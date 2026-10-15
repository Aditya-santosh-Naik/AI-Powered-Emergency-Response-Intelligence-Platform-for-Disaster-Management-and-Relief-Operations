"""GDACS connector — fetches global disaster alerts."""

import logging
from datetime import UTC, datetime, timedelta

import httpx
from shapely.geometry import Point

from app.connectors.base import BaseConnector

logger = logging.getLogger(__name__)

# GDACS GeoJSON API — verified 2024-10-15, returns FeatureCollection
GDACS_API = "https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH"

# Map GDACS event type codes to our normalized types
EVENT_TYPE_MAP = {
    "EQ": "earthquake",
    "TC": "cyclone",
    "FL": "flood",
    "VO": "volcano",
    "DR": "drought",
    "WF": "wildfire",
}


class GDACSConnector(BaseConnector):
    @property
    def source_name(self) -> str:
        return "GDACS"

    async def fetch_events(self) -> list[dict]:
        # Fetch events from the last 90 days to get a good spread
        to_date = datetime.now(UTC)
        from_date = to_date - timedelta(days=90)

        params = {
            "alertlevel": "Green;Orange;Red",
            "eventlist": "EQ;TC;FL;VO;DR;WF",
            "fromDate": from_date.strftime("%Y-%m-%d"),
            "toDate": to_date.strftime("%Y-%m-%d"),
        }

        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.get(GDACS_API, params=params)
            resp.raise_for_status()
            data = resp.json()

        features = data.get("features", [])
        logger.info("GDACS returned %d features", len(features))
        return features

    def normalize(self, raw: dict) -> dict:
        props = raw.get("properties", {})
        geom = raw.get("geometry", {})

        event_code = props.get("eventtype", "")
        event_type = EVENT_TYPE_MAP.get(event_code, event_code.lower())

        # Build a WKT point from the GeoJSON coordinates
        coords = geom.get("coordinates", [])
        wkt_geom = None
        if coords and len(coords) >= 2:
            wkt_geom = Point(coords[0], coords[1]).wkt

        # GDACS uses episodeid to distinguish episodes of the same event
        external_id = f"{props.get('eventid', '')}-{props.get('episodeid', '')}"

        severity = props.get("severitydata", {})

        started_at = props.get("fromdate")
        if started_at:
            started_at = datetime.fromisoformat(started_at.replace("Z", "+00:00"))
        else:
            started_at = datetime.now(UTC)

        ended_at = props.get("todate")
        if ended_at:
            ended_at = datetime.fromisoformat(ended_at.replace("Z", "+00:00"))

        # Extract magnitude from severity data if available
        magnitude = None
        if event_type == "earthquake" or severity.get("severity"):
            magnitude = severity.get("severity")

        report_url = props.get("url", {})
        source_url = report_url.get("report", "") if isinstance(report_url, dict) else ""

        return {
            "external_id": external_id,
            "event_type": event_type,
            "title": props.get("name", "Unknown Event"),
            "description": props.get("description", ""),
            "geometry": wkt_geom,
            "magnitude": magnitude,
            "depth_km": None,  # GDACS doesn't provide depth in the list feed
            "alert_level": props.get("alertlevel"),
            "country": props.get("country", ""),
            "started_at": started_at,
            "ended_at": ended_at,
            "source_url": source_url,
            "is_sample": False,
        }
