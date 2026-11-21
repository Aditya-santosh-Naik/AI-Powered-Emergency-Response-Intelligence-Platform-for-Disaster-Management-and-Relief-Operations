"""Post-Event Analytics and Situation Report (SitRep) Generation Service."""

import datetime
import logging
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import (
    AllocationDetail,
    AllocationPlan,
    Depot,
    DisasterEvent,
    InventoryItem,
    ReliefMission,
    ResourcePrediction,
    ResourceType,
    SituationReport,
    User,
)
from app.schemas import OperationsOverviewOut

logger = logging.getLogger(__name__)


async def get_operations_overview(db: AsyncSession) -> OperationsOverviewOut:
    """Compute real-time operational KPI metrics for the command dashboard."""
    # Active events count
    events_count_res = await db.execute(select(func.count(DisasterEvent.id)))
    active_alerts = events_count_res.scalar() or 0

    # Critical events (red alert or magnitude >= 6.0)
    crit_stmt = select(func.count(DisasterEvent.id)).where(
        (func.lower(DisasterEvent.alert_level) == "red") | (DisasterEvent.magnitude >= 6.0)
    )
    crit_res = await db.execute(crit_stmt)
    critical_events = crit_res.scalar() or 0

    # High priority zones
    high_zones_stmt = select(func.count(ResourcePrediction.id)).where(
        func.upper(ResourcePrediction.urgency_class).in_(["CRITICAL", "HIGH"])
    )
    high_zones_res = await db.execute(high_zones_stmt)
    high_priority_zones = high_zones_res.scalar() or 0

    # Active depots
    depots_res = await db.execute(select(func.count(Depot.id)).where(Depot.status == "active"))
    depots_count = depots_res.scalar() or 0

    # Total inventory stock across all depots
    items_stmt = (
        select(ResourceType.name, func.sum(InventoryItem.quantity))
        .join(InventoryItem, InventoryItem.resource_type_id == ResourceType.id)
        .group_by(ResourceType.name)
    )
    items_res = await db.execute(items_stmt)
    total_stock = {row[0].lower(): int(row[1]) for row in items_res.all()}

    # Standardize water key
    if "water_liters" in total_stock and "water" not in total_stock:
        total_stock["water"] = total_stock["water_liters"]

    # Active missions (not completed / cancelled)
    missions_stmt = select(func.count(ReliefMission.id)).where(
        ReliefMission.status.in_(["ASSIGNED", "DISPATCHED", "IN_TRANSIT"])
    )
    missions_res = await db.execute(missions_stmt)
    active_missions = missions_res.scalar() or 0

    return OperationsOverviewOut(
        active_alerts_count=active_alerts,
        critical_events_count=critical_events,
        high_priority_zones_count=high_priority_zones,
        depots_active_count=depots_count,
        total_stock=total_stock,
        active_missions_count=active_missions,
        gdacs_status="Connected (Live Stream)",
        system_status="All Systems Operational",
    )


