"""Inference engine for predicting zone resource demands with uncertainty bounds and inventory reconciliation."""

import json
import logging
import sys
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

import joblib
import numpy as np
import pandas as pd

from ml.config import (
    ARTIFACTS_DIR,
    DATA_STATUS_OPERATIONAL,
    MODEL_VERSION,
    TARGET_COLUMNS,
    TARGET_METADATA,
)
from ml.models import ResourceDemandModelBundle, prepare_feature_matrix
from ml.vulnerability import evaluate_vulnerability_profile

logger = logging.getLogger("ml.inference")

_LOADED_BUNDLES: dict[str, ResourceDemandModelBundle] | None = None
_FEATURE_COLUMNS: list[str] | None = None
_EVALUATION_METRICS: dict[str, Any] | None = None


def load_inference_artifacts() -> tuple[dict[str, ResourceDemandModelBundle], list[str], dict[str, Any]]:
    """Load model bundles and feature columns from disk, cached in memory."""
    global _LOADED_BUNDLES, _FEATURE_COLUMNS, _EVALUATION_METRICS

    if _LOADED_BUNDLES is not None and _FEATURE_COLUMNS is not None and _EVALUATION_METRICS is not None:
        return _LOADED_BUNDLES, _FEATURE_COLUMNS, _EVALUATION_METRICS

    feat_path = ARTIFACTS_DIR / "feature_columns.json"
    metrics_path = ARTIFACTS_DIR / "evaluation_metrics.json"

    if not feat_path.exists():
        logger.warning("Model artifacts not found on disk. Training initial pipeline now...")
        from ml.train import train_resource_demand_pipeline
        train_resource_demand_pipeline(save_artifacts=True)

    with open(feat_path, "r", encoding="utf-8") as f:
        _FEATURE_COLUMNS = json.load(f)

    if metrics_path.exists():
        with open(metrics_path, "r", encoding="utf-8") as f:
            _EVALUATION_METRICS = json.load(f)
    else:
        _EVALUATION_METRICS = {}

    bundles: dict[str, ResourceDemandModelBundle] = {}
    for target in TARGET_COLUMNS:
        bundle_path = ARTIFACTS_DIR / f"{target}_bundle.joblib"
        if not bundle_path.exists():
            raise FileNotFoundError(f"Model bundle not found for {target} at {bundle_path}")
        bundles[target] = joblib.load(bundle_path)

    _LOADED_BUNDLES = bundles
    logger.info("Successfully loaded ML models for all 4 targets.")
    return _LOADED_BUNDLES, _FEATURE_COLUMNS, _EVALUATION_METRICS


