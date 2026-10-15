"""Geospatial impact assessment service.

Computes event footprint geometry, zonal population statistics from WorldPop raster,
and building counts from OpenStreetMap (Overpass API).
"""

import logging
import math
from pathlib import Path

import httpx
import numpy as np
import rasterio
from rasterio.mask import mask
from shapely import wkt
from shapely.geometry import Point, Polygon, box, mapping
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import DisasterEvent, ImpactZone

logger = logging.getLogger(__name__)

DEFAULT_RASTER_PATH = Path(__file__).parent.parent.parent / "fixtures" / "population_sample.tif"
OVERPASS_URL = "https://overpass-api.de/api/interpreter"

# Cache for Overpass queries to respect rate limits
_OVERPASS_CACHE: dict[str, int] = {}


def derive_earthquake_radius_km(magnitude: float | None, depth_km: float | None) -> float:
    """
    Derive damage impact radius for an earthquake using an empirical model:
    R = 10^(0.5 * M - 1.2) - (0.2 * depth_km), bounded in [5.0, 350.0] km.
    """
    m = magnitude if magnitude is not None else 5.0
    d = depth_km if depth_km is not None else 10.0
    # Base radius from magnitude
    raw_r = 10 ** (0.5 * m - 1.2)
    # Shallow quakes have larger surface impact than deep quakes
    depth_attenuation = max(0.0, 0.2 * d)
    radius = max(5.0, raw_r - depth_attenuation)
    return min(350.0, float(radius))


def derive_flood_radius_km(alert_level: str | None, magnitude: float | None) -> float:
    """Derive impact radius for flood/cyclone/storm event when only point location is known."""
    if magnitude and magnitude > 0:
        return min(250.0, max(10.0, magnitude * 8.0))
    alert = (alert_level or "").lower()
    if alert == "red":
        return 45.0
    if alert == "orange":
        return 25.0
    return 12.0


def buffer_point_km(lon: float, lat: float, radius_km: float) -> Polygon:
    """
    Create a polygon buffer approximating a circle in kilometers at a given WGS84 coordinate.
    1 deg latitude ~ 111.32 km.
    1 deg longitude ~ 111.32 * cos(lat) km.
    """
    rad_lat = math.radians(lat)
    cos_lat = max(0.01, math.cos(rad_lat))

    delta_lat = radius_km / 111.32
    delta_lon = radius_km / (111.32 * cos_lat)

    num_points = 32
    coords = []
    for i in range(num_points):
        theta = 2 * math.pi * i / num_points
        dx = delta_lon * math.cos(theta)
        dy = delta_lat * math.sin(theta)
        coords.append((lon + dx, lat + dy))
    coords.append(coords[0])
    return Polygon(coords)


def calculate_zonal_population(
    polygon: Polygon, raster_path: Path = DEFAULT_RASTER_PATH
) -> tuple[int, float]:
    """
    Compute total exposed population and area (sq km) using zonal statistics on the raster.
    Returns (population_count, area_sq_km).
    """
    # Approximate area: geodesic or projection
    # 1 deg^2 at latitude = 111.32 * 111.32 * cos(lat)
    centroid = polygon.centroid
    lat_rad = math.radians(centroid.y)
    deg2_to_km2 = (111.32 * 111.32) * max(0.01, math.cos(lat_rad))
    area_sq_km = polygon.area * deg2_to_km2

    if not raster_path.exists():
        logger.warning("Population raster not found at %s — using density estimate", raster_path)
        # Default baseline estimate: ~450 people / sq km (typical South Asia rural/semi-urban density)
        estimated_pop = int(area_sq_km * 450)
        return estimated_pop, round(area_sq_km, 2)

    try:
        with rasterio.open(raster_path) as src:
            # Check if polygon intersects raster bounds
            rbounds = src.bounds
            raster_box = box(rbounds.left, rbounds.bottom, rbounds.right, rbounds.top)
            if not polygon.intersects(raster_box):
                logger.info("Polygon outside raster bounds — using density estimate")
                return int(area_sq_km * 450), round(area_sq_km, 2)

            geom = [mapping(polygon)]
            out_image, _ = mask(src, geom, crop=True, nodata=-9999.0)
            data = out_image[0]
            valid_mask = (data != -9999.0) & (~np.isnan(data)) & (data > 0)
            if np.any(valid_mask):
                valid_data = data[valid_mask]
                mean_density = float(np.mean(valid_data))
                total_pop = int(mean_density * area_sq_km)
            else:
                total_pop = int(area_sq_km * 350)
            return max(0, total_pop), round(area_sq_km, 2)
    except Exception:
        logger.exception("Error extracting zonal statistics from raster")
        return int(area_sq_km * 400), round(area_sq_km, 2)


