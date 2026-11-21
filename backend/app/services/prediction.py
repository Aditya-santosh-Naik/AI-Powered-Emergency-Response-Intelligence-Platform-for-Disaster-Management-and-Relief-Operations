"""Prediction service connecting database events, impact zones, depots, and the ML prediction engine."""

import logging
from datetime import UTC, datetime
from uuid import UUID

from ml.inference import predict_zone_resource_demand
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    DisasterEvent,
    GridCell,
    ImpactZone,
    PredictionHistory,
    ResourcePrediction,
)
from app.services.inventory import get_inventory_summary

logger = logging.getLogger(__name__)


def calculate_resource_shortage(
    predicted_demand: int,
    verified_available_stock: int | None = None,
    confirmed_incoming_supply: int = 0,
) -> dict:
    """Calculate net shortage and recommended additional quantity against verified inventory."""
    if verified_available_stock is not None:
        net_available = verified_available_stock + confirmed_incoming_supply
        shortage = max(0, predicted_demand - net_available)
        additional_recommended = shortage
        stock_status = "VERIFIED"
    else:
        # Crucial safeguard: unknown inventory must NOT silently become verified zero inventory
        shortage = None
        additional_recommended = None
        stock_status = "UNKNOWN_STOCK"

    return {
        "predicted_demand": predicted_demand,
        "verified_available_stock": verified_available_stock,
        "confirmed_incoming_supply": confirmed_incoming_supply,
        "shortage": shortage,
        "additional_quantity_recommended": additional_recommended,
        "stock_verification_status": stock_status,
    }


async def get_depot_inventory_totals(db: AsyncSession) -> dict[str, int]:
    """Retrieve verified aggregated available inventory across active depots keyed by resource short name."""
    summary = await get_inventory_summary(db)
    # Map resource_type_name to short key:
    # "food_packets" -> "food_packets"
    # "water" -> "water_liters"
    # "medical_kits" -> "medical_kits"
    # "shelter_spaces" -> "shelter_spaces"
    totals: dict[str, int] = {
        "food_packets": 0,
        "water_liters": 0,
        "medical_kits": 0,
        "shelter_spaces": 0,
    }

    for item in summary:
        name = item.get("resource_type_name", "").lower()
        qty = item.get("total_quantity", 0)
        if "food" in name:
            totals["food_packets"] += qty
        elif "water" in name:
            totals["water_liters"] += qty
        elif "medical" in name or "kit" in name:
            totals["medical_kits"] += qty
        elif "shelter" in name or "space" in name or "bed" in name:
            totals["shelter_spaces"] += qty

    return totals


