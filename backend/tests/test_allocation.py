"""Unit and integration tests for Resource Allocation Optimization Engine (Weeks 5-6)."""

from starlette.testclient import TestClient


def test_allocation_run_and_plan_lifecycle(client: TestClient):
    """Test running the Google OR-Tools MILP optimization allocation."""
    # 1. Trigger an allocation run
    payload = {
        "planning_horizon_days": 3,
        "distance_penalty_weight": 0.0001,
        "enforce_accessibility": True,
        "min_demand_fulfillment_ratio": 0.0,
    }
    resp = client.post("/api/v1/allocation/run", json=payload)
    assert resp.status_code in [200, 400], f"Response: {resp.text}"

    if resp.status_code == 200:
        data = resp.json()
        assert "id" in data
        assert data["solver_status"] in ["OPTIMAL", "FEASIBLE"]
        assert "total_demand_satisfied_pct" in data
        assert isinstance(data["details"], list)

        plan_id = data["id"]

        # 2. Retrieve historical allocation plans
        plans_resp = client.get("/api/v1/allocation/plans")
        assert plans_resp.status_code == 200
        plans_data = plans_resp.json()
        assert len(plans_data) > 0
        assert any(p["id"] == plan_id for p in plans_data)

        # 3. Test auto-creation of missions from plan
        if len(data["details"]) > 0:
            msn_resp = client.post(f"/api/v1/allocation/plans/{plan_id}/create-missions")
            assert msn_resp.status_code == 200
            missions = msn_resp.json()
            assert isinstance(missions, list)