async def fetch_osm_building_count(polygon: Polygon) -> int:
    """
    Query Overpass API for building footprints within the polygon's bounding box.
    Caches queries and falls back gracefully if Overpass is down or times out.
    """
    minx, miny, maxx, maxy = polygon.bounds
    cache_key = f"{miny:.3f},{minx:.3f},{maxy:.3f},{maxx:.3f}"
    if cache_key in _OVERPASS_CACHE:
        return _OVERPASS_CACHE[cache_key]

    # Overpass count query
    overpass_query = f"""
    [out:json][timeout:15];
    (
      way["building"]({miny:.4f},{minx:.4f},{maxy:.4f},{maxx:.4f});
      relation["building"]({miny:.4f},{minx:.4f},{maxy:.4f},{maxx:.4f});
    );
    out count;
    """

    try:
        headers = {"User-Agent": "EmergencyResponsePlatform/0.1 (https://github.com/emergency-response)"}
        async with httpx.AsyncClient(timeout=20.0, headers=headers) as client:
            resp = await client.post(OVERPASS_URL, data={"data": overpass_query})
            if resp.status_code == 200:
                data = resp.json()
                elements = data.get("elements", [])
                if elements and "tags" in elements[0]:
                    count = int(elements[0]["tags"].get("total", 0))
                    _OVERPASS_CACHE[cache_key] = count
                    return count
    except Exception as exc:
        logger.info("Overpass query failed or timed out (%s) — using estimate", exc)

    # Fallback estimate based on area and density: ~40 buildings per sq km
    centroid = polygon.centroid
    cos_lat = max(0.01, math.cos(math.radians(centroid.y)))
    area_sq_km = polygon.area * (111.32 * 111.32 * cos_lat)
    estimated_buildings = max(10, int(area_sq_km * 42))
    _OVERPASS_CACHE[cache_key] = estimated_buildings
    return estimated_buildings


async def assess_event_impact(
    event: DisasterEvent, db: AsyncSession, raster_path: Path = DEFAULT_RASTER_PATH
) -> ImpactZone:
    """
    Main entry point for assessing impact of a single disaster event:
    1. Derive footprint polygon.
    2. Overlay population raster.
    3. Query OSM building counts.
    4. Persist and return ImpactZone.
    """
    # Extract coordinates from event geometry
    point = None
    if event.geometry is not None:
        try:
            # If stored as WKB or WKT
            shapely_geom = wkt.loads(event.geometry) if isinstance(event.geometry, str) else None
            if shapely_geom is None and hasattr(event.geometry, "data"):
                from shapely.wkb import loads as wkb_loads
                shapely_geom = wkb_loads(bytes(event.geometry.data))
            if isinstance(shapely_geom, Point):
                point = shapely_geom
            elif isinstance(shapely_geom, Polygon):
                footprint = shapely_geom
                radius_km = math.sqrt(footprint.area) * 111.32 / 2
        except Exception:
            pass

    if point is None:
        # Fallback coordinate if geometry is missing
        point = Point(80.0, 20.0)

    # Derive footprint polygon based on event type
    if event.event_type == "earthquake":
        radius_km = derive_earthquake_radius_km(event.magnitude, event.depth_km)
    else:
        radius_km = derive_flood_radius_km(event.alert_level, event.magnitude)

    footprint = buffer_point_km(point.x, point.y, radius_km)

    # Zonal statistics
    pop_exposed, area_sq_km = calculate_zonal_population(footprint, raster_path)

    # OSM building count
    building_count = await fetch_osm_building_count(footprint)

    impact_zone = ImpactZone(
        event_id=event.id,
        geometry=footprint.wkt,
        radius_km=round(radius_km, 2),
        population_exposed=pop_exposed,
        building_count=building_count,
        area_sq_km=area_sq_km,
    )
    db.add(impact_zone)
    await db.flush()
    return impact_zone
