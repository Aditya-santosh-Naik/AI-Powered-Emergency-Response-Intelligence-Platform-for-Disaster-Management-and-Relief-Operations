import type {
  DisasterEvent,
  EventDetail,
  Depot,
  DepotCreate,
  InventoryItem,
  InventorySummaryItem,
  ResourceType,
  IngestionRun,
  GridCell,
  Donor,
  DonorDetail,
  Donation,
  ZonePrediction,
  ModelStatus,
  ScenarioComparison,
  SingleZonePredictionPayload,
  User,
  TokenOut,
  DisasterReport,
  DisasterReportCreate,
  DisasterReportReviewRequest,
  DisasterReportAssessmentResponse,
} from "../types";


const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api/v1";

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const token = localStorage.getItem("emergency_token");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...((options.headers as Record<string, string>) || {}),
  };

  const response = await fetch(url, { ...options, headers });
  if (!response.ok) {
    let errorDetail = `Request failed: ${response.statusText} (${response.status})`;
    try {
      const errJson = await response.json();
      if (errJson.detail) {
        errorDetail = typeof errJson.detail === "string" ? errJson.detail : JSON.stringify(errJson.detail);
      }
    } catch {
      // ignore
    }
    throw new Error(errorDetail);
  }

  if (response.status === 204) {
    return null as unknown as T;
  }
  return response.json();
}

