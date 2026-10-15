# Build Plan — Weeks 1–2

## Requirement Checklist

Each requirement is broken into tasks. Tasks are marked `[ ]` (pending), `[x]` (done), or `[!]` (blocked).

### R1 — Ingestion

- [ ] R1.1: Base connector class with `fetch`, `normalize`, `persist` methods
- [ ] R1.2: GDACS connector (earthquakes, floods, cyclones, droughts, wildfires)
- [ ] R1.3: USGS connector (earthquake GeoJSON feed)
- [ ] R1.4: NDMA connector (fixture fallback — no public API exists)
- [ ] R1.5: NASA FIRMS connector (satellite fire hotspots, requires MAP_KEY)
- [ ] R1.6: Upsert logic keyed on `(source, external_id)`
- [ ] R1.7: `ingestion_run` table logging each run
- [ ] R1.8: Scheduled polling with configurable interval (APScheduler)
- [ ] R1.9: Manual trigger endpoint `POST /api/v1/ingestion/trigger`
- [ ] R1.10: Isolation — one failing source does not break others
- [ ] R1.11: Fixture data flagged `is_sample = true`

### R2 — Geospatial Impact Assessment

- [ ] R2.1: Impact footprint derivation (earthquake: magnitude/depth radius; flood: event geometry or buffer)
- [ ] R2.2: Population density overlay using WorldPop rasters + zonal statistics (rasterio)
- [ ] R2.3: OSM building footprint overlay via Overpass API (bounded, cached)
- [ ] R2.4: Store impact zones with computed stats
- [ ] R2.5: Sample raster for dev included, full download documented
- [ ] R2.6: Document formulas in ARCHITECTURE.md

### R3 — Resource Inventory

- [ ] R3.1: Resource types: food packets, water, medical kits, rescue vehicles, personnel
- [ ] R3.2: Depot CRUD (PostGIS point, name, location, status)
- [ ] R3.3: Inventory CRUD per depot per resource type, with units
- [ ] R3.4: Stock adjustment endpoint that rejects negative stock
- [ ] R3.5: Summary endpoint — totals by resource type

### R4 — Zone Classification

- [ ] R4.1: Grid cell generation with configurable cell size
- [ ] R4.2: Severity score (0–100) from hazard intensity + population + building density
- [ ] R4.3: Classification thresholds from config (Low/Moderate/High/Critical)
- [ ] R4.4: Store with GIST-indexed geometry, queryable by event and bbox

### R5 — PostGIS Database

- [ ] R5.1: Schema — `disaster_event`, `impact_zone`, `grid_cell`, `depot`, `resource_type`, `inventory_item`, `field_operation`, `ingestion_run`, `donor`, `donation`
- [ ] R5.2: Alembic migrations from empty database
- [ ] R5.3: `field_operation` — create and list endpoints only, no UI
- [ ] R5.4: Constraints, foreign keys, spatial indexes
- [ ] R5.5: Seed script with realistic sample data

### P1 — Structure

- [ ] P1.1: `frontend/`, `backend/`, `ml/` folders
- [ ] P1.2: `ml/` has only `.gitkeep` and a 3-line README

### P2 — Connection

- [ ] P2.1: Backend REST API under `/api/v1` with OpenAPI at `/docs`
- [ ] P2.2: CORS from environment config
- [ ] P2.3: Frontend reads `VITE_API_BASE_URL` via typed API client
- [ ] P2.4: README "verify the connection" section

### P3 — Ingestion Works

- [ ] P3.1: Trigger ingestion, see records in PostGIS
- [ ] P3.2: Evidence: query output showing real ingested data

### P4 — Instructions

- [ ] P4.1: README — what, scope, architecture sketch, prerequisites, quick start, ports, seed, ingestion, tests, connection check, troubleshooting
- [ ] P4.2: `docs/ARCHITECTURE.md`
- [ ] P4.3: `docs/DATA_SOURCES.md`
- [ ] P4.4: `docs/ASSUMPTIONS.md`
- [ ] P4.5: `.env.example` with every variable commented

### D1 — Donor (user-directed addition)

- [ ] D1.1: `donor` table (name, email, phone, organization, location as PostGIS point)
- [ ] D1.2: `donation` table (donor -> depot, resource_type, quantity, date)
- [ ] D1.3: Donor CRUD API endpoints
- [ ] D1.4: Record donation endpoint (increases depot stock)
- [ ] D1.5: Frontend Donors view (list, add, record donation)

---

## Folder Structure