def predict_zone_resource_demand(
    zone_data: dict[str, Any],
    verified_inventory: dict[str, int] | None = None,
    confirmed_incoming: dict[str, int] | None = None,
    apply_vulnerability_buffer: bool = False,
) -> dict[str, Any]:
    """Generate numeric resource predictions, uncertainty intervals, and shortage recommendations for a single zone."""
    bundles, feature_cols, metrics = load_inference_artifacts()

    # Convert zone dict to single-row DataFrame
    df = pd.DataFrame([zone_data])
    X, _ = prepare_feature_matrix(df, feature_columns=feature_cols)

    predictions: dict[str, Any] = {}
    total_shortages: dict[str, int | None] = {}

    vuln_profile = evaluate_vulnerability_profile(zone_data)
    vulnerability_adjustments = vuln_profile["adjustments"]

    for target in TARGET_COLUMNS:
        meta = TARGET_METADATA[target]
        key = meta["short_key"]
        bundle = bundles[target]

        pt_pred, low_pred, up_pred = bundle.predict(X)
        base_val = float(pt_pred[0])
        low_val = float(low_pred[0])
        up_val = float(up_pred[0])

        # Optional coordinator surge buffer
        multiplier = vulnerability_adjustments.get(f"{key}_multiplier", 1.0) if apply_vulnerability_buffer else 1.0
        final_demand = int(round(base_val * multiplier))
        final_lower = int(round(low_val * multiplier))
        final_upper = int(round(up_val * multiplier))

        # Inventory reconciliation
        inv_val = verified_inventory.get(key) if verified_inventory is not None else None
        incoming_val = confirmed_incoming.get(key, 0) if confirmed_incoming is not None else 0

        if inv_val is not None:
            net_available = inv_val + incoming_val
            additional_needed = max(0, final_demand - net_available)
            stock_status = "VERIFIED_STOCK"
        else:
            net_available = incoming_val if incoming_val > 0 else None
            additional_needed = final_demand  # Default to full demand if no verified local stock
            stock_status = "UNVERIFIED_LOCAL_STOCK"

        predictions[key] = {
            "target_variable": target,
            "display_name": meta["display_name"],
            "unit": meta["unit"],
            "base_predicted_demand": int(round(base_val)),
            "vulnerability_multiplier": round(multiplier, 3),
            "predicted_demand": final_demand,
            "lower_bound_80pct": final_lower,
            "upper_bound_80pct": final_upper,
            "verified_available_stock": inv_val,
            "confirmed_incoming_supply": incoming_val,
            "additional_quantity_recommended": additional_needed,
            "stock_verification_status": stock_status,
        }
        total_shortages[key] = additional_needed

    # Calculate zone urgency priority score & why it needs attention
    severity = float(zone_data.get("severity_score_0_1", 0.5))
    pop = int(zone_data.get("affected_population_estimate", 0))
    damage = float(zone_data.get("building_damage_share_0_1", 0.2))
    access = float(zone_data.get("road_accessibility_0_1", 0.8))
    vuln_idx = vuln_profile["vulnerability_index_0_1"]

    urgency_score = (
        (severity * 30.0)
        + (min(pop / 10000.0, 1.0) * 25.0)
        + (damage * 20.0)
        + ((1.0 - access) * 15.0)
        + (vuln_idx * 10.0)
    )

    if urgency_score >= 65:
        urgency_class = "CRITICAL_URGENT"
    elif urgency_score >= 45:
        urgency_class = "HIGH_PRIORITY"
    elif urgency_score >= 25:
        urgency_class = "MODERATE"
    else:
        urgency_class = "LOW_MONITORING"

    # Explain why urgent attention is needed
    urgency_reasons = []
    if severity >= 0.7:
        urgency_reasons.append(f"Severe disaster impact score ({round(severity, 2)})")
    if pop >= 10000:
        urgency_reasons.append(f"Substantial population affected ({pop:,} individuals)")
    if damage >= 0.4:
        urgency_reasons.append(f"Heavy structural/building destruction ({round(damage * 100, 1)}%)")
    if access <= 0.5:
        urgency_reasons.append(f"Severely restricted road access ({round(access * 100, 1)}%) causing logistics bottleneck")
    if vuln_profile["has_elevated_vulnerability"]:
        urgency_reasons.append("High demographic vulnerability requiring urgent specialized care")
    if not urgency_reasons:
        urgency_reasons.append("Routine response monitoring based on baseline exposure")

    zone_id = zone_data.get("zone_id") or "ZONE-UNKNOWN"
    event_id = zone_data.get("event_id") or "EVENT-UNKNOWN"


    return {
        "zone_id": zone_id,
        "event_id": event_id,
        "disaster_type": zone_data.get("disaster_type", "unknown"),
        "severity_score_0_1": severity,
        "affected_population_estimate": pop,
        "planning_horizon_days": int(zone_data.get("planning_horizon_days", 3)),
        "road_accessibility_0_1": access,
        "building_damage_share_0_1": damage,
        "urgency_score_0_100": round(urgency_score, 1),
        "urgency_class": urgency_class,
        "urgency_reasons": urgency_reasons,
        "resource_demands": predictions,
        "vulnerability_profile": vuln_profile,
        "prediction_uncertainty_note": (
            "80% empirical prediction intervals generated via Quantile Gradient Boosting. "
            "Evaluated on held-out disaster events. Use for coordinator planning, not automated dispatch."
        ),
        "model_version": MODEL_VERSION,
        "data_status": DATA_STATUS_OPERATIONAL,
        "human_review_required": True,
        "prediction_timestamp": datetime.now(UTC).isoformat(),
    }


def predict_batch_zones(
    zones_list: list[dict[str, Any]],
    depot_inventory_map: dict[str, dict[str, int]] | None = None,
) -> list[dict[str, Any]]:
    """Predict demand across multiple zones."""
    results = []
    for z in zones_list:
        zid = z.get("zone_id", "")
        inv = depot_inventory_map.get(zid) if depot_inventory_map else None
        res = predict_zone_resource_demand(z, verified_inventory=inv)
        results.append(res)
    return results
