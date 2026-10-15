export interface GeoJSONGeometry {
  type: string;
  coordinates: any;
}

export interface DisasterEvent {
  id: string;
  source: string;
  external_id: string;
  event_type: "earthquake" | "flood" | "cyclone" | "wildfire" | "drought" | string;
  title: string;
  description?: string;
  magnitude?: number;
  depth_km?: number;
  alert_level?: string;
  country?: string;
  started_at: string;
  ended_at?: string;
  source_url?: string;
  is_sample: boolean;
  geometry?: GeoJSONGeometry;
  created_at: string;
  updated_at: string;
}

export interface ImpactZone {
  id: string;
  event_id: string;
  geometry?: GeoJSONGeometry;
  radius_km?: number;
  population_exposed?: number;
  building_count?: number;
  area_sq_km?: number;
  created_at: string;
}

export interface GridCell {
  id: string;
  event_id: string;
  impact_zone_id: string;
  geometry?: GeoJSONGeometry;
  cell_size_deg: number;
  hazard_intensity: number;
  population_density?: number;
  building_density?: number;
  severity_score: number;
  severity_class: "Low" | "Moderate" | "High" | "Critical";
  created_at: string;
}

export interface EventDetail extends DisasterEvent {
  impact_zones: ImpactZone[];
  grid_cells: GridCell[];
}

export interface ResourceType {
  id: string;
  name: string;
  unit: string;
}

export interface InventoryItem {
  id: string;
  depot_id: string;
  resource_type_id: string;
  resource_type_name?: string;
  resource_type_unit?: string;
  quantity: number;
  updated_at: string;
}

export interface Depot {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  address?: string;
  status: "active" | "inactive";
  created_at: string;
  updated_at: string;
}

export interface DepotCreate {
  name: string;
  latitude: number;
  longitude: number;
  address?: string;
  status?: string;
}

export interface InventorySummaryItem {
  resource_type_id: string;
  resource_type_name: string;
  resource_type_unit: string;
  total_quantity: number;
}

export interface IngestionRun {
  id: string;
  source: string;
  started_at: string;
  finished_at?: string;
  status: "success" | "running" | "error";
  records_fetched: number;
  records_created: number;
  records_updated: number;
  error_message?: string;
}

export interface FieldOperation {
  id: string;
  event_id?: string;
  depot_id?: string;
  operation_type: string;
  description?: string;
  latitude?: number;
  longitude?: number;
  status: string;
  started_at: string;
  ended_at?: string;
  created_at: string;
}

export interface Donor {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  organization?: string;
  latitude?: number;
  longitude?: number;
  created_at: string;
  updated_at: string;
}

export interface Donation {
  id: string;
  donor_id: string;
  depot_id: string;
  resource_type_id: string;
  resource_type_name?: string;
  quantity: number;
  donated_at: string;
  notes?: string;
  created_at: string;
}

export interface DonorDetail extends Donor {
  donations: Donation[];
}
