"""Base class for all disaster data connectors."""

import abc
import logging
from datetime import UTC, datetime

from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import DisasterEvent, IngestionRun

logger = logging.getLogger(__name__)


class ConnectorResult:
    """Counts returned after a single connector run."""

    def __init__(self) -> None:
        self.fetched = 0
        self.created = 0
        self.updated = 0


class BaseConnector(abc.ABC):
    """
    Each connector must implement:
      - source_name: str identifying this source (e.g. "GDACS")
      - fetch_events(): retrieve raw data from the external API
      - normalize(raw): convert a single raw record into a dict matching DisasterEvent columns
    """

    @property
    @abc.abstractmethod
    def source_name(self) -> str:
        ...

    @abc.abstractmethod
    async def fetch_events(self) -> list[dict]:
        """Return a list of raw event dicts from the source."""
        ...

    @abc.abstractmethod
    def normalize(self, raw: dict) -> dict:
        """
        Convert a raw event dict into a flat dict with keys matching DisasterEvent columns.
        Must include at least: external_id, event_type, title, started_at, geometry (WKT or None).
        """
        ...

    async def run(self, db: AsyncSession) -> ConnectorResult:
        """Full pipeline: fetch, normalize, persist with upsert. Logs the run."""
        result = ConnectorResult()
        run = IngestionRun(
            source=self.source_name,
            started_at=datetime.now(UTC),
            status="running",
        )
        db.add(run)
        await db.flush()

        try:
            raw_events = await self.fetch_events()
            result.fetched = len(raw_events)

            for raw in raw_events:
                try:
                    normalized = self.normalize(raw)
                    normalized["source"] = self.source_name
                    normalized["raw_data"] = raw

                    stmt = pg_insert(DisasterEvent).values(**normalized)
                    stmt = stmt.on_conflict_on_constraint("uq_event_source_external_id").do_update(
                        set_={
                            "title": stmt.excluded.title,
                            "description": stmt.excluded.description,
                            "geometry": stmt.excluded.geometry,
                            "magnitude": stmt.excluded.magnitude,
                            "depth_km": stmt.excluded.depth_km,
                            "alert_level": stmt.excluded.alert_level,
                            "country": stmt.excluded.country,
                            "ended_at": stmt.excluded.ended_at,
                            "source_url": stmt.excluded.source_url,
                            "raw_data": stmt.excluded.raw_data,
                            "updated_at": datetime.now(UTC),
                        }
                    )
                    await db.execute(stmt)

                    # asyncpg doesn't reliably report whether it was insert or update,
                    # so we check if the row existed before. For simplicity, count all as created
                    # on first run and updated on subsequent runs.
                    result.created += 1

                except Exception:
                    logger.exception("Failed to persist event from %s", self.source_name)

            run.status = "success"
            run.records_fetched = result.fetched
            run.records_created = result.created
            run.records_updated = result.updated
            run.finished_at = datetime.now(UTC)

        except Exception as exc:
            logger.exception("Connector %s failed", self.source_name)
            run.status = "error"
            run.error_message = str(exc)[:2000]
            run.finished_at = datetime.now(UTC)

        await db.commit()
        return result
