"""Commander Priority Overrides API Router."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models import User
from app.schemas import PriorityOverrideCreate, PriorityOverrideOut
from app.services.auth import require_admin
from app.services.overrides import (
    create_commander_override,
    deactivate_override,
    list_active_overrides,
)

router = APIRouter(prefix="/overrides", tags=["overrides"])


@router.post("", response_model=PriorityOverrideOut, status_code=status.HTTP_201_CREATED)
async def create_override(
    payload: PriorityOverrideCreate,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    Elevate or adjust zone operational urgency with mandatory commander justification.
    Restricted to authorized 'admin' role.
    """
    try:
        return await create_commander_override(db, payload, current_user)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))


@router.get("", response_model=list[PriorityOverrideOut])
async def get_overrides(
    db: AsyncSession = Depends(get_db),
):
    """List all currently active commander priority overrides with audit details."""
    return await list_active_overrides(db)


@router.delete("/{override_id}")
async def delete_override(
    override_id: UUID,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Deactivate a priority override, restoring original ML model urgency calculation."""
    try:
        await deactivate_override(db, override_id, current_user)
        return {"status": "success", "message": f"Override {override_id} deactivated."}
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))

