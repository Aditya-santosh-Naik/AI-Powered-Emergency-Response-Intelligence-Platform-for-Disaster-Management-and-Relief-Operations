"""Donor management and donation processing service (Requirement D1).

Tracks donors and records donations, automatically incrementing depot stock.
"""

from datetime import datetime
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Donation
from app.services.inventory import adjust_depot_stock


async def record_donation(
    db: AsyncSession,
    donor_id: UUID,
    depot_id: UUID,
    resource_type_id: UUID,
    quantity: int,
    donated_at: datetime,
    notes: str | None = None,
) -> Donation:
    """
    Record a new donation and increase the depot's inventory stock accordingly.
    """
    if quantity <= 0:
        raise ValueError("Donation quantity must be greater than zero.")

    donation = Donation(
        donor_id=donor_id,
        depot_id=depot_id,
        resource_type_id=resource_type_id,
        quantity=quantity,
        donated_at=donated_at,
        notes=notes,
    )
    db.add(donation)

    # Increase depot inventory
    await adjust_depot_stock(
        db=db,
        depot_id=depot_id,
        resource_type_id=resource_type_id,
        quantity_change=quantity,
    )

    await db.flush()
    return donation
