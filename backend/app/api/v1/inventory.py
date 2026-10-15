"""Inventory and Depot management API router."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from shapely.geometry import Point
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.v1.utils import geom_to_geojson
from app.db import get_db
from app.models import Depot, InventoryItem, ResourceType
from app.schemas import (
    DepotCreate,
    DepotOut,
    DepotUpdate,
    InventoryItemOut,
    InventorySummaryItem,
    ResourceTypeOut,
    StockAdjustment,
)
from app.services.inventory import (
    InsufficientStockError,
    adjust_depot_stock,
    get_inventory_summary,
)

router = APIRouter(tags=["inventory"])


def _extract_coords(point_geom) -> tuple[float, float]:
    """Helper to extract (latitude, longitude) from a Point geometry."""
    geojson = geom_to_geojson(point_geom)
    if geojson and "coordinates" in geojson:
        coords = geojson["coordinates"]
        return float(coords[1]), float(coords[0])  # lat, lon
    return 0.0, 0.0


# -- Resource Types --

@router.get("/resource-types", response_model=list[ResourceTypeOut])
async def list_resource_types(db: AsyncSession = Depends(get_db)):
    stmt = select(ResourceType).order_by(ResourceType.name)
    res = await db.execute(stmt)
    types = res.scalars().all()
    return types


# -- Depots --

@router.get("/depots", response_model=list[DepotOut])
async def list_depots(db: AsyncSession = Depends(get_db)):
    stmt = select(Depot).order_by(Depot.name)
    res = await db.execute(stmt)
    depots = res.scalars().all()
    out = []
    for d in depots:
        lat, lon = _extract_coords(d.location)
        out.append(
            DepotOut(
                id=d.id,
                name=d.name,
                latitude=lat,
                longitude=lon,
                address=d.address,
                status=d.status,
                created_at=d.created_at,
                updated_at=d.updated_at,
            )
        )
    return out


@router.post("/depots", response_model=DepotOut, status_code=status.HTTP_201_CREATED)
async def create_depot(data: DepotCreate, db: AsyncSession = Depends(get_db)):
    point_wkt = Point(data.longitude, data.latitude).wkt
    depot = Depot(
        name=data.name,
        location=point_wkt,
        address=data.address,
        status=data.status,
    )
    db.add(depot)
    await db.commit()
    await db.refresh(depot)
    lat, lon = _extract_coords(depot.location)
    return DepotOut(
        id=depot.id,
        name=depot.name,
        latitude=lat,
        longitude=lon,
        address=depot.address,
        status=depot.status,
        created_at=depot.created_at,
        updated_at=depot.updated_at,
    )


@router.get("/depots/{depot_id}", response_model=DepotOut)
async def get_depot(depot_id: UUID, db: AsyncSession = Depends(get_db)):
    stmt = select(Depot).where(Depot.id == depot_id)
    res = await db.execute(stmt)
    depot = res.scalar_one_or_none()
    if not depot:
        raise HTTPException(status_code=404, detail="Depot not found")
    lat, lon = _extract_coords(depot.location)
    return DepotOut(
        id=depot.id,
        name=depot.name,
        latitude=lat,
        longitude=lon,
        address=depot.address,
        status=depot.status,
        created_at=depot.created_at,
        updated_at=depot.updated_at,
    )


@router.put("/depots/{depot_id}", response_model=DepotOut)
async def update_depot(depot_id: UUID, data: DepotUpdate, db: AsyncSession = Depends(get_db)):
    stmt = select(Depot).where(Depot.id == depot_id)
    res = await db.execute(stmt)
    depot = res.scalar_one_or_none()
    if not depot:
        raise HTTPException(status_code=404, detail="Depot not found")

    if data.name is not None:
        depot.name = data.name
    if data.latitude is not None and data.longitude is not None:
        depot.location = Point(data.longitude, data.latitude).wkt
    if data.address is not None:
        depot.address = data.address
    if data.status is not None:
        depot.status = data.status

    await db.commit()
    await db.refresh(depot)
    lat, lon = _extract_coords(depot.location)
    return DepotOut(
        id=depot.id,
        name=depot.name,
        latitude=lat,
        longitude=lon,
        address=depot.address,
        status=depot.status,
        created_at=depot.created_at,
        updated_at=depot.updated_at,
    )


@router.delete("/depots/{depot_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_depot(depot_id: UUID, db: AsyncSession = Depends(get_db)):
    stmt = select(Depot).where(Depot.id == depot_id)
    res = await db.execute(stmt)
    depot = res.scalar_one_or_none()
    if not depot:
        raise HTTPException(status_code=404, detail="Depot not found")
    await db.delete(depot)
    await db.commit()


# -- Inventory items --

@router.get("/depots/{depot_id}/inventory", response_model=list[InventoryItemOut])
async def get_depot_inventory(depot_id: UUID, db: AsyncSession = Depends(get_db)):
    # Verify depot exists
    depot_stmt = select(Depot).where(Depot.id == depot_id)
    depot_res = await db.execute(depot_stmt)
    if not depot_res.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Depot not found")

    stmt = (
        select(InventoryItem)
        .options(selectinload(InventoryItem.resource_type))
        .where(InventoryItem.depot_id == depot_id)
    )
    res = await db.execute(stmt)
    items = res.scalars().all()
    return [
        InventoryItemOut(
            id=item.id,
            depot_id=item.depot_id,
            resource_type_id=item.resource_type_id,
            resource_type_name=item.resource_type.name if item.resource_type else None,
            resource_type_unit=item.resource_type.unit if item.resource_type else None,
            quantity=item.quantity,
            updated_at=item.updated_at,
        )
        for item in items
    ]


@router.post("/depots/{depot_id}/inventory/adjust", response_model=InventoryItemOut)
async def adjust_inventory(
    depot_id: UUID, adjustment: StockAdjustment, db: AsyncSession = Depends(get_db)
):
    # Verify depot exists
    depot_stmt = select(Depot).where(Depot.id == depot_id)
    depot_res = await db.execute(depot_stmt)
    if not depot_res.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Depot not found")

    try:
        item = await adjust_depot_stock(
            db=db,
            depot_id=depot_id,
            resource_type_id=adjustment.resource_type_id,
            quantity_change=adjustment.quantity_change,
        )
        await db.commit()
        await db.refresh(item)

        # Load resource_type name & unit
        rt_stmt = select(ResourceType).where(ResourceType.id == item.resource_type_id)
        rt_res = await db.execute(rt_stmt)
        rt = rt_res.scalar_one_or_none()

        return InventoryItemOut(
            id=item.id,
            depot_id=item.depot_id,
            resource_type_id=item.resource_type_id,
            resource_type_name=rt.name if rt else None,
            resource_type_unit=rt.unit if rt else None,
            quantity=item.quantity,
            updated_at=item.updated_at,
        )
    except InsufficientStockError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.get("/inventory/summary", response_model=list[InventorySummaryItem])
async def get_inventory_totals(db: AsyncSession = Depends(get_db)):
    summary = await get_inventory_summary(db)
    return [
        InventorySummaryItem(
            resource_type_id=row["resource_type_id"],
            resource_type_name=row["resource_type_name"],
            resource_type_unit=row["resource_type_unit"],
            total_quantity=row["total_quantity"],
        )
        for row in summary
    ]
