import uuid

from geoalchemy2 import Geometry
from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db import Base


class DisasterEvent(Base):
    __tablename__ = "disaster_event"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    source = Column(String(50), nullable=False, index=True)
    external_id = Column(String(255), nullable=False)
    event_type = Column(String(50), nullable=False, index=True)
    title = Column(Text, nullable=False)
    description = Column(Text, nullable=True)
    geometry = Column(Geometry("GEOMETRY", srid=4326), nullable=True)
    magnitude = Column(Float, nullable=True)
    depth_km = Column(Float, nullable=True)
    alert_level = Column(String(20), nullable=True)
    country = Column(String(255), nullable=True)
    started_at = Column(DateTime(timezone=True), nullable=False)
    ended_at = Column(DateTime(timezone=True), nullable=True)
    source_url = Column(Text, nullable=True)
    is_sample = Column(Boolean, default=False, nullable=False)
    raw_data = Column(JSONB, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    impact_zones = relationship("ImpactZone", back_populates="event", cascade="all, delete-orphan")
    grid_cells = relationship("GridCell", back_populates="event", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("source", "external_id", name="uq_event_source_external_id"),
    )


class ImpactZone(Base):
    __tablename__ = "impact_zone"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_id = Column(UUID(as_uuid=True), ForeignKey("disaster_event.id", ondelete="CASCADE"), nullable=False)
    geometry = Column(Geometry("POLYGON", srid=4326, spatial_index=False), nullable=False)
    radius_km = Column(Float, nullable=True)
    population_exposed = Column(Integer, nullable=True)
    building_count = Column(Integer, nullable=True)
    area_sq_km = Column(Float, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    event = relationship("DisasterEvent", back_populates="impact_zones")
    grid_cells = relationship("GridCell", back_populates="impact_zone", cascade="all, delete-orphan")

    __table_args__ = (
        Index("idx_impact_zone_geometry", "geometry", postgresql_using="gist"),
    )


class GridCell(Base):
    __tablename__ = "grid_cell"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_id = Column(UUID(as_uuid=True), ForeignKey("disaster_event.id", ondelete="CASCADE"), nullable=False)
    impact_zone_id = Column(UUID(as_uuid=True), ForeignKey("impact_zone.id", ondelete="CASCADE"), nullable=False)
    geometry = Column(Geometry("POLYGON", srid=4326, spatial_index=False), nullable=False)
    cell_size_deg = Column(Float, nullable=False)
    hazard_intensity = Column(Float, nullable=False)
    population_density = Column(Float, nullable=True, default=0.0)
    building_density = Column(Float, nullable=True, default=0.0)
    severity_score = Column(Float, nullable=False)
    severity_class = Column(String(20), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    event = relationship("DisasterEvent", back_populates="grid_cells")
    impact_zone = relationship("ImpactZone", back_populates="grid_cells")

    __table_args__ = (
        Index("idx_grid_cell_geometry", "geometry", postgresql_using="gist"),
        Index("idx_grid_cell_event_id", "event_id"),
    )


class Depot(Base):
    __tablename__ = "depot"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    location = Column(Geometry("POINT", srid=4326), nullable=False)
    address = Column(Text, nullable=True)
    status = Column(String(20), nullable=False, default="active")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    inventory_items = relationship("InventoryItem", back_populates="depot", cascade="all, delete-orphan")
    donations = relationship("Donation", back_populates="depot")


class ResourceType(Base):
    __tablename__ = "resource_type"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), nullable=False, unique=True)
    unit = Column(String(50), nullable=False)


class InventoryItem(Base):
    __tablename__ = "inventory_item"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    depot_id = Column(UUID(as_uuid=True), ForeignKey("depot.id", ondelete="CASCADE"), nullable=False)
    resource_type_id = Column(UUID(as_uuid=True), ForeignKey("resource_type.id", ondelete="CASCADE"), nullable=False)
    quantity = Column(Integer, nullable=False, default=0)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    depot = relationship("Depot", back_populates="inventory_items")
    resource_type = relationship("ResourceType")

    __table_args__ = (
        UniqueConstraint("depot_id", "resource_type_id", name="uq_inventory_depot_resource"),
        CheckConstraint("quantity >= 0", name="ck_inventory_quantity_non_negative"),
    )


class FieldOperation(Base):
    __tablename__ = "field_operation"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_id = Column(UUID(as_uuid=True), ForeignKey("disaster_event.id", ondelete="SET NULL"), nullable=True)
    depot_id = Column(UUID(as_uuid=True), ForeignKey("depot.id", ondelete="SET NULL"), nullable=True)
    operation_type = Column(String(50), nullable=False)
    description = Column(Text, nullable=True)
    location = Column(Geometry("POINT", srid=4326), nullable=True)
    status = Column(String(20), nullable=False, default="planned")
    started_at = Column(DateTime(timezone=True), nullable=False)
    ended_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class IngestionRun(Base):
    __tablename__ = "ingestion_run"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    source = Column(String(50), nullable=False, index=True)
    started_at = Column(DateTime(timezone=True), nullable=False)
    finished_at = Column(DateTime(timezone=True), nullable=True)
    status = Column(String(20), nullable=False, default="running")
    records_fetched = Column(Integer, nullable=False, default=0)
    records_created = Column(Integer, nullable=False, default=0)
    records_updated = Column(Integer, nullable=False, default=0)
    error_message = Column(Text, nullable=True)


class Donor(Base):
    __tablename__ = "donor"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=True)
    phone = Column(String(50), nullable=True)
    organization = Column(String(255), nullable=True)
    location = Column(Geometry("POINT", srid=4326), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    donations = relationship("Donation", back_populates="donor", cascade="all, delete-orphan")


class Donation(Base):
    __tablename__ = "donation"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    donor_id = Column(UUID(as_uuid=True), ForeignKey("donor.id", ondelete="CASCADE"), nullable=False)
    depot_id = Column(UUID(as_uuid=True), ForeignKey("depot.id", ondelete="CASCADE"), nullable=False)
    resource_type_id = Column(UUID(as_uuid=True), ForeignKey("resource_type.id", ondelete="CASCADE"), nullable=False)
    quantity = Column(Integer, nullable=False)
    donated_at = Column(DateTime(timezone=True), nullable=False)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    donor = relationship("Donor", back_populates="donations")
    depot = relationship("Depot", back_populates="donations")
    resource_type = relationship("ResourceType")

    __table_args__ = (
        CheckConstraint("quantity > 0", name="ck_donation_quantity_positive"),
    )


class ResourcePrediction(Base):
    __tablename__ = "resource_prediction"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_id = Column(UUID(as_uuid=True), ForeignKey("disaster_event.id", ondelete="CASCADE"), nullable=False)
    impact_zone_id = Column(UUID(as_uuid=True), ForeignKey("impact_zone.id", ondelete="SET NULL"), nullable=True)
    grid_cell_id = Column(UUID(as_uuid=True), ForeignKey("grid_cell.id", ondelete="SET NULL"), nullable=True)
    zone_identifier = Column(String(100), nullable=False)
    disaster_type = Column(String(50), nullable=False)
    severity_score = Column(Float, nullable=False)
    affected_population = Column(Integer, nullable=False)
    planning_horizon_days = Column(Integer, nullable=False, default=3)
    road_accessibility = Column(Float, nullable=False, default=0.8)
    building_damage_share = Column(Float, nullable=False, default=0.2)
    food_packets_predicted = Column(Integer, nullable=False)
    food_packets_lower = Column(Integer, nullable=True)
    food_packets_upper = Column(Integer, nullable=True)
    water_liters_predicted = Column(Integer, nullable=False)
    water_liters_lower = Column(Integer, nullable=True)
    water_liters_upper = Column(Integer, nullable=True)
    medical_kits_predicted = Column(Integer, nullable=False)
    medical_kits_lower = Column(Integer, nullable=True)
    medical_kits_upper = Column(Integer, nullable=True)
    shelter_spaces_predicted = Column(Integer, nullable=False)
    shelter_spaces_lower = Column(Integer, nullable=True)
    shelter_spaces_upper = Column(Integer, nullable=True)
    urgency_score = Column(Float, nullable=False, default=50.0)
    urgency_class = Column(String(50), nullable=False, default="MODERATE")
    urgency_reasons = Column(JSONB, nullable=True)
    vulnerability_profile = Column(JSONB, nullable=True)
    model_version = Column(String(50), nullable=False)
    data_status = Column(String(50), nullable=False)
    is_reviewed = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class PredictionHistory(Base):
    __tablename__ = "prediction_history"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_id = Column(UUID(as_uuid=True), ForeignKey("disaster_event.id", ondelete="CASCADE"), nullable=False)
    trigger_type = Column(String(50), nullable=False)
    trigger_source = Column(String(255), nullable=False)
    notes = Column(Text, nullable=True)
    zones_updated_count = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class User(Base):
    __tablename__ = "app_user"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    role = Column(String(50), nullable=False, default="reporter")  # "reporter" or "admin"
    is_active = Column(Boolean, nullable=False, default=True)
    organization = Column(String(255), nullable=True)
    phone = Column(String(50), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    reports_submitted = relationship("DisasterReport", back_populates="reporter", foreign_keys="DisasterReport.reporter_id")


class DisasterReport(Base):
    __tablename__ = "disaster_report"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    report_code = Column(String(50), unique=True, nullable=False, index=True)
    reporter_id = Column(UUID(as_uuid=True), ForeignKey("app_user.id", ondelete="CASCADE"), nullable=False)
    disaster_type = Column(String(50), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    location_name = Column(String(255), nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    location = Column(Geometry("POINT", srid=4326), nullable=True)
    occurred_at = Column(DateTime(timezone=True), nullable=False)
    estimated_affected_population = Column(Integer, nullable=True)
    estimated_damage_severity = Column(Float, nullable=True)
    road_accessible = Column(Boolean, nullable=False, default=True)
    supporting_evidence_url = Column(Text, nullable=True)

    # Review workflow fields
    status = Column(String(50), nullable=False, default="PENDING_REVIEW", index=True)
    admin_notes = Column(Text, nullable=True)
    reviewed_by_id = Column(UUID(as_uuid=True), ForeignKey("app_user.id", ondelete="SET NULL"), nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)

    # Linked confirmed event
    associated_event_id = Column(UUID(as_uuid=True), ForeignKey("disaster_event.id", ondelete="SET NULL"), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    reporter = relationship("User", back_populates="reports_submitted", foreign_keys=[reporter_id])
    reviewer = relationship("User", foreign_keys=[reviewed_by_id])
    associated_event = relationship("DisasterEvent")

    __table_args__ = (
        CheckConstraint("latitude >= -90.0 AND latitude <= 90.0", name="ck_report_latitude"),
        CheckConstraint("longitude >= -180.0 AND longitude <= 180.0", name="ck_report_longitude"),
    )



# ==============================================================================
# WEEKS 5-6: LOGISTICS PLANNING, OPTIMIZATION & DISASTER OPERATIONS MODELS
# ==============================================================================

class AllocationPlan(Base):
    __tablename__ = "allocation_plan"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_id = Column(UUID(as_uuid=True), ForeignKey("disaster_event.id", ondelete="SET NULL"), nullable=True)
    solver_status = Column(String(50), nullable=False, default="OPTIMAL")  # OPTIMAL, FEASIBLE, INFEASIBLE
    objective_value = Column(Float, nullable=False, default=0.0)
    total_demand_satisfied_pct = Column(Float, nullable=False, default=0.0)
    execution_time_ms = Column(Float, nullable=False, default=0.0)
    solver_parameters = Column(JSONB, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    event = relationship("DisasterEvent")
    details = relationship("AllocationDetail", back_populates="plan", cascade="all, delete-orphan")
    missions = relationship("ReliefMission", back_populates="plan")


class AllocationDetail(Base):
    __tablename__ = "allocation_detail"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    plan_id = Column(UUID(as_uuid=True), ForeignKey("allocation_plan.id", ondelete="CASCADE"), nullable=False)
    depot_id = Column(UUID(as_uuid=True), ForeignKey("depot.id", ondelete="CASCADE"), nullable=False)
    prediction_id = Column(UUID(as_uuid=True), ForeignKey("resource_prediction.id", ondelete="CASCADE"), nullable=False)
    resource_type = Column(String(50), nullable=False)
    allocated_quantity = Column(Integer, nullable=False, default=0)
    demanded_quantity = Column(Integer, nullable=False, default=0)
    shortage_quantity = Column(Integer, nullable=False, default=0)
    distance_km = Column(Float, nullable=True)
    est_duration_hours = Column(Float, nullable=True)
    accessibility_status = Column(String(50), nullable=True, default="Accessible")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    plan = relationship("AllocationPlan", back_populates="details")
    depot = relationship("Depot")
    prediction = relationship("ResourcePrediction")


class PriorityOverride(Base):
    __tablename__ = "priority_override"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    prediction_id = Column(UUID(as_uuid=True), ForeignKey("resource_prediction.id", ondelete="CASCADE"), nullable=False)
    original_urgency_score = Column(Float, nullable=False)
    original_urgency_class = Column(String(50), nullable=False)
    overridden_urgency_score = Column(Float, nullable=False)
    overridden_urgency_class = Column(String(50), nullable=False)
    justification = Column(Text, nullable=False)
    authorized_by_id = Column(UUID(as_uuid=True), ForeignKey("app_user.id", ondelete="SET NULL"), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    prediction = relationship("ResourcePrediction")
    authorized_by = relationship("User")


class ReliefMission(Base):
    __tablename__ = "relief_mission"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    mission_code = Column(String(100), unique=True, nullable=False, index=True)
    plan_id = Column(UUID(as_uuid=True), ForeignKey("allocation_plan.id", ondelete="SET NULL"), nullable=True)
    depot_id = Column(UUID(as_uuid=True), ForeignKey("depot.id", ondelete="CASCADE"), nullable=False)
    prediction_id = Column(UUID(as_uuid=True), ForeignKey("resource_prediction.id", ondelete="CASCADE"), nullable=False)
    status = Column(String(50), nullable=False, default="PLANNED", index=True)  # PLANNED, ASSIGNED, DISPATCHED, IN_TRANSIT, DELIVERED, COMPLETED, CANCELLED
    team_leader = Column(String(255), nullable=True)
    vehicle_type = Column(String(100), nullable=False, default="Heavy Cargo Truck")
    vehicle_identifier = Column(String(100), nullable=True)
    manifest = Column(JSONB, nullable=True)
    route_geojson = Column(JSONB, nullable=True)
    distance_km = Column(Float, nullable=True)
    est_duration_hours = Column(Float, nullable=True)
    notes = Column(Text, nullable=True)
    dispatched_at = Column(DateTime(timezone=True), nullable=True)
    delivered_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    plan = relationship("AllocationPlan", back_populates="missions")
    depot = relationship("Depot")
    prediction = relationship("ResourcePrediction")
    transactions = relationship("ResourceTransaction", back_populates="mission")


class ResourceTransaction(Base):
    __tablename__ = "resource_transaction"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    depot_id = Column(UUID(as_uuid=True), ForeignKey("depot.id", ondelete="CASCADE"), nullable=False)
    mission_id = Column(UUID(as_uuid=True), ForeignKey("relief_mission.id", ondelete="SET NULL"), nullable=True)
    resource_type = Column(String(50), nullable=False)
    quantity = Column(Integer, nullable=False)
    state_from = Column(String(50), nullable=False)
    state_to = Column(String(50), nullable=False)
    reference_note = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    depot = relationship("Depot")
    mission = relationship("ReliefMission", back_populates="transactions")


class SituationReport(Base):
    __tablename__ = "situation_report"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_id = Column(UUID(as_uuid=True), ForeignKey("disaster_event.id", ondelete="CASCADE"), nullable=False)
    report_title = Column(String(255), nullable=False)
    summary = Column(Text, nullable=False)
    metrics = Column(JSONB, nullable=False)
    created_by_id = Column(UUID(as_uuid=True), ForeignKey("app_user.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    event = relationship("DisasterEvent")
    created_by = relationship("User")
