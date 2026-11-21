"""Logistics Routing API Router."""

from typing import Any

from fastapi import APIRouter, Query

from app.services.routing import CORRIDOR_WAYPOINTS, routing_engine

router = APIRouter(prefix="/routing", tags=["routing"])


@router.get("/route")
async def calculate_route(
    origin_lat: float = Query(..., ge=-90.0, le=90.0),
    origin_lon: float = Query(..., ge=-180.0, le=180.0),
    dest_lat: float = Query(..., ge=-90.0, le=90.0),
    dest_lon: float = Query(..., ge=-180.0, le=180.0),
    road_accessibility: float = Query(default=1.0, ge=0.0, le=1.0),
) -> dict[str, Any]:
    """Calculate road delivery route, distance, duration, and GeoJSON LineString."""
    return routing_engine.calculate_delivery_route(
        origin_lat=origin_lat,
        origin_lon=origin_lon,
        dest_lat=dest_lat,
        dest_lon=dest_lon,
        road_accessibility=road_accessibility,
    )


@router.get("/corridors")
async def get_corridor_network() -> dict[str, Any]:
    """Return strategic logistics highway waypoints and network topology for map overlay."""
    waypoints_geojson = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [coords[1], coords[0]],
                },
                "properties": {
                    "name": name,
                    "hub_type": "Trunk Logistics Hub",
                },
            }
            for name, coords in CORRIDOR_WAYPOINTS.items()
        ],
    }
    return {
        "waypoints": waypoints_geojson,
        "nodes_count": len(CORRIDOR_WAYPOINTS),
    }

