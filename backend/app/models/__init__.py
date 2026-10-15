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
