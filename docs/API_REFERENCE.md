# API Reference — AI-Powered Disaster Response Intelligence Platform

Complete REST API documentation covering Weeks 1 through 8 endpoints. Base URL: `/api/v1`.

---

## 1. System Health & Ingestion

### `GET /api/v1/health`
Checks backend service availability, software version, and operational module scope.
- **Response `200`**:
  ```json
  {
    "status": "ok",
    "version": "1.0.0",
    "module": "Weeks 1–8: Full Platform — Ingestion, Impact Assessment, ML Prediction, Logistics Optimization, Mission Dispatch, Post-Event Analytics"
  }
  ```

### `POST /api/v1/ingestion/trigger`
Triggers real-time polling across GDACS, USGS, NDMA, and NASA FIRMS connectors.
- **Request Body**: `{"source": "gdacs"}` (Optional, omit to poll all feeds)
- **Response `200`**: Array of `IngestionRun` records.

### `GET /api/v1/ingestion/status`
Returns status, timestamp, records fetched, and execution metrics of recent ingestion runs.

---

## 2. Disaster Events & Geospatial Impact

### `GET /api/v1/events`
Query disaster events with multi-attribute filtering.
- **Query Params**: `event_type` (str), `source` (str), `country` (str), `limit` (int, default: 50)
- **Response `200`**: List of `EventOut` items with GeoJSON geometry.

### `GET /api/v1/events/{event_id}`
Detailed event metadata including all calculated `impact_zones` and 0.05° `grid_cells`.

### `GET /api/v1/grid-cells`
Retrieves classified severity grid cells for map polygon overlays.
- **Query Params**: `severity_class` (`Critical`, `High`, `Moderate`, `Low`), `limit` (int)

---

## 3. Depots & Inventory Management

### `GET /api/v1/depots`
Lists all active regional logistics depots with geographic coordinates.

### `POST /api/v1/depots`
Registers a new relief logistics depot.

### `GET /api/v1/depots/{depot_id}/inventory`
Retrieves granular resource item breakdown at a given depot.

### `POST /api/v1/inventory/adjust`
Adjusts inventory count. Strictly rejects negative balance transactions.

### `GET /api/v1/inventory/summary`
Returns global resource stockpiles aggregated across all active depots.

---

## 4. Donors & Aid Consignments (`D1`)

### `GET /api/v1/donors` | `POST /api/v1/donors`
Manage registered humanitarian partner organizations.

### `POST /api/v1/donations`
Records an incoming relief donation and automatically replenishes depot inventory.

---

## 5. Machine Learning Resource Demand Prediction (Weeks 3–4)

### `GET /api/v1/predictions/status`
Returns trained XGBoost model status, evaluation metrics (RMSE, MAE, R²), feature counts, and Excel dataset sync timestamp.

### `POST /api/v1/predictions/events/{event_id}/predict`
Executes 4-target regression prediction for an event:
- Targets: `food_packets`, `water_liters`, `medical_kits`, `shelter_spaces`
- Computes 80% prediction intervals, urgency score (0-100), and vulnerability adjustments.

### `POST /api/v1/predictions/predict-zone`
Ad-hoc zone inference for what-if exploratory analysis.

### `POST /api/v1/predictions/scenarios`
Simulates hypothetical operational shock scenarios (e.g. population surge, severed roads).

---

## 6. Logistics Optimization & OR-Tools Solver (Weeks 5–6)

### `POST /api/v1/allocation/run`
Executes Google OR-Tools SCIP MILP solver to allocate available depot inventory to zones.
- **Request Body**:
  ```json
  {
    "event_id": "UUID (optional)",
    "planning_horizon_days": 3,
    "distance_penalty_weight": 0.0001,
    "enforce_accessibility": true,
    "min_demand_fulfillment_ratio": 0.0
  }
  ```
- **Response `200`**: `AllocationPlanOut` with solver status (`OPTIMAL`/`FEASIBLE`), objective value, total demand satisfied percentage, latency in ms, and route-by-route allocation detail items.

### `GET /api/v1/allocation/plans`
Retrieves historical optimization plans and allocation details.

### `POST /api/v1/allocation/plans/{plan_id}/create-missions`
Auto-generates relief dispatch missions for all non-zero allocations in the plan.

---

## 7. Highway Corridors & Logistics Routing

### `GET /api/v1/routing/route`
Computes road transit path, distance (km), estimated duration (hours), and GeoJSON LineString.
- **Query Params**: `origin_lat`, `origin_lon`, `dest_lat`, `dest_lon`, `road_accessibility` (0.0 - 1.0)

### `GET /api/v1/routing/corridors`
Returns 28 strategic national transit highway corridor nodes and network topology for map overlay.

---

## 8. Commander Priority Overrides

### `POST /api/v1/overrides` *(Admin Role Required)*
Registers a manual zone priority override elevating urgency score in the solver.
- **Request Body**: `prediction_id` (UUID), `overridden_urgency_score` (float), `overridden_urgency_class` (str), `justification` (str)

### `GET /api/v1/overrides`
Lists all active priority overrides with audit details.

### `DELETE /api/v1/overrides/{override_id}` *(Admin Role Required)*
Deactivates an override, restoring default ML calculation.

---

## 9. Relief Mission Operations

### `POST /api/v1/missions`
Creates a relief dispatch mission with stock reservation.

### `GET /api/v1/missions`
Lists missions filtered by `status` (`ASSIGNED`, `DISPATCHED`, `IN_TRANSIT`, `DELIVERED`, `COMPLETED`, `CANCELLED`) or `depot_id`.

### `PATCH /api/v1/missions/{mission_id}/status`
Transitions mission along operational state machine.

### `GET /api/v1/missions/{mission_id}/transactions`
Audit trail of stock reservations and status transitions.

---

## 10. Operations Command & Situation Reports

### `GET /api/v1/operations/overview`
High-level KPI metrics: active alerts, critical events, high-priority zones, active depots, total stock, active missions.

### `GET /api/v1/operations/sitrep/{event_id}`
Generates formal Markdown Situation Report (SitRep) with exposed demographics, demand vs allocation matrix, and fleet performance.

### `GET /api/v1/operations/sitrep/{event_id}/markdown`
Downloads raw formatted SitRep markdown document.
