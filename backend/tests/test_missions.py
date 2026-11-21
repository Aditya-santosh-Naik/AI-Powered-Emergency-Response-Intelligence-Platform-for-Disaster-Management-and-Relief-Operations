"""Tests for Relief Missions Management and Status State Machine (Weeks 5-6)."""

from starlette.testclient import TestClient


def test_missions_list_endpoint(client: TestClient):
    """Test GET /api/v1/missions endpoint."""
    resp = client.get("/api/v1/missions")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)


def test_mission_status_transition_if_exists(client: TestClient):
    """Test state machine transition for any existing mission."""
    list_resp = client.get("/api/v1/missions")
    assert list_resp.status_code == 200
    missions = list_resp.json()

    if len(missions) > 0:
        target = missions[0]
        mission_id = target["id"]

        # Advance status
        new_status = "DISPATCHED" if target["status"] == "ASSIGNED" else "IN_TRANSIT"
        patch_resp = client.patch(
            f"/api/v1/missions/{mission_id}/status",
            json={"status": new_status, "notes": "Automated test transition."},
        )
        assert patch_resp.status_code in [200, 400]
        if patch_resp.status_code == 200:
            assert patch_resp.json()["status"] == new_status

        # Query transactions
        tx_resp = client.get(f"/api/v1/missions/{mission_id}/transactions")
        assert tx_resp.status_code == 200
        assert isinstance(tx_resp.json(), list)
