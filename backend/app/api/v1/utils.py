"""API helper utilities for geometry serialization and bounding box parsing."""

from typing import Any

from shapely import wkt
from shapely.geometry import mapping
from shapely.wkb import loads as wkb_loads


def geom_to_geojson(geom: Any) -> dict[str, Any] | None:
    """Safely convert a GeoAlchemy2 element, WKT string, or Shapely geometry to a GeoJSON dict."""
    if geom is None:
        return None
    try:
        # Check if already a dict
        if isinstance(geom, dict):
            return geom
        # Check if WKT / EWKT string
        if isinstance(geom, str):
            clean_wkt = geom.split(";", 1)[-1].strip()
            parsed = wkt.loads(clean_wkt)
            return mapping(parsed)
        # Check if GeoAlchemy2 element
        try:
            from geoalchemy2.shape import to_shape
            shape = to_shape(geom)
            return mapping(shape)
        except Exception:
            pass
        # Check if WKB element
        if hasattr(geom, "data"):
            parsed = wkb_loads(bytes(geom.data))
            return mapping(parsed)
        # Check if it has __geo_interface__
        if hasattr(geom, "__geo_interface__"):
            return geom.__geo_interface__
    except Exception:
        pass
    return None

