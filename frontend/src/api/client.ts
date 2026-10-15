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
} from "../types";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api/v1";

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
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
};