```
emergency-response-platform/
├── frontend/
│   ├── src/
│   │   ├── api/           # Typed API client
│   │   ├── components/    # Shared components (Map, DataTable, etc.)
│   │   ├── pages/         # MapPage, EventsPage, InventoryPage, DonorsPage
│   │   ├── types/         # TypeScript interfaces matching API schemas
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── index.css
│   ├── public/
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── Dockerfile
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   └── v1/
│   │   │       ├── events.py
│   │   │       ├── inventory.py
│   │   │       ├── ingestion.py
│   │   │       ├── zones.py
│   │   │       ├── field_ops.py
│   │   │       └── donors.py
│   │   ├── connectors/
│   │   │   ├── base.py
│   │   │   ├── gdacs.py
│   │   │   ├── usgs.py
│   │   │   ├── ndma.py
│   │   │   └── firms.py
│   │   ├── services/
│   │   │   ├── impact.py
│   │   │   ├── grid.py
│   │   │   ├── inventory.py
│   │   │   └── donors.py
│   │   ├── models/
│   │   ├── schemas/
│   │   ├── db.py
│   │   ├── config.py
│   │   ├── scheduler.py
│   │   └── main.py
│   ├── alembic/
│   ├── fixtures/          # NDMA sample data, sample raster
│   ├── tests/
│   ├── seed.py
│   ├── requirements.txt
│   ├── alembic.ini
│   └── Dockerfile
├── ml/
│   ├── .gitkeep
│   └── README.md
├── docs/
│   ├── SCOPE.md
│   ├── PLAN.md
│   ├── ARCHITECTURE.md
│   ├── DATA_SOURCES.md
│   └── ASSUMPTIONS.md
├── docker-compose.yml
├── .env.example
├── .gitignore
└── README.md
```

---

## Stack Decisions

| Choice | Reason |
|--------|--------|
| FastAPI + Pydantic v2 | Native async, auto-generated OpenAPI docs, fast validation |
| SQLAlchemy 2 + GeoAlchemy2 | Mature ORM with PostGIS type support |
| Alembic | Standard migration tool for SQLAlchemy |
| PostgreSQL 16 + PostGIS 3.4 | Required by R5 — spatial queries, GIST indexes |
| httpx | Async HTTP client for connector layer |
| APScheduler | Simple scheduled polling without a heavy job framework |
| rasterio | Zonal statistics on population rasters |
| shapely + pyproj | Geometry operations and coordinate transforms |
| React 18 + Vite + TypeScript | Fast dev server, strict types |
| react-leaflet | Map rendering for disaster events and zones |
| TanStack Query | Server state management with caching and refetching |
| Tailwind CSS | Specified in the stack section of the prompt |
| Docker Compose | Reproducible dev environment with correct startup order |

---

## Schema Design

### `disaster_event`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| source | VARCHAR(50) | GDACS, USGS, NDMA, FIRMS |
| external_id | VARCHAR(255) | Source's identifier |
| event_type | VARCHAR(50) | earthquake, flood, cyclone, drought, wildfire |
| title | TEXT | |
| description | TEXT | |
| geometry | GEOMETRY(Geometry, 4326) | Point or Polygon |
| magnitude | FLOAT | Nullable |
| depth_km | FLOAT | Nullable |
| alert_level | VARCHAR(20) | Green/Orange/Red or null |
| country | VARCHAR(255) | |
| started_at | TIMESTAMPTZ | |
| ended_at | TIMESTAMPTZ | Nullable |
| source_url | TEXT | |
| is_sample | BOOLEAN | Default false |
| raw_data | JSONB | Full source payload |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |
| **UNIQUE** | (source, external_id) | Upsert key |

### `impact_zone`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| event_id | UUID FK -> disaster_event | |
| geometry | GEOMETRY(Polygon, 4326) | Impact footprint |
| radius_km | FLOAT | For earthquake circles |
| population_exposed | INTEGER | From raster overlay |
| building_count | INTEGER | From OSM overlay |
| area_sq_km | FLOAT | |
| created_at | TIMESTAMPTZ | |

### `grid_cell`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| event_id | UUID FK -> disaster_event | |
| impact_zone_id | UUID FK -> impact_zone | |
| geometry | GEOMETRY(Polygon, 4326) | GIST indexed |
| cell_size_deg | FLOAT | |
| hazard_intensity | FLOAT | 0-1 |
| population_density | FLOAT | people/km2 |
| building_density | FLOAT | buildings/km2 |
| severity_score | FLOAT | 0-100 |
| severity_class | VARCHAR(20) | Low/Moderate/High/Critical |
| created_at | TIMESTAMPTZ | |

### `depot`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| name | VARCHAR(255) | |
| location | GEOMETRY(Point, 4326) | |
| address | TEXT | |
| status | VARCHAR(20) | active/inactive |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

### `resource_type`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| name | VARCHAR(100) | food_packets, water, medical_kits, rescue_vehicles, personnel |
| unit | VARCHAR(50) | packets, liters, kits, vehicles, persons |

### `inventory_item`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| depot_id | UUID FK -> depot | |
| resource_type_id | UUID FK -> resource_type | |
| quantity | INTEGER | >= 0 enforced |
| updated_at | TIMESTAMPTZ | |
| **UNIQUE** | (depot_id, resource_type_id) | One row per resource per depot |

### `field_operation`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| event_id | UUID FK -> disaster_event | Nullable |
| depot_id | UUID FK -> depot | Nullable |
| operation_type | VARCHAR(50) | |
| description | TEXT | |
| location | GEOMETRY(Point, 4326) | |
| status | VARCHAR(20) | |
| started_at | TIMESTAMPTZ | |
| ended_at | TIMESTAMPTZ | Nullable |
| created_at | TIMESTAMPTZ | |

