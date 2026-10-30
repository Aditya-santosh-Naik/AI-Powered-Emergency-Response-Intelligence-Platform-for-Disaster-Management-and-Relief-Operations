# Disaster Resource Demand Dataset — Mentor Demo Package

## What is included
- `data/synthetic_demo_training.csv`: 2,500 illustrative zone-level records for testing the end-to-end training pipeline.
- `docs/data_dictionary.csv`: key field definitions and units.
- `docs/source_registry.csv`: real source candidates and limitations.
- `docs/model_and_data_plan.md`: recommended path from demo data to defensible real-world training.

## Critical honesty note
`synthetic_demo_training.csv` is **synthetic**, generated from illustrative rules with noise. It is not a downloaded historical dataset and must not be described as observed disaster-response data or used to claim real-world model accuracy. It is suitable for demonstrating schema validation, preprocessing, training code, API wiring, and scenario UI only.

For real operational training, replace or supplement the synthetic records with verified historical zone-level labels. Public event databases often report disaster impacts, not actual resource requirements by zone for all four targets. Keep source URL, license, retrieval date, geographic/time scope, transformations, and observed/estimated/synthetic status for every source.

## Suggested training targets
- `target_food_packets_required`
- `target_water_liters_required`
- `target_medical_kits_required`
- `target_shelter_spaces_required`

These are four separate regression targets. Train and evaluate each target separately at first; do not assume the same error profile or unit across resources.

## Current disaster workflow
1. Ingest current event feeds and field reports.
2. Use the Week 1–2 geospatial pipeline to produce affected zones and current features.
3. Apply the trained model to each current zone.
4. Apply transparent vulnerability adjustments only once (avoid double-counting if vulnerability features are already used by the model).
5. Compare estimated demand with verified available inventory and incoming supply.
6. Return demand, uncertainty, source timestamps, model version, and shortage estimate.
7. Require a coordinator review before operational allocation.

## Confidence intervals
Do not invent confidence intervals. Use a validated method such as quantile regression, bootstrap/conformal intervals, or a suitable count/continuous-target approach, and evaluate interval coverage on held-out real data. Intervals computed on synthetic-only data are demo outputs, not real-world guarantees.

## Before training
- Remove identifiers that leak the target or split related zones/events across train and test.
- Split by disaster event/time where possible, not only random rows.
- Check units, missingness, outliers, leakage, duplicate zones and label definitions.
- Report MAE/RMSE per target and compare against a simple baseline.
- Never call synthetic test performance real-world accuracy.
