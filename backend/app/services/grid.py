"""Grid zone classification service.

Splits affected disaster areas into regular grid cells and computes
composite impact severity scores (0-100) mapped to severity classes.
"""

import logging
import math

from shapely import wkt
from shapely.geometry import Polygon, box
from shapely.wkb import loads as wkb_loads
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models import GridCell, ImpactZone

logger = logging.getLogger(__name__)


def compute_severity_score(
    hazard_intensity: float,
    population_density: float,
    building_density: float,
    weight_hazard: float = settings.severity_weight_hazard,
    weight_population: float = settings.severity_weight_population,
    weight_buildings: float = settings.severity_weight_buildings,
) -> tuple[float, str]:
    """
    Compute 0-100 composite severity score and map to class:
    - Hazard intensity is already in [0, 1].
    - Population density normalized against 2,000 people/km2 ceiling.
    - Building density normalized against 400 buildings/km2 ceiling.
    """
    hazard_norm = min(1.0, max(0.0, hazard_intensity))
    pop_norm = min(1.0, max(0.0, population_density / 2000.0))
    bld_norm = min(1.0, max(0.0, building_density / 400.0))

    raw_score = 100.0 * (
        weight_hazard * hazard_norm
        + weight_population * pop_norm
        + weight_buildings * bld_norm
    )
    score = round(min(100.0, max(0.0, raw_score)), 1)

    if score >= settings.severity_threshold_high:
        s_class = "Critical"
    elif score >= settings.severity_threshold_moderate:
        s_class = "High"
    elif score >= settings.severity_threshold_low:
        s_class = "Moderate"
    else:
        s_class = "Low"

    return score, s_class


async def generate_grid_cells_for_impact_zone(
    impact_zone: ImpactZone,
    db: AsyncSession,
    cell_size_deg: float = settings.grid_cell_size_deg,
) -> list[GridCell]:
    """
    Generate grid cells covering the impact zone polygon, compute severity for each,
    and persist GridCell records.
    """
    # Parse impact zone geometry
    poly: Polygon | None = None
    if isinstance(impact_zone.geometry, str):
        poly = wkt.loads(impact_zone.geometry)
    elif hasattr(impact_zone.geometry, "data"):
        poly = wkb_loads(bytes(impact_zone.geometry.data))

    if poly is None or not poly.is_valid:
        logger.error("Invalid polygon geometry for impact zone %s", impact_zone.id)
        return []

    minx, miny, maxx, maxy = poly.bounds
    centroid = poly.centroid

    # Calculate base densities for the whole zone to distribute across cells
    total_area_km2 = max(1.0, impact_zone.area_sq_km or 100.0)
    avg_pop_density = (impact_zone.population_exposed or 0) / total_area_km2
    avg_bld_density = (impact_zone.building_count or 0) / total_area_km2

    max_dist = max(
        0.01,
        math.sqrt((maxx - centroid.x) ** 2 + (maxy - centroid.y) ** 2),
    )

    cells: list[GridCell] = []
    x = minx
    while x < maxx:
        y = miny
        while y < maxy:
            cell_box = box(x, y, x + cell_size_deg, y + cell_size_deg)
            if poly.intersects(cell_box):
                intersection = poly.intersection(cell_box)
                if not intersection.is_empty and intersection.area > 0:
                    cell_center = cell_box.centroid
                    # Distance from epicenter / centroid determines hazard intensity
                    dist = math.sqrt(
                        (cell_center.x - centroid.x) ** 2 + (cell_center.y - centroid.y) ** 2
                    )
                    dist_factor = max(0.0, 1.0 - (dist / max_dist))
                    hazard_intensity = round(max(0.15, dist_factor), 2)

                    # Population & building densities decrease slightly with distance from core
                    cell_pop_density = round(avg_pop_density * (0.6 + 0.6 * dist_factor), 1)
                    cell_bld_density = round(avg_bld_density * (0.6 + 0.6 * dist_factor), 1)

                    score, s_class = compute_severity_score(
                        hazard_intensity=hazard_intensity,
                        population_density=cell_pop_density,
                        building_density=cell_bld_density,
                    )

                    # Store as cell_box or intersection geometry
                    cell_geom_wkt = cell_box.wkt

                    cell_record = GridCell(
                        event_id=impact_zone.event_id,
                        impact_zone_id=impact_zone.id,
                        geometry=cell_geom_wkt,
                        cell_size_deg=cell_size_deg,
                        hazard_intensity=hazard_intensity,
                        population_density=cell_pop_density,
                        building_density=cell_bld_density,
                        severity_score=score,
                        severity_class=s_class,
                    )
                    db.add(cell_record)
                    cells.append(cell_record)
            y += cell_size_deg
        x += cell_size_deg

    await db.flush()
    return cells
