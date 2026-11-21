"""Disaster Reports API router: Submission, Admin Review, and End-to-End Prediction Pipeline."""

import logging
import secrets
from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from ml.excel_generator import generate_excel_workbook
from shapely.geometry import Point
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db import get_db
from app.models import DisasterEvent, DisasterReport, ImpactZone, PredictionHistory, User
from app.schemas import (
    DisasterReportAssessmentResponse,
    DisasterReportCreate,
    DisasterReportOut,
    DisasterReportReviewRequest,
    ZonePredictionOut,
)
from app.services.auth import get_current_user, require_admin, require_reporter
from app.services.prediction import (
    predict_event_resource_needs,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/reports", tags=["reports"])

VALID_DISASTER_TYPES = ["flood", "earthquake", "cyclone", "landslide", "wildfire"]
VALID_REVIEW_STATUSES = [
    "ACCEPTED_FOR_ASSESSMENT",
    "REJECTED",
    "ADDITIONAL_INFO_REQUIRED",
]


def _format_report_out(rep: DisasterReport) -> DisasterReportOut:
    """Helper to convert DisasterReport DB entity to Pydantic output."""
    reporter_name = rep.reporter.full_name if rep.reporter else None
    reporter_email = rep.reporter.email if rep.reporter else None
    reviewer_name = rep.reviewer.full_name if rep.reviewer else None

    return DisasterReportOut(
        id=rep.id,
        report_code=rep.report_code,
        reporter_id=rep.reporter_id,
        reporter_name=reporter_name,
        reporter_email=reporter_email,
        disaster_type=rep.disaster_type,
        title=rep.title,
        description=rep.description,
        location_name=rep.location_name,
        latitude=rep.latitude,
        longitude=rep.longitude,
        occurred_at=rep.occurred_at,
        estimated_affected_population=rep.estimated_affected_population,
        estimated_damage_severity=rep.estimated_damage_severity,
        road_accessible=rep.road_accessible,
        supporting_evidence_url=rep.supporting_evidence_url,
        status=rep.status,
        admin_notes=rep.admin_notes,
        reviewed_by_name=reviewer_name,
        reviewed_at=rep.reviewed_at,
        associated_event_id=rep.associated_event_id,
        created_at=rep.created_at,
        updated_at=rep.updated_at,
    )


# -- Role A: Disaster Reporter Endpoints --

@router.post("", response_model=DisasterReportOut, status_code=status.HTTP_201_CREATED)
async def submit_disaster_report(
    payload: DisasterReportCreate,
    current_user: User = Depends(require_reporter),
    db: AsyncSession = Depends(get_db),
):
    """Submit a new user disaster report. Assigns a unique report code and sets status to PENDING_REVIEW."""
    d_type = payload.disaster_type.strip().lower()
    if d_type not in VALID_DISASTER_TYPES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid disaster type '{payload.disaster_type}'. Must be one of: {', '.join(VALID_DISASTER_TYPES)}",
        )

    # Validate coordinate bounds strictly
    if not (-90.0 <= payload.latitude <= 90.0):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Latitude must be between -90.0 and 90.0 degrees.",
        )
    if not (-180.0 <= payload.longitude <= 180.0):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Longitude must be between -180.0 and 180.0 degrees.",
        )

    # Check for potential duplicates (same reporter, same type, within ~1km and 6 hours)
    dup_stmt = (
        select(DisasterReport)
        .where(
            DisasterReport.reporter_id == current_user.id,
            DisasterReport.disaster_type == d_type,
            DisasterReport.status.in_(["PENDING_REVIEW", "ACCEPTED_FOR_ASSESSMENT"]),
        )
        .order_by(DisasterReport.created_at.desc())
    )
    dup_res = await db.execute(dup_stmt)
    existing_reports = dup_res.scalars().all()
    for er in existing_reports:
        # Distance check approximately: 0.01 deg is ~1.1km
        lat_diff = abs(er.latitude - payload.latitude)
        lon_diff = abs(er.longitude - payload.longitude)
        if lat_diff < 0.015 and lon_diff < 0.015:
            # Check time proximity within 6 hours (normalize tzinfo to avoid naive/aware subtraction error)
            t1 = payload.occurred_at.replace(tzinfo=None) if payload.occurred_at.tzinfo else payload.occurred_at
            t2 = er.occurred_at.replace(tzinfo=None) if er.occurred_at.tzinfo else er.occurred_at
            time_diff = abs((t1 - t2).total_seconds())
            if time_diff < 21600:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Duplicate report detected: You have already submitted report '{er.report_code}' for this location and time.",
                )

    # Generate unique human-readable report code
    date_str = datetime.now(UTC).strftime("%Y%m%d")
    unique_suffix = secrets.token_hex(2).upper()
    report_code = f"REP-{date_str}-{unique_suffix}"

    # Geometry Point WKT
    point_wkt = Point(payload.longitude, payload.latitude).wkt

    report = DisasterReport(
        report_code=report_code,
        reporter_id=current_user.id,
        disaster_type=d_type,
        title=payload.title.strip(),
        description=payload.description.strip(),
        location_name=payload.location_name.strip(),
        latitude=payload.latitude,
        longitude=payload.longitude,
        location=point_wkt,
        occurred_at=payload.occurred_at,
        estimated_affected_population=payload.estimated_affected_population,
        estimated_damage_severity=payload.estimated_damage_severity,
        road_accessible=payload.road_accessible,
        supporting_evidence_url=payload.supporting_evidence_url,
        status="PENDING_REVIEW",
    )
    db.add(report)
    await db.commit()
    await db.refresh(report)

    # Eagerly load reporter relationship
    rep_stmt = (
        select(DisasterReport)
        .options(selectinload(DisasterReport.reporter), selectinload(DisasterReport.reviewer))
        .where(DisasterReport.id == report.id)
    )
    reloaded = (await db.execute(rep_stmt)).scalar_one()
    return _format_report_out(reloaded)


