"""Resource Allocation Optimization Engine using Google OR-Tools (MILP/SCIP)."""

import logging
import time
from typing import Any
from uuid import UUID

from ortools.linear_solver import pywraplp
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.v1.utils import geom_to_geojson
from app.models import (
    AllocationDetail,
    AllocationPlan,
    Depot,
    DisasterEvent,
    GridCell,
    ImpactZone,
    InventoryItem,
    PriorityOverride,
    ResourcePrediction,
)
from app.services.routing import routing_engine

logger = logging.getLogger(__name__)

# Resource category configuration and critical weights
RESOURCE_CONFIG = {
    "food_packets": {
        "attr_predicted": "food_packets_predicted",
        "weight": 1.2,
        "is_integer": True,
        "display_name": "Food Packets",
        "unit": "packets",
    },
    "water": {
        "attr_predicted": "water_liters_predicted",
        "weight": 1.4,
        "is_integer": True,
        "display_name": "Water (Liters)",
        "unit": "liters",
    },
    "medical_kits": {
        "attr_predicted": "medical_kits_predicted",
        "weight": 1.5,
        "is_integer": True,
        "display_name": "Medical Kits",
        "unit": "kits",
    },
    "shelter_spaces": {
        "attr_predicted": "shelter_spaces_predicted",
        "weight": 1.0,
        "is_integer": True,
        "display_name": "Shelter Spaces",
        "unit": "spaces",
    },
}


def _extract_coords(point_geom) -> tuple[float, float]:
    """Extract (latitude, longitude) from a geometry element."""
    geojson = geom_to_geojson(point_geom)
    if geojson and "coordinates" in geojson:
        coords = geojson["coordinates"]
        if isinstance(coords[0], (int, float)):
            return float(coords[1]), float(coords[0])
        elif isinstance(coords[0], list):
            # Polygon / centroid approximation
            flat = coords[0]
            avg_lon = sum(c[0] for c in flat) / len(flat)
            avg_lat = sum(c[1] for c in flat) / len(flat)
            return avg_lat, avg_lon
    return 20.5937, 78.9629  # Default centroid of India


