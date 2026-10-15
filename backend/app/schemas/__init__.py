from datetime import datetime
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
