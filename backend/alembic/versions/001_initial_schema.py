"""Initial schema with PostGIS tables for Weeks 1-2.

Revision ID: 001_initial_schema
Revises:
Create Date: 2024-10-15 12:00:00.000000

"""
from collections.abc import Sequence

import geoalchemy2
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "001_initial_schema"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Ensure PostGIS extension exists
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis;")

    # 1. disaster_event
    op.create_table(
        "disaster_event",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("source", sa.String(50), nullable=False, index=True),
        sa.Column("external_id", sa.String(255), nullable=False),
        sa.Column("event_type", sa.String(50), nullable=False, index=True),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("geometry", geoalchemy2.Geometry(geometry_type="GEOMETRY", srid=4326), nullable=True),
        sa.Column("magnitude", sa.Float(), nullable=True),
        sa.Column("depth_km", sa.Float(), nullable=True),
        sa.Column("alert_level", sa.String(20), nullable=True),
        sa.Column("country", sa.String(255), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("source_url", sa.Text(), nullable=True),
        sa.Column("is_sample", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("raw_data", postgresql.JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("source", "external_id", name="uq_event_source_external_id"),
    )

    # 2. impact_zone
    op.create_table(
        "impact_zone",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("event_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("disaster_event.id", ondelete="CASCADE"), nullable=False),
        sa.Column("geometry", geoalchemy2.Geometry(geometry_type="POLYGON", srid=4326), nullable=False),
        sa.Column("radius_km", sa.Float(), nullable=True),
        sa.Column("population_exposed", sa.Integer(), nullable=True),
        sa.Column("building_count", sa.Integer(), nullable=True),
        sa.Column("area_sq_km", sa.Float(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("idx_impact_zone_geometry", "impact_zone", ["geometry"], postgresql_using="gist")

    # 3. grid_cell
    op.create_table(
        "grid_cell",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("event_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("disaster_event.id", ondelete="CASCADE"), nullable=False),
        sa.Column("impact_zone_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("impact_zone.id", ondelete="CASCADE"), nullable=False),
        sa.Column("geometry", geoalchemy2.Geometry(geometry_type="POLYGON", srid=4326), nullable=False),
        sa.Column("cell_size_deg", sa.Float(), nullable=False),
        sa.Column("hazard_intensity", sa.Float(), nullable=False),
        sa.Column("population_density", sa.Float(), server_default=sa.text("0.0"), nullable=True),
        sa.Column("building_density", sa.Float(), server_default=sa.text("0.0"), nullable=True),
        sa.Column("severity_score", sa.Float(), nullable=False),
        sa.Column("severity_class", sa.String(20), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("idx_grid_cell_geometry", "grid_cell", ["geometry"], postgresql_using="gist")
    op.create_index("idx_grid_cell_event_id", "grid_cell", ["event_id"])

    # 4. depot
    op.create_table(
        "depot",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("location", geoalchemy2.Geometry(geometry_type="POINT", srid=4326), nullable=False),
        sa.Column("address", sa.Text(), nullable=True),
        sa.Column("status", sa.String(20), server_default="active", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # 5. resource_type
    op.create_table(
        "resource_type",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(100), nullable=False, unique=True),
        sa.Column("unit", sa.String(50), nullable=False),
    )

    # 6. inventory_item
    op.create_table(
        "inventory_item",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("depot_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("depot.id", ondelete="CASCADE"), nullable=False),
        sa.Column("resource_type_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("resource_type.id", ondelete="CASCADE"), nullable=False),
        sa.Column("quantity", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("depot_id", "resource_type_id", name="uq_inventory_depot_resource"),
        sa.CheckConstraint("quantity >= 0", name="ck_inventory_quantity_non_negative"),
    )

    # 7. field_operation
    op.create_table(
        "field_operation",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("event_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("disaster_event.id", ondelete="SET NULL"), nullable=True),
        sa.Column("depot_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("depot.id", ondelete="SET NULL"), nullable=True),
        sa.Column("operation_type", sa.String(50), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("location", geoalchemy2.Geometry(geometry_type="POINT", srid=4326), nullable=True),
        sa.Column("status", sa.String(20), server_default="planned", nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # 8. ingestion_run
    op.create_table(
        "ingestion_run",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("source", sa.String(50), nullable=False, index=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", sa.String(20), server_default="running", nullable=False),
        sa.Column("records_fetched", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("records_created", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("records_updated", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("error_message", sa.Text(), nullable=True),
    )

    # 9. donor (D1)
    op.create_table(
        "donor",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("email", sa.String(255), nullable=True),
        sa.Column("phone", sa.String(50), nullable=True),
        sa.Column("organization", sa.String(255), nullable=True),
        sa.Column("location", geoalchemy2.Geometry(geometry_type="POINT", srid=4326), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # 10. donation (D1)
    op.create_table(
        "donation",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("donor_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("donor.id", ondelete="CASCADE"), nullable=False),
        sa.Column("depot_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("depot.id", ondelete="CASCADE"), nullable=False),
        sa.Column("resource_type_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("resource_type.id", ondelete="CASCADE"), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("donated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("quantity > 0", name="ck_donation_quantity_positive"),
    )


def downgrade() -> None:
    op.drop_table("donation")
    op.drop_table("donor")
    op.drop_table("ingestion_run")
    op.drop_table("field_operation")
    op.drop_table("inventory_item")
    op.drop_table("resource_type")
    op.drop_table("depot")
    op.drop_index("idx_grid_cell_event_id", table_name="grid_cell")
    op.drop_index("idx_grid_cell_geometry", table_name="grid_cell")
    op.drop_table("grid_cell")
    op.drop_index("idx_impact_zone_geometry", table_name="impact_zone")
    op.drop_table("impact_zone")
    op.drop_table("disaster_event")
