"""Unit tests for geospatial impact assessment and grid severity scoring."""

from shapely.geometry import Polygon

from app.services.grid import compute_severity_score
from app.services.impact import (
    DEFAULT_RASTER_PATH,
    buffer_point_km,
    calculate_zonal_population,
    derive_earthquake_radius_km,
    derive_flood_radius_km,
)


def test_earthquake_radius_model():
    # Shallow M6.0 quake should have significant impact radius
    r_shallow = derive_earthquake_radius_km(magnitude=6.0, depth_km=10.0)
    # Deep M6.0 quake should have attenuated surface radius
    r_deep = derive_earthquake_radius_km(magnitude=6.0, depth_km=70.0)
    assert r_shallow > r_deep
    assert 5.0 <= r_shallow <= 350.0
    assert 5.0 <= r_deep <= 350.0

    # Low magnitude bound check
    r_tiny = derive_earthquake_radius_km(magnitude=2.0, depth_km=10.0)
    assert r_tiny == 5.0  # minimum lower bound


def test_flood_radius_model():
    r_red = derive_flood_radius_km(alert_level="Red", magnitude=None)
    r_orange = derive_flood_radius_km(alert_level="Orange", magnitude=None)
    r_green = derive_flood_radius_km(alert_level="Green", magnitude=None)
    assert r_red > r_orange > r_green


def test_buffer_point_km():
    poly = buffer_point_km(lon=85.0, lat=20.0, radius_km=25.0)
    assert isinstance(poly, Polygon)
    assert poly.is_valid
    assert not poly.is_empty
    # Centroid should be approximately at (85.0, 20.0)
    assert abs(poly.centroid.x - 85.0) < 0.01
    assert abs(poly.centroid.y - 20.0) < 0.01


def test_zonal_population_raster_overlay():
    assert DEFAULT_RASTER_PATH.exists(), "Sample population raster should exist in fixtures"
    # Create test polygon within South Asia raster extent (e.g. lon 78.0, lat 22.0)
    poly = buffer_point_km(lon=78.0, lat=22.0, radius_km=30.0)
    pop_exposed, area_sq_km = calculate_zonal_population(poly, DEFAULT_RASTER_PATH)
    assert area_sq_km > 0
    assert pop_exposed > 0


def test_severity_scoring_and_classes():
    # High hazard + high pop + high buildings -> Critical
    score_crit, class_crit = compute_severity_score(
        hazard_intensity=0.9,
        population_density=2500.0,
        building_density=500.0,
    )
    assert score_crit >= 75.0
    assert class_crit == "Critical"

    # Moderate conditions -> Moderate or High
    score_mod, class_mod = compute_severity_score(
        hazard_intensity=0.4,
        population_density=600.0,
        building_density=100.0,
    )
    assert 25.0 <= score_mod < 75.0
    assert class_mod in ("Moderate", "High")

    # Low intensity & sparse population -> Low
    score_low, class_low = compute_severity_score(
        hazard_intensity=0.1,
        population_density=50.0,
        building_density=5.0,
    )
    assert score_low < 25.0
    assert class_low == "Low"