async def run_resource_allocation_optimization(
    db: AsyncSession,
    event_id: UUID | None = None,
    planning_horizon_days: int = 3,
    distance_penalty_weight: float = 0.0001,
    enforce_accessibility: bool = True,
    min_demand_fulfillment_ratio: float = 0.0,
) -> AllocationPlan:
    """
    Formulate and solve MILP optimization matching available depot inventories
    to disaster zone demands while respecting operational and road constraints.
    """
    start_time = time.perf_counter()

    # 1. Fetch active depots with inventories
    depot_stmt = (
        select(Depot)
        .where(Depot.status == "active")
        .options(
            selectinload(Depot.inventory_items).selectinload(InventoryItem.resource_type)
        )
    )
    depot_res = await db.execute(depot_stmt)
    depots = depot_res.scalars().all()

    if not depots:
        raise ValueError("No active relief depots found in the database.")

    # Build depot stock map: depot_id -> {resource_type_name: available_quantity}
    # and depot coordinates map: depot_id -> (lat, lon)
    depot_stocks: dict[UUID, dict[str, int]] = {}
    depot_coords: dict[UUID, tuple[float, float]] = {}
    depot_info: dict[UUID, Depot] = {}

    for d in depots:
        depot_info[d.id] = d
        lat, lon = _extract_coords(d.location)
        depot_coords[d.id] = (lat, lon)
        depot_stocks[d.id] = {k: 0 for k in RESOURCE_CONFIG.keys()}

        for item in d.inventory_items:
            res_name = item.resource_type.name.lower()
            # Standardize names: "water" or "water_liters" -> "water"
            if res_name in ["water", "water_liters"]:
                depot_stocks[d.id]["water"] = item.quantity
            elif res_name in depot_stocks[d.id]:
                depot_stocks[d.id][res_name] = item.quantity

    # 2. Fetch candidate predictions
    pred_stmt = select(ResourcePrediction)
    if event_id:
        pred_stmt = pred_stmt.where(ResourcePrediction.event_id == event_id)
    pred_stmt = pred_stmt.order_by(ResourcePrediction.urgency_score.desc())

    pred_res = await db.execute(pred_stmt)
    predictions = pred_res.scalars().all()

    if not predictions:
        raise ValueError(
            "No predicted resource demands found"
            + (f" for event {event_id}." if event_id else " in the database.")
        )

    # 3. Check for active Priority Overrides
    pred_ids = [p.id for p in predictions]
    override_stmt = (
        select(PriorityOverride)
        .where(PriorityOverride.prediction_id.in_(pred_ids))
        .where(PriorityOverride.is_active.is_(True))
    )
    override_res = await db.execute(override_stmt)
    overrides = {ov.prediction_id: ov for ov in override_res.scalars().all()}

    # 4. Extract zone coordinates, effective urgency, and demands
    zone_demands: dict[UUID, dict[str, int]] = {}
    zone_urgency: dict[UUID, float] = {}
    zone_urgency_class: dict[UUID, str] = {}
    zone_coords: dict[UUID, tuple[float, float]] = {}
    zone_accessibility: dict[UUID, float] = {}

    for p in predictions:
        # Effective urgency (with commander override if present)
        if p.id in overrides:
            ov = overrides[p.id]
            eff_urgency = ov.overridden_urgency_score
            eff_class = ov.overridden_urgency_class
        else:
            eff_urgency = p.urgency_score
            eff_class = p.urgency_class

        zone_urgency[p.id] = max(1.0, min(100.0, eff_urgency))
        zone_urgency_class[p.id] = eff_class
        zone_accessibility[p.id] = p.road_accessibility

        # Extract coordinates
        coords = (20.5937, 78.9629)
        if p.impact_zone_id:
            iz_res = await db.execute(
                select(ImpactZone).where(ImpactZone.id == p.impact_zone_id)
            )
            iz = iz_res.scalar_one_or_none()
            if iz:
                coords = _extract_coords(iz.geometry)
        elif p.grid_cell_id:
            gc_res = await db.execute(
                select(GridCell).where(GridCell.id == p.grid_cell_id)
            )
            gc = gc_res.scalar_one_or_none()
            if gc:
                coords = _extract_coords(gc.geometry)
        else:
            # Fall back to event geometry
            ev_res = await db.execute(
                select(DisasterEvent).where(DisasterEvent.id == p.event_id)
            )
            ev = ev_res.scalar_one_or_none()
            if ev and ev.geometry:
                coords = _extract_coords(ev.geometry)

        zone_coords[p.id] = coords

        # Read demanded quantities
        zone_demands[p.id] = {
            "food_packets": getattr(p, RESOURCE_CONFIG["food_packets"]["attr_predicted"]) or 0,
            "water": getattr(p, RESOURCE_CONFIG["water"]["attr_predicted"]) or 0,
            "medical_kits": getattr(p, RESOURCE_CONFIG["medical_kits"]["attr_predicted"]) or 0,
            "shelter_spaces": getattr(p, RESOURCE_CONFIG["shelter_spaces"]["attr_predicted"]) or 0,
        }

    # 5. Precompute routing distances and leg details
    routing_details: dict[tuple[UUID, UUID], dict[str, Any]] = {}
    for d_id, (d_lat, d_lon) in depot_coords.items():
        for z_id, (z_lat, z_lon) in zone_coords.items():
            acc = zone_accessibility[z_id]
            route_info = routing_engine.calculate_delivery_route(
                d_lat, d_lon, z_lat, z_lon, road_accessibility=acc
            )
            routing_details[(d_id, z_id)] = route_info

    # 6. Formulate OR-Tools MILP Model (SCIP Solver)
    solver = pywraplp.Solver.CreateSolver("SCIP")
    if not solver:
        # Fallback to CBC or GLOP if SCIP is unavailable
        solver = pywraplp.Solver.CreateSolver("CBC") or pywraplp.Solver.CreateSolver("GLOP")

    if not solver:
        raise RuntimeError("No suitable linear programming solver found in Google OR-Tools.")

    # Decision variables: x[d_id, z_id, resource]
    x_vars: dict[tuple[UUID, UUID, str], Any] = {}

    for d_id in depot_stocks.keys():
        for z_id in zone_demands.keys():
            z_acc = zone_accessibility[z_id]
            for r_key, r_cfg in RESOURCE_CONFIG.items():
                max_possible = min(depot_stocks[d_id][r_key], zone_demands[z_id][r_key])

                # Check road accessibility guard: if road is completely impassable (< 0.2)
                if enforce_accessibility and z_acc < 0.2:
                    var = solver.IntVar(0, 0, f"x_{d_id}_{z_id}_{r_key}")
                else:
                    if r_cfg["is_integer"]:
                        var = solver.IntVar(0, max_possible, f"x_{d_id}_{z_id}_{r_key}")
                    else:
                        var = solver.NumVar(0.0, float(max_possible), f"x_{d_id}_{z_id}_{r_key}")

                x_vars[(d_id, z_id, r_key)] = var

    # Constraint 1: Depot stock capacity
    # sum_{z} x[d, z, r] <= Inventory[d, r]
    for d_id in depot_stocks.keys():
        for r_key in RESOURCE_CONFIG.keys():
            depot_limit = depot_stocks[d_id][r_key]
            solver.Add(
                solver.Sum(x_vars[(d_id, z_id, r_key)] for z_id in zone_demands.keys())
                <= depot_limit
            )

    # Constraint 2: Zone demand ceiling
    # sum_{d} x[d, z, r] <= Demand[z, r]
    for z_id in zone_demands.keys():
        for r_key in RESOURCE_CONFIG.keys():
            z_demand = zone_demands[z_id][r_key]
            solver.Add(
                solver.Sum(x_vars[(d_id, z_id, r_key)] for d_id in depot_stocks.keys())
                <= z_demand
            )

    # Objective Function
    # Maximize urgency-weighted fulfillment minus transit distance penalty
    objective = solver.Objective()
    for (d_id, z_id, r_key), var in x_vars.items():
        r_weight = RESOURCE_CONFIG[r_key]["weight"]
        urgency_factor = zone_urgency[z_id] / 100.0
        dist_km = routing_details[(d_id, z_id)]["distance_km"]
        acc = max(0.1, zone_accessibility[z_id])

        # Distance penalty: penalize routing over long distance and poor roads
        dist_cost = distance_penalty_weight * (dist_km / (1000.0 * acc))

        net_coeff = (r_weight * urgency_factor) - dist_cost
        objective.SetCoefficient(var, net_coeff)

    objective.SetMaximization()

    # Solve
    solver_status_code = solver.Solve()
    execution_time_ms = round((time.perf_counter() - start_time) * 1000.0, 2)

    status_str_map = {
        pywraplp.Solver.OPTIMAL: "OPTIMAL",
        pywraplp.Solver.FEASIBLE: "FEASIBLE",
        pywraplp.Solver.INFEASIBLE: "INFEASIBLE",
        pywraplp.Solver.UNBOUNDED: "UNBOUNDED",
        pywraplp.Solver.ABNORMAL: "ABNORMAL",
        pywraplp.Solver.NOT_SOLVED: "NOT_SOLVED",
    }
    solver_status = status_str_map.get(solver_status_code, "COMPLETED")
    obj_val = round(objective.Value(), 2) if solver_status in ["OPTIMAL", "FEASIBLE"] else 0.0

    # 7. Collect results and calculate fulfillment ratios
    total_demanded = 0
    total_allocated = 0
    details_to_create: list[AllocationDetail] = []

    # Create AllocationPlan record
    plan = AllocationPlan(
        event_id=event_id,
        solver_status=solver_status,
        objective_value=obj_val,
        total_demand_satisfied_pct=0.0,
        execution_time_ms=execution_time_ms,
        solver_parameters={
            "distance_penalty_weight": distance_penalty_weight,
            "enforce_accessibility": enforce_accessibility,
            "min_demand_fulfillment_ratio": min_demand_fulfillment_ratio,
            "zones_count": len(predictions),
            "depots_count": len(depots),
            "planning_horizon_days": planning_horizon_days,
        },
    )
    db.add(plan)
    await db.flush()  # Obtain plan.id

    for z_id in zone_demands.keys():
        _ = next(p for p in predictions if p.id == z_id)
        for r_key in RESOURCE_CONFIG.keys():
            demanded_qty = zone_demands[z_id][r_key]
            total_demanded += demanded_qty

            # Total allocated to this zone from all depots
            total_res_allocated_to_zone = 0
            for d_id in depot_stocks.keys():
                var = x_vars[(d_id, z_id, r_key)]
                alloc_qty = int(round(var.solution_value())) if solver_status in ["OPTIMAL", "FEASIBLE"] else 0
                total_res_allocated_to_zone += alloc_qty
                total_allocated += alloc_qty

                # Create detail record if there was an allocation OR if this is the primary nearest depot
                route_info = routing_details[(d_id, z_id)]
                if alloc_qty > 0:
                    detail = AllocationDetail(
                        plan_id=plan.id,
                        depot_id=d_id,
                        prediction_id=z_id,
                        resource_type=r_key,
                        allocated_quantity=alloc_qty,
                        demanded_quantity=demanded_qty,
                        shortage_quantity=max(0, demanded_qty - total_res_allocated_to_zone),
                        distance_km=route_info["distance_km"],
                        est_duration_hours=route_info["est_duration_hours"],
                        accessibility_status=route_info["accessibility_status"],
                    )
                    details_to_create.append(detail)

            # If no depot allocated anything to this demand, log a zero-allocation record with nearest depot
            if total_res_allocated_to_zone == 0 and demanded_qty > 0:
                nearest_d_id = min(
                    depot_stocks.keys(),
                    key=lambda d: routing_details[(d, z_id)]["distance_km"],
                )
                route_info = routing_details[(nearest_d_id, z_id)]
                detail = AllocationDetail(
                    plan_id=plan.id,
                    depot_id=nearest_d_id,
                    prediction_id=z_id,
                    resource_type=r_key,
                    allocated_quantity=0,
                    demanded_quantity=demanded_qty,
                    shortage_quantity=demanded_qty,
                    distance_km=route_info["distance_km"],
                    est_duration_hours=route_info["est_duration_hours"],
                    accessibility_status=route_info["accessibility_status"],
                )
                details_to_create.append(detail)

    # Overall fulfillment percentage
    sat_pct = round((total_allocated / total_demanded * 100.0), 1) if total_demanded > 0 else 100.0
    plan.total_demand_satisfied_pct = sat_pct

    for det in details_to_create:
        db.add(det)

    await db.commit()
    await db.refresh(plan)

    logger.info(
        "Optimization solved with status %s in %.2f ms. Satisfied %.1f%% of demand.",
        solver_status,
        execution_time_ms,
        sat_pct,
    )
    return plan

