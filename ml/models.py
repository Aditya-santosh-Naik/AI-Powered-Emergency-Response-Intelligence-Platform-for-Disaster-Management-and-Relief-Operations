"""Machine learning models, baseline models, and prediction interval regressors."""

import logging
from typing import Any

import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

from ml.config import (
    CATEGORICAL_FEATURES,
    DISASTER_TYPES,
    NUMERIC_FEATURES,
    REGION_TYPES,
    TARGET_METADATA,
)

logger = logging.getLogger(__name__)


def prepare_feature_matrix(
    df: pd.DataFrame, feature_columns: list[str] | None = None
) -> tuple[np.ndarray, list[str]]:
    """Build numeric feature matrix with one-hot encoded categorical columns."""
    df_copy = df.copy()

    # Ensure all numeric features exist and fill missing with median/defaults
    for col in NUMERIC_FEATURES:
        if col not in df_copy.columns:
            df_copy[col] = 0.0
        else:
            df_copy[col] = pd.to_numeric(df_copy[col], errors="coerce").fillna(0.0)

    # Encode categoricals with fixed categories to prevent mismatch
    encoded_dfs = [df_copy[NUMERIC_FEATURES]]

    for cat_col, valid_cats in [
        ("disaster_type", DISASTER_TYPES),
        ("region_type", REGION_TYPES),
    ]:
        series = df_copy[cat_col].astype(str).str.lower() if cat_col in df_copy.columns else pd.Series(["unknown"] * len(df_copy))
        for cat in valid_cats:
            col_name = f"{cat_col}_{cat}"
            encoded_dfs.append(pd.Series((series == cat).astype(float), name=col_name))

    X_df = pd.concat(encoded_dfs, axis=1)

    if feature_columns is not None:
        # Align columns with training feature columns
        for col in feature_columns:
            if col not in X_df.columns:
                X_df[col] = 0.0
        X_df = X_df[feature_columns]
    else:
        feature_columns = list(X_df.columns)

    return X_df.values, feature_columns


class HeuristicBaseline:
    """Domain-specific emergency relief planning baseline using standard heuristic rates."""

    def __init__(self, target_name: str):
        self.target_name = target_name
        self.meta = TARGET_METADATA.get(target_name, {})
        self.mean_fallback = 0.0

    def fit(self, X_df: pd.DataFrame, y: np.ndarray) -> "HeuristicBaseline":
        self.mean_fallback = float(np.mean(y)) if len(y) > 0 else 0.0
        return self

    def predict(self, df: pd.DataFrame) -> np.ndarray:
        pop = pd.to_numeric(df.get("affected_population_estimate", 0), errors="coerce").fillna(0).values
        horizon = pd.to_numeric(df.get("planning_horizon_days", 3), errors="coerce").fillna(3).values
        severity = pd.to_numeric(df.get("severity_score_0_1", 0.5), errors="coerce").fillna(0.5).values
        damage = pd.to_numeric(df.get("building_damage_share_0_1", 0.3), errors="coerce").fillna(0.3).values

        if self.target_name == "target_food_packets_required":
            # Sphere baseline: 2 meals/day * population * days
            preds = pop * horizon * 2.0 * (0.8 + 0.4 * severity)
        elif self.target_name == "target_water_liters_required":
            # Sphere baseline: 5-7 L/day * population * days
            preds = pop * horizon * 5.0 * (0.8 + 0.4 * severity)
        elif self.target_name == "target_medical_kits_required":
            # Primary health trauma kit rate based on severity & population
            preds = (pop / 1000.0) * 80.0 * (0.5 + 0.8 * severity)
        elif self.target_name == "target_shelter_spaces_required":
            # Evacuation displacement based on building damage & severity
            displacement_rate = np.clip(damage * 0.8 + severity * 0.2, 0.05, 0.95)
            preds = pop * displacement_rate
        else:
            preds = np.full_like(pop, self.mean_fallback, dtype=float)

        return np.maximum(preds, 0.0)


