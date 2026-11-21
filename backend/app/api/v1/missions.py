"""Relief Missions Management and Resource Tracking API Router."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db import get_db
from app.models import ReliefMission, ResourceTransaction
from app.schemas import (
    ReliefMissionCreate,
    ReliefMissionOut,
    ReliefMissionStatusUpdate,
    ResourceTransactionOut,
)
from app.services.missions import (
    create_mission,
    list_relief_missions,
    update_mission_status,
)

router = APIRouter(prefix="/missions", tags=["missions"])


@router.post("", response_model=ReliefMissionOut, status_code=status.HTTP_201_CREATED)
async def create_relief_mission(
    payload: ReliefMissionCreate,
    db: AsyncSession = Depends(get_db),
):
    """Dispatch a new relief mission with route calculation and stock reservation."""
    try:
        mission = await create_mission(db, payload)
        # Fetch with relationships
        stmt = (
            select(ReliefMission)
            .where(ReliefMission.id == mission.id)
            .options(
                selectinload(ReliefMission.depot),
                selectinload(ReliefMission.prediction),
            )
        )
        res = await db.execute(stmt)
        full_mission = res.scalar_one()

        return ReliefMissionOut(
            id=full_mission.id,
            mission_code=full_mission.mission_code,
            plan_id=full_mission.plan_id,
            depot_id=full_mission.depot_id,
            depot_name=full_mission.depot.name if full_mission.depot else "Regional Depot",
            prediction_id=full_mission.prediction_id,
            zone_identifier=full_mission.prediction.zone_identifier if full_mission.prediction else "Sector",
            status=full_mission.status,
            team_leader=full_mission.team_leader,
            vehicle_type=full_mission.vehicle_type,
            vehicle_identifier=full_mission.vehicle_identifier,
            manifest=full_mission.manifest or {},
            route_geojson=full_mission.route_geojson,
            distance_km=full_mission.distance_km,
            est_duration_hours=full_mission.est_duration_hours,
            notes=full_mission.notes,
            dispatched_at=full_mission.dispatched_at,
            delivered_at=full_mission.delivered_at,
            completed_at=full_mission.completed_at,
            created_at=full_mission.created_at,
            updated_at=full_mission.updated_at,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))


@router.get("", response_model=list[ReliefMissionOut])
async def list_missions(
    status: str | None = None,
    depot_id: UUID | None = None,
    limit: int = Query(default=100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
):
    """List relief missions across depots and operational sectors."""
    return await list_relief_missions(db, status=status, depot_id=depot_id, limit=limit)


@router.get("/{mission_id}", response_model=ReliefMissionOut)
async def get_mission(
    mission_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Retrieve full mission manifest, route GeoJSON LineString, and status."""
    stmt = (
        select(ReliefMission)
        .where(ReliefMission.id == mission_id)
        .options(
            selectinload(ReliefMission.depot),
            selectinload(ReliefMission.prediction),
        )
    )
    res = await db.execute(stmt)
    mission = res.scalar_one_or_none()
    if not mission:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mission not found.")

    return ReliefMissionOut(
        id=mission.id,
        mission_code=mission.mission_code,
        plan_id=mission.plan_id,
        depot_id=mission.depot_id,
        depot_name=mission.depot.name if mission.depot else "Regional Depot",
        prediction_id=mission.prediction_id,
        zone_identifier=mission.prediction.zone_identifier if mission.prediction else "Sector",
        status=mission.status,
        team_leader=mission.team_leader,
        vehicle_type=mission.vehicle_type,
        vehicle_identifier=mission.vehicle_identifier,
        manifest=mission.manifest or {},
        route_geojson=mission.route_geojson,
        distance_km=mission.distance_km,
        est_duration_hours=mission.est_duration_hours,
        notes=mission.notes,
        dispatched_at=mission.dispatched_at,
        delivered_at=mission.delivered_at,
        completed_at=mission.completed_at,
        created_at=mission.created_at,
        updated_at=mission.updated_at,
    )


@router.patch("/{mission_id}/status", response_model=ReliefMissionOut)
async def update_status(
    mission_id: UUID,
    payload: ReliefMissionStatusUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Advance mission operational status (ASSIGNED -> DISPATCHED -> IN_TRANSIT -> DELIVERED -> COMPLETED)."""
    try:
        updated = await update_mission_status(db, mission_id, payload)
        # Fetch with relationships
        stmt = (
            select(ReliefMission)
            .where(ReliefMission.id == updated.id)
            .options(
                selectinload(ReliefMission.depot),
                selectinload(ReliefMission.prediction),
            )
        )
        res = await db.execute(stmt)
        full_mission = res.scalar_one()

        return ReliefMissionOut(
            id=full_mission.id,
            mission_code=full_mission.mission_code,
            plan_id=full_mission.plan_id,
            depot_id=full_mission.depot_id,
            depot_name=full_mission.depot.name if full_mission.depot else "Regional Depot",
            prediction_id=full_mission.prediction_id,
            zone_identifier=full_mission.prediction.zone_identifier if full_mission.prediction else "Sector",
            status=full_mission.status,
            team_leader=full_mission.team_leader,
            vehicle_type=full_mission.vehicle_type,
            vehicle_identifier=full_mission.vehicle_identifier,
            manifest=full_mission.manifest or {},
            route_geojson=full_mission.route_geojson,
            distance_km=full_mission.distance_km,
            est_duration_hours=full_mission.est_duration_hours,
            notes=full_mission.notes,
            dispatched_at=full_mission.dispatched_at,
            delivered_at=full_mission.delivered_at,
            completed_at=full_mission.completed_at,
            created_at=full_mission.created_at,
            updated_at=full_mission.updated_at,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))


@router.get("/{mission_id}/transactions", response_model=list[ResourceTransactionOut])
async def get_mission_transactions(
    mission_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Retrieve full audit trail of resource state transitions for this mission."""
    stmt = (
        select(ResourceTransaction)
        .where(ResourceTransaction.mission_id == mission_id)
        .order_by(ResourceTransaction.created_at.asc())
    )
    res = await db.execute(stmt)
    txs = res.scalars().all()
    return txs

