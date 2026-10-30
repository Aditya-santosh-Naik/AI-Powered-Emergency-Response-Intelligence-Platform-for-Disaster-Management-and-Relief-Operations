"""Data loading, schema validation, data quality auditing, and grouped train/test splitting."""

import logging
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from sklearn.model_selection import GroupShuffleSplit

from ml.config import (
    CATEGORICAL_FEATURES,
    DATA_STATUS_SYNTHETIC,
    NUMERIC_FEATURES,
    TARGET_COLUMNS,
    TRAINING_DATA_CSV,
)

logger = logging.getLogger(__name__)


def load_raw_dataset(csv_path: Path | str | None = None) -> pd.DataFrame:
    """Load the raw disaster resource demand CSV dataset."""
    path = Path(csv_path) if csv_path else TRAINING_DATA_CSV
    if not path.exists():
        # Fallback to nested location if not found
        alt_path = Path("dataset/disaster_resource_demand_dataset/disaster_resource_demand_dataset/data/synthetic_demo_training.csv")
        if alt_path.exists():
            path = alt_path
        else:
            raise FileNotFoundError(f"Dataset CSV not found at {path} or {alt_path}")

    df = pd.read_csv(path)
    validate_schema(df)
    return df


def validate_schema(df: pd.DataFrame) -> None:
    """Verify that required columns exist in the dataset."""
    required = set(NUMERIC_FEATURES + CATEGORICAL_FEATURES + TARGET_COLUMNS)
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f"Missing required columns in dataset: {missing}")


def audit_data_quality(df: pd.DataFrame) -> dict[str, Any]:
    """Perform comprehensive data quality audit."""
    total_records = len(df)
    dup_records = int(df["record_id"].duplicated().sum()) if "record_id" in df else 0
    dup_zones = int(df["zone_id"].duplicated().sum()) if "zone_id" in df else 0

    missing_by_col = df.isnull().sum().to_dict()
    total_missing = int(df.isnull().sum().sum())

    # Range checks
    invalid_counts: dict[str, int] = {}
    share_cols = [
        "severity_score_0_1",
        "children_share_0_1",
        "elderly_share_0_1",
        "medical_dependency_share_0_1",
        "building_damage_share_0_1",
        "road_accessibility_0_1",
    ]
    for col in share_cols:
        if col in df:
            invalid_counts[col] = int(((df[col] < 0.0) | (df[col] > 1.0)).sum())

    non_negative_cols = [
        "affected_population_estimate",
        "population_density_per_km2",
        "response_delay_hours",
        "planning_horizon_days",
    ] + TARGET_COLUMNS
    for col in non_negative_cols:
        if col in df:
            invalid_counts[col] = int((df[col] < 0).sum())

    # Target completeness
    target_completeness = {}
    for target in TARGET_COLUMNS:
        valid_count = int(df[target].notnull().sum())
        target_completeness[target] = {
            "valid_records": valid_count,
            "completeness_pct": round((valid_count / total_records) * 100, 2) if total_records > 0 else 0,
            "min": float(df[target].min()),
            "median": float(df[target].median()),
            "max": float(df[target].max()),
            "mean": float(df[target].mean()),
            "std": float(df[target].std()),
        }

    status_counts = df["data_status"].value_counts().to_dict() if "data_status" in df else {DATA_STATUS_SYNTHETIC: total_records}

    report = {
        "total_records": total_records,
        "duplicate_records": dup_records,
        "duplicate_zones": dup_zones,
        "total_missing_values": total_missing,
        "missing_by_column": missing_by_col,
        "invalid_values_by_column": invalid_counts,
        "target_completeness": target_completeness,
        "data_status_distribution": status_counts,
        "unique_events": int(df["event_id"].nunique()) if "event_id" in df else 0,
        "unique_zones": int(df["zone_id"].nunique()) if "zone_id" in df else 0,
    }
    return report


def split_grouped_dataset(
    df: pd.DataFrame, test_size: float = 0.2, random_state: int = 42
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Split dataset grouped by event_id to prevent disaster event leakage.

    All zones belonging to a single disaster event stay entirely within
    either the training set or the test set.
    """
    if "event_id" not in df.columns:
        raise ValueError("Cannot perform grouped split without 'event_id' column")

    gss = GroupShuffleSplit(n_splits=1, test_size=test_size, random_state=random_state)
    train_idx, test_idx = next(gss.split(df, groups=df["event_id"]))

    train_df = df.iloc[train_idx].copy().reset_index(drop=True)
    test_df = df.iloc[test_idx].copy().reset_index(drop=True)

    logger.info(
        "Grouped split completed: %d train records (%d events), %d test records (%d events)",
        len(train_df),
        train_df["event_id"].nunique(),
        len(test_df),
        test_df["event_id"].nunique(),
    )
    return train_df, test_df