async def generate_situation_report(
    db: AsyncSession,
    event_id: UUID,
    author: User | None = None,
) -> dict:
    """Generate comprehensive post-event analytics and formal Situation Report (SitRep)."""
    # 1. Fetch Event
    ev_stmt = (
        select(DisasterEvent)
        .where(DisasterEvent.id == event_id)
        .options(selectinload(DisasterEvent.impact_zones))
    )
    ev_res = await db.execute(ev_stmt)
    event = ev_res.scalar_one_or_none()
    if not event:
        raise ValueError(f"Disaster event with ID {event_id} not found.")

    # 2. Fetch Predictions
    pred_stmt = select(ResourcePrediction).where(ResourcePrediction.event_id == event_id)
    pred_res = await db.execute(pred_stmt)
    predictions = pred_res.scalars().all()

    total_pop_exposed = sum(iz.population_exposed or 0 for iz in event.impact_zones)
    total_bld_exposed = sum(iz.building_count or 0 for iz in event.impact_zones)

    # Demands aggregate
    demands_agg = {
        "food_packets": sum(p.food_packets_predicted for p in predictions),
        "water_liters": sum(p.water_liters_predicted for p in predictions),
        "medical_kits": sum(p.medical_kits_predicted for p in predictions),
        "shelter_spaces": sum(p.shelter_spaces_predicted for p in predictions),
    }

    # 3. Fetch latest Allocation Plan
    plan_stmt = (
        select(AllocationPlan)
        .where(AllocationPlan.event_id == event_id)
        .order_by(AllocationPlan.created_at.desc())
        .options(
            selectinload(AllocationPlan.details).selectinload(AllocationDetail.depot),
            selectinload(AllocationPlan.missions),
        )
    )
    plan_res = await db.execute(plan_stmt)
    plan = plan_res.scalars().first()

    allocations_agg = {k: 0 for k in demands_agg.keys()}
    depot_contributions: dict[str, dict[str, int]] = {}
    depot_distances: list[float] = []
    depot_durations: list[float] = []

    if plan:
        for det in plan.details:
            r_key = "water_liters" if det.resource_type in ["water", "water_liters"] else det.resource_type
            if r_key in allocations_agg:
                allocations_agg[r_key] += det.allocated_quantity

            depot_name = det.depot.name if det.depot else "Regional Depot"
            if depot_name not in depot_contributions:
                depot_contributions[depot_name] = {k: 0 for k in demands_agg.keys()}
            if r_key in depot_contributions[depot_name]:
                depot_contributions[depot_name][r_key] += det.allocated_quantity

            if det.allocated_quantity > 0:
                if det.distance_km:
                    depot_distances.append(det.distance_km)
                if det.est_duration_hours:
                    depot_durations.append(det.est_duration_hours)

    fulfillment_rates = {}
    shortages = {}
    for k, dem_qty in demands_agg.items():
        alloc_qty = allocations_agg.get(k, 0)
        rate = round((alloc_qty / dem_qty * 100.0), 1) if dem_qty > 0 else 100.0
        fulfillment_rates[k] = rate
        shortages[k] = max(0, dem_qty - alloc_qty)

    # Missions status breakdown
    missions_stmt = select(ReliefMission).where(
        ReliefMission.prediction_id.in_([p.id for p in predictions])
    )
    missions_res = await db.execute(missions_stmt)
    missions = missions_res.scalars().all()

    missions_summary = {
        "total_missions": len(missions),
        "assigned": sum(1 for m in missions if m.status == "ASSIGNED"),
        "dispatched": sum(1 for m in missions if m.status == "DISPATCHED"),
        "in_transit": sum(1 for m in missions if m.status == "IN_TRANSIT"),
        "delivered": sum(1 for m in missions if m.status == "DELIVERED"),
        "completed": sum(1 for m in missions if m.status == "COMPLETED"),
    }

    avg_distance = round(sum(depot_distances) / len(depot_distances), 1) if depot_distances else 0.0
    avg_duration = round(sum(depot_durations) / len(depot_durations), 1) if depot_durations else 0.0

    # Build Markdown SitRep text
    now_str = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    markdown_report = f"""# SITUATION REPORT (SITREP): {event.title.upper()}
**Report Generated:** {now_str}
**Classification:** Operational / Official Relief Directive
**Disaster Event ID:** `{event.id}`
**Source:** {event.source.upper()} | External ID: `{event.external_id}`

---

## 1. INCIDENT OVERVIEW & DAMAGE ASSESSMENT
- **Event Type:** {event.event_type.title()}
- **Severity / Magnitude:** {event.magnitude or 'N/A'} (Alert Level: {event.alert_level or 'Standard'})
- **Geographic Scope:** {event.country or 'India'}
- **Estimated Exposed Population:** {total_pop_exposed:,} persons
- **Estimated Exposed Structures:** {total_bld_exposed:,} buildings
- **Impacted Zones Assessed:** {len(predictions)} priority operational sectors

## 2. RESOURCE DEMAND VS. ALLOCATED RELIEF
| Relief Category | Predicted Demand | Stock Allocated | Fulfilled % | Unfulfilled Shortage |
| :--- | :--- | :--- | :--- | :--- |
| **Food Packets** | {demands_agg['food_packets']:,} pkts | {allocations_agg['food_packets']:,} pkts | {fulfillment_rates['food_packets']}% | {shortages['food_packets']:,} pkts |
| **Clean Water** | {demands_agg['water_liters']:,} L | {allocations_agg['water_liters']:,} L | {fulfillment_rates['water_liters']}% | {shortages['water_liters']:,} L |
| **Medical Kits** | {demands_agg['medical_kits']:,} kits | {allocations_agg['medical_kits']:,} kits | {fulfillment_rates['medical_kits']}% | {shortages['medical_kits']:,} kits |
| **Shelter Spaces** | {demands_agg['shelter_spaces']:,} beds | {allocations_agg['shelter_spaces']:,} beds | {fulfillment_rates['shelter_spaces']}% | {shortages['shelter_spaces']:,} beds |

## 3. LOGISTICS DISPATCH & FLEET PERFORMANCE
- **Total Missions Configured:** {missions_summary['total_missions']}
- **Dispatched / In-Transit:** {missions_summary['dispatched'] + missions_summary['in_transit']}
- **Successfully Delivered:** {missions_summary['delivered']}
- **Completed Missions:** {missions_summary['completed']}
- **Average Haul Distance:** {avg_distance} km
- **Average Transit Time:** {avg_duration} hours

## 4. DEPOT CONTRIBUTION MATRIX
"""
    for dep_name, supplies in depot_contributions.items():
        markdown_report += f"- **{dep_name}:** Food: {supplies.get('food_packets', 0):,} pkts | Water: {supplies.get('water_liters', 0):,} L | Med: {supplies.get('medical_kits', 0):,} kits | Shelter: {supplies.get('shelter_spaces', 0):,} spaces\n"

    markdown_report += """
---
*Directive signed by Operations Response Center under Protocol OP-2026.*
"""

    metrics_payload = {
        "event_id": str(event.id),
        "event_title": event.title,
        "event_type": event.event_type,
        "total_pop_exposed": total_pop_exposed,
        "total_bld_exposed": total_bld_exposed,
        "demands": demands_agg,
        "allocations": allocations_agg,
        "fulfillment_rates": fulfillment_rates,
        "shortages": shortages,
        "missions": missions_summary,
        "depot_contributions": depot_contributions,
        "avg_distance_km": avg_distance,
        "avg_duration_hours": avg_duration,
        "solver_status": plan.solver_status if plan else "NO_PLAN",
        "solver_execution_time_ms": plan.execution_time_ms if plan else 0.0,
    }

    # Save SituationReport to database
    sitrep = SituationReport(
        event_id=event.id,
        report_title=f"SitRep - {event.title}",
        summary=markdown_report,
        metrics=metrics_payload,
        created_by_id=author.id if author else None,
    )
    db.add(sitrep)
    await db.commit()
    await db.refresh(sitrep)

    return {
        "id": str(sitrep.id),
        "event_id": str(event.id),
        "report_title": sitrep.report_title,
        "markdown_report": markdown_report,
        "metrics": metrics_payload,
        "created_at": sitrep.created_at.isoformat(),
    }

