"""Scenario simulation engine for evaluating what-if operational parameters."""

from datetime import UTC, datetime
from typing import Any

from ml.inference import predict_zone_resource_demand


def simulate_zone_scenario(
    baseline_zone_data: dict[str, Any],
    scenario_modifiers: dict[str, Any],
    verified_inventory: dict[str, int] | None = None,
) -> dict[str, Any]:
    """Compare baseline demand and shortages against hypothetical what-if scenario assumptions.

    Scenario simulations strictly execute in-memory and NEVER mutate actual inventory or operational records.
    """
    # 1. Run baseline prediction
    baseline_result = predict_zone_resource_demand(
        baseline_zone_data,
        verified_inventory=verified_inventory,
        apply_vulnerability_buffer=False,
    )

    # 2. Construct hypothetical scenario zone inputs
    hypothetical_zone = dict(baseline_zone_data)

    scenario_name = scenario_modifiers.get("scenario_name", "Hypothetical Scenario")
    scenario_id = scenario_modifiers.get("scenario_id", f"SCENARIO-{datetime.now(UTC).strftime('%Y%m%d%H%M%S')}")

    # Population modification
    pop_mult = float(scenario_modifiers.get("population_multiplier", 1.0))
    if pop_mult != 1.0:
        hypothetical_zone["affected_population_estimate"] = max(
            1, int(round(hypothetical_zone.get("affected_population_estimate", 1000) * pop_mult))
        )
    elif "affected_population_estimate" in scenario_modifiers:
        hypothetical_zone["affected_population_estimate"] = int(scenario_modifiers["affected_population_estimate"])

    # Severity modification
    sev_delta = float(scenario_modifiers.get("severity_score_delta", 0.0))
    if sev_delta != 0.0:
        cur_sev = float(hypothetical_zone.get("severity_score_0_1", 0.5))
        hypothetical_zone["severity_score_0_1"] = max(0.0, min(1.0, cur_sev + sev_delta))
    elif "severity_score_0_1" in scenario_modifiers:
        hypothetical_zone["severity_score_0_1"] = max(0.0, min(1.0, float(scenario_modifiers["severity_score_0_1"])))

    # Planning horizon
    if "planning_horizon_days" in scenario_modifiers:
        hypothetical_zone["planning_horizon_days"] = max(1, min(30, int(scenario_modifiers["planning_horizon_days"])))

    # Response delay
    delay_delta = float(scenario_modifiers.get("response_delay_hours_delta", 0.0))
    if delay_delta != 0.0:
        cur_delay = float(hypothetical_zone.get("response_delay_hours", 24.0))
        hypothetical_zone["response_delay_hours"] = max(0.0, cur_delay + delay_delta)
    elif "response_delay_hours" in scenario_modifiers:
        hypothetical_zone["response_delay_hours"] = max(0.0, float(scenario_modifiers["response_delay_hours"]))

    # Road accessibility
    access_delta = float(scenario_modifiers.get("road_accessibility_delta", 0.0))
    if access_delta != 0.0:
        cur_access = float(hypothetical_zone.get("road_accessibility_0_1", 0.8))
        hypothetical_zone["road_accessibility_0_1"] = max(0.0, min(1.0, cur_access + access_delta))

    # Hypothetical inventory stock
    hypothetical_inventory = dict(verified_inventory) if verified_inventory else {}
    stock_mult = float(scenario_modifiers.get("inventory_availability_multiplier", 1.0))
    if stock_mult != 1.0 and hypothetical_inventory:
        for k in hypothetical_inventory:
            hypothetical_inventory[k] = max(0, int(round(hypothetical_inventory[k] * stock_mult)))
    elif "hypothetical_inventory" in scenario_modifiers:
        hypothetical_inventory = scenario_modifiers["hypothetical_inventory"]

    # 3. Run scenario prediction
    scenario_result = predict_zone_resource_demand(
        hypothetical_zone,
        verified_inventory=hypothetical_inventory,
        apply_vulnerability_buffer=scenario_modifiers.get("apply_vulnerability_buffer", False),
    )

    # 4. Compute comparative differences
    comparisons = {}
    driver_explanations = []

    for res_key in ["food_packets", "water_liters", "medical_kits", "shelter_spaces"]:
        base_res = baseline_result["resource_demands"][res_key]
        scen_res = scenario_result["resource_demands"][res_key]

        demand_diff = scen_res["predicted_demand"] - base_res["predicted_demand"]
        demand_pct = round((demand_diff / base_res["predicted_demand"]) * 100.0, 1) if base_res["predicted_demand"] > 0 else 0.0

        shortage_diff = (scen_res["additional_quantity_recommended"] or 0) - (base_res["additional_quantity_recommended"] or 0)

        comparisons[res_key] = {
            "display_name": base_res["display_name"],
            "unit": base_res["unit"],
            "baseline_demand": base_res["predicted_demand"],
            "scenario_demand": scen_res["predicted_demand"],
            "demand_difference": demand_diff,
            "demand_difference_pct": demand_pct,
            "baseline_shortage": base_res["additional_quantity_recommended"],
            "scenario_shortage": scen_res["additional_quantity_recommended"],
            "shortage_difference": shortage_diff,
            "baseline_stock_assumption": base_res["verified_available_stock"],
            "scenario_stock_assumption": scen_res["verified_available_stock"],
        }

    # Generate narrative summary of drivers
    if pop_mult != 1.0:
        driver_explanations.append(f"Affected population adjusted by {round((pop_mult - 1) * 100, 1)}%")
    if sev_delta != 0.0:
        driver_explanations.append(f"Severity score adjusted by {sev_delta:+.2f}")
    if hypothetical_zone.get("planning_horizon_days") != baseline_zone_data.get("planning_horizon_days"):
        driver_explanations.append(
            f"Planning horizon changed from {baseline_zone_data.get('planning_horizon_days', 3)} to {hypothetical_zone['planning_horizon_days']} days"
        )
    if delay_delta != 0.0:
        driver_explanations.append(f"Response delay adjusted by {delay_delta:+.1f} hours")
    if stock_mult != 1.0:
        driver_explanations.append(f"Stock availability modified to {round(stock_mult * 100)}% of verified inventory")

    return {
        "scenario_id": scenario_id,
        "scenario_name": scenario_name,
        "zone_id": baseline_zone_data.get("zone_id", "ZONE-UNKNOWN"),
        "event_id": baseline_zone_data.get("event_id", "EVENT-UNKNOWN"),
        "timestamp": datetime.now(UTC).isoformat(),
        "baseline_parameters": {
            "affected_population": baseline_zone_data.get("affected_population_estimate"),
            "severity_score": baseline_zone_data.get("severity_score_0_1"),
            "planning_horizon_days": baseline_zone_data.get("planning_horizon_days", 3),
            "response_delay_hours": baseline_zone_data.get("response_delay_hours", 24.0),
            "road_accessibility": baseline_zone_data.get("road_accessibility_0_1", 0.8),
        },
        "scenario_parameters": {
            "affected_population": hypothetical_zone.get("affected_population_estimate"),
            "severity_score": hypothetical_zone.get("severity_score_0_1"),
            "planning_horizon_days": hypothetical_zone.get("planning_horizon_days"),
            "response_delay_hours": hypothetical_zone.get("response_delay_hours"),
            "road_accessibility": hypothetical_zone.get("road_accessibility_0_1"),
        },
        "comparisons": comparisons,
        "drivers_narrative": "; ".join(driver_explanations) if driver_explanations else "No parameter shifts applied",
        "operational_integrity_notice": "Scenario outputs are simulations for risk assessment and DO NOT modify operational stock or database records.",
    }
