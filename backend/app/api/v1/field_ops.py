"""Field operations API router (Requirement R5.3).

Exposes create and list endpoints only. No UI is built for this in Weeks 1-2.
"""

from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from shapely.geometry import Point
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.utils import geom_to_geojson
from app.db import get_db
from app.models import FieldOperation
from app.schemas import FieldOperationCreate, FieldOperationOut

router = APIRouter(prefix="/field-operations", tags=["field-operations"])


@router.post("", response_model=FieldOperationOut, status_code=status.HTTP_201_CREATED)
async def create_field_operation(
    data: FieldOperationCreate, db: AsyncSession = Depends(get_db)
):
    point_wkt = None
    if data.latitude is not None and data.longitude is not None:
        point_wkt = Point(data.longitude, data.latitude).wkt

    op = FieldOperation(
        event_id=data.event_id,
        depot_id=data.depot_id,
        operation_type=data.operation_type,
        description=data.description,
        location=point_wkt,
        status=data.status,
        started_at=data.started_at,
    )
    db.add(op)
    await db.commit()
    await db.refresh(op)

    lat, lon = None, None
    if op.location is not None:
        geojson = geom_to_geojson(op.location)
        if geojson and "coordinates" in geojson:
            coords = geojson["coordinates"]
            lon, lat = coords[0], coords[1]

    return FieldOperationOut(
        id=op.id,
        event_id=op.event_id,
        depot_id=op.depot_id,
        operation_type=op.operation_type,
        description=op.description,
        latitude=lat,
        longitude=lon,
        status=op.status,
        started_at=op.started_at,
        ended_at=op.ended_at,
        created_at=op.created_at,
    )


@router.get("", response_model=list[FieldOperationOut])
async def list_field_operations(
    event_id: UUID | None = None,
    depot_id: UUID | None = None,
    op_status: str | None = Query(default=None, alias="status"),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(FieldOperation)
    if event_id:
        stmt = stmt.where(FieldOperation.event_id == event_id)
    if depot_id:
        stmt = stmt.where(FieldOperation.depot_id == depot_id)
    if op_status:
        stmt = stmt.where(FieldOperation.status == op_status)

    stmt = stmt.order_by(FieldOperation.started_at.desc())
    res = await db.execute(stmt)
    ops = res.scalars().all()

    out = []
    for op in ops:
        lat, lon = None, None
        if op.location is not None:
            geojson = geom_to_geojson(op.location)
            if geojson and "coordinates" in geojson:
                coords = geojson["coordinates"]
                lon, lat = coords[0], coords[1]
        out.append(
            FieldOperationOut(
                id=op.id,
                event_id=op.event_id,
                depot_id=op.depot_id,
                operation_type=op.operation_type,
                description=op.description,
                latitude=lat,
                longitude=lon,
                status=op.status,
                started_at=op.started_at,
                ended_at=op.ended_at,
                created_at=op.created_at,
            )
        )
    return out
