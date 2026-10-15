"""NASA FIRMS connector — fetches active fire hotspots from satellite observations."""

import csv
import io
import logging
from datetime import UTC, datetime

import httpx
from shapely.geometry import Point

from app.config import settings
from app.connectors.base import BaseConnector

logger = logging.getLogger(__name__)

# NASA FIRMS Area API URL format:
# https://firms.modaps.eosdis.nasa.gov/api/area/csv/[MAP_KEY]/[SOURCE]/[EXTENT]/[DAYS]
FIRMS_BASE_URL = "https://firms.modaps.eosdis.nasa.gov/api/area/csv"


class FIRMSConnector(BaseConnector):
    @property
    def source_name(self) -> str:
        return "FIRMS"

    async def fetch_events(self) -> list[dict]:
        map_key = settings.firms_map_key
        if not map_key or map_key.strip() == "":
            logger.info("FIRMS_MAP_KEY not configured — skipping live FIRMS fetch gracefully")
            return []

        # Query global active fires or a broad bounding box for the last 1 day
        # Source options: VIIRS_SNPP_NRT, MODIS_NRT, VIIRS_NOAA20_NRT
        # Format: /api/area/csv/[MAP_KEY]/[SOURCE]/[W,S,E,N]/[DAYS]
        # Using South Asia bounding box (60, 5, 100, 38) as primary focus area for manageable response size
        url = f"{FIRMS_BASE_URL}/{map_key.strip()}/VIIRS_SNPP_NRT/60,5,100,38/1"

        async with httpx.AsyncClient(timeout=45.0) as client:
            resp = await client.get(url)
            if resp.status_code == 403 or "Invalid MAP_KEY" in resp.text:
                logger.warning("NASA FIRMS returned invalid key response — skipping gracefully")
                return []
            resp.raise_for_status()

            # Parse CSV response into list of dicts
            reader = csv.DictReader(io.StringIO(resp.text))
            records = list(reader)

        logger.info("FIRMS returned %d hotspot records", len(records))
        return records

    def normalize(self, raw: dict) -> dict:
        lat = float(raw.get("latitude", 0.0))
        lon = float(raw.get("longitude", 0.0))
        wkt_geom = Point(lon, lat).wkt

        acq_date = raw.get("acq_date", "")
        acq_time = raw.get("acq_time", "0000").zfill(4)
        started_at = datetime.now(UTC)
        if acq_date:
            try:
                hour = int(acq_time[:2])
                minute = int(acq_time[2:])
                started_at = datetime.strptime(acq_date, "%Y-%m-%d").replace(
                    hour=hour, minute=minute, tzinfo=UTC
                )
            except Exception:
                pass

        brightness = raw.get("bright_ti4") or raw.get("brightness")
        confidence = raw.get("confidence", "nominal")
        frp = raw.get("frp", "0.0")

        # Create unique external ID from coordinates and acquisition time
        external_id = f"FIRMS-{lat:.4f}-{lon:.4f}-{acq_date}-{acq_time}"

        return {
            "external_id": external_id,
            "event_type": "wildfire",
            "title": f"Thermal Anomaly / Fire Hotspot at ({lat:.2f}, {lon:.2f})",
            "description": f"Brightness: {brightness}K, FRP: {frp}MW, Confidence: {confidence}",
            "geometry": wkt_geom,
            "magnitude": float(frp) if frp else None,
            "depth_km": None,
            "alert_level": "Red" if confidence in ("h", "high") else "Orange",
            "country": "",
            "started_at": started_at,
            "ended_at": None,
            "source_url": "https://firms.modaps.eosdis.nasa.gov",
            "is_sample": False,
        }
