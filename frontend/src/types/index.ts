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

// -- Weeks 5-6 Logistics & Allocation Types --

export interface AllocationDetail {
  id: string;
  plan_id?: string;
  depot_id?: string;
  depot_name?: string;
  depot_latitude?: number;
  depot_longitude?: number;
  prediction_id?: string;
  zone_identifier?: string;
  zone_id?: string;
  zone_label?: string;
  resource_type: string;
  allocated_quantity?: number;
  allocated_qty?: number;
  demanded_quantity?: number;
  shortage_quantity?: number;
  distance_km?: number;
  est_duration_hours?: number;
  accessibility_status?: string;
  priority_score?: number;
  source_depot_id?: string;
  source_depot_name?: string;
  created_at?: string;
}

export interface AllocationPlan {
  id: string;
  event_id?: string;
  solver_status?: string;
  objective_value?: number;
  total_demand_satisfied_pct?: number;
  execution_time_ms?: number;
  solver_parameters?: Record<string, any>;
  horizon_hours?: number;
  total_items_allocated?: number;
  zones_covered?: number;
  depots_used?: number;
  status?: string;
  created_at: string;
  details: AllocationDetail[];
}

export interface PriorityOverride {
  id: string;
  prediction_id?: string;
  event_id?: string;
  zone_identifier?: string;
  zone_id?: string;
  resource_type?: string;
  original_urgency_score?: number;
  original_urgency_class?: string;
  overridden_urgency_score?: number;
  overridden_urgency_class?: string;
  override_factor?: number;
  justification?: string;
  reason?: string;
  authorized_by_id?: string;
  authorized_by_name?: string;
  created_by?: string;
  is_active?: boolean;
  created_at: string;
}

export interface ResourceTransaction {
  id: string;
  depot_id?: string;
  mission_id?: string;
  resource_type: string;
  resource_type_name?: string;
  quantity: number;
  unit?: string;
  state_from?: string;
  state_to?: string;
  reference_note?: string;
  source_depot_id?: string;
  source_depot_name?: string;
  destination_zone_id?: string;
  created_at: string;
}

export interface ReliefMission {
  id: string;
  mission_code?: string;
  label?: string;
  plan_id?: string;
  allocation_plan_id?: string;
  event_id?: string;
  depot_id?: string;
  depot_name?: string;
  source_depot_id?: string;
  source_depot_name?: string;
  prediction_id?: string;
  zone_identifier?: string;
  destination_zone_id?: string;
  destination_label?: string;
  status: "ASSIGNED" | "DISPATCHED" | "IN_TRANSIT" | "DELIVERED" | "COMPLETED" | "CANCELLED" | string;
  team_leader?: string;
  vehicle_type?: string;
  vehicle_identifier?: string;
  manifest?: Record<string, any>;
  route_geojson?: any;
  route_geometry?: GeoJSONGeometry;
  distance_km?: number;
  est_duration_hours?: number;
  eta_minutes?: number;
  notes?: string;
  items?: ResourceTransaction[];
  dispatched_at?: string;
  delivered_at?: string;
  completed_at?: string;
  created_at: string;
  updated_at?: string;
}

export interface OperationsOverview {
  active_alerts_count: number;
  critical_events_count: number;
  high_priority_zones_count: number;
  depots_active_count: number;
  total_stock: Record<string, number>;
  active_missions_count: number;
  gdacs_status: string;
  system_status: string;
  // Legacy / fallback fields
  active_events?: number;
  total_allocations?: number;
  missions_in_transit?: number;
  missions_delivered?: number;
  total_items_dispatched?: number;
  zones_covered?: number;
}

export interface SituationReportData {
  id: string;
  event_id: string;
  report_title?: string;
  markdown_report?: string;
  summary?: string;
  markdown?: string;
  metrics: Record<string, any>;
  created_at?: string;
  generated_at?: string;
}

