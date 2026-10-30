"""Configuration for Disaster Resource Demand Prediction Engine (Weeks 3-4)."""

from pathlib import Path

# Paths
BASE_DIR = Path(__file__).resolve().parent.parent
ML_DIR = BASE_DIR / "ml"
ARTIFACTS_DIR = ML_DIR / "artifacts"
DATASET_DIR = BASE_DIR / "dataset"
TRAINING_DATA_CSV = DATASET_DIR / "data" / "synthetic_demo_training.csv"
EXCEL_WORKBOOK_PATH = DATASET_DIR / "disaster_resource_demand_dataset.xlsx"

# Ensure artifacts directory exists
ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)

# Target definitions
TARGET_COLUMNS = [
    "target_food_packets_required",
    "target_water_liters_required",
    "target_medical_kits_required",
    "target_shelter_spaces_required",
]

TARGET_METADATA = {
    "target_food_packets_required": {
        "display_name": "Food Packets Required",
        "short_key": "food_packets",
        "unit": "packets",
        "description": "Total standardized meal packets required for the affected population over the planning horizon.",
        "heuristic_daily_rate": 2.0,  # 2 food packets per person per day baseline heuristic
    },
    "target_water_liters_required": {
        "display_name": "Clean Water Required",
        "short_key": "water_liters",
        "unit": "liters",
        "description": "Total potable clean water required in liters (WHO Sphere standard guideline baseline).",
        "heuristic_daily_rate": 5.0,  # 5 liters water per person per day baseline heuristic
    },
    "target_medical_kits_required": {
        "display_name": "Medical Kits Required",
        "short_key": "medical_kits",
        "unit": "kits",
        "description": "Standardized trauma and emergency healthcare relief kits required for injured and vulnerable people.",
        "heuristic_rate_per_1000": 80.0,  # ~80 kits per 1000 affected with baseline severity
    },
    "target_shelter_spaces_required": {
        "display_name": "Shelter Spaces Required",
        "short_key": "shelter_spaces",
        "unit": "spaces",
        "description": "Emergency temporary shelter bed/space capacity needed for displaced populations.",
        "heuristic_displacement_rate": 0.40,  # ~40% displacement under typical high damage
    },
}

# Features
NUMERIC_FEATURES = [
    "affected_population_estimate",
    "severity_score_0_1",
    "population_density_per_km2",
    "children_share_0_1",
    "elderly_share_0_1",
    "medical_dependency_share_0_1",
    "building_damage_share_0_1",
    "road_accessibility_0_1",
    "response_delay_hours",
    "planning_horizon_days",
]

CATEGORICAL_FEATURES = [
    "disaster_type",
    "region_type",
]

DISASTER_TYPES = ["flood", "earthquake", "cyclone", "landslide", "wildfire"]
REGION_TYPES = ["urban", "peri_urban", "rural"]

MODEL_VERSION = "v1.2.0-ensemble-quantile"
DATA_STATUS_SYNTHETIC = "SYNTHETIC_DEMO_NOT_REAL_OBSERVATIONS"
DATA_STATUS_OPERATIONAL = "ESTIMATED_DEMAND_COORDINATOR_REVIEW_REQUIRED"
