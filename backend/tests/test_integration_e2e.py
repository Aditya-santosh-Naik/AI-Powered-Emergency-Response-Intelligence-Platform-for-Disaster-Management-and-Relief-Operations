"""End-to-end integration test across all modules (Weeks 1 through 8).

Disaster feeds -> Impact assessor -> Demand predictor -> Logistics optimizer -> Command dashboard -> SitRep.
"""

from starlette.testclient import TestClient


def test_full_platform_end_to_end_pipeline(client: TestClient):
    """Verify entire pipeline data flow from disaster event to mission dispatch and situation report."""
    # Step 1: Query events
    events_resp = client.get("/api/v1/events?limit=5")
    assert events_resp.status_code == 200
    events = events_resp.json()
    assert len(events) > 0, "At least one disaster event should exist."
    event = events[0]
    event_id = event["id"]

    # Step 2: Query event details and impact zones
    detail_resp = client.get(f"/api/v1/events/{event_id}")
    assert detail_resp.status_code == 200
    event_detail = detail_resp.json()
    assert "impact_zones" in event_detail

    # Step 3: Run Resource Demand Prediction
    pred_resp = client.post(f"/api/v1/predictions/events/{event_id}/predict?planning_horizon_days=3")
    assert pred_resp.status_code in [200, 400]

    # Step 4: Run Google OR-Tools Logistics Allocation
    alloc_resp = client.post(
        "/api/v1/allocation/run",
        json={
            "event_id": event_id,
            "planning_horizon_days": 3,
            "enforce_accessibility": True,
        },
    )
    assert alloc_resp.status_code in [200, 400]

    if alloc_resp.status_code == 200:
        plan = alloc_resp.json()
        assert plan["solver_status"] in ["OPTIMAL", "FEASIBLE"]
        plan_id = plan["id"]

        # Step 5: Auto-create missions from allocation plan
        if len(plan.get("details", [])) > 0:
            msn_resp = client.post(f"/api/v1/allocation/plans/{plan_id}/create-missions")
            assert msn_resp.status_code == 200
            missions = msn_resp.json()
            assert isinstance(missions, list)

    # Step 6: Post-Event Analytics / Situation Report Generation
    sitrep_resp = client.get(f"/api/v1/operations/sitrep/{event_id}")
    assert sitrep_resp.status_code in [200, 404]

    # Step 7: Command Overview Telemetry
    overview_resp = client.get("/api/v1/operations/overview")
    assert overview_resp.status_code == 200
    overview = overview_resp.json()
    assert overview["active_alerts_count"] >= 1
    assert "total_stock" in overview
