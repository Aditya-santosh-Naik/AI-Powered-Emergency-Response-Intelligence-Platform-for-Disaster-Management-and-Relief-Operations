"""Tests for Logistics Routing Engine and Highway Corridor Network (Weeks 5-6)."""

from starlette.testclient import TestClient

from app.services.routing import haversine_distance, routing_engine


def test_haversine_distance_accuracy():
    """Verify haversine formula against known city pairs."""
    # Delhi (28.6139, 77.2090) to Mumbai (19.0760, 72.8777) ~ 1150 km
    dist = haversine_distance(28.6139, 77.2090, 19.0760, 72.8777)
    assert 1100 <= dist <= 1200, f"Distance calculated: {dist} km"


def test_routing_engine_calculation():
    """Verify route generation between regional depot and disaster zone."""
    res = routing_engine.calculate_delivery_route(
        origin_lat=28.6139,
        origin_lon=77.2090,
        dest_lat=13.0827,
        dest_lon=80.2707,
        road_accessibility=0.8,
    )
    assert "distance_km" in res
    assert "est_duration_hours" in res
    assert res["accessibility_status"] == "Accessible"
    assert "geojson" in res
    assert res["geojson"]["geometry"]["type"] == "LineString"
    assert len(res["geojson"]["geometry"]["coordinates"]) >= 2


def test_routing_api_endpoint(client: TestClient):
    """Test GET /api/v1/routing/route endpoint."""
    resp = client.get(
        "/api/v1/routing/route",
        params={
            "origin_lat": 28.6139,
            "origin_lon": 77.2090,
            "dest_lat": 19.0760,
            "dest_lon": 72.8777,
            "road_accessibility": 0.5,
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["accessibility_status"] == "Restricted"
    assert data["distance_km"] > 0
    assert data["geojson"]["type"] == "Feature"


def test_routing_corridors_endpoint(client: TestClient):
    """Test GET /api/v1/routing/corridors endpoint."""
    resp = client.get("/api/v1/routing/corridors")
    assert resp.status_code == 200
    data = resp.json()
    assert "waypoints" in data
    assert data["nodes_count"] >= 20
