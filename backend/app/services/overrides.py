"""Commander Priority Override service with audit trail and plan comparison."""

import logging
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import PriorityOverride, ResourcePrediction, User
from app.schemas import PriorityOverrideCreate, PriorityOverrideOut

logger = logging.getLogger(__name__)


async def create_commander_override(
    db: AsyncSession,
    payload: PriorityOverrideCreate,
    authorized_user: User,
) -> PriorityOverrideOut:
    """Create a commander priority override with mandatory justification and audit logging."""
    if authorized_user.role != "admin":
        raise PermissionError("Only commanders with 'admin' privilege can override zone operational priorities.")

    # Fetch targeted prediction
    pred_res = await db.execute(
        select(ResourcePrediction).where(ResourcePrediction.id == payload.prediction_id)
    )
    prediction = pred_res.scalar_one_or_none()
    if not prediction:
        raise ValueError(f"Resource prediction with ID {payload.prediction_id} not found.")

    # Deactivate any previous active override for this prediction
    prev_stmt = (
        select(PriorityOverride)
        .where(PriorityOverride.prediction_id == payload.prediction_id)
        .where(PriorityOverride.is_active.is_(True))
    )
    prev_res = await db.execute(prev_stmt)
    for prev_ov in prev_res.scalars().all():
        prev_ov.is_active = False

    # Create new override
    override = PriorityOverride(
        prediction_id=prediction.id,
        original_urgency_score=prediction.urgency_score,
        original_urgency_class=prediction.urgency_class,
        overridden_urgency_score=payload.overridden_urgency_score,
        overridden_urgency_class=payload.overridden_urgency_class.upper(),
        justification=payload.justification.strip(),
        authorized_by_id=authorized_user.id,
        is_active=True,
    )
    db.add(override)
    await db.commit()
    await db.refresh(override)

    return PriorityOverrideOut(
        id=override.id,
        prediction_id=override.prediction_id,
        zone_identifier=prediction.zone_identifier,
        original_urgency_score=override.original_urgency_score,
        original_urgency_class=override.original_urgency_class,
        overridden_urgency_score=override.overridden_urgency_score,
        overridden_urgency_class=override.overridden_urgency_class,
        justification=override.justification,
        authorized_by_id=authorized_user.id,
        authorized_by_name=authorized_user.full_name,
        is_active=override.is_active,
        created_at=override.created_at,
    )


async def list_active_overrides(db: AsyncSession) -> list[PriorityOverrideOut]:
    """Retrieve all active commander priority overrides with zone identifiers and author names."""
    stmt = (
        select(PriorityOverride)
        .where(PriorityOverride.is_active.is_(True))
        .options(
            selectinload(PriorityOverride.prediction),
            selectinload(PriorityOverride.authorized_by),
        )
        .order_by(PriorityOverride.created_at.desc())
    )
    res = await db.execute(stmt)
    overrides = res.scalars().all()

    out = []
    for ov in overrides:
        out.append(
            PriorityOverrideOut(
                id=ov.id,
                prediction_id=ov.prediction_id,
                zone_identifier=ov.prediction.zone_identifier if ov.prediction else "Unknown Zone",
                original_urgency_score=ov.original_urgency_score,
                original_urgency_class=ov.original_urgency_class,
                overridden_urgency_score=ov.overridden_urgency_score,
                overridden_urgency_class=ov.overridden_urgency_class,
                justification=ov.justification,
                authorized_by_id=ov.authorized_by_id,
                authorized_by_name=ov.authorized_by.full_name if ov.authorized_by else "Authorized Commander",
                is_active=ov.is_active,
                created_at=ov.created_at,
            )
        )
    return out


async def deactivate_override(
    db: AsyncSession,
    override_id: UUID,
    authorized_user: User,
) -> bool:
    """Deactivate an existing priority override, restoring original ML model urgency."""
    if authorized_user.role != "admin":
        raise PermissionError("Only commanders with 'admin' privilege can revert priority overrides.")

    res = await db.execute(select(PriorityOverride).where(PriorityOverride.id == override_id))
    override = res.scalar_one_or_none()
    if not override:
        raise ValueError(f"Priority override with ID {override_id} not found.")

    override.is_active = False
    await db.commit()
    return True

