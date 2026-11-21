"""Relief Mission Management and Multi-State Resource Tracking Service."""

import datetime
import logging
import uuid
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.v1.utils import geom_to_geojson
from app.models import (
    AllocationDetail,
    Depot,
    GridCell,
    ImpactZone,
    InventoryItem,
    ReliefMission,
    ResourcePrediction,
    ResourceTransaction,
)
from app.schemas import ReliefMissionCreate, ReliefMissionOut, ReliefMissionStatusUpdate
from app.services.routing import routing_engine

logger = logging.getLogger(__name__)


def _extract_coords(point_geom) -> tuple[float, float]:
    """Helper to extract (latitude, longitude) from geometry."""
    geojson = geom_to_geojson(point_geom)
    if geojson and "coordinates" in geojson:
        coords = geojson["coordinates"]
        if isinstance(coords[0], (int, float)):
            return float(coords[1]), float(coords[0])
        elif isinstance(coords[0], list):
            flat = coords[0]
            avg_lon = sum(c[0] for c in flat) / len(flat)
            avg_lat = sum(c[1] for c in flat) / len(flat)
            return avg_lat, avg_lon
    return 20.5937, 78.9629


async def create_mission(
    db: AsyncSession,
    payload: ReliefMissionCreate,
) -> ReliefMission:
    """Create a new relief dispatch mission with precomputed route and inventory reservation."""
    # 1. Fetch depot
    depot_res = await db.execute(
        select(Depot)
        .where(Depot.id == payload.depot_id)
        .options(selectinload(Depot.inventory_items).selectinload(InventoryItem.resource_type))
    )
    depot = depot_res.scalar_one_or_none()
    if not depot:
        raise ValueError(f"Depot with ID {payload.depot_id} not found.")

    # 2. Fetch destination prediction
    pred_res = await db.execute(
        select(ResourcePrediction).where(ResourcePrediction.id == payload.prediction_id)
    )
    prediction = pred_res.scalar_one_or_none()
    if not prediction:
        raise ValueError(f"Target zone prediction with ID {payload.prediction_id} not found.")

    # 3. Extract coordinates
    depot_lat, depot_lon = _extract_coords(depot.location)

    zone_coords = (20.5937, 78.9629)
    if prediction.impact_zone_id:
        iz_res = await db.execute(select(ImpactZone).where(ImpactZone.id == prediction.impact_zone_id))
        iz = iz_res.scalar_one_or_none()
        if iz:
            zone_coords = _extract_coords(iz.geometry)
    elif prediction.grid_cell_id:
        gc_res = await db.execute(select(GridCell).where(GridCell.id == prediction.grid_cell_id))
        gc = gc_res.scalar_one_or_none()
        if gc:
            zone_coords = _extract_coords(gc.geometry)

    # 4. Calculate delivery route
    route_calc = routing_engine.calculate_delivery_route(
        origin_lat=depot_lat,
        origin_lon=depot_lon,
        dest_lat=zone_coords[0],
        dest_lon=zone_coords[1],
        road_accessibility=prediction.road_accessibility,
    )

    # 5. Generate unique mission code e.g. MSN-2026-DEL-1A4F
    now_year = datetime.datetime.now(datetime.timezone.utc).year
    depot_prefix = depot.name[:3].upper().replace(" ", "")
    code_suffix = uuid.uuid4().hex[:4].upper()
    mission_code = f"MSN-{now_year}-{depot_prefix}-{code_suffix}"

    # 6. Verify depot stock against manifest
    depot_stock_by_name = {
        item.resource_type.name.lower(): item.quantity
        for item in depot.inventory_items
    }
    for res_name, requested_qty in payload.manifest.items():
        norm_name = "water" if res_name.lower() in ["water", "water_liters"] else res_name.lower()
        curr_stock = depot_stock_by_name.get(norm_name, 0)
        if requested_qty > curr_stock:
            raise ValueError(
                f"Insufficient stock at depot '{depot.name}' for '{res_name}'. "
                f"Requested: {requested_qty}, Available: {curr_stock}"
            )

    # 7. Create ReliefMission
    mission = ReliefMission(
        mission_code=mission_code,
        plan_id=payload.plan_id,
        depot_id=payload.depot_id,
        prediction_id=payload.prediction_id,
        status="ASSIGNED",
        team_leader=payload.team_leader or "Field Operations Dispatch Lead",
        vehicle_type=payload.vehicle_type,
        vehicle_identifier=payload.vehicle_identifier or f"LOG-{uuid.uuid4().hex[:4].upper()}",
        manifest=payload.manifest,
        route_geojson=route_calc["geojson"],
        distance_km=route_calc["distance_km"],
        est_duration_hours=route_calc["est_duration_hours"],
        notes=payload.notes,
    )
    db.add(mission)
    await db.flush()

    # 8. Record reservation transactions
    for res_name, qty in payload.manifest.items():
        if qty > 0:
            tx = ResourceTransaction(
                depot_id=depot.id,
                mission_id=mission.id,
                resource_type=res_name,
                quantity=qty,
                state_from="Available",
                state_to="Reserved",
                reference_note=f"Stock reserved for mission {mission.mission_code}",
            )
            db.add(tx)

    await db.commit()
    await db.refresh(mission)
    return mission