@router.get("/my", response_model=list[DisasterReportOut])
async def get_my_reports(
    current_user: User = Depends(require_reporter),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve all disaster reports submitted by the currently logged-in user."""
    stmt = (
        select(DisasterReport)
        .options(selectinload(DisasterReport.reporter), selectinload(DisasterReport.reviewer))
        .where(DisasterReport.reporter_id == current_user.id)
        .order_by(DisasterReport.created_at.desc())
    )
    res = await db.execute(stmt)
    reports = res.scalars().all()
    return [_format_report_out(r) for r in reports]


@router.get("/{report_id}", response_model=DisasterReportOut)
async def get_report_detail(
    report_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """View details of a specific report. Reporters can view their own reports; admins can view all."""
    stmt = (
        select(DisasterReport)
        .options(selectinload(DisasterReport.reporter), selectinload(DisasterReport.reviewer))
        .where(DisasterReport.id == report_id)
    )
    res = await db.execute(stmt)
    report = res.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Disaster report not found.")

    if current_user.role != "admin" and report.reporter_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: You do not have permission to view this report.",
        )

    return _format_report_out(report)


# -- Role B: Admin / Relief Coordinator Endpoints --

@router.get("", response_model=list[DisasterReportOut])
async def list_reports_admin(
    status_filter: str | None = Query(default=None, alias="status"),
    disaster_type: str | None = None,
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    admin_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Admin-only: List and filter all submitted reports across all users."""
    stmt = (
        select(DisasterReport)
        .options(selectinload(DisasterReport.reporter), selectinload(DisasterReport.reviewer))
        .order_by(DisasterReport.created_at.desc())
    )

    if status_filter:
        stmt = stmt.where(DisasterReport.status == status_filter)
    if disaster_type:
        stmt = stmt.where(DisasterReport.disaster_type == disaster_type.lower())

    stmt = stmt.offset(offset).limit(limit)
    res = await db.execute(stmt)
    reports = res.scalars().all()
    return [_format_report_out(r) for r in reports]


@router.patch("/{report_id}/review", response_model=DisasterReportOut)
async def review_disaster_report(
    report_id: UUID,
    payload: DisasterReportReviewRequest,
    admin_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Admin-only: Approve, reject, or request information on a submitted disaster report."""
    target_status = payload.status.strip().upper()
    if target_status not in VALID_REVIEW_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid review decision '{payload.status}'. Must be one of: {', '.join(VALID_REVIEW_STATUSES)}",
        )

    stmt = (
        select(DisasterReport)
        .options(selectinload(DisasterReport.reporter), selectinload(DisasterReport.reviewer))
        .where(DisasterReport.id == report_id)
    )
    res = await db.execute(stmt)
    report = res.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Disaster report not found.")

    report.status = target_status
    report.admin_notes = payload.admin_notes.strip() if payload.admin_notes else None
    report.reviewed_by_id = admin_user.id
    report.reviewed_at = datetime.now(UTC)

    await db.commit()
    await db.refresh(report)
    return _format_report_out(report)


@router.post("/{report_id}/assess-and-predict", response_model=DisasterReportAssessmentResponse)
async def assess_report_and_predict(
    report_id: UUID,
    planning_horizon_days: int = Query(default=3, ge=1, le=14),
    apply_vulnerability_buffer: bool = Query(default=False),
    admin_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Complete Pipeline: Convert accepted report to disaster event, run ML prediction, and calculate shortages."""
    stmt = (
        select(DisasterReport)
        .options(selectinload(DisasterReport.reporter), selectinload(DisasterReport.reviewer))
        .where(DisasterReport.id == report_id)
    )
    res = await db.execute(stmt)
    report = res.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Disaster report not found.")

    # Must be accepted
    if report.status != "ACCEPTED_FOR_ASSESSMENT":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Report must be in 'ACCEPTED_FOR_ASSESSMENT' status before running prediction engine. Current status: '{report.status}'.",
        )

    # 1. Retrieve or create linked DisasterEvent
    event = None
    if report.associated_event_id:
        ev_stmt = select(DisasterEvent).where(DisasterEvent.id == report.associated_event_id)
        event = (await db.execute(ev_stmt)).scalar_one_or_none()

    if not event:
        # Create confirmed disaster event
        point_wkt = Point(report.longitude, report.latitude).wkt
        event = DisasterEvent(
            source="CITIZEN_REPORT_CONFIRMED",
            external_id=report.report_code,
            event_type=report.disaster_type,
            title=f"[Verified] {report.title}",
            description=f"Verified citizen report from {report.location_name}. Notes: {report.description}",
            geometry=point_wkt,
            country="India",
            started_at=report.occurred_at,
            is_sample=False,
            alert_level="Orange" if (report.estimated_damage_severity or 0.5) >= 0.5 else "Yellow",
        )
        db.add(event)
        await db.commit()
        await db.refresh(event)

        # Create corresponding ImpactZone around the coordinates
        severity = report.estimated_damage_severity if report.estimated_damage_severity is not None else 0.55
        radius = max(3.0, severity * 20.0)
        pop = report.estimated_affected_population if report.estimated_affected_population else 7500
        buildings = max(50, int(pop * 0.15))

        point_geom = Point(report.longitude, report.latitude)
        # 1 deg ~ 111 km => buffer in degrees
        deg_radius = radius / 111.0
        poly_geom = point_geom.buffer(deg_radius)

        zone = ImpactZone(
            event_id=event.id,
            geometry=poly_geom.wkt,
            radius_km=round(radius, 1),
            population_exposed=pop,
            building_count=buildings,
            area_sq_km=round(3.14159 * (radius ** 2), 1),
        )
        db.add(zone)

        # Link event to report
        report.associated_event_id = event.id
        await db.commit()
        await db.refresh(report)

    # 2. Run the Resource Demand Prediction Engine
    predictions_raw = await predict_event_resource_needs(
        db,
        event_id=event.id,
        planning_horizon_days=planning_horizon_days,
        apply_vulnerability_buffer=apply_vulnerability_buffer,
        persist=True,
    )

    # Reformat predictions to ZonePredictionOut
    predictions_out: list[ZonePredictionOut] = []
    for p in predictions_raw:
        predictions_out.append(ZonePredictionOut.model_validate(p))

    # 3. Refresh Excel dataset workbook to reflect this operational run
    try:
        generate_excel_workbook()
    except Exception as exc:
        logger.warning("Could not auto-refresh Excel workbook after assessment: %s", exc)

    # 4. Record PredictionHistory entry for coordinator audit trail and history view
    history_entry = PredictionHistory(
        event_id=event.id,
        trigger_type="CITIZEN_REPORT_ASSESSMENT",
        trigger_source=report.report_code,
        notes=f"Admin {admin_user.full_name} assessed and triggered prediction engine for report '{report.title}'",
        zones_updated_count=len(predictions_out),
    )
    db.add(history_entry)
    await db.commit()

    return DisasterReportAssessmentResponse(
        report=_format_report_out(report),
        associated_event_id=event.id,
        predictions=predictions_out,
    )
