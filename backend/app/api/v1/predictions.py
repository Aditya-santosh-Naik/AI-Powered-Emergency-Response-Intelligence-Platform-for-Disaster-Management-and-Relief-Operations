"""Resource Demand Prediction API router (Weeks 3-4)."""

import os
from datetime import UTC, datetime
from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models import PredictionHistory, ResourcePrediction
from app.schemas import (
    DynamicRecalculationRequest,
    ModelStatusOut,
    PredictionHistoryOut,
    ScenarioSimulationRequest,
    SingleZonePredictionRequest,
    ZonePredictionOut,
)
from app.services.prediction import (
    execute_dynamic_recalculation,
    get_depot_inventory_totals,
    predict_event_resource_needs,
)
from ml.config import (
    EXCEL_WORKBOOK_PATH,
    MODEL_VERSION,
    TARGET_COLUMNS,
    TARGET_METADATA,
)
from ml.excel_generator import generate_excel_workbook
from ml.inference import load_inference_artifacts, predict_zone_resource_demand
from ml.scenario import simulate_zone_scenario

router = APIRouter(prefix="/predictions", tags=["predictions"])


@router.get("/status", response_model=ModelStatusOut)
async def get_model_status():
    """Retrieve service health, loaded ML model version, and Excel dataset status."""
    _, feature_cols, eval_summary = load_inference_artifacts()
    evaluations = eval_summary.get("evaluations", {})
    trained_at = eval_summary.get("trained_at")

    wb_path = Path(EXCEL_WORKBOOK_PATH)
    wb_exists = wb_path.exists()
    wb_size = wb_path.stat().st_size if wb_exists else 0
    wb_mtime = (
        datetime.fromtimestamp(wb_path.stat().st_mtime, tz=UTC).isoformat()
        if wb_exists
        else None
    )

    return ModelStatusOut(
        service_status="operational",
        model_version=MODEL_VERSION,
        trained_at=trained_at,
        targets=TARGET_COLUMNS,
        features_count=len(feature_cols),
        excel_workbook_path=str(wb_path),
        excel_workbook_size_bytes=wb_size,
        excel_last_modified=wb_mtime,
        evaluations=evaluations,
    )


@router.get("/metrics")
async def get_model_evaluation_metrics():
    """Return actual training and test evaluation metrics for all four resource targets."""
    _, _, eval_summary = load_inference_artifacts()
    evaluations = eval_summary.get("evaluations", {})
    return {
        "model_version": MODEL_VERSION,
        "dataset_status": "SYNTHETIC_DEMO_NOT_REAL_OBSERVATIONS",
        "honesty_caveat": (
            "Metrics reflect held-out test performance on synthetic demonstration data. "
            "Real-world operational validity requires verified agency ground truth."
        ),
        "targets": evaluations,
    }


@router.post("/predict-zone", response_model=ZonePredictionOut)
async def predict_single_zone(
    payload: SingleZonePredictionRequest, db: AsyncSession = Depends(get_db)
):
    """Predict four resource demands, uncertainty bounds, and shortages for a single zone."""
    zone_dict = payload.model_dump()

    # If verified inventory not provided, query aggregate local depot stock
    verified_inv = payload.verified_inventory
    if verified_inv is None:
        verified_inv = await get_depot_inventory_totals(db)

    result = predict_zone_resource_demand(
        zone_dict,
        verified_inventory=verified_inv,
        confirmed_incoming=payload.confirmed_incoming,
        apply_vulnerability_buffer=payload.apply_vulnerability_buffer,
    )
    return result