async def update_mission_status(
    db: AsyncSession,
    mission_id: UUID,
    payload: ReliefMissionStatusUpdate,
) -> ReliefMission:
    """Transition mission through its operational lifecycle with transactional stock updates."""
    stmt = (
        select(ReliefMission)
        .where(ReliefMission.id == mission_id)
        .options(
            selectinload(ReliefMission.depot).selectinload(Depot.inventory_items).selectinload(InventoryItem.resource_type),
            selectinload(ReliefMission.prediction),
        )
    )
    res = await db.execute(stmt)
    mission = res.scalar_one_or_none()
    if not mission:
        raise ValueError(f"Mission with ID {mission_id} not found.")

    new_status = payload.status.upper()
    old_status = mission.status.upper()
    now_utc = datetime.datetime.now(datetime.timezone.utc)

    if new_status == old_status:
        if payload.notes:
            mission.notes = (mission.notes or "") + f"\n[{now_utc.isoformat()}] " + payload.notes
            await db.commit()
        return mission

    # Lifecycle state transition
    if new_status == "DISPATCHED":
        mission.dispatched_at = now_utc
        # Deduct actual physical stock from depot InventoryItem
        manifest = mission.manifest or {}
        for item in mission.depot.inventory_items:
            norm_name = "water" if item.resource_type.name.lower() in ["water", "water_liters"] else item.resource_type.name.lower()
            for m_key, m_qty in manifest.items():
                m_norm = "water" if m_key.lower() in ["water", "water_liters"] else m_key.lower()
                if norm_name == m_norm:
                    item.quantity = max(0, item.quantity - m_qty)
                    tx = ResourceTransaction(
                        depot_id=mission.depot_id,
                        mission_id=mission.id,
                        resource_type=m_key,
                        quantity=m_qty,
                        state_from="Reserved",
                        state_to="Dispatched",
                        reference_note=f"Dispatched with fleet unit {mission.vehicle_identifier}",
                    )
                    db.add(tx)

    elif new_status == "IN_TRANSIT":
        # Vehicle en route
        manifest = mission.manifest or {}
        for m_key, m_qty in manifest.items():
            tx = ResourceTransaction(
                depot_id=mission.depot_id,
                mission_id=mission.id,
                resource_type=m_key,
                quantity=m_qty,
                state_from="Dispatched",
                state_to="In Transit",
                reference_note="Convoy active on transport corridor",
            )
            db.add(tx)

    elif new_status == "DELIVERED":
        mission.delivered_at = now_utc
        manifest = mission.manifest or {}
        for m_key, m_qty in manifest.items():
            tx = ResourceTransaction(
                depot_id=mission.depot_id,
                mission_id=mission.id,
                resource_type=m_key,
                quantity=m_qty,
                state_from="In Transit",
                state_to="Delivered",
                reference_note="Delivered to target disaster zone field staging",
            )
            db.add(tx)

    elif new_status == "COMPLETED":
        mission.completed_at = now_utc
        manifest = mission.manifest or {}
        for m_key, m_qty in manifest.items():
            tx = ResourceTransaction(
                depot_id=mission.depot_id,
                mission_id=mission.id,
                resource_type=m_key,
                quantity=m_qty,
                state_from="Delivered",
                state_to="Fulfilled",
                reference_note="Mission verified complete. Demands marked fulfilled.",
            )
            db.add(tx)

    elif new_status == "CANCELLED":
        # If cancelled while reserved (before dispatch), release reservation
        if old_status in ["PLANNED", "ASSIGNED"]:
            manifest = mission.manifest or {}
            for m_key, m_qty in manifest.items():
                tx = ResourceTransaction(
                    depot_id=mission.depot_id,
                    mission_id=mission.id,
                    resource_type=m_key,
                    quantity=m_qty,
                    state_from="Reserved",
                    state_to="Available",
                    reference_note="Mission cancelled. Reserved stock returned to pool.",
                )
                db.add(tx)

    mission.status = new_status
    if payload.notes:
        mission.notes = (mission.notes or "") + f"\n[{now_utc.isoformat()}] Status -> {new_status}: " + payload.notes

    await db.commit()
    await db.refresh(mission)
    return mission


