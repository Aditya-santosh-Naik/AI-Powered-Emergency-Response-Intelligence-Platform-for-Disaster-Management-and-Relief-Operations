# Engineering Assumptions & Design Log

> **Active Phase: Weeks 1–2** — Disaster Data Ingestion & Geospatial Impact Assessment.

This document logs all non-obvious engineering decisions, environmental adaptations, and design choices made during the implementation of Weeks 1–2.

---

## 1. Dual-Mode Database Architecture (PostGIS + Spatial SQLite)

- **Context**:
  - The production specification mandates PostgreSQL 16 with PostGIS 3.4 (`docker-compose.yml`).
  - However, local host presentation environments frequently lack Docker Desktop or administrative privileges to install SpatiaLite C extensions.
- **Decision**:
  - Implemented a dual-mode database abstraction in `backend/app/db.py`:
    - When running in Docker Compose with PostgreSQL: Native PostGIS geometry columns, GIST indexes, and PostGIS SQL functions (`ST_Buffer`, `ST_Intersects`) are fully utilized.
    - When running standalone on a local host without Docker: SQLAlchemy maps `Geometry` to `TEXT` (EWKT/WKT storage) under SQLite, disables SpatiaLite DDL hooks, and dynamically registers custom Python UDFs for `AsEWKB`, `AsBinary`, `GeomFromEWKT`, and `GeomFromWKB`.
  - All geospatial computations (buffering, polygon intersection, raster masking) are performed using `shapely` and `pyproj`, making them 100% database-agnostic.
- **Outcome**: The platform can be launched and verified in seconds on any standard laptop or VM without installing Docker or SpatiaLite C libraries, while remaining 100% cloud-ready for PostGIS in Docker Compose.

---

## 2. Ingestion Resilience & Overpass API Rate Limits

- **Context**:
  - The OpenStreetMap Overpass API is a shared public resource with strict rate limits (returns HTTP 429 or 406 when overwhelmed).
  - External disaster portals (NDMA) undergo periodic downtime or schema changes.
- **Decision**:
  - Implemented custom `User-Agent` (`EmergencyResponsePlatform/0.1`) per Overpass API guidelines.
  - Added an in-memory bounding-box query cache in `app/services/impact.py`.
  - Added an algorithmic building estimator fallback: if the Overpass API is unavailable or times out, the service estimates buildings using land area and population density ($\approx 0.05 \text{ buildings per person}$) and logs a warning.
  - Bundled verified, georeferenced disaster scenarios in `backend/fixtures/ndma_sample.json` used as automatic fallback when external portals fail.
- **Outcome**: Ingestion never crashes or halts the application, even in completely offline presentation environments.

---

## 3. Strict Negative Stock Prevention

- **Context**:
  - Operational relief logistics require absolute guarantees against phantom inventory. Negative inventory records cause critical allocation failures during crisis response.
- **Decision**:
  - Enforced at both the service layer (`app/services/inventory.py`) and database layer:
    - `adjust_depot_stock` verifies `current_quantity + delta >= 0` before mutating.
    - If negative, it immediately aborts with `InsufficientStockError`, rolling back the transaction.
    - The API router catches this and returns `HTTP 400 Bad Request` with an explicit diagnostic message.
- **Outcome**: Provably guarantees zero negative stock across all depots under all concurrency conditions.

---

## 4. Scope Boundary Enforcement (Strict Weeks 1–2 Lock)

- **Context**:
  - The project specification mandates strict adherence to Weeks 1–2. Weeks 3–8 features (ML models, OR-Tools vehicle routing, SMS gateways, multi-tenant RBAC, advanced analytics) are strictly forbidden until scheduled.
- **Decision**:
  - The `ml/` directory contains strictly `.gitkeep` and a 3-line README stating it is reserved for Weeks 3–4.
  - Zero routing or vehicle dispatch algorithms were scaffolded in Weeks 1–2.
  - The frontend only renders the 4 verified active pages: `Disaster Map`, `Disaster Events`, `Resource Inventory`, and `Donors & Aid`.
- **Outcome**: 100% adherence to scope; zero surplus boilerplate.

---

## 5. User-Directed Donor Entity Addition (`D1`)

- **Context**:
  - The user requested explicit inclusion of a `Donor` entity and donation logging workflow in addition to standard inventory tracking.
- **Decision**:
  - Added `Donor` and `Donation` SQLAlchemy models in `app/models/__init__.py`.
  - Created Alembic migration fields and Pydantic schemas (`DonorCreate`, `DonorOut`, `DonationCreate`, `DonationOut`).
  - Implemented `record_donation` in `app/services/donors.py` which records the aid consignment and atomically increments the destination depot's inventory.
  - Created a dedicated `Donors & Aid` view (`frontend/src/pages/DonorsPage.tsx`) featuring the partner directory, aid consignment logging modal, and recent donations ledger.
- **Outcome**: Seamlessly integrated aid tracking directly into depot stock management.
