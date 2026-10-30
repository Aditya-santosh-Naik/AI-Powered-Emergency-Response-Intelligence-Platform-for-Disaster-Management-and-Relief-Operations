"""USGS Earthquake connector — fetches from the GeoJSON summary feed."""

import logging
from datetime import UTC, datetime

import httpx
from shapely.geometry import Point

from app.connectors.base import BaseConnector

logger = logging.getLogger(__name__)

# Verified 2024-10-15 — returns GeoJSON FeatureCollection with ~170 earthquakes per day
USGS_FEED = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson"


class USGSConnector(BaseConnector):
    @property
    def source_name(self) -> str:
        return "USGS"

    async def fetch_events(self) -> list[dict]:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(USGS_FEED)
            resp.raise_for_status()
            data = resp.json()

        features = data.get("features", [])
        # Restrict strictly to India & immediate border/coastal zones (lat: 6 to 38, lon: 65 to 98.5)
        india_features = []
        for f in features:
            props = f.get("properties", {})
            place = (props.get("place") or "").lower()
            coords = f.get("geometry", {}).get("coordinates", [])
            if "india" in place:
                india_features.append(f)
                continue
            if coords and len(coords) >= 2:
                lon, lat = coords[0], coords[1]
                if 6.0 <= lat <= 38.0 and 65.0 <= lon <= 98.5:
                    india_features.append(f)

        logger.info("USGS returned %d earthquakes (%d in India)", len(features), len(india_features))
        return india_features

    def normalize(self, raw: dict) -> dict:
        props = raw.get("properties", {})
        geom = raw.get("geometry", {})

        coords = geom.get("coordinates", [])
        wkt_geom = None
        depth_km = None
        if coords and len(coords) >= 2:
            wkt_geom = Point(coords[0], coords[1]).wkt
            if len(coords) >= 3:
                depth_km = coords[2]

        # USGS timestamps are in milliseconds since epoch
        time_ms = props.get("time", 0)
        started_at = datetime.fromtimestamp(time_ms / 1000, tz=UTC)

        return {
            "external_id": raw.get("id", ""),
            "event_type": "earthquake",
            "title": props.get("title", "Unknown Earthquake"),
            "description": props.get("place", ""),
            "geometry": wkt_geom,
            "magnitude": props.get("mag"),
            "depth_km": depth_km,
            "alert_level": props.get("alert"),  # green/yellow/orange/red or null
            "country": "",  # USGS feed doesn't include country, place has location text
            "started_at": started_at,
            "ended_at": None,
            "source_url": props.get("url", ""),
            "is_sample": False,
        }