export const api = {
  // Health
  getHealth: () => request<{ status: string; version: string; module: string }>("/health"),

  // Events
  getEvents: (params?: { event_type?: string; source?: string; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.event_type) q.set("event_type", params.event_type);
    if (params?.source) q.set("source", params.source);
    if (params?.limit) q.set("limit", params.limit.toString());
    const queryStr = q.toString() ? `?${q.toString()}` : "";
    return request<DisasterEvent[]>(`/events${queryStr}`);
  },

  getEventDetail: (id: string) => request<EventDetail>(`/events/${id}`),

  // Ingestion
  triggerIngestion: (source?: string) =>
    request<IngestionRun[]>("/ingestion/trigger", {
      method: "POST",
      body: JSON.stringify(source ? { source } : {}),
    }),

  getIngestionStatus: () => request<IngestionRun[]>("/ingestion/status"),

  // Depots & Inventory
  getDepots: () => request<Depot[]>("/depots"),
  createDepot: (data: DepotCreate) =>
    request<Depot>("/depots", { method: "POST", body: JSON.stringify(data) }),
  updateDepot: (id: string, data: Partial<DepotCreate>) =>
    request<Depot>(`/depots/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteDepot: (id: string) => request<void>(`/depots/${id}`, { method: "DELETE" }),

  getDepotInventory: (depotId: string) =>
    request<InventoryItem[]>(`/depots/${depotId}/inventory`),

  adjustInventory: (depotId: string, resourceTypeId: string, quantityChange: number) =>
    request<InventoryItem>(`/depots/${depotId}/inventory/adjust`, {
      method: "POST",
      body: JSON.stringify({ resource_type_id: resourceTypeId, quantity_change: quantityChange }),
    }),

  getInventorySummary: () => request<InventorySummaryItem[]>("/inventory/summary"),
  getResourceTypes: () => request<ResourceType[]>("/resource-types"),

  // Zones & Grid Cells
  getGridCells: (params?: { severity_class?: string; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.severity_class) q.set("severity_class", params.severity_class);
    if (params?.limit) q.set("limit", params.limit.toString());
    const queryStr = q.toString() ? `?${q.toString()}` : "";
    return request<GridCell[]>(`/grid-cells${queryStr}`);
  },

  // Donors (D1)
  getDonors: () => request<Donor[]>("/donors"),
  createDonor: (data: { name: string; email?: string; phone?: string; organization?: string; latitude?: number; longitude?: number }) =>
    request<Donor>("/donors", { method: "POST", body: JSON.stringify(data) }),
  getDonorDetail: (id: string) => request<DonorDetail>(`/donors/${id}`),
  recordDonation: (data: { donor_id: string; depot_id: string; resource_type_id: string; quantity: number; donated_at: string; notes?: string }) =>
    request<Donation>("/donations", { method: "POST", body: JSON.stringify(data) }),
  getDonations: (params?: { donor_id?: string; depot_id?: string }) => {
    const q = new URLSearchParams();
    if (params?.donor_id) q.set("donor_id", params.donor_id);
    if (params?.depot_id) q.set("depot_id", params.depot_id);
    const queryStr = q.toString() ? `?${q.toString()}` : "";
    return request<Donation[]>(`/donations${queryStr}`);
  },

  // Weeks 3-4 Resource Demand Predictions
  getModelStatus: () => request<ModelStatus>("/predictions/status"),
  getEventPredictions: (eventId: string) =>
    request<ZonePrediction[]>(`/predictions/events/${eventId}`),
  predictEventResources: (eventId: string, horizonDays: number = 3, vulnBuffer: boolean = false) =>
    request<ZonePrediction[]>(
      `/predictions/events/${eventId}/predict?planning_horizon_days=${horizonDays}&apply_vulnerability_buffer=${vulnBuffer}`,
      { method: "POST" }
    ),
  predictSingleZone: (data: SingleZonePredictionPayload) =>
    request<ZonePrediction>("/predictions/predict-zone", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  simulateScenario: (data: {
    zone_data?: any;
    scenario_name?: string;
    population_multiplier?: number;
    severity_score_delta?: number;
    planning_horizon_days?: number;
    response_delay_hours_delta?: number;
    road_accessibility_delta?: number;
    inventory_availability_multiplier?: number;
    apply_vulnerability_buffer?: boolean;
  }) =>
    request<ScenarioComparison>("/predictions/scenarios", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  recalculateEventDemand: (
    eventId: string,
    data: { trigger_type: string; source_reference: string; notes?: string; field_updates?: any }
  ) =>
    request<{
      status: string;
      history_id: string;
      event_id: string;
      trigger_type: string;
      trigger_source: string;
      zones_updated_count: number;
      updated_at: string;
      predictions: ZonePrediction[];
    }>(`/predictions/events/${eventId}/recalculate`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  refreshExcelWorkbook: () =>
    request<{ status: string; path: string; size_bytes: number; timestamp: string }>(
      "/predictions/excel/refresh",
      { method: "POST" }
    ),
  getExcelDownloadUrl: () => `${API_BASE}/predictions/excel/download`,

  // Authentication (Role A & B)
  login: (data: { email: string; password: string }) =>
    request<TokenOut>("/auth/login", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  register: (data: {
    email: string;
    password: string;
    full_name: string;
    role?: string;
    organization?: string;
    phone?: string;
  }) =>
    request<TokenOut>("/auth/register", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getMe: () => request<User>("/auth/me"),

  // Disaster Reporting (Role A: Disaster Reporter)
  submitReport: (data: DisasterReportCreate) =>
    request<DisasterReport>("/reports", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getMyReports: () => request<DisasterReport[]>("/reports/my"),
  getReportDetail: (id: string) => request<DisasterReport>(`/reports/${id}`),

  // Admin Report Review & Assessment (Role B: Relief Coordinator)
  getAdminReports: (params?: { status?: string; disaster_type?: string; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.status) q.set("status", params.status);
    if (params?.disaster_type) q.set("disaster_type", params.disaster_type);
    if (params?.limit) q.set("limit", params.limit.toString());
    const queryStr = q.toString() ? `?${q.toString()}` : "";
    return request<DisasterReport[]>(`/reports${queryStr}`);
  },
  reviewReport: (id: string, data: DisasterReportReviewRequest) =>
    request<DisasterReport>(`/reports/${id}/review`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  assessReportAndPredict: (id: string, horizonDays: number = 3, vulnBuffer: boolean = false) =>
    request<DisasterReportAssessmentResponse>(
      `/reports/${id}/assess-and-predict?planning_horizon_days=${horizonDays}&apply_vulnerability_buffer=${vulnBuffer}`,
      { method: "POST" }
    ),
};

