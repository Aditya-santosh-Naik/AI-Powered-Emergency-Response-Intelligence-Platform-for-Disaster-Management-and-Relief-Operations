"""Unit tests for inventory rules and stock constraints."""

from unittest.mock import AsyncMock
from uuid import uuid4

import pytest

from app.models import InventoryItem
from app.services.donors import record_donation
from app.services.inventory import (
    InsufficientStockError,
    adjust_depot_stock,
)


@pytest.mark.asyncio
async def test_stock_adjustment_rejects_negative_stock():
    # Setup mock session and existing inventory item with quantity 10
    mock_db = AsyncMock()
    mock_item = InventoryItem(
        id=uuid4(),
        depot_id=uuid4(),
        resource_type_id=uuid4(),
        quantity=10,
    )

    # Mock get_or_create_inventory_item
    async def mock_get(db, depot_id, rt_id):
        return mock_item

    with pytest.MonkeyPatch.context() as mp:
        mp.setattr("app.services.inventory.get_or_create_inventory_item", mock_get)

        # Successful decrement within bounds
        updated = await adjust_depot_stock(mock_db, mock_item.depot_id, mock_item.resource_type_id, -5)
        assert updated.quantity == 5

        # Attempting to decrement by 10 when only 5 remain should raise InsufficientStockError
        with pytest.raises(InsufficientStockError) as exc_info:
            await adjust_depot_stock(mock_db, mock_item.depot_id, mock_item.resource_type_id, -10)
        assert "negative stock" in str(exc_info.value)
        # Quantity must remain 5, not modified
        assert mock_item.quantity == 5


@pytest.mark.asyncio
async def test_donation_rejects_non_positive_quantity():
    mock_db = AsyncMock()
    with pytest.raises(ValueError) as exc:
        await record_donation(
            db=mock_db,
            donor_id=uuid4(),
            depot_id=uuid4(),
            resource_type_id=uuid4(),
            quantity=0,
            donated_at=None,
        )
    assert "greater than zero" in str(exc.value)
