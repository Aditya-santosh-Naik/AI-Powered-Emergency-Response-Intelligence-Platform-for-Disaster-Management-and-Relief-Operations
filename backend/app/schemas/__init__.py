from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field

# -- GeoJSON helpers --

class GeoJSONPoint(BaseModel):
    type: str = "Point"
    coordinates: list[float]  # [lon, lat] or [lon, lat, alt]


class GeoJSONPolygon(BaseModel):
    type: str = "Polygon"
    coordinates: list[list[list[float]]]


class GeoJSONGeometry(BaseModel):
    type: str
    coordinates: list  # flexible for Point, Polygon, MultiPolygon


# -- Disaster Events --

class EventBase(BaseModel):
    source: str
    external_id: str
    event_type: str
    title: str
    description: str | None = None
    magnitude: float | None = None
    depth_km: float | None = None
    alert_level: str | None = None
    country: str | None = None
    started_at: datetime
    ended_at: datetime | None = None
    source_url: str | None = None
    is_sample: bool = False


class EventOut(EventBase):
    id: UUID
    geometry: GeoJSONGeometry | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class EventDetail(EventOut):
    impact_zones: list["ImpactZoneOut"] = []
    grid_cells: list["GridCellOut"] = []


# -- Impact Zones --

class ImpactZoneOut(BaseModel):
    id: UUID
    event_id: UUID
    geometry: GeoJSONPolygon | None = None
    radius_km: float | None = None
    population_exposed: int | None = None
    building_count: int | None = None
    area_sq_km: float | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


# -- Grid Cells --

class GridCellOut(BaseModel):
    id: UUID
    event_id: UUID
    impact_zone_id: UUID
    geometry: GeoJSONPolygon | None = None
    cell_size_deg: float
    hazard_intensity: float
    population_density: float | None = None
    building_density: float | None = None
    severity_score: float
    severity_class: str
    created_at: datetime

    model_config = {"from_attributes": True}


# -- Depots --

class DepotCreate(BaseModel):
    name: str
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    address: str | None = None
    status: str = "active"


class DepotUpdate(BaseModel):
    name: str | None = None
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    address: str | None = None
    status: str | None = None


class DepotOut(BaseModel):
    id: UUID
    name: str
    latitude: float
    longitude: float
    address: str | None = None
    status: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# -- Resource Types --

class ResourceTypeOut(BaseModel):
    id: UUID
    name: str
    unit: str

    model_config = {"from_attributes": True}


# -- Inventory --

class InventoryItemOut(BaseModel):
    id: UUID
    depot_id: UUID
    resource_type_id: UUID
    resource_type_name: str | None = None
    resource_type_unit: str | None = None
    quantity: int
    updated_at: datetime

    model_config = {"from_attributes": True}


class StockAdjustment(BaseModel):
    resource_type_id: UUID
    quantity_change: int  # positive to add, negative to subtract


class InventorySummaryItem(BaseModel):
    resource_type_id: UUID
    resource_type_name: str
    resource_type_unit: str
    total_quantity: int


# -- Ingestion --

class IngestionRunOut(BaseModel):
    id: UUID
    source: str
    started_at: datetime
    finished_at: datetime | None = None
    status: str
    records_fetched: int
    records_created: int
    records_updated: int
    error_message: str | None = None

    model_config = {"from_attributes": True}


class IngestionTriggerRequest(BaseModel):
    source: str | None = None  # None means run all sources


# -- Field Operations --

class FieldOperationCreate(BaseModel):
    event_id: UUID | None = None
    depot_id: UUID | None = None
    operation_type: str
    description: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    status: str = "planned"
    started_at: datetime


class FieldOperationOut(BaseModel):
    id: UUID
    event_id: UUID | None = None
    depot_id: UUID | None = None
    operation_type: str
    description: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    status: str
    started_at: datetime
    ended_at: datetime | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


# -- Donors --

class DonorCreate(BaseModel):
    name: str
    email: str | None = None
    phone: str | None = None
    organization: str | None = None
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)


class DonorUpdate(BaseModel):
    name: str | None = None
    email: str | None = None
    phone: str | None = None
    organization: str | None = None
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)


class DonorOut(BaseModel):
    id: UUID
    name: str
    email: str | None = None
    phone: str | None = None
    organization: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class DonorDetail(DonorOut):
    donations: list["DonationOut"] = []


class DonationCreate(BaseModel):
    donor_id: UUID
    depot_id: UUID
    resource_type_id: UUID
    quantity: int = Field(gt=0)
    donated_at: datetime
    notes: str | None = None


class DonationOut(BaseModel):
    id: UUID
    donor_id: UUID
    depot_id: UUID
    resource_type_id: UUID
    resource_type_name: str | None = None
    quantity: int
    donated_at: datetime
    notes: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


# -- Pagination wrapper --

class PaginatedResponse(BaseModel):
    items: list
    total: int
    page: int
    page_size: int


# -- Weeks 3-4 Resource Demand Predictions --

class ResourceDemandItem(BaseModel):
    target_variable: str
    display_name: str
    unit: str
    base_predicted_demand: int
    vulnerability_multiplier: float
    predicted_demand: int
    lower_bound_80pct: int
    upper_bound_80pct: int
    verified_available_stock: int | None = None
    confirmed_incoming_supply: int = 0
    additional_quantity_recommended: int | None = None
    stock_verification_status: str


