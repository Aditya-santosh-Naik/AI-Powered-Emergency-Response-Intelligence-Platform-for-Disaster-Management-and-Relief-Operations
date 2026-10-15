"""Events API router."""

from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.v1.utils import geom_to_geojson
from app.db import get_db
from app.models import DisasterEvent
from app.schemas import EventDetail, EventOut, GridCellOut, ImpactZoneOut

router = APIRouter(prefix="/events", tags=["events"])


@router.get("", response_model=list[EventOut])
async def list_events(
    event_type: str | None = None,
    source: str | None = None,
    country: str | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(DisasterEvent)
    if event_type:
        stmt = stmt.where(DisasterEvent.event_type == event_type.lower())
    if source:
        stmt = stmt.where(DisasterEvent.source == source)
    if country:
        stmt = stmt.where(DisasterEvent.country.ilike(f"%{country}%"))
    if date_from:
        stmt = stmt.where(DisasterEvent.started_at >= date_from)
    if date_to:
        stmt = stmt.where(DisasterEvent.started_at <= date_to)

    stmt = stmt.order_by(DisasterEvent.started_at.desc()).offset(offset).limit(limit)
    res = await db.execute(stmt)
    events = res.scalars().all()

    output = []
    for ev in events:
        data = {
            "id": ev.id,
            "source": ev.source,
            "external_id": ev.external_id,
            "event_type": ev.event_type,
            "title": ev.title,
            "description": ev.description,
            "magnitude": ev.magnitude,
            "depth_km": ev.depth_km,
            "alert_level": ev.alert_level,
            "country": ev.country,
            "started_at": ev.started_at,
            "ended_at": ev.ended_at,
            "source_url": ev.source_url,
            "is_sample": ev.is_sample,
            "geometry": geom_to_geojson(ev.geometry),
            "created_at": ev.created_at,
            "updated_at": ev.updated_at,
        }
        output.append(data)
    return output


@router.get("/{event_id}", response_model=EventDetail)
async def get_event(event_id: UUID, db: AsyncSession = Depends(get_db)):
    stmt = (
        select(DisasterEvent)
        .options(
            selectinload(DisasterEvent.impact_zones),
            selectinload(DisasterEvent.grid_cells),
        )
        .where(DisasterEvent.id == event_id)
    )
    res = await db.execute(stmt)
    event = res.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    impact_zones_data = [
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
        for z in event.impact_zones
    ]

    grid_cells_data = [
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
        for c in event.grid_cells
    ]

    return EventDetail(
        id=event.id,
        source=event.source,
        external_id=event.external_id,
        event_type=event.event_type,
        title=event.title,
        description=event.description,
        magnitude=event.magnitude,
        depth_km=event.depth_km,
        alert_level=event.alert_level,
        country=event.country,
        started_at=event.started_at,
        ended_at=event.ended_at,
        source_url=event.source_url,
        is_sample=event.is_sample,
        geometry=geom_to_geojson(event.geometry),
        created_at=event.created_at,
        updated_at=event.updated_at,
        impact_zones=impact_zones_data,
        grid_cells=grid_cells_data,
    )