@router.post("/events/{event_id}/predict", response_model=list[ZonePredictionOut])
async def predict_event_resources(
    event_id: UUID,
    planning_horizon_days: int = Query(default=3, ge=1, le=14),
    apply_vulnerability_buffer: bool = Query(default=False),
    db: AsyncSession = Depends(get_db),
):
    """Generate and persist numeric resource demand predictions for all zones of a disaster event."""
    try:
        results = await predict_event_resource_needs(
            db,
            event_id=event_id,
            planning_horizon_days=planning_horizon_days,
            apply_vulnerability_buffer=apply_vulnerability_buffer,
            persist=True,
        )
        return results
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.get("/events/{event_id}", response_model=list[ZonePredictionOut])
async def get_event_predictions(event_id: UUID, db: AsyncSession = Depends(get_db)):
    """Retrieve saved resource demand predictions for a disaster event."""
    stmt = (
        select(ResourcePrediction)
        .where(ResourcePrediction.event_id == event_id)
        .order_by(ResourcePrediction.urgency_score.desc())
    )
    res = await db.execute(stmt)
    records = res.scalars().all()

    if not records:
        # If no saved predictions exist yet, generate them on the fly
        try:
            return await predict_event_resource_needs(db, event_id=event_id, persist=True)
        except ValueError as exc:
            raise HTTPException(status_code=404, detail=str(exc))

    # Query active depot stock for inventory reconciliation
    verified_inventory = await get_depot_inventory_totals(db)

    out = []
    for r in records:
        # Reconstruct resource demands dict
        demands = {
            "food_packets": {
                "target_variable": "target_food_packets_required",
                "display_name": "Food Packets Required",
                "unit": "packets",
                "base_predicted_demand": r.food_packets_predicted,
                "vulnerability_multiplier": 1.0,
                "predicted_demand": r.food_packets_predicted,
                "lower_bound_80pct": r.food_packets_lower or int(r.food_packets_predicted * 0.8),
                "upper_bound_80pct": r.food_packets_upper or int(r.food_packets_predicted * 1.25),
                "verified_available_stock": verified_inventory.get("food_packets"),
                "confirmed_incoming_supply": 0,
                "additional_quantity_recommended": max(
                    0, r.food_packets_predicted - (verified_inventory.get("food_packets") or 0)
                ),
                "stock_verification_status": "VERIFIED_STOCK" if "food_packets" in verified_inventory else "UNVERIFIED",
            },
            "water_liters": {
                "target_variable": "target_water_liters_required",
                "display_name": "Clean Water Required",
                "unit": "liters",
                "base_predicted_demand": r.water_liters_predicted,
                "vulnerability_multiplier": 1.0,
                "predicted_demand": r.water_liters_predicted,
                "lower_bound_80pct": r.water_liters_lower or int(r.water_liters_predicted * 0.8),
                "upper_bound_80pct": r.water_liters_upper or int(r.water_liters_predicted * 1.25),
                "verified_available_stock": verified_inventory.get("water_liters"),
                "confirmed_incoming_supply": 0,
                "additional_quantity_recommended": max(
                    0, r.water_liters_predicted - (verified_inventory.get("water_liters") or 0)
                ),
                "stock_verification_status": "VERIFIED_STOCK" if "water_liters" in verified_inventory else "UNVERIFIED",
            },
            "medical_kits": {
                "target_variable": "target_medical_kits_required",
                "display_name": "Medical Kits Required",
                "unit": "kits",
                "base_predicted_demand": r.medical_kits_predicted,
                "vulnerability_multiplier": 1.0,
                "predicted_demand": r.medical_kits_predicted,
                "lower_bound_80pct": r.medical_kits_lower or int(r.medical_kits_predicted * 0.8),
                "upper_bound_80pct": r.medical_kits_upper or int(r.medical_kits_predicted * 1.25),
                "verified_available_stock": verified_inventory.get("medical_kits"),
                "confirmed_incoming_supply": 0,
                "additional_quantity_recommended": max(
                    0, r.medical_kits_predicted - (verified_inventory.get("medical_kits") or 0)
                ),
                "stock_verification_status": "VERIFIED_STOCK" if "medical_kits" in verified_inventory else "UNVERIFIED",
            },
            "shelter_spaces": {
                "target_variable": "target_shelter_spaces_required",
                "display_name": "Shelter Spaces Required",
                "unit": "spaces",
                "base_predicted_demand": r.shelter_spaces_predicted,
                "vulnerability_multiplier": 1.0,
                "predicted_demand": r.shelter_spaces_predicted,
                "lower_bound_80pct": r.shelter_spaces_lower or int(r.shelter_spaces_predicted * 0.8),
                "upper_bound_80pct": r.shelter_spaces_upper or int(r.shelter_spaces_predicted * 1.25),
                "verified_available_stock": verified_inventory.get("shelter_spaces"),
                "confirmed_incoming_supply": 0,
                "additional_quantity_recommended": max(
                    0, r.shelter_spaces_predicted - (verified_inventory.get("shelter_spaces") or 0)
                ),
                "stock_verification_status": "VERIFIED_STOCK" if "shelter_spaces" in verified_inventory else "UNVERIFIED",
            },
        }

        out.append(
            ZonePredictionOut(
                id=r.id,
                zone_id=r.zone_identifier,
                event_id=str(r.event_id),
                disaster_type=r.disaster_type,
                severity_score_0_1=r.severity_score,
                affected_population_estimate=r.affected_population,
                planning_horizon_days=r.planning_horizon_days,
                road_accessibility_0_1=r.road_accessibility,
                building_damage_share_0_1=r.building_damage_share,
                urgency_score_0_100=r.urgency_score,
                urgency_class=r.urgency_class,
                urgency_reasons=r.urgency_reasons or ["Routine response monitoring"],
                resource_demands=demands,
                vulnerability_profile=r.vulnerability_profile,
                prediction_uncertainty_note="80% empirical prediction interval evaluated on held-out test data.",
                model_version=r.model_version,
                data_status=r.data_status,
                human_review_required=not r.is_reviewed,
                prediction_timestamp=r.created_at,
            )
        )
    return out


