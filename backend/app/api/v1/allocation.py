"""Resource Allocation Optimization API Router."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.v1.utils import geom_to_geojson
from app.db import get_db
from app.models import AllocationDetail, AllocationPlan
from app.schemas import (
    AllocationDetailOut,
    AllocationPlanOut,
    AllocationRunRequest,
    ReliefMissionOut,
)
from app.services.allocation import run_resource_allocation_optimization
from app.services.missions import auto_create_missions_from_plan

router = APIRouter(prefix="/allocation", tags=["allocation"])


def _extract_coords(point_geom) -> tuple[float, float]:
    geojson = geom_to_geojson(point_geom)
    if geojson and "coordinates" in geojson:
        coords = geojson["coordinates"]
        if isinstance(coords[0], (int, float)):
            return float(coords[1]), float(coords[0])
    return 20.5937, 78.9629


@router.post("/run", response_model=AllocationPlanOut)
async def run_allocation(
    payload: AllocationRunRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Execute Google OR-Tools SCIP optimization matching available depot inventories
    to disaster zone demands while respecting operational and road constraints.
    """
    try:
        plan = await run_resource_allocation_optimization(
            db,
            event_id=payload.event_id,
            planning_horizon_days=payload.planning_horizon_days,
            distance_penalty_weight=payload.distance_penalty_weight,
            enforce_accessibility=payload.enforce_accessibility,
            min_demand_fulfillment_ratio=payload.min_demand_fulfillment_ratio,
        )

        # Re-fetch plan with details and relations
        stmt = (
            select(AllocationPlan)
            .where(AllocationPlan.id == plan.id)
            .options(
                selectinload(AllocationPlan.details).selectinload(AllocationDetail.depot),
                selectinload(AllocationPlan.details).selectinload(AllocationDetail.prediction),
            )
        )
        res = await db.execute(stmt)
        full_plan = res.scalar_one()

        details_out = []
        for d in full_plan.details:
            d_lat, d_lon = _extract_coords(d.depot.location) if d.depot else (None, None)
            details_out.append(
                AllocationDetailOut(
                    id=d.id,
                    plan_id=d.plan_id,
                    depot_id=d.depot_id,
                    depot_name=d.depot.name if d.depot else "Regional Depot",
                    depot_latitude=d_lat,
                    depot_longitude=d_lon,
                    prediction_id=d.prediction_id,
                    zone_identifier=d.prediction.zone_identifier if d.prediction else "Sector",
                    resource_type=d.resource_type,
                    allocated_quantity=d.allocated_quantity,
                    demanded_quantity=d.demanded_quantity,
                    shortage_quantity=d.shortage_quantity,
                    distance_km=d.distance_km,
                    est_duration_hours=d.est_duration_hours,
                    accessibility_status=d.accessibility_status,
                    created_at=d.created_at,
                )
            )

        return AllocationPlanOut(
            id=full_plan.id,
            event_id=full_plan.event_id,
            solver_status=full_plan.solver_status,
            objective_value=full_plan.objective_value,
            total_demand_satisfied_pct=full_plan.total_demand_satisfied_pct,
            execution_time_ms=full_plan.execution_time_ms,
            solver_parameters=full_plan.solver_parameters,
            created_at=full_plan.created_at,
            details=details_out,
        )

    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Optimization error: {str(exc)}")


@router.get("/plans", response_model=list[AllocationPlanOut])
async def list_allocation_plans(
    event_id: UUID | None = None,
    limit: int = Query(default=10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve historical optimization plans and allocations."""
    stmt = (
        select(AllocationPlan)
        .order_by(AllocationPlan.created_at.desc())
        .limit(limit)
        .options(
            selectinload(AllocationPlan.details).selectinload(AllocationDetail.depot),
            selectinload(AllocationPlan.details).selectinload(AllocationDetail.prediction),
        )
    )
    if event_id:
        stmt = stmt.where(AllocationPlan.event_id == event_id)

    res = await db.execute(stmt)
    plans = res.scalars().all()

    out = []
    for p in plans:
        details_out = []
        for d in p.details:
            d_lat, d_lon = _extract_coords(d.depot.location) if d.depot else (None, None)
            details_out.append(
                AllocationDetailOut(
                    id=d.id,
                    plan_id=d.plan_id,
                    depot_id=d.depot_id,
                    depot_name=d.depot.name if d.depot else "Regional Depot",
                    depot_latitude=d_lat,
                    depot_longitude=d_lon,
                    prediction_id=d.prediction_id,
                    zone_identifier=d.prediction.zone_identifier if d.prediction else "Sector",
                    resource_type=d.resource_type,
                    allocated_quantity=d.allocated_quantity,
                    demanded_quantity=d.demanded_quantity,
                    shortage_quantity=d.shortage_quantity,
                    distance_km=d.distance_km,
                    est_duration_hours=d.est_duration_hours,
                    accessibility_status=d.accessibility_status,
                    created_at=d.created_at,
                )
            )

        out.append(
            AllocationPlanOut(
                id=p.id,
                event_id=p.event_id,
                solver_status=p.solver_status,
                objective_value=p.objective_value,
                total_demand_satisfied_pct=p.total_demand_satisfied_pct,
                execution_time_ms=p.execution_time_ms,
                solver_parameters=p.solver_parameters,
                created_at=p.created_at,
                details=details_out,
            )
        )
    return out


@router.post("/plans/{plan_id}/create-missions", response_model=list[ReliefMissionOut])
async def create_missions_for_plan(
    plan_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Auto-generate relief dispatch missions for all allocated supplies in the plan."""
    missions = await auto_create_missions_from_plan(db, plan_id)
    return missions

