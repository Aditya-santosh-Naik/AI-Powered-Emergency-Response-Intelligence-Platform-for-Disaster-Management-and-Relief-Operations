"""Impact zones and grid cells API router."""

from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.utils import geom_to_geojson
from app.db import get_db
from app.models import GridCell, ImpactZone
from app.schemas import GridCellOut, ImpactZoneOut

router = APIRouter(tags=["zones"])


@router.get("/events/{event_id}/impact-zones", response_model=list[ImpactZoneOut])
async def get_event_impact_zones(event_id: UUID, db: AsyncSession = Depends(get_db)):
    stmt = select(ImpactZone).where(ImpactZone.event_id == event_id)
    res = await db.execute(stmt)
    zones = res.scalars().all()
    return [
        ImpactZoneOut(
            id=z.id,
            event_id=z.event_id,
            geometry=geom_to_geojson(z.geometry),
            radius_km=z.radius_km,
            population_exposed=z.population_exposed,
            building_count=z.building_count,
            area_sq_km=z.area_sq_km,
            created_at=z.created_at,
        )
        for z in zones
    ]


@router.get("/events/{event_id}/grid-cells", response_model=list[GridCellOut])
async def get_event_grid_cells(event_id: UUID, db: AsyncSession = Depends(get_db)):
    stmt = select(GridCell).where(GridCell.event_id == event_id)
    res = await db.execute(stmt)
    cells = res.scalars().all()
    return [
        GridCellOut(
            id=c.id,
            event_id=c.event_id,
            impact_zone_id=c.impact_zone_id,
            geometry=geom_to_geojson(c.geometry),
            cell_size_deg=c.cell_size_deg,
            hazard_intensity=c.hazard_intensity,
            population_density=c.population_density,
            building_density=c.building_density,
            severity_score=c.severity_score,
            severity_class=c.severity_class,
            created_at=c.created_at,
        )
        for c in cells
    ]


@router.get("/grid-cells", response_model=list[GridCellOut])
async def list_grid_cells(
    severity_class: str | None = None,
    min_score: float | None = None,
    limit: int = Query(default=200, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(GridCell)
    if severity_class:
        stmt = stmt.where(GridCell.severity_class == severity_class)
    if min_score is not None:
        stmt = stmt.where(GridCell.severity_score >= min_score)

    stmt = stmt.order_by(GridCell.severity_score.desc()).offset(offset).limit(limit)
    res = await db.execute(stmt)
    cells = res.scalars().all()
    return [
        GridCellOut(
            id=c.id,
            event_id=c.event_id,
            impact_zone_id=c.impact_zone_id,
            geometry=geom_to_geojson(c.geometry),
            cell_size_deg=c.cell_size_deg,
            hazard_intensity=c.hazard_intensity,
            population_density=c.population_density,
            building_density=c.building_density,
            severity_score=c.severity_score,
            severity_class=c.severity_class,
            created_at=c.created_at,
        )
        for c in cells
    ]
