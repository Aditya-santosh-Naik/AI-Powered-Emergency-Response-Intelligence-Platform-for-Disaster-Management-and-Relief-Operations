"""Operations Command Dashboard & Situation Reporting API Router."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.schemas import OperationsOverviewOut
from app.services.analytics import (
    generate_situation_report,
    get_operations_overview,
)

router = APIRouter(prefix="/operations", tags=["operations"])


@router.get("/overview", response_model=OperationsOverviewOut)
async def get_overview(
    db: AsyncSession = Depends(get_db),
):
    """Retrieve real-time operational status, incident alerts count, and stock overview."""
    return await get_operations_overview(db)


@router.get("/sitrep/{event_id}")
async def get_situation_report(
    event_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Generate structured post-event analytics and formal Situation Report (SitRep)."""
    try:
        report = await generate_situation_report(db, event_id=event_id)
        return report
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))


@router.get("/sitrep/{event_id}/markdown")
async def get_situation_report_markdown(
    event_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Download plain text / Markdown formal Situation Report (SitRep)."""
    try:
        report = await generate_situation_report(db, event_id=event_id)
        return Response(
            content=report["markdown_report"],
            media_type="text/markdown",
            headers={"Content-Disposition": f"attachment; filename=sitrep-{event_id}.md"},
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))

