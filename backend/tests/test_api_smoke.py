"""API smoke tests checking health, OpenAPI documentation, and route availability."""

from starlette.testclient import TestClient


def test_health_check(client: TestClient):
    resp = client.get("/api/v1/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert "Weeks 1–2" in data["module"]


def test_openapi_schema_contains_required_endpoints(client: TestClient):
    resp = client.get("/openapi.json")
    assert resp.status_code == 200
    schema = resp.json()
    paths = schema.get("paths", {})

    # Check key endpoint paths required by R1-R5 and D1
    assert "/api/v1/events" in paths
    assert "/api/v1/events/{event_id}" in paths
    assert "/api/v1/ingestion/trigger" in paths
    assert "/api/v1/ingestion/status" in paths
    assert "/api/v1/depots" in paths
    assert "/api/v1/depots/{depot_id}/inventory/adjust" in paths
    assert "/api/v1/inventory/summary" in paths
    assert "/api/v1/field-operations" in paths
    assert "/api/v1/donors" in paths
    assert "/api/v1/donations" in paths