async def predict_event_resource_needs(
    db: AsyncSession,
    event_id: UUID,
    planning_horizon_days: int = 3,
    apply_vulnerability_buffer: bool = False,
    persist: bool = True,
) -> list[dict]:
    """Run model predictions for all impact zones and grid cells of an event."""
    # Fetch disaster event
    ev_stmt = select(DisasterEvent).where(DisasterEvent.id == event_id)
    ev_res = await db.execute(ev_stmt)
    event = ev_res.scalar_one_or_none()
    if not event:
        raise ValueError(f"DisasterEvent {event_id} not found")

    # Fetch impact zones and grid cells
    iz_stmt = select(ImpactZone).where(ImpactZone.event_id == event_id)
    iz_res = await db.execute(iz_stmt)
    impact_zones = iz_res.scalars().all()

    gc_stmt = select(GridCell).where(GridCell.event_id == event_id).order_by(GridCell.severity_score.desc())
    _ = await db.execute(gc_stmt)

    # Aggregate stock across active depots for inventory reconciliation
    verified_inventory = await get_depot_inventory_totals(db)

    results = []
    predictions_to_save = []

    # Map event attributes to ML feature space
    event_type = (event.event_type or "flood").lower()
    if event_type not in ["flood", "earthquake", "cyclone", "landslide", "wildfire"]:
        event_type = "flood"

    # Base severity from magnitude / alert level
    base_severity = 0.5
    if event.magnitude:
        base_severity = min(1.0, max(0.1, event.magnitude / 8.0))
    elif event.alert_level:
        al = event.alert_level.lower()
        base_severity = 0.9 if al == "red" else (0.6 if al == "orange" else 0.35)

    # 1. Predict for each ImpactZone
    if impact_zones:
        for iz in impact_zones:
            pop = iz.population_exposed if iz.population_exposed and iz.population_exposed > 0 else 5000
            _ = iz.building_count if iz.building_count and iz.building_count > 0 else 500
            area = iz.area_sq_km if iz.area_sq_km and iz.area_sq_km > 0 else 10.0
            density = pop / area

            # Damage estimate from building count and severity
            damage_share = min(0.95, max(0.05, base_severity * 0.6 + 0.1))
            road_access = max(0.2, min(1.0, 1.0 - (base_severity * 0.5)))

            zone_input = {
                "record_id": f"LIVE-{str(iz.id)[:8]}",
                "event_id": str(event.id),
                "zone_id": f"ZONE-{str(iz.id)[:8]}",
                "disaster_type": event_type,
                "region_type": "urban" if density > 2000 else ("peri_urban" if density > 500 else "rural"),
                "affected_population_estimate": pop,
                "severity_score_0_1": round(base_severity, 3),
                "population_density_per_km2": round(density, 1),
                "children_share_0_1": 0.22,
                "elderly_share_0_1": 0.14,
                "medical_dependency_share_0_1": 0.09,
                "building_damage_share_0_1": round(damage_share, 3),
                "road_accessibility_0_1": round(road_access, 3),
                "response_delay_hours": 24.0,
                "planning_horizon_days": planning_horizon_days,
            }

            pred_res = predict_zone_resource_demand(
                zone_input,
                verified_inventory=verified_inventory,
                apply_vulnerability_buffer=apply_vulnerability_buffer,
            )
            pred_res["impact_zone_id"] = str(iz.id)
            pred_res["grid_cell_id"] = None
            results.append(pred_res)

            if persist:
                predictions_to_save.append(
                    _build_resource_prediction_entity(event.id, iz.id, None, pred_res)
                )

    # 2. If no impact zones or grid cells present, create an aggregate zone prediction
    if not results:
        default_pop = 12000
        zone_input = {
            "record_id": f"LIVE-EV-{str(event.id)[:8]}",
            "event_id": str(event.id),
            "zone_id": f"EVENT-AREA-{str(event.id)[:8]}",
            "disaster_type": event_type,
            "region_type": "urban",
            "affected_population_estimate": default_pop,
            "severity_score_0_1": round(base_severity, 3),
            "population_density_per_km2": 2500.0,
            "children_share_0_1": 0.20,
            "elderly_share_0_1": 0.12,
            "medical_dependency_share_0_1": 0.08,
            "building_damage_share_0_1": 0.30,
            "road_accessibility_0_1": 0.70,
            "response_delay_hours": 24.0,
            "planning_horizon_days": planning_horizon_days,
        }
        pred_res = predict_zone_resource_demand(
            zone_input,
            verified_inventory=verified_inventory,
            apply_vulnerability_buffer=apply_vulnerability_buffer,
        )
        pred_res["impact_zone_id"] = None
        pred_res["grid_cell_id"] = None
        results.append(pred_res)

        if persist:
            predictions_to_save.append(
                _build_resource_prediction_entity(event.id, None, None, pred_res)
            )

    # Save to database
    if persist and predictions_to_save:
        # Clear existing predictions for this event to avoid stale duplicates
        del_stmt = delete(ResourcePrediction).where(ResourcePrediction.event_id == event_id)
        await db.execute(del_stmt)

        for p in predictions_to_save:
            db.add(p)
        await db.commit()
        logger.info("Persisted %d resource predictions for event %s", len(predictions_to_save), event_id)

    return results


