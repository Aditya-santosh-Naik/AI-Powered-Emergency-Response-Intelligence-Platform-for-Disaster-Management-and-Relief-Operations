# Platform Data Flow Architecture

Complete data pipeline flows across ingestion, impact assessment, predictive intelligence, optimization, mission dispatch, and reporting.

---

## 1. End-to-End Operational Response Pipeline

```mermaid
sequenceDiagram
    autonumber
    actor ExternalFeeds as GDACS / USGS / NDMA
    participant Ingest as Ingestion Service
    participant DB as PostGIS / SQLite DB
    participant Impact as Geospatial Impact Engine
    participant Grid as Severity Grid Generator
    participant ML as XGBoost Demand Predictor
    participant Solver as OR-Tools SCIP Optimizer
    participant Routing as NetworkX Routing Engine
    participant Missions as Mission Dispatch Manager
    actor Commander as Operations Commander
    actor FieldLead as Field Convoy Lead

    ExternalFeeds->>Ingest: Poll Disaster Data (GeoJSON / RSS)
    Ingest->>DB: Idempotent Event Upsert
    Ingest->>Impact: Trigger Impact Assessment
    Impact->>DB: Store ImpactZone & Exposed Population
    Impact->>Grid: Partition Footprint into 0.05° Cells
    Grid->>DB: Store GridCells with Composite Severity
    Commander->>ML: Request Demand Prediction
    ML->>DB: Query Zone Parameters & Vulnerability
    ML->>DB: Persist 4-Target Demand Predictions
    Commander->>Solver: Execute Resource Allocation Run
    Solver->>DB: Query Depot Stocks & Zone Demands
    Solver->>Routing: Calculate Distances & Accessibility
    Routing-->>Solver: Return Distances & Durations
    Solver->>DB: Persist AllocationPlan & AllocationDetails
    Commander->>Missions: Auto-Generate Dispatch Missions
    Missions->>DB: Reserve Depot Stock (ResourceTransaction)
    Missions->>FieldLead: Assign Convoy Manifest & Route
    FieldLead->>Missions: Update Status (ASSIGNED -> IN_TRANSIT -> DELIVERED)
    Missions->>DB: Deduct Physical Inventory Stock
    Commander->>DB: Generate Situation Report (SitRep)
```

---

## 2. Citizen Disaster Reporting & Triage Workflow

```mermaid
flowchart TD
    Citizen([Citizen / First Responder]) -->|Submit Incident Report| WebForm[Citizen Report API POST /reports]
    WebForm -->|Status: PENDING_REVIEW| ReportQueue[(Disaster Report DB)]
    ReportQueue --> CoordinatorDesk[Relief Coordinator Triage Dashboard]
    CoordinatorDesk -->|Review Evidence & Photos| Decision{Coordinator Decision}
    Decision -->|Reject| RejectedState[Mark REJECTED with Reason]
    Decision -->|Request Info| InfoState[Mark ADDITIONAL_INFO_REQUIRED]
    Decision -->|Approve & Verify| AcceptedState[Mark ACCEPTED_FOR_ASSESSMENT]
    AcceptedState --> AutoEvent[Auto-Create Verified DisasterEvent]
    AutoEvent --> AutoZone[Buffer Geographic Coordinates -> ImpactZone]
    AutoZone --> AutoPredict[Execute ML Demand Predictor]
    AutoPredict --> ExcelSync[Synchronize Dataset Workbook .xlsx]
    AutoPredict --> ReadyForAllocation[Ready for OR-Tools Allocation]
```

---

## 3. Commander Priority Override Flow

```mermaid
flowchart LR
    MLPred[ML Model Predicted Urgency] -->|Score & Class| ZoneQueue[Allocation Queue]
    Commander([Command Center Admin]) -->|Identify Critical Field Need| OverrideForm[POST /overrides]
    OverrideForm -->|Deactivate Previous| DBOverride[(PriorityOverride Table)]
    DBOverride --> SolverRun[OR-Tools MILP Solver Run]
    SolverRun -->|Read is_active Overrides| ObjectiveFunction[Elevate Zone Objective Weight]
    ObjectiveFunction --> ReallocatedPlan[Optimal Allocation Prioritizing Overridden Sector]
```