@router.post("/events/{event_id}/recalculate")
async def recalculate_predictions(
    event_id: UUID,
    payload: DynamicRecalculationRequest,
    db: AsyncSession = Depends(get_db),
):
    """Trigger controlled demand recalculation when field reports or updated assessments arrive."""
    try:
        result = await execute_dynamic_recalculation(
            db,
            event_id=event_id,
            trigger_type=payload.trigger_type,
            source_reference=payload.source_reference,
            notes=payload.notes,
            field_updates=payload.field_updates,
        )
        return result
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.post("/scenarios")
async def simulate_scenario(
    payload: ScenarioSimulationRequest, db: AsyncSession = Depends(get_db)
):
    """Compare baseline demand against hypothetical what-if scenario assumptions."""
    baseline_data = payload.zone_data
    if not baseline_data:
        # Default representative baseline zone
        baseline_data = {
            "record_id": "SCEN-BASE-01",
            "event_id": payload.event_id or "EVENT-DEMO",
            "zone_id": payload.zone_id or "ZONE-DEMO-01",
            "disaster_type": "flood",
            "region_type": "urban",
            "affected_population_estimate": 8500,
            "severity_score_0_1": 0.65,
            "population_density_per_km2": 4500.0,
            "children_share_0_1": 0.22,
            "elderly_share_0_1": 0.15,
            "medical_dependency_share_0_1": 0.10,
            "building_damage_share_0_1": 0.35,
            "road_accessibility_0_1": 0.60,
            "response_delay_hours": 24.0,
            "planning_horizon_days": 3,
        }

    verified_inventory = await get_depot_inventory_totals(db)

    modifiers = {
        "scenario_name": payload.scenario_name,
        "scenario_id": payload.scenario_id,
        "population_multiplier": payload.population_multiplier,
        "severity_score_delta": payload.severity_score_delta,
        "response_delay_hours_delta": payload.response_delay_hours_delta,
        "road_accessibility_delta": payload.road_accessibility_delta,
        "inventory_availability_multiplier": payload.inventory_availability_multiplier,
        "apply_vulnerability_buffer": payload.apply_vulnerability_buffer,
    }
    if payload.planning_horizon_days is not None:
        modifiers["planning_horizon_days"] = payload.planning_horizon_days

    comparison = simulate_zone_scenario(
        baseline_zone_data=baseline_data,
        scenario_modifiers=modifiers,
        verified_inventory=verified_inventory,
    )
    return comparison


@router.get("/history", response_model=list[PredictionHistoryOut])
async def list_prediction_history(
    limit: int = Query(default=50, ge=1, le=200), db: AsyncSession = Depends(get_db)
):
    """List historical prediction recalculations and audit trail."""
    stmt = (
        select(PredictionHistory)
        .order_by(PredictionHistory.created_at.desc())
        .limit(limit)
    )
    res = await db.execute(stmt)
    return res.scalars().all()


@router.post("/excel/refresh")
async def refresh_excel_workbook():
    """Reproducibly re-generate the 8-worksheet Excel dataset and reporting workbook."""
    try:
        path = generate_excel_workbook()
        return {
            "status": "refreshed",
            "path": str(path),
            "size_bytes": os.path.getsize(path),
            "timestamp": datetime.now(UTC).isoformat(),
        }
    except Exception as exc:
        logger.error("Failed to refresh Excel workbook: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Excel generation failed: {exc}",
        )


@router.get("/excel/download")
async def download_excel_workbook():
    """Download the official disaster resource demand Excel workbook."""
    path = Path(EXCEL_WORKBOOK_PATH)
    if not path.exists():
        generate_excel_workbook()

    return FileResponse(
        path=path,
        filename="disaster_resource_demand_dataset.xlsx",
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )
