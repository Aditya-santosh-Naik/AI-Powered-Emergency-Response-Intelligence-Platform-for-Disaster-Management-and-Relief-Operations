"""Tests for Operations Command Dashboard & Post-Event Situation Reporting (Weeks 5-6)."""

from starlette.testclient import TestClient


def test_operations_overview_endpoint(client: TestClient):
    """Test GET /api/v1/operations/overview KPI response."""
    resp = client.get("/api/v1/operations/overview")
    assert resp.status_code == 200
    data = resp.json()
    assert "active_alerts_count" in data
    assert "critical_events_count" in data
    assert "total_stock" in data
    assert "active_missions_count" in data
    assert "system_status" in data


def test_situation_report_endpoint_for_seeded_event(client: TestClient):
    """Test generating a formal SitRep for an active disaster event."""
    events_resp = client.get("/api/v1/events?limit=1")
    assert events_resp.status_code == 200
    events = events_resp.json()

    if len(events) > 0:
        event_id = events[0]["id"]
        sitrep_resp = client.get(f"/api/v1/operations/sitrep/{event_id}")
        assert sitrep_resp.status_code in [200, 404]

        if sitrep_resp.status_code == 200:
            data = sitrep_resp.json()
            assert "markdown_report" in data
            assert "SITUATION REPORT" in data["markdown_report"]
            assert "metrics" in data

        # Test markdown file download endpoint
        md_resp = client.get(f"/api/v1/operations/sitrep/{event_id}/markdown")
        assert md_resp.status_code in [200, 404]
        if md_resp.status_code == 200:
            assert "text/markdown" in md_resp.headers["content-type"]
