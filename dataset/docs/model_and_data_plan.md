# Model and data plan

## Data hierarchy
1. **Observed labels**: actual resource quantities requested, delivered, consumed, remaining, and unmet per zone/time from trusted field/agency records.
2. **Published scenario estimates**: useful for method exploration; label as scenario-derived, not observed.
3. **Synthetic demo records**: useful for plumbing and presentations; never mix silently with observed labels.

## What the model needs
Features may include disaster type, severity, affected population, exposed buildings, age-group shares, medical-dependency share, access disruption, response delay, planning horizon and time since event. Every feature needs a definition, unit, timestamp, source and missing-data policy.

The target definition must be consistent. For example, "food packets required" could mean forecast total demand over 72 hours, not a mix of total need, requested amount and delivered amount. The same applies to water litres, medical kits and shelter spaces.

## Training/evaluation
- Start with a simple baseline, then a scikit-learn regression model.
- Keep event IDs for grouped train/test separation.
- Evaluate each target separately with MAE and RMSE; compare with baseline.
- Report sample size, geographic coverage, time period, source provenance and limitations.
- With few real events, report the model as a prototype and do not imply broad generalization.
- Add confidence intervals only after validating their coverage on held-out data.

## Current event recommendations
The current event is not itself a training label. Build current zone features from the live ingestion/geospatial system, then infer demand. As field reports arrive, store them as timestamped observations and re-run predictions; do not silently overwrite prior predictions. Scenario simulations should use copies/parameters and must not mutate actual inventory.

## Human review and safety
Display "estimated demand" separately from "available inventory" and "recommended additional quantity". Keep provenance and a human approval step. In a real emergency, predictions must not replace incident command, public health guidance, or verified field assessments.
