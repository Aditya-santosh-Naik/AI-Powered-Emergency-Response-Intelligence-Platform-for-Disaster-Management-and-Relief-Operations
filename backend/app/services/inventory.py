"""Resource inventory management service.

Handles depots, inventory items, stock adjustments (rejecting negative stock),
and aggregate resource summaries.
"""

from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import InventoryItem, ResourceType


class InsufficientStockError(Exception):
    """Raised when an inventory adjustment would result in a negative quantity."""


async def get_or_create_inventory_item(
    db: AsyncSession, depot_id: UUID, resource_type_id: UUID
) -> InventoryItem:
    stmt = select(InventoryItem).where(
        InventoryItem.depot_id == depot_id,
        InventoryItem.resource_type_id == resource_type_id,
    )
    result = await db.execute(stmt)
    item = result.scalar_one_or_none()
    if not item:
        item = InventoryItem(
            depot_id=depot_id,
            resource_type_id=resource_type_id,
            quantity=0,
        )
        db.add(item)
        await db.flush()
    return item


async def adjust_depot_stock(
    db: AsyncSession, depot_id: UUID, resource_type_id: UUID, quantity_change: int
) -> InventoryItem:
    """
    Adjust depot stock by quantity_change (positive or negative).
    Strictly rejects any change that would leave the quantity below 0.
    """
    item = await get_or_create_inventory_item(db, depot_id, resource_type_id)

    new_quantity = item.quantity + quantity_change
    if new_quantity < 0:
        raise InsufficientStockError(
            f"Adjustment of {quantity_change} would result in negative stock: "
            f"current {item.quantity}, requested {new_quantity}."
        )

    item.quantity = new_quantity
    item.updated_at = datetime.now(UTC)
    await db.flush()
    return item


async def get_inventory_summary(db: AsyncSession) -> list[dict]:
    """Calculate aggregate total quantities across all depots grouped by resource type."""
    stmt = (
        select(
            ResourceType.id.label("resource_type_id"),
            ResourceType.name.label("resource_type_name"),
            ResourceType.unit.label("resource_type_unit"),
            func.coalesce(func.sum(InventoryItem.quantity), 0).label("total_quantity"),
        )
        .outerjoin(InventoryItem, InventoryItem.resource_type_id == ResourceType.id)
        .group_by(ResourceType.id, ResourceType.name, ResourceType.unit)
        .order_by(ResourceType.name)
    )
    res = await db.execute(stmt)
    rows = res.all()
    return [
        {
            "resource_type_id": row.resource_type_id,
            "resource_type_name": row.resource_type_name,
            "resource_type_unit": row.resource_type_unit,
            "total_quantity": int(row.total_quantity),
        }
        for row in rows
    ]
