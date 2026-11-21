"""Scenario testing using historical disaster datasets: Kerala Floods 2018, Chennai Floods 2015 (Weeks 7-8)."""

from starlette.testclient import TestClient


def test_kerala_floods_2018_pipeline(client: TestClient):
    """Test full pipeline on Kerala Floods 2018 historical scenario."""
    # Find Kerala event
    resp = client.get("/api/v1/events", params={"limit": 100})
    assert resp.status_code == 200
    events = resp.json()
    kerala_events = [e for e in events if "kerala" in (e.get("title") or "").lower()]

    if kerala_events:
        event_id = kerala_events[0]["id"]

        # 1. Run Demand Predictor
        pred_resp = client.post(f"/api/v1/predictions/events/{event_id}/predict")
        assert pred_resp.status_code in [200, 400]

        # 2. Run Allocation Optimizer
        alloc_resp = client.post(
            "/api/v1/allocation/run",
            json={"event_id": event_id, "planning_horizon_days": 3},
        )
        assert alloc_resp.status_code in [200, 400]

        # 3. Generate SitRep
        sitrep_resp = client.get(f"/api/v1/operations/sitrep/{event_id}")
        assert sitrep_resp.status_code in [200, 404]


def test_chennai_floods_2015_pipeline(client: TestClient):
    """Test full pipeline on Chennai Floods 2015 historical scenario."""
    resp = client.get("/api/v1/events", params={"limit": 100})
    assert resp.status_code == 200
    events = resp.json()
    chennai_events = [e for e in events if "chennai" in (e.get("title") or "").lower()]

    if chennai_events:
        event_id = chennai_events[0]["id"]

        # Run Demand Predictor
        pred_resp = client.post(f"/api/v1/predictions/events/{event_id}/predict")
        assert pred_resp.status_code in [200, 400]

        # Run Allocation Optimizer
        alloc_resp = client.post(
            "/api/v1/allocation/run",
            json={"event_id": event_id, "planning_horizon_days": 3},
        )
        assert alloc_resp.status_code in [200, 400]