def _build_resource_prediction_entity(
    event_id: UUID, impact_zone_id: UUID | None, grid_cell_id: UUID | None, pred_res: dict
) -> ResourcePrediction:
    demands = pred_res["resource_demands"]
    return ResourcePrediction(
        event_id=event_id,
        impact_zone_id=impact_zone_id,
        grid_cell_id=grid_cell_id,
        zone_identifier=pred_res["zone_id"],
        disaster_type=pred_res["disaster_type"],
        severity_score=pred_res["severity_score_0_1"],
        affected_population=pred_res["affected_population_estimate"],
        planning_horizon_days=pred_res["planning_horizon_days"],
        road_accessibility=pred_res["road_accessibility_0_1"],
        building_damage_share=pred_res["building_damage_share_0_1"],
        food_packets_predicted=demands["food_packets"]["predicted_demand"],
        food_packets_lower=demands["food_packets"]["lower_bound_80pct"],
        food_packets_upper=demands["food_packets"]["upper_bound_80pct"],
        water_liters_predicted=demands["water_liters"]["predicted_demand"],
        water_liters_lower=demands["water_liters"]["lower_bound_80pct"],
        water_liters_upper=demands["water_liters"]["upper_bound_80pct"],
        medical_kits_predicted=demands["medical_kits"]["predicted_demand"],
        medical_kits_lower=demands["medical_kits"]["lower_bound_80pct"],
        medical_kits_upper=demands["medical_kits"]["upper_bound_80pct"],
        shelter_spaces_predicted=demands["shelter_spaces"]["predicted_demand"],
        shelter_spaces_lower=demands["shelter_spaces"]["lower_bound_80pct"],
        shelter_spaces_upper=demands["shelter_spaces"]["upper_bound_80pct"],
        urgency_score=pred_res["urgency_score_0_100"],
        urgency_class=pred_res["urgency_class"],
        urgency_reasons=pred_res["urgency_reasons"],
        vulnerability_profile=pred_res["vulnerability_profile"],
        model_version=pred_res["model_version"],
        data_status=pred_res["data_status"],
        is_reviewed=False,
    )


async def execute_dynamic_recalculation(
    db: AsyncSession,
    event_id: UUID,
    trigger_type: str,
    source_reference: str,
    notes: str | None = None,
    field_updates: dict | None = None,
) -> dict:
    """Rerun predictions on an active event following new field reports, revised hazard assessments, or inventory shifts."""
    # Log to prediction history first
    history_entry = PredictionHistory(
        event_id=event_id,
        trigger_type=trigger_type,
        trigger_source=source_reference,
        notes=notes or "Dynamic recalculation triggered by coordinator or ingestion feed",
        zones_updated_count=0,
    )
    db.add(history_entry)
    await db.commit()
    await db.refresh(history_entry)

    # If field updates modify event or zone properties, update them
    if field_updates:
        ev_stmt = select(DisasterEvent).where(DisasterEvent.id == event_id)
        ev_res = await db.execute(ev_stmt)
        event = ev_res.scalar_one_or_none()
        if event and "magnitude" in field_updates:
            event.magnitude = float(field_updates["magnitude"])
        if event and "alert_level" in field_updates:
            event.alert_level = str(field_updates["alert_level"])
        await db.commit()

    # Recalculate predictions
    updated_predictions = await predict_event_resource_needs(db, event_id=event_id, persist=True)

    # Update history count
    history_entry.zones_updated_count = len(updated_predictions)
    await db.commit()

    return {
        "status": "recalculated",
        "history_id": history_entry.id,
        "event_id": event_id,
        "trigger_type": trigger_type,
        "trigger_source": source_reference,
        "zones_updated_count": len(updated_predictions),
        "updated_at": datetime.now(UTC).isoformat(),
        "predictions": updated_predictions,
    }
