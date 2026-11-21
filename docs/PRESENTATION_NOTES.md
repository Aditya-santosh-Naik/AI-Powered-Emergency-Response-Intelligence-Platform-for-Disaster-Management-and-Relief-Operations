# Final Project Presentation & Demonstration Guide

Executive pitch deck outline, feature demonstrations, and talking points for mentor evaluation and project review.

---

## 1. Executive Summary & Problem Statement

- **The Challenge**: During catastrophic disaster events (e.g. 2018 Kerala Floods, 2015 Chennai Deluge), disaster management agencies face severe bottlenecks:
  - Fragmented data across disparate global and national feeds.
  - Manual, heuristic-based relief allocation resulting in severe local shortages and duplicate supply dispatches.
  - Lack of unified tracking connecting incoming donations, warehouse stockpiles, and frontline field convoys.
- **The Solution**: An integrated, end-to-end Geospatial AI platform combining automated multi-source ingestion, demographic exposure estimation, machine learning demand forecasting, and OR-Tools linear optimization.

---

## 2. Architecture & Technological Innovation

| Module | Core Technology | Architectural Purpose |
|---|---|---|
| **Data Ingestion** | APScheduler, GDACS/USGS/NDMA Connectors | Idempotent, continuous feed polling |
| **Geospatial Engine** | GeoAlchemy2, PostGIS, Shapely | Hazard footprint & 0.05° severity grid |
| **Demand Prediction** | XGBoost, MultiOutput Regressor | 4-commodity demand prediction with 80% intervals |
| **Logistics Optimizer** | Google OR-Tools (SCIP MILP) | Constrained resource allocation |
| **Transit Routing** | NetworkX, Haversine Engine | Highway corridor dispatch with road status |
| **Command Dashboard** | React 19, Leaflet, Tailwind CSS | Unified operations map & convoy tracking |

---

## 3. Step-by-Step Live Demo Walkthrough Script

### Step 1: Command Dashboard & Situational Map (`/` and `/command`)
1. Show the interactive Leaflet command map with active disaster markers across India.
2. Toggle map layers: **Impact Footprints**, **Severity Grid Cells**, and **Strategic Regional Depots**.
3. Highlight the KPI telemetry strip displaying active alerts, high-priority zones, and inventory stockpiles.

### Step 2: Citizen Incident Reporting & Coordinator Triage (`/report` and `/admin`)
1. Demonstrate citizen report submission (`/report`) with geographic coordinates and damage severity.
2. Switch to Admin Dashboard (`/admin`), review the report in the triage queue, and click **"Approve & Accept"**.
3. Click **"Run Prediction Engine"** to execute the trained XGBoost model and generate 4-target demand forecasts.

### Step 3: Google OR-Tools Resource Allocation (`/command`)
1. Select the disaster event and set the planning horizon to 3 days.
2. Click **"Execute Resource Allocation Solver"**.
3. Showcase the output:
   - Solver Status: `OPTIMAL`
   - Demand Satisfied: `100.0%`
   - Execution Time: `< 25 ms`
   - Allocation Matrix: Exact quantities of food, water, medical kits routed from closest depots.

### Step 4: Convoy Dispatch & Status Advancement (`/missions`)
1. In the Command Center, click **"Auto-Generate Missions"**.
2. Navigate to the Missions Board (`/missions`).
3. Show the newly generated mission codes (e.g. `MSN-2026-DEL-1A4F`).
4. Expand a mission card to reveal the cargo manifest and route summary.
5. Click **"Dispatch"** $\rightarrow$ **"In Transit"** $\rightarrow$ **"Mark Delivered"** to demonstrate the state machine.

### Step 5: Post-Event Analytics & Situation Report (`/sitrep`)
1. Select the event to view the auto-generated official **Situation Report (SitRep)**.
2. Review the demographic exposure summary, demand vs. fulfilled matrix, and fleet metrics.
3. Click **"Download Markdown"** to download the official directive.
