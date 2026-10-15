"""Scheduled background polling for disaster feeds using APScheduler."""

import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from sqlalchemy import select

from app.config import settings
from app.connectors.firms import FIRMSConnector
from app.connectors.gdacs import GDACSConnector
from app.connectors.ndma import NDMAConnector
from app.connectors.usgs import USGSConnector
from app.db import async_session
from app.models import DisasterEvent
from app.services.grid import generate_grid_cells_for_impact_zone
from app.services.impact import assess_event_impact

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()

CONNECTORS = [
    GDACSConnector(),
    USGSConnector(),
    NDMAConnector(),
    FIRMSConnector(),
]


async def run_scheduled_ingestion() -> None:
    """Execute all connectors and post-process impact assessment for unassessed events."""
    logger.info("Executing scheduled disaster data ingestion")
    async with async_session() as session:
        for connector in CONNECTORS:
            try:
                await connector.run(session)
            except Exception:
                logger.exception("Scheduled ingestion error for %s", connector.source_name)

        # Post-process impact zones
        try:
            unassessed_stmt = (
                select(DisasterEvent)
                .where(~DisasterEvent.impact_zones.any())
                .order_by(DisasterEvent.started_at.desc())
                .limit(20)
            )
            res = await session.execute(unassessed_stmt)
            for ev in res.scalars().all():
                try:
                    zone = await assess_event_impact(ev, session)
                    await generate_grid_cells_for_impact_zone(zone, session)
                except Exception:
                    logger.exception("Error processing impact for event %s", ev.id)
            await session.commit()
        except Exception:
            logger.exception("Error in scheduled post-ingestion processing")


def start_scheduler() -> None:
    interval = max(1, settings.ingestion_interval_minutes)
    scheduler.add_job(
        run_scheduled_ingestion,
        trigger=IntervalTrigger(minutes=interval),
        id="disaster_data_ingestion",
        name="Poll disaster data feeds",
        replace_existing=True,
    )
    scheduler.start()
    logger.info("Scheduler started with %d minute polling interval", interval)


def shutdown_scheduler() -> None:
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("Scheduler shut down")
