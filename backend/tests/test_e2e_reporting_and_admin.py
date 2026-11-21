"""End-to-end integration tests for Disaster Reporting, Admin Review, and ML Resource Demand Prediction.

Tests A through I verify:
- Test A: User report submission & persistence
- Test B: Input validation & boundary rejection
- Test C: Authentication & server-side RBAC enforcement
- Test D: Admin report review lifecycle
- Test E: ML Model 4-target inference & non-negativity
- Test F: Depot inventory reconciliation & shortage calculations
- Test G: Scenario simulation & baseline preservation
- Test H: Excel workbook sheets & target columns
- Test I: Full End-to-End User -> Admin -> Predictor -> Inventory -> History workflow
"""

import os
import random
import uuid
from datetime import UTC, datetime

import openpyxl
import pytest
from ml.config import EXCEL_WORKBOOK_PATH, TARGET_COLUMNS
from ml.inference import predict_zone_resource_demand
from starlette.testclient import TestClient

from app.services.prediction import calculate_resource_shortage


@pytest.fixture
def auth_tokens(client: TestClient):
    """Retrieve JWT access tokens for seeded demo admin and reporter accounts."""
    # Login reporter
    resp_rep = client.post(
        "/api/v1/auth/login",
        json={"email": "reporter@emergency.gov", "password": "Reporter@1234"},
    )
    assert resp_rep.status_code == 200, f"Reporter login failed: {resp_rep.text}"
    reporter_token = resp_rep.json()["access_token"]

    # Login admin
    resp_adm = client.post(
        "/api/v1/auth/login",
        json={"email": "admin@emergency.gov", "password": "Admin@1234"},
    )
    assert resp_adm.status_code == 200, f"Admin login failed: {resp_adm.text}"
    admin_token = resp_adm.json()["access_token"]

    return {
        "reporter": reporter_token,
        "admin": admin_token,
    }


# ==========================================
# Test A: User report submission
# ==========================================
def test_a_user_report_submission(client: TestClient, auth_tokens: dict):
    headers = {"Authorization": f"Bearer {auth_tokens['reporter']}"}
    suffix = uuid.uuid4().hex[:6]
    payload = {
        "disaster_type": "flood",
        "title": f"Severe Embankment Breach in Majuli {suffix}",
        "description": "Rising Brahmaputra water submerged 6 villages and severed ferry access.",
        "location_name": f"Majuli Island {suffix}, Assam",
        "latitude": round(26.8000 + random.uniform(0.05, 0.4), 4),
        "longitude": round(94.1000 + random.uniform(0.05, 0.4), 4),
        "occurred_at": datetime.now(UTC).isoformat(),
        "estimated_affected_population": 8500,
        "estimated_damage_severity": 0.70,
        "road_accessible": False,
    }
    resp = client.post("/api/v1/reports", json=payload, headers=headers)
    assert resp.status_code == 201, f"Report submission failed: {resp.text}"
    data = resp.json()
    assert "id" in data
    assert data["report_code"].startswith("REP-")
    assert data["status"] == "PENDING_REVIEW"
    assert suffix in data["location_name"]
    assert data["estimated_affected_population"] == 8500
    assert data["road_accessible"] is False

    # Retrieve by ID
    get_resp = client.get(f"/api/v1/reports/{data['id']}", headers=headers)
    assert get_resp.status_code == 200
    assert get_resp.json()["report_code"] == data["report_code"]