class ZonePredictionOut(BaseModel):
    id: UUID | None = None
    zone_id: str
    event_id: str | None = None
    disaster_type: str

    severity_score_0_1: float
    affected_population_estimate: int
    planning_horizon_days: int
    road_accessibility_0_1: float
    building_damage_share_0_1: float
    urgency_score_0_100: float
    urgency_class: str
    urgency_reasons: list[str]
    resource_demands: dict[str, ResourceDemandItem]
    vulnerability_profile: dict[str, Any] | None = None
    prediction_uncertainty_note: str
    model_version: str
    data_status: str
    human_review_required: bool
    prediction_timestamp: datetime


class SingleZonePredictionRequest(BaseModel):
    zone_id: str | None = None
    event_id: str | None = None
    disaster_type: str = "flood"
    region_type: str = "urban"
    affected_population_estimate: int = Field(default=5000, ge=0)
    severity_score_0_1: float = Field(default=0.5, ge=0.0, le=1.0)
    population_density_per_km2: float = Field(default=1500.0, ge=0.0)
    children_share_0_1: float = Field(default=0.20, ge=0.0, le=1.0)
    elderly_share_0_1: float = Field(default=0.12, ge=0.0, le=1.0)
    medical_dependency_share_0_1: float = Field(default=0.08, ge=0.0, le=1.0)
    building_damage_share_0_1: float = Field(default=0.25, ge=0.0, le=1.0)
    road_accessibility_0_1: float = Field(default=0.75, ge=0.0, le=1.0)
    response_delay_hours: float = Field(default=24.0, ge=0.0)
    planning_horizon_days: int = Field(default=3, ge=1, le=30)
    verified_inventory: dict[str, int] | None = None
    confirmed_incoming: dict[str, int] | None = None
    apply_vulnerability_buffer: bool = False


class ScenarioSimulationRequest(BaseModel):
    zone_id: str | None = None
    event_id: str | None = None
    zone_data: dict[str, Any] | None = None
    scenario_name: str = "Hypothetical Operational Scenario"
    scenario_id: str | None = None
    population_multiplier: float = 1.0
    severity_score_delta: float = 0.0
    planning_horizon_days: int | None = None
    response_delay_hours_delta: float = 0.0
    road_accessibility_delta: float = 0.0
    inventory_availability_multiplier: float = 1.0
    apply_vulnerability_buffer: bool = False


class DynamicRecalculationRequest(BaseModel):
    trigger_type: str = "field_report"
    source_reference: str = "Field Operation SitRep"
    notes: str | None = None
    field_updates: dict[str, Any] | None = None


class ModelStatusOut(BaseModel):
    service_status: str
    model_version: str
    trained_at: str | None = None
    targets: list[str]
    features_count: int
    excel_workbook_path: str
    excel_workbook_size_bytes: int
    excel_last_modified: str | None = None
    evaluations: dict[str, Any]


class PredictionHistoryOut(BaseModel):
    id: UUID
    event_id: UUID
    trigger_type: str
    trigger_source: str
    notes: str | None = None
    zones_updated_count: int
    created_at: datetime

    model_config = {"from_attributes": True}


# -- User Authentication Schemas --

class UserRegister(BaseModel):
    email: str = Field(min_length=5, max_length=255)
    password: str = Field(min_length=6, max_length=128)
    full_name: str = Field(min_length=2, max_length=255)
    role: str = Field(default="reporter")
    organization: str | None = None
    phone: str | None = None


class UserLogin(BaseModel):
    email: str
    password: str


class UserOut(BaseModel):
    id: UUID
    email: str
    full_name: str
    role: str
    organization: str | None = None
    phone: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# -- Disaster Report Schemas --

class DisasterReportCreate(BaseModel):
    disaster_type: str = Field(min_length=3, max_length=50)
    title: str = Field(min_length=3, max_length=255)
    description: str = Field(min_length=10)
    location_name: str = Field(min_length=2, max_length=255)
    latitude: float = Field(ge=-90.0, le=90.0)
    longitude: float = Field(ge=-180.0, le=180.0)
    occurred_at: datetime
    estimated_affected_population: int | None = Field(default=None, ge=0)
    estimated_damage_severity: float | None = Field(default=None, ge=0.0, le=1.0)
    road_accessible: bool = True
    supporting_evidence_url: str | None = None


class DisasterReportReviewRequest(BaseModel):
    status: str = Field(description="ACCEPTED_FOR_ASSESSMENT, REJECTED, or ADDITIONAL_INFO_REQUIRED")
    admin_notes: str | None = None


class DisasterReportOut(BaseModel):
    id: UUID
    report_code: str
    reporter_id: UUID
    reporter_name: str | None = None
    reporter_email: str | None = None
    disaster_type: str
    title: str
    description: str
    location_name: str
    latitude: float
    longitude: float
    occurred_at: datetime
    estimated_affected_population: int | None = None
    estimated_damage_severity: float | None = None
    road_accessible: bool
    supporting_evidence_url: str | None = None
    status: str
    admin_notes: str | None = None
    reviewed_by_name: str | None = None
    reviewed_at: datetime | None = None
    associated_event_id: UUID | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class DisasterReportAssessmentResponse(BaseModel):
    report: DisasterReportOut
    associated_event_id: UUID
    predictions: list[ZonePredictionOut]


