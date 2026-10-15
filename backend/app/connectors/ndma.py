"""
NDMA connector — fixture fallback.

India's National Disaster Management Authority (ndma.gov.in) does not expose
a stable public API. This connector loads sample disaster events from a local
fixture file. All records are marked is_sample=True so the UI can distinguish
them from live data.
"""

import json
import logging
from datetime import UTC, datetime
from pathlib import Path

from shapely.geometry import Point

from app.connectors.base import BaseConnector

logger = logging.getLogger(__name__)

FIXTURE_PATH = Path(__file__).parent.parent.parent / "fixtures" / "ndma_sample.json"


class NDMAConnector(BaseConnector):
    @property
    def source_name(self) -> str:
        return "NDMA"

    async def fetch_events(self) -> list[dict]:
        if not FIXTURE_PATH.exists():
            logger.warning("NDMA fixture not found at %s — skipping", FIXTURE_PATH)
            return []

        with open(FIXTURE_PATH) as f:
            events = json.load(f)

        logger.info("NDMA fixture loaded %d sample events", len(events))
        return events

    def normalize(self, raw: dict) -> dict:
        lat = raw.get("latitude")
        lon = raw.get("longitude")
        wkt_geom = None
        if lat is not None and lon is not None:
            wkt_geom = Point(float(lon), float(lat)).wkt

        started_at = raw.get("started_at")
        if started_at:
            started_at = datetime.fromisoformat(started_at)
        else:
            started_at = datetime.now(UTC)

        ended_at = raw.get("ended_at")
        if ended_at:
            ended_at = datetime.fromisoformat(ended_at)

        return {
            "external_id": raw.get("id", ""),
            "event_type": raw.get("event_type", "flood"),
            "title": raw.get("title", "Unknown Event"),
            "description": raw.get("description", ""),
            "geometry": wkt_geom,
            "magnitude": raw.get("magnitude"),
            "depth_km": raw.get("depth_km"),
            "alert_level": raw.get("alert_level"),
            "country": raw.get("country", "India"),
            "started_at": started_at,
            "ended_at": ended_at,
            "source_url": raw.get("source_url", "https://ndma.gov.in"),
            "is_sample": True,
        }
