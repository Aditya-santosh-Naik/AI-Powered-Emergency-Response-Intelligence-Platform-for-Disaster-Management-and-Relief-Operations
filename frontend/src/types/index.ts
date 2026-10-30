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

// -- Weeks 3-4 Resource Demand Prediction Types --

export interface ResourceDemandItem {
  target_variable: string;
  display_name: string;
  unit: string;
  base_predicted_demand: number;
  vulnerability_multiplier: number;
  predicted_demand: number;
  lower_bound_80pct: number;
  upper_bound_80pct: number;
  verified_available_stock?: number | null;
  confirmed_incoming_supply: number;
  additional_quantity_recommended?: number | null;
  stock_verification_status: string;
}

export interface ZonePrediction {
  id?: string;
  zone_id: string;
  event_id?: string;
  disaster_type: string;
  severity_score_0_1: number;
  affected_population_estimate: number;
  planning_horizon_days: number;
  road_accessibility_0_1: number;
  building_damage_share_0_1: number;
  urgency_score_0_100: number;
  urgency_class: "CRITICAL_URGENT" | "HIGH_PRIORITY" | "MODERATE" | "LOW_MONITORING" | string;
  urgency_reasons: string[];
  resource_demands: {
    food_packets: ResourceDemandItem;
    water_liters: ResourceDemandItem;
    medical_kits: ResourceDemandItem;
    shelter_spaces: ResourceDemandItem;
    [key: string]: ResourceDemandItem;
  };
  vulnerability_profile?: {
    vulnerability_index_0_1: number;
    children_share: number;
    elderly_share: number;
    medical_dependency_share: number;
    has_elevated_vulnerability: boolean;
    adjustments?: Record<string, number>;
    explanations: Array<{
      factor: string;
      observed_value: number;
      reference_baseline: number;
      impacted_resources: string[];
      adjustment_applied: string;
      operational_rationale: string;
    }>;
    double_counting_safeguard: string;
  };
  prediction_uncertainty_note: string;
  model_version: string;
  data_status: string;
  human_review_required: boolean;
  prediction_timestamp: string;
}

export interface ModelStatus {
  service_status: string;
  model_version: string;
  trained_at?: string;
  targets: string[];
  features_count: number;
  excel_workbook_path: string;
  excel_workbook_size_bytes: number;
  excel_last_modified?: string;
  evaluations: Record<string, any>;
}

export interface ScenarioComparison {
  scenario_id: string;
  scenario_name: string;
  zone_id: string;
  timestamp: string;
  drivers_narrative: string;
  operational_integrity_notice: string;
  baseline_parameters: Record<string, any>;
  scenario_parameters: Record<string, any>;
  comparisons: Record<
    string,
    {
      display_name: string;
      unit: string;
      baseline_demand: number;
      scenario_demand: number;
      demand_difference: number;
      demand_difference_pct: number;
      baseline_shortage?: number | null;
      scenario_shortage?: number | null;
      shortage_difference: number;
      baseline_stock_assumption?: number | null;
      scenario_stock_assumption?: number | null;
    }
  >;
}

export interface SingleZonePredictionPayload {
  zone_id?: string;
  event_id?: string;
  disaster_type: string;
  region_type: string;
  affected_population_estimate: number;
  severity_score_0_1: number;
  population_density_per_km2?: number;
  children_share_0_1: number;
  elderly_share_0_1: number;
  medical_dependency_share_0_1: number;
  building_damage_share_0_1: number;
  road_accessibility_0_1: number;
  response_delay_hours: number;
  planning_horizon_days: number;
  verified_inventory?: Record<string, number>;
  confirmed_incoming?: Record<string, number>;
  apply_vulnerability_buffer?: boolean;
}

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: "admin" | "reporter" | string;
  organization?: string;
  phone?: string;
  is_active: boolean;
  created_at: string;
}

export interface TokenOut {
  access_token: string;
  token_type: string;
  user: User;
}

export interface DisasterReport {
  id: string;
  report_code: string;
  reporter_id?: string;
  reporter_name?: string;
  reporter_email?: string;
  disaster_type: string;
  title: string;
  description: string;
  location_name: string;
  latitude: number;
  longitude: number;
  occurred_at: string;
  estimated_affected_population?: number;
  estimated_damage_severity?: number;
  road_accessible?: boolean;
  supporting_evidence_url?: string;
  status: "PENDING_REVIEW" | "ACCEPTED_FOR_ASSESSMENT" | "REJECTED" | "ADDITIONAL_INFO_REQUIRED" | string;
  admin_notes?: string;
  reviewed_by_name?: string;
  reviewed_at?: string;
  associated_event_id?: string;
  created_at: string;
  updated_at: string;
}

export interface DisasterReportCreate {
  disaster_type: string;
  title: string;
  description: string;
  location_name: string;
  latitude: number;
  longitude: number;
  occurred_at: string;
  estimated_affected_population?: number;
  estimated_damage_severity?: number;
  road_accessible?: boolean;
  supporting_evidence_url?: string;
}

export interface DisasterReportReviewRequest {
  status: "ACCEPTED_FOR_ASSESSMENT" | "REJECTED" | "ADDITIONAL_INFO_REQUIRED" | string;
  admin_notes?: string;
}

export interface DisasterReportAssessmentResponse {
  report: DisasterReport;
  associated_event_id: string;
  predictions: ZonePrediction[];
}

