"""Tests for Weeks 3-4 Resource Demand Prediction Engine."""

import pytest
from starlette.testclient import TestClient


def test_prediction_status_endpoint(client: TestClient):
    resp = client.get("/api/v1/predictions/status")
    assert resp.status_code == 200
    data = resp.json()
    assert data["service_status"] == "operational"
    assert "v1." in data["model_version"]
    assert len(data["targets"]) == 4
    assert "target_food_packets_required" in data["targets"]
    assert "target_water_liters_required" in data["targets"]
    assert "target_medical_kits_required" in data["targets"]
    assert "target_shelter_spaces_required" in data["targets"]
    assert data["excel_workbook_size_bytes"] > 0


def test_prediction_evaluation_metrics(client: TestClient):
    resp = client.get("/api/v1/predictions/metrics")
    assert resp.status_code == 200
    data = resp.json()
    targets = data["targets"]
    for t in [
        "target_food_packets_required",
        "target_water_liters_required",
        "target_medical_kits_required",
        "target_shelter_spaces_required",
    ]:
        assert t in targets
        t_metrics = targets[t]
        assert t_metrics["mae"] > 0
        assert t_metrics["rmse"] > 0
        assert "baseline_heuristic_mae" in t_metrics
        assert t_metrics["mae_improvement_pct"] > 0
        assert t_metrics["test_interval_coverage_pct"] > 60.0


def test_predict_single_zone(client: TestClient):
    payload = {
        "zone_id": "ZONE-TEST-001",
        "disaster_type": "flood",
        "region_type": "urban",
        "affected_population_estimate": 10000,
        "severity_score_0_1": 0.75,
        "population_density_per_km2": 4500.0,
        "children_share_0_1": 0.25,
        "elderly_share_0_1": 0.16,
        "medical_dependency_share_0_1": 0.10,
        "building_damage_share_0_1": 0.40,
        "road_accessibility_0_1": 0.50,
        "response_delay_hours": 36.0,
        "planning_horizon_days": 3,
        "verified_inventory": {
            "food_packets": 15000,
            "water_liters": 40000,
            "medical_kits": 500,
            "shelter_spaces": 1200,
        },
        "confirmed_incoming": {
            "food_packets": 5000,
            "water_liters": 10000,
            "medical_kits": 100,
            "shelter_spaces": 300,
        },
        "apply_vulnerability_buffer": False,
    }

    resp = client.post("/api/v1/predictions/predict-zone", json=payload)
    assert resp.status_code == 200
    data = resp.json()

    assert data["zone_id"] == "ZONE-TEST-001"
    assert data["urgency_class"] in ["CRITICAL_URGENT", "HIGH_PRIORITY", "MODERATE", "LOW_MONITORING"]
    assert len(data["urgency_reasons"]) > 0

    demands = data["resource_demands"]
    assert "food_packets" in demands
    assert "water_liters" in demands
    assert "medical_kits" in demands
    assert "shelter_spaces" in demands

    # Check numeric predictions & logical ordering
    for k in ["food_packets", "water_liters", "medical_kits", "shelter_spaces"]:
        item = demands[k]
        assert item["predicted_demand"] > 0
        assert item["lower_bound_80pct"] <= item["predicted_demand"]
        assert item["upper_bound_80pct"] >= item["predicted_demand"]
        assert item["verified_available_stock"] is not None
        # Shortage = max(0, predicted_demand - (verified_stock + incoming))
        net_stock = item["verified_available_stock"] + item["confirmed_incoming_supply"]
        expected_shortage = max(0, item["predicted_demand"] - net_stock)
        assert item["additional_quantity_recommended"] == expected_shortage


def test_scenario_simulation(client: TestClient):
    payload = {
        "scenario_name": "Logistics Slower Response + Population Surge",
        "population_multiplier": 1.25,
        "severity_score_delta": 0.15,
        "planning_horizon_days": 5,
        "response_delay_hours_delta": 24.0,
        "inventory_availability_multiplier": 0.8,
    }

    resp = client.post("/api/v1/predictions/scenarios", json=payload)
    assert resp.status_code == 200
    data = resp.json()

    assert "comparisons" in data
    assert "drivers_narrative" in data
    assert len(data["drivers_narrative"]) > 0

    for k in ["food_packets", "water_liters", "medical_kits", "shelter_spaces"]:
        comp = data["comparisons"][k]
        assert "baseline_demand" in comp
        assert "scenario_demand" in comp
        assert "demand_difference" in comp
        assert "demand_difference_pct" in comp
        # With longer horizon and increased population, food and water demand should increase
        if k in ["food_packets", "water_liters"]:
            assert comp["scenario_demand"] > comp["baseline_demand"]


def test_excel_refresh_and_download(client: TestClient):
    resp = client.post("/api/v1/predictions/excel/refresh")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "refreshed"
    assert data["size_bytes"] > 0

    dl_resp = client.get("/api/v1/predictions/excel/download")
    assert dl_resp.status_code == 200
    assert len(dl_resp.content) > 100000