class ResourceDemandModelBundle:
    """Ensemble bundle containing point regressor and 80% prediction interval quantile regressors."""

    def __init__(self, target_name: str):
        self.target_name = target_name
        self.point_model = GradientBoostingRegressor(
            n_estimators=120,
            learning_rate=0.08,
            max_depth=5,
            subsample=0.9,
            random_state=42,
        )
        # 10th percentile for lower bound
        self.lower_model = GradientBoostingRegressor(
            loss="quantile",
            alpha=0.10,
            n_estimators=100,
            learning_rate=0.08,
            max_depth=4,
            random_state=42,
        )
        # 90th percentile for upper bound
        self.upper_model = GradientBoostingRegressor(
            loss="quantile",
            alpha=0.90,
            n_estimators=100,
            learning_rate=0.08,
            max_depth=4,
            random_state=42,
        )
        self.heuristic_baseline = HeuristicBaseline(target_name)

    def fit(self, X_train: np.ndarray, y_train: np.ndarray, train_df: pd.DataFrame) -> "ResourceDemandModelBundle":
        logger.info("Fitting models for target: %s (N=%d)", self.target_name, len(y_train))
        self.point_model.fit(X_train, y_train)
        self.lower_model.fit(X_train, y_train)
        self.upper_model.fit(X_train, y_train)
        self.heuristic_baseline.fit(train_df, y_train)
        return self

    def predict(self, X: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
        """Returns (point_predictions, lower_bounds, upper_bounds)."""
        point_preds = np.maximum(self.point_model.predict(X), 0.0)
        lower_preds = np.maximum(self.lower_model.predict(X), 0.0)
        upper_preds = np.maximum(self.upper_model.predict(X), 0.0)

        # Ensure logical ordering: lower <= point <= upper
        lower_preds = np.minimum(lower_preds, point_preds)
        upper_preds = np.maximum(upper_preds, point_preds)

        return point_preds, lower_preds, upper_preds

    def evaluate(
        self, X_test: np.ndarray, y_test: np.ndarray, test_df: pd.DataFrame
    ) -> dict[str, Any]:
        """Evaluate trained model against test data and compare against baselines."""
        point_preds, lower_preds, upper_preds = self.predict(X_test)
        heuristic_preds = self.heuristic_baseline.predict(test_df)
        mean_preds = np.full_like(y_test, np.mean(y_test))

        # Metrics for ML model
        ml_mae = float(mean_absolute_error(y_test, point_preds))
        ml_rmse = float(np.sqrt(mean_squared_error(y_test, point_preds)))
        ml_r2 = float(r2_score(y_test, point_preds))

        # Metrics for Heuristic baseline
        heur_mae = float(mean_absolute_error(y_test, heuristic_preds))
        heur_rmse = float(np.sqrt(mean_squared_error(y_test, heuristic_preds)))
        heur_r2 = float(r2_score(y_test, heuristic_preds))

        # Metrics for Mean baseline
        mean_mae = float(mean_absolute_error(y_test, mean_preds))
        mean_rmse = float(np.sqrt(mean_squared_error(y_test, mean_preds)))

        # Interval empirical coverage on held-out test data
        inside_interval = (y_test >= lower_preds) & (y_test <= upper_preds)
        coverage_pct = float(np.mean(inside_interval) * 100.0)

        # Relative improvement over heuristic baseline
        mae_improvement_pct = round(((heur_mae - ml_mae) / heur_mae) * 100.0, 2) if heur_mae > 0 else 0.0
        rmse_improvement_pct = round(((heur_rmse - ml_rmse) / heur_rmse) * 100.0, 2) if heur_rmse > 0 else 0.0

        return {
            "target": self.target_name,
            "sample_count_test": len(y_test),
            "mae": round(ml_mae, 2),
            "rmse": round(ml_rmse, 2),
            "r2": round(ml_r2, 4),
            "baseline_heuristic_mae": round(heur_mae, 2),
            "baseline_heuristic_rmse": round(heur_rmse, 2),
            "baseline_heuristic_r2": round(heur_r2, 4),
            "baseline_mean_mae": round(mean_mae, 2),
            "baseline_mean_rmse": round(mean_rmse, 2),
            "mae_improvement_pct": mae_improvement_pct,
            "rmse_improvement_pct": rmse_improvement_pct,
            "prediction_interval_nominal": "80% (10th-90th quantile)",
            "test_interval_coverage_pct": round(coverage_pct, 2),
        }
