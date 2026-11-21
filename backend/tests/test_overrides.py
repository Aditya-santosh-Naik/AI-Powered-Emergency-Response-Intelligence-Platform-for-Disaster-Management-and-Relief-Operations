"""Tests for Commander Priority Overrides and RBAC authorization (Weeks 5-6)."""

import pytest
from starlette.testclient import TestClient


@pytest.fixture
def admin_token(client: TestClient):
    resp = client.post(
        "/api/v1/auth/login",
        json={"email": "admin@emergency.gov", "password": "Admin@1234"},
    )
    if resp.status_code == 200:
        return resp.json()["access_token"]
    return None


@pytest.fixture
def reporter_token(client: TestClient):
    resp = client.post(
        "/api/v1/auth/login",
        json={"email": "reporter@emergency.gov", "password": "Reporter@1234"},
    )
    if resp.status_code == 200:
        return resp.json()["access_token"]
    return None


def test_list_overrides(client: TestClient):
    """Test public GET /api/v1/overrides endpoint."""
    resp = client.get("/api/v1/overrides")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


def test_create_override_requires_admin(client: TestClient, reporter_token):
    """Verify non-admin reporter cannot create a priority override."""
    if not reporter_token:
        pytest.skip("Reporter user not seeded.")

    headers = {"Authorization": f"Bearer {reporter_token}"}
    payload = {
        "prediction_id": "00000000-0000-0000-0000-000000000000",
        "overridden_urgency_score": 95.0,
        "overridden_urgency_class": "CRITICAL",
        "justification": "Unauthorized elevation attempt.",
    }
    resp = client.post("/api/v1/overrides", json=payload, headers=headers)
    assert resp.status_code in [403, 401]