async def list_relief_missions(
    db: AsyncSession,
    status: str | None = None,
    depot_id: UUID | None = None,
    limit: int = 100,
) -> list[ReliefMissionOut]:
    """List relief missions with linked depot names and zone identifiers."""
    stmt = (
        select(ReliefMission)
        .options(
            selectinload(ReliefMission.depot),
            selectinload(ReliefMission.prediction),
        )
        .order_by(ReliefMission.created_at.desc())
        .limit(limit)
    )
    if status:
        stmt = stmt.where(ReliefMission.status == status.upper())
    if depot_id:
        stmt = stmt.where(ReliefMission.depot_id == depot_id)

    res = await db.execute(stmt)
    missions = res.scalars().all()

    out = []
    for m in missions:
        out.append(
            ReliefMissionOut(
                id=m.id,
                mission_code=m.mission_code,
                plan_id=m.plan_id,
                depot_id=m.depot_id,
                depot_name=m.depot.name if m.depot else "Unknown Depot",
                prediction_id=m.prediction_id,
                zone_identifier=m.prediction.zone_identifier if m.prediction else "Unknown Zone",
                status=m.status,
                team_leader=m.team_leader,
                vehicle_type=m.vehicle_type,
                vehicle_identifier=m.vehicle_identifier,
                manifest=m.manifest or {},
                route_geojson=m.route_geojson,
                distance_km=m.distance_km,
                est_duration_hours=m.est_duration_hours,
                notes=m.notes,
                dispatched_at=m.dispatched_at,
                delivered_at=m.delivered_at,
                completed_at=m.completed_at,
                created_at=m.created_at,
                updated_at=m.updated_at,
            )
        )
    return out


async def auto_create_missions_from_plan(
    db: AsyncSession,
    plan_id: UUID,
) -> list[ReliefMissionOut]:
    """Generate dispatch missions grouping all positive resource allocations by (depot, zone)."""
    # Fetch plan details
    det_stmt = (
        select(AllocationDetail)
        .where(AllocationDetail.plan_id == plan_id)
        .where(AllocationDetail.allocated_quantity > 0)
    )
    det_res = await db.execute(det_stmt)
    details = det_res.scalars().all()

    # Group by (depot_id, prediction_id)
    grouped: dict[tuple[UUID, UUID], dict[str, int]] = {}
    for d in details:
        key = (d.depot_id, d.prediction_id)
        if key not in grouped:
            grouped[key] = {}
        grouped[key][d.resource_type] = d.allocated_quantity

    created_missions = []
    for (d_id, p_id), manifest in grouped.items():
        payload = ReliefMissionCreate(
            plan_id=plan_id,
            depot_id=d_id,
            prediction_id=p_id,
            vehicle_type="Heavy Cargo Truck",
            manifest=manifest,
            notes=f"Auto-generated from Allocation Plan {str(plan_id)[:8]}",
        )
        try:
            m = await create_mission(db, payload)
            # Re-fetch with relations
            m_res = await db.execute(
                select(ReliefMission)
                .where(ReliefMission.id == m.id)
                .options(selectinload(ReliefMission.depot), selectinload(ReliefMission.prediction))
            )
            m_full = m_res.scalar_one()
            created_missions.append(
                ReliefMissionOut(
                    id=m_full.id,
                    mission_code=m_full.mission_code,
                    plan_id=m_full.plan_id,
                    depot_id=m_full.depot_id,
                    depot_name=m_full.depot.name if m_full.depot else "Unknown Depot",
                    prediction_id=m_full.prediction_id,
                    zone_identifier=m_full.prediction.zone_identifier if m_full.prediction else "Unknown Zone",
                    status=m_full.status,
                    team_leader=m_full.team_leader,
                    vehicle_type=m_full.vehicle_type,
                    vehicle_identifier=m_full.vehicle_identifier,
                    manifest=m_full.manifest or {},
                    route_geojson=m_full.route_geojson,
                    distance_km=m_full.distance_km,
                    est_duration_hours=m_full.est_duration_hours,
                    notes=m_full.notes,
                    dispatched_at=m_full.dispatched_at,
                    delivered_at=m_full.delivered_at,
                    completed_at=m_full.completed_at,
                    created_at=m_full.created_at,
                    updated_at=m_full.updated_at,
                )
            )
        except Exception as exc:
            logger.warning("Could not auto-create mission for depot %s to zone %s: %s", d_id, p_id, exc)

    return created_missions

