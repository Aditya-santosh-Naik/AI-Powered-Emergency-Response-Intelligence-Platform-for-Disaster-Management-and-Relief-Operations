"""Ingestion API router."""

import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.connectors.firms import FIRMSConnector
from app.connectors.gdacs import GDACSConnector
from app.connectors.ndma import NDMAConnector
from app.connectors.usgs import USGSConnector
from app.db import get_db
from app.models import DisasterEvent, IngestionRun
from app.schemas import IngestionRunOut, IngestionTriggerRequest
from app.services.grid import generate_grid_cells_for_impact_zone
from app.services.impact import assess_event_impact

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ingestion", tags=["ingestion"])

CONNECTORS = {
    "GDACS": GDACSConnector(),
    "USGS": USGSConnector(),
    "NDMA": NDMAConnector(),
    "FIRMS": FIRMSConnector(),
}


@router.post("/trigger", response_model=list[IngestionRunOut])
async def trigger_ingestion(
    request: IngestionTriggerRequest | None = None,
    db: AsyncSession = Depends(get_db),
):
    """
    Manually trigger disaster data ingestion across sources (or a single requested source).
    Each source is executed in isolation so failure of one does not affect others.
    Newly ingested events are automatically processed for impact zones and grid severity.
    """
    requested_source = request.source.upper() if request and request.source else None
    targets = (
        {requested_source: CONNECTORS[requested_source]}
        if requested_source and requested_source in CONNECTORS
        else CONNECTORS
    )

    if requested_source and requested_source not in CONNECTORS:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown source '{requested_source}'. Available sources: {list(CONNECTORS.keys())}",
        )

    runs = []
    for name, connector in targets.items():
        try:
            logger.info("Starting ingestion for %s", name)
            await connector.run(db)
        except Exception:
            logger.exception("Unexpected error running connector %s", name)

        # Retrieve the latest run record for this source
        stmt = (
            select(IngestionRun)
            .where(IngestionRun.source == name)
            .order_by(desc(IngestionRun.started_at))
            .limit(1)
        )
        res = await db.execute(stmt)
        latest_run = res.scalar_one_or_none()
        if latest_run:
            runs.append(latest_run)

    # Post-process: compute impact zones and grid cells for unassessed events
    try:
        unassessed_stmt = (
            select(DisasterEvent)
            .where(~DisasterEvent.impact_zones.any())
            .order_by(DisasterEvent.started_at.desc())
            .limit(20)
        )
        unassessed_res = await db.execute(unassessed_stmt)
        unassessed_events = unassessed_res.scalars().all()
        for ev in unassessed_events:
            try:
                zone = await assess_event_impact(ev, db)
                await generate_grid_cells_for_impact_zone(zone, db)
            except Exception:
                logger.exception("Failed to assess impact for event %s", ev.id)
        await db.commit()
    except Exception:
        logger.exception("Error in post-ingestion impact assessment")

    return runs


@router.get("/status", response_model=list[IngestionRunOut])
async def get_ingestion_status(db: AsyncSession = Depends(get_db)):
    """Retrieve the latest ingestion run per source."""
    latest_runs = []
    for name in CONNECTORS:
        stmt = (
            select(IngestionRun)
            .where(IngestionRun.source == name)
            .order_by(desc(IngestionRun.started_at))
            .limit(1)
        )
        res = await db.execute(stmt)
        run = res.scalar_one_or_none()
        if run:
            latest_runs.append(run)
    return latest_runs