# ==========================================
# Test B: Input validation
# ==========================================
def test_b_input_validation(client: TestClient, auth_tokens: dict):
    headers = {"Authorization": f"Bearer {auth_tokens['reporter']}"}

    # 1. Invalid coordinates (> 90 lat)
    resp = client.post(
        "/api/v1/reports",
        json={
            "disaster_type": "flood",
            "title": "Invalid Lat",
            "description": "Lat over 90",
            "location_name": "Arctic",
            "latitude": 105.0,
            "longitude": 75.0,
            "occurred_at": datetime.now(UTC).isoformat(),
        },
        headers=headers,
    )
    assert resp.status_code == 422
    assert "latitude" in resp.text.lower() or "90" in resp.text

    # 2. Invalid disaster type
    resp2 = client.post(
        "/api/v1/reports",
        json={
            "disaster_type": "alien_invasion",
            "title": "Invalid Type",
            "description": "Alien invasion",
            "location_name": "Delhi",
            "latitude": 28.5,
            "longitude": 77.2,
            "occurred_at": datetime.now(UTC).isoformat(),
        },
        headers=headers,
    )
    assert resp2.status_code == 422
    assert "Invalid disaster type" in resp2.text

    # 3. Missing required field (title)
    resp3 = client.post(
        "/api/v1/reports",
        json={
            "disaster_type": "flood",
            "description": "Missing title",
            "location_name": "Assam",
            "latitude": 26.0,
            "longitude": 91.0,
            "occurred_at": datetime.now(UTC).isoformat(),
        },
        headers=headers,
    )
    assert resp3.status_code == 422


# ==========================================
# Test C: Authentication & Server-side Authorization
# ==========================================
def test_c_authentication_and_authorization(client: TestClient, auth_tokens: dict):
    # 1. Unauthenticated request rejected
    resp_unauth = client.post(
        "/api/v1/reports",
        json={
            "disaster_type": "flood",
            "title": "Unauth Report",
            "description": "Should fail",
            "location_name": "Delhi",
            "latitude": 28.6,
            "longitude": 77.2,
            "occurred_at": datetime.now(UTC).isoformat(),
        },
    )
    assert resp_unauth.status_code == 401

    # 2. Reporter cannot access admin-only reports list (/reports)
    resp_forbidden = client.get(
        "/api/v1/reports",
        headers={"Authorization": f"Bearer {auth_tokens['reporter']}"},
    )
    assert resp_forbidden.status_code == 403
    assert "Admin / Relief Coordinator privileges required" in resp_forbidden.text

    # 3. Admin CAN access admin-only reports list
    resp_admin = client.get(
        "/api/v1/reports",
        headers={"Authorization": f"Bearer {auth_tokens['admin']}"},
    )
    assert resp_admin.status_code == 200
    assert isinstance(resp_admin.json(), list)


# ==========================================
# Test D: Admin report review lifecycle
# ==========================================
def test_d_admin_report_review(client: TestClient, auth_tokens: dict):
    # First submit report as reporter
    rep_headers = {"Authorization": f"Bearer {auth_tokens['reporter']}"}
    adm_headers = {"Authorization": f"Bearer {auth_tokens['admin']}"}

    suffix = uuid.uuid4().hex[:6]
    sub_resp = client.post(
        "/api/v1/reports",
        json={
            "disaster_type": "earthquake",
            "title": f"Tremors in Kangra Valley {suffix}",
            "description": "Cracks observed in older masonry structures.",
            "location_name": f"Dharamshala {suffix}, Himachal Pradesh",
            "latitude": round(32.1000 + random.uniform(0.05, 0.4), 4),
            "longitude": round(76.2000 + random.uniform(0.05, 0.4), 4),
            "occurred_at": datetime.now(UTC).isoformat(),
            "estimated_affected_population": 3200,
            "estimated_damage_severity": 0.40,
        },
        headers=rep_headers,
    )
    assert sub_resp.status_code == 201
    report_id = sub_resp.json()["id"]

    # Admin reviews: Request Info
    review1 = client.patch(
        f"/api/v1/reports/{report_id}/review",
        json={"status": "ADDITIONAL_INFO_REQUIRED", "admin_notes": "Awaiting report from local SDMA"},
        headers=adm_headers,
    )
    assert review1.status_code == 200
    assert review1.json()["status"] == "ADDITIONAL_INFO_REQUIRED"
    assert review1.json()["admin_notes"] == "Awaiting report from local SDMA"
    assert review1.json()["reviewed_by_name"] is not None

    # Admin accepts for assessment
    review2 = client.patch(
        f"/api/v1/reports/{report_id}/review",
        json={"status": "ACCEPTED_FOR_ASSESSMENT", "admin_notes": "Field team confirmed damage; proceeding to assessment."},
        headers=adm_headers,
    )
    assert review2.status_code == 200
    assert review2.json()["status"] == "ACCEPTED_FOR_ASSESSMENT"