### `ingestion_run`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| source | VARCHAR(50) | |
| started_at | TIMESTAMPTZ | |
| finished_at | TIMESTAMPTZ | |
| status | VARCHAR(20) | success/error/partial |
| records_fetched | INTEGER | |
| records_created | INTEGER | |
| records_updated | INTEGER | |
| error_message | TEXT | Nullable |

### `donor`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| name | VARCHAR(255) | |
| email | VARCHAR(255) | Nullable |
| phone | VARCHAR(50) | Nullable |
| organization | VARCHAR(255) | Nullable |
| location | GEOMETRY(Point, 4326) | Nullable |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

### `donation`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| donor_id | UUID FK -> donor | |
| depot_id | UUID FK -> depot | |
| resource_type_id | UUID FK -> resource_type | |
| quantity | INTEGER | > 0 |
| donated_at | TIMESTAMPTZ | |
| notes | TEXT | Nullable |
| created_at | TIMESTAMPTZ | |

---

## API Endpoints

All under `/api/v1`.

### Events
| Method | Path | Purpose | Req |
|--------|------|---------|-----|
| GET | /events | List events, filterable by type, source, bbox, date range | R1, P2 |
| GET | /events/{id} | Event detail with impact zones and grid cells | R1, R2, R4 |

### Ingestion
| Method | Path | Purpose | Req |
|--------|------|---------|-----|
| POST | /ingestion/trigger | Trigger manual ingestion (optional `source` param) | R1 |
| GET | /ingestion/status | Latest run per source | R1 |

### Impact / Zones
| Method | Path | Purpose | Req |
|--------|------|---------|-----|
| GET | /events/{id}/impact-zones | Impact zones for an event | R2 |
| GET | /events/{id}/grid-cells | Grid cells for an event, filterable by bbox | R4 |
| GET | /grid-cells | All grid cells, filterable by bbox and severity | R4 |

### Inventory
| Method | Path | Purpose | Req |
|--------|------|---------|-----|
| GET | /depots | List depots | R3 |
| POST | /depots | Create depot | R3 |
| GET | /depots/{id} | Depot detail with inventory | R3 |
| PUT | /depots/{id} | Update depot | R3 |
| DELETE | /depots/{id} | Delete depot | R3 |
| GET | /depots/{id}/inventory | Inventory for a depot | R3 |
| POST | /depots/{id}/inventory/adjust | Adjust stock (rejects negative result) | R3 |
| GET | /inventory/summary | Totals by resource type | R3 |

### Resource Types
| Method | Path | Purpose | Req |
|--------|------|---------|-----|
| GET | /resource-types | List all resource types | R3 |

### Field Operations
| Method | Path | Purpose | Req |
|--------|------|---------|-----|
| POST | /field-operations | Create | R5 |
| GET | /field-operations | List, filterable by event_id | R5 |

### Donors
| Method | Path | Purpose | Req |
|--------|------|---------|-----|
| GET | /donors | List donors | D1 |
| POST | /donors | Create donor | D1 |
| GET | /donors/{id} | Donor detail with donation history | D1 |
| PUT | /donors/{id} | Update donor | D1 |
| DELETE | /donors/{id} | Delete donor | D1 |
| POST | /donations | Record donation (increases depot stock) | D1 |
| GET | /donations | List donations, filterable by donor_id, depot_id | D1 |

---

## Data Sources

| Source | Endpoint | Key Required | Status |
|--------|----------|-------------|--------|
| GDACS | `https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH` | No | Verified |
| USGS | `https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson` | No | Verified |
| NDMA | No public API | N/A | Fixture fallback |
| NASA FIRMS | `https://firms.modaps.eosdis.nasa.gov/api/area/csv/{MAP_KEY}/...` | Yes (free) | Degrades without key |
| WorldPop | Raster download | No | Sample included |
| Overpass | `https://overpass-api.de/api/interpreter` | No | Public |

---

## Task Order

1. P1.1-P1.2: Scaffold folder structure
2. R5.1-R5.4: Database schema, models, Alembic migrations
3. P2.1-P2.2: FastAPI app skeleton with CORS, OpenAPI
4. R1.1-R1.11: Connector layer, all sources
5. R2.1-R2.6: Impact assessment service
6. R4.1-R4.4: Grid classification service
7. R3.1-R3.5: Inventory CRUD
8. D1.1-D1.5: Donor entity and donations
9. R5.5: Seed script
10. R5.3: Field operations endpoints
11. P2.3-P2.4: Frontend API client
12. Frontend: Map, Events, Inventory, Donors views
13. Docker: Compose file, Dockerfiles, health checks
14. P4.1-P4.5: Documentation
15. Tests

---

## Risks and Fallbacks

| Risk | Mitigation |
|------|-----------|
| NDMA has no public API | Fixture fallback clearly labelled |
| FIRMS requires API key | Graceful skip, documented in .env.example |
| WorldPop raster is large | Ship small sample, document full download |
| Overpass API rate limits | Cache responses, bounded queries only |
| GDACS may be slow | Timeout + retry, error logged in ingestion_run |
