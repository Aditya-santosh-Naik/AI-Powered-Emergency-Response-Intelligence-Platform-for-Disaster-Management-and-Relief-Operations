"""Base class for all disaster data connectors."""

import abc
import logging
from datetime import UTC, datetime

from sqlalchemy import select
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

                    existing_stmt = select(DisasterEvent).where(
                        DisasterEvent.source == self.source_name,
                        DisasterEvent.external_id == normalized["external_id"],
                    )
                    res = await db.execute(existing_stmt)
                    existing = res.scalar_one_or_none()
                    if existing:
                        for k, v in normalized.items():
                            setattr(existing, k, v)
                        existing.updated_at = datetime.now(UTC)
                        result.updated += 1
                    else:
                        new_event = DisasterEvent(**normalized)
                        db.add(new_event)
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