# ==========================================
# Test E: Model integration
# ==========================================
def test_e_model_integration():
    sample_zone = {
        "zone_id": "ZONE-TEST-001",
        "event_id": "EVENT-TEST-001",
        "disaster_type": "flood",
        "region_type": "rural",
        "affected_population_estimate": 10000,
        "severity_score_0_1": 0.65,
        "population_density_per_km2": 450.0,
        "children_share_0_1": 0.22,
        "elderly_share_0_1": 0.14,
        "medical_dependency_share_0_1": 0.08,
        "building_damage_share_0_1": 0.45,
        "road_accessibility_0_1": 0.70,
        "response_delay_hours": 12.0,
        "planning_horizon_days": 3,
    }
    result = predict_zone_resource_demand(sample_zone)
    assert result is not None
    assert "resource_demands" in result

    demands = result["resource_demands"]
    assert "food_packets" in demands
    assert "water_liters" in demands
    assert "medical_kits" in demands
    assert "shelter_spaces" in demands

    # Check numeric, positive values and appropriate units
    assert demands["food_packets"]["predicted_demand"] > 0
    assert demands["food_packets"]["unit"] == "packets"
    assert demands["water_liters"]["predicted_demand"] > 0
    assert demands["water_liters"]["unit"] == "liters"
    assert demands["medical_kits"]["predicted_demand"] > 0
    assert demands["medical_kits"]["unit"] == "kits"
    assert demands["shelter_spaces"]["predicted_demand"] > 0
    assert demands["shelter_spaces"]["unit"] == "spaces"


# ==========================================
# Test F: Inventory and recommendations
# ==========================================
def test_f_inventory_and_recommendations():
    # Demand = 10,000, Stock = 6,000, Pipeline = 1,000 -> Shortage = 3,000
    rec = calculate_resource_shortage(
        predicted_demand=10000,
        verified_available_stock=6000,
        confirmed_incoming_supply=1000,
    )
    assert rec["shortage"] == 3000
    assert rec["additional_quantity_recommended"] == 3000
    assert rec["stock_verification_status"] == "VERIFIED"

    # When stock is unknown (None), shortage should be None and NOT 0
    rec_unknown = calculate_resource_shortage(
        predicted_demand=10000,
        verified_available_stock=None,
    )
    assert rec_unknown["shortage"] is None
    assert rec_unknown["additional_quantity_recommended"] is None
    assert rec_unknown["stock_verification_status"] == "UNKNOWN_STOCK"

    # Excess stock: Demand = 5,000, Stock = 8,000 -> Shortage = 0
    rec_surplus = calculate_resource_shortage(
        predicted_demand=5000,
        verified_available_stock=8000,
        confirmed_incoming_supply=500,
    )
    assert rec_surplus["shortage"] == 0
    assert rec_surplus["additional_quantity_recommended"] == 0


# ==========================================
# Test G: Scenario simulation
# ==========================================
def test_g_scenario_simulation(client: TestClient):
    payload = {
        "zone_data": {
            "zone_id": "ZONE-SCENARIO-01",
            "disaster_type": "cyclone",
            "region_type": "coastal",
            "affected_population_estimate": 15000,
            "severity_score_0_1": 0.75,
            "road_accessibility_0_1": 0.50,
            "response_delay_hours": 8.0,
            "planning_horizon_days": 3,
            "verified_inventory": {
                "food_packets": 20000,
                "water_liters": 50000,
                "medical_kits": 800,
                "shelter_spaces": 1500,
            },
        },
        "scenario_name": "High Surge + Cut Off Roads",
        "population_multiplier": 1.5,
        "road_accessibility_delta": -0.3,
    }
    resp = client.post("/api/v1/predictions/scenarios", json=payload)
    assert resp.status_code == 200, f"Scenario simulation failed: {resp.text}"
    data = resp.json()
    assert data["scenario_name"] == "High Surge + Cut Off Roads"
    assert "comparisons" in data
    # Scenario demand should be higher than baseline due to 1.5x population multiplier
    food_comp = data["comparisons"]["food_packets"]
    assert food_comp["scenario_demand"] > food_comp["baseline_demand"]
    assert food_comp["demand_difference"] > 0


