"""Training script for the 4 resource demand regression models with event-grouped validation."""

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
import pandas as pd

from ml.config import (

    ARTIFACTS_DIR,
    DATA_STATUS_SYNTHETIC,
    MODEL_VERSION,
    TARGET_COLUMNS,
    TARGET_METADATA,
)
from ml.data_loader import audit_data_quality, load_raw_dataset, split_grouped_dataset
from ml.models import ResourceDemandModelBundle, prepare_feature_matrix

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("ml.train")


def train_resource_demand_pipeline(
    csv_path: Path | str | None = None,
    save_artifacts: bool = True,
    random_state: int = 42,
) -> dict[str, Any]:
    """Train all four resource demand regression models and record honest evaluation metrics."""
    logger.info("Loading disaster resource demand dataset...")
    df = load_raw_dataset(csv_path)

    # Perform data quality audit
    quality_report = audit_data_quality(df)
    logger.info(
        "Data quality audit: %d records, %d unique events, %d missing values.",
        quality_report["total_records"],
        quality_report["unique_events"],
        quality_report["total_missing_values"],
    )

    # Grouped train/test split by disaster event
    train_df, test_df = split_grouped_dataset(df, test_size=0.2, random_state=random_state)

    # Prepare feature matrices
    X_train, feature_cols = prepare_feature_matrix(train_df)
    X_test, _ = prepare_feature_matrix(test_df, feature_columns=feature_cols)

    evaluations: dict[str, Any] = {}
    fitted_bundles: dict[str, ResourceDemandModelBundle] = {}

    for target in TARGET_COLUMNS:
        logger.info("--- Training model for: %s ---", target)
        y_train = train_df[target].values.astype(float)
        y_test = test_df[target].values.astype(float)

        bundle = ResourceDemandModelBundle(target)
        bundle.fit(X_train, y_train, train_df)

        metrics = bundle.evaluate(X_test, y_test, test_df)
        metrics["model_name"] = "GradientBoostingRegressor (Ensemble + Quantile Bounds)"
        metrics["sample_count_train"] = len(train_df)
        metrics["train_events_count"] = train_df["event_id"].nunique()
        metrics["test_events_count"] = test_df["event_id"].nunique()
        metrics["model_version"] = MODEL_VERSION
        metrics["dataset_status"] = DATA_STATUS_SYNTHETIC
        metrics["evaluation_timestamp"] = datetime.now(UTC).isoformat()
        metrics["validation_method"] = "Event-Grouped Held-Out Test Split (GroupShuffleSplit, 80/20)"
        metrics["limitations"] = (
            "Trained and evaluated on synthetic demonstration records. "
            "Must be supplemented with verified operational field records before real disaster dispatch."
        )

        evaluations[target] = metrics
        fitted_bundles[target] = bundle

        logger.info(
            "[%s] MAE: %.2f | RMSE: %.2f | Baseline Heuristic MAE: %.2f (%.1f%% improvement) | 80%% Interval Coverage: %.1f%%",
            target,
            metrics["mae"],
            metrics["rmse"],
            metrics["baseline_heuristic_mae"],
            metrics["mae_improvement_pct"],
            metrics["test_interval_coverage_pct"],
        )

    # Save artifacts if requested
    if save_artifacts:
        ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)

        # Save feature column names
        feature_cols_path = ARTIFACTS_DIR / "feature_columns.json"
        with open(feature_cols_path, "w", encoding="utf-8") as f:
            json.dump(feature_cols, f, indent=2)

        # Save model bundles
        for target, bundle in fitted_bundles.items():
            model_path = ARTIFACTS_DIR / f"{target}_bundle.joblib"
            joblib.dump(bundle, model_path)
            logger.info("Saved model artifact to %s", model_path)

        # Save evaluation metrics
        metrics_payload = {
            "model_version": MODEL_VERSION,
            "trained_at": datetime.now(UTC).isoformat(),
            "feature_columns": feature_cols,
            "evaluations": evaluations,
            "data_quality_report": quality_report,
        }
        metrics_path = ARTIFACTS_DIR / "evaluation_metrics.json"
        with open(metrics_path, "w", encoding="utf-8") as f:
            json.dump(metrics_payload, f, indent=2)
        logger.info("Saved evaluation summary to %s", metrics_path)

    return {
        "status": "success",
        "model_version": MODEL_VERSION,
        "evaluations": evaluations,
        "data_quality_report": quality_report,
        "feature_count": len(feature_cols),
    }


if __name__ == "__main__":
    train_resource_demand_pipeline()