# ==========================================
# Test H: Excel integration
# ==========================================
def test_h_excel_integration():
    assert os.path.exists(EXCEL_WORKBOOK_PATH), f"Excel workbook not found at {EXCEL_WORKBOOK_PATH}"
    wb = openpyxl.load_workbook(EXCEL_WORKBOOK_PATH, read_only=True)
    required_sheets = [
        "Training_Data",
        "Data_Dictionary",
        "Source_Registry",
        "Data_Quality_Report",
        "Training_Evaluation",
        "Prediction_Results",
        "Scenario_Comparison",
    ]
    for sheet_name in required_sheets:
        assert sheet_name in wb.sheetnames, f"Sheet '{sheet_name}' missing from Excel workbook"

    # Check target columns in Training_Data
    ws = wb["Training_Data"]
    header_row = [cell for cell in next(ws.iter_rows(values_only=True))]
    for target in TARGET_COLUMNS:
        assert target in header_row, f"Mandatory target column '{target}' missing from Training_Data sheet"
    wb.close()


# ==========================================
# Test I: Full End-to-End Workflow
# ==========================================
def test_i_full_end_to_end_workflow(client: TestClient, auth_tokens: dict):
    rep_headers = {"Authorization": f"Bearer {auth_tokens['reporter']}"}
    adm_headers = {"Authorization": f"Bearer {auth_tokens['admin']}"}

    suffix = uuid.uuid4().hex[:6]
    sub_resp = client.post(
        "/api/v1/reports",
        json={
            "disaster_type": "cyclone",
            "title": f"Severe Cyclone Landfall along Paradip Coast {suffix}",
            "description": "Catastrophic winds up to 130 km/h damaging coastal infrastructure and fishing hamlets.",
            "location_name": f"Paradip Port Zone {suffix}, Jagatsinghpur, Odisha",
            "latitude": round(20.3000 + random.uniform(0.05, 0.4), 4),
            "longitude": round(86.6000 + random.uniform(0.05, 0.4), 4),
            "occurred_at": datetime.now(UTC).isoformat(),
            "estimated_affected_population": 22000,
            "estimated_damage_severity": 0.85,
            "road_accessible": False,
        },
        headers=rep_headers,
    )
    assert sub_resp.status_code == 201
    report = sub_resp.json()
    report_id = report["id"]
    assert report["status"] == "PENDING_REVIEW"
    assert report["report_code"].startswith("REP-")

    # Step 2: Admin reviews and accepts the report
    rev_resp = client.patch(
        f"/api/v1/reports/{report_id}/review",
        json={
            "status": "ACCEPTED_FOR_ASSESSMENT",
            "admin_notes": "Validated via IMD Doppler radar and district magistrate notification.",
        },
        headers=adm_headers,
    )
    assert rev_resp.status_code == 200
    assert rev_resp.json()["status"] == "ACCEPTED_FOR_ASSESSMENT"

    # Step 3: Admin triggers full End-to-End assessment and ML predictor
    assess_resp = client.post(
        f"/api/v1/reports/{report_id}/assess-and-predict?planning_horizon_days=3&apply_vulnerability_buffer=true",
        headers=adm_headers,
    )
    assert assess_resp.status_code == 200, f"Assess and predict failed: {assess_resp.text}"
    assess_data = assess_resp.json()
    assert "associated_event_id" in assess_data
    assert len(assess_data["predictions"]) > 0

    pred = assess_data["predictions"][0]
    assert pred["planning_horizon_days"] == 3
    assert pred["model_version"] == "v1.2.0-ensemble-quantile"

    demands = pred["resource_demands"]
    assert demands["food_packets"]["predicted_demand"] > 0
    assert demands["water_liters"]["predicted_demand"] > 0
    assert demands["medical_kits"]["predicted_demand"] > 0
    assert demands["shelter_spaces"]["predicted_demand"] > 0

    # Step 4: Verify prediction was persisted in DB and can be retrieved via prediction history
    hist_resp = client.get("/api/v1/predictions/history?limit=10")
    assert hist_resp.status_code == 200
    history = hist_resp.json()
    assert len(history) > 0
