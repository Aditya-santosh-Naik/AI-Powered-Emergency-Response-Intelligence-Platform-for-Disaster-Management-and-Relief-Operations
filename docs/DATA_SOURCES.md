# Data Sources & External Integrations

> **Active Phase: Weeks 1–2** — Disaster Data Ingestion & Geospatial Impact Assessment.

This document details the external data feeds, geospatial datasets, external APIs, and local fallback mechanisms used across the platform.

---

## 1. Summary of Ingestion Feeds

| Data Source | Entity Monitored | Format | Polling Interval | Auth Required | Fallback Strategy |
|---|---|---|---|---|---|
| **GDACS** | Floods, Cyclones, Earthquakes | XML (RSS 2.0 / GeoRSS) | 30 minutes | None (Public) | Ingest last cached payload |
| **USGS** | Global Seismic Activity ($M \ge 3.0$) | GeoJSON (REST) | 30 minutes | None (Public) | Ingest last cached payload |
| **NDMA** | Indian National Bulletins | JSON / HTML | 30 minutes | None (Public) | Seed fixture: `fixtures/ndma_sample.json` |
| **NASA FIRMS** | Thermal Anomalies & Wildfires | CSV / REST API | 30 minutes | Free Map Key | Synthetic hotspot generator |

---

## 2. Ingestion Feed Specifications

### 2.1 Global Disaster Alert and Coordination System (GDACS)
- **Provider**: Joint UNEP / OCHA initiative.
- **Feed URL**: `https://www.gdacs.org/xml/rss.xml`
- **Protocol**: HTTP GET, standard RSS 2.0 with GeoRSS namespace extension (`xmlns:geo="http://www.w3.org/2003/01/geo/wgs84_pos#"`).
- **Extracted Fields**:
  - `guid` / `link`: External event identifier.
  - `title`: Event designation and geographical description.
  - `geo:lat` & `geo:long`: WGS84 coordinates.
  - `gdacs:alertlevel`: Categorized severity (`Green`, `Orange`, `Red`).
  - `gdacs:eventtype`: Event classifier (`EQ` = Earthquake, `TC` = Tropical Cyclone, `FL` = Flood, `DR` = Drought).
- **Connector Implementation**: `backend/app/connectors/gdacs.py`.

---

### 2.2 USGS Earthquake Hazards Program
- **Provider**: United States Geological Survey.
- **Feed URL**: `https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson`
- **Protocol**: RESTful HTTP GET returning GeoJSON FeatureCollection.
- **Filtering**: Only earthquakes with magnitude $M \ge 3.0$ are ingested to preserve operational relevance and avoid log saturation.
- **Extracted Fields**:
  - `id`: USGS unique earthquake identifier.
  - `properties.mag`: Richter / Moment magnitude.
  - `properties.place`: Descriptive location string.
  - `geometry.coordinates`: `[longitude, latitude, depth_km]`.
  - `properties.alert`: USGS PAGER alert level (`green`, `yellow`, `orange`, `red`).
- **Connector Implementation**: `backend/app/connectors/usgs.py`.

---

### 2.3 National Disaster Management Authority (NDMA)
- **Provider**: Government of India National Disaster Management Authority.
- **Feed Target**: National disaster situational reports and state bulletins.
- **Resilience Mechanism**: Because Indian government portal schemas periodically change or undergo scheduled maintenance, `app/connectors/ndma.py` implements an active fallback to a pre-verified, georeferenced scenario fixture located at:
  - `backend/fixtures/ndma_sample.json`
- **Sample Scenarios Included**:
  - *Assam Flooding Inundation (Brahmaputra Basin)*
  - *Cyclone Impact Zone (Odisha / Bay of Bengal)*
  - *Uttarakhand Flash Flood Advisory*
- **Connector Implementation**: `backend/app/connectors/ndma.py`.

---

### 2.4 NASA FIRMS (Fire Information for Resource Management System)
- **Provider**: NASA Earth Observing System Data and Information System (EOSDIS).
- **Feed URL**: `https://firms.modaps.eosdis.nasa.gov/api/area/csv/{MAP_KEY}/MODIS_NRT/world/1`
- **Authentication**: Requires a free 32-character Map Key (`FIRMS_MAP_KEY` in `.env`).
- **Graceful Degradation**: If `FIRMS_MAP_KEY` is omitted or empty, `app/connectors/firms.py` generates realistic synthetic thermal anomalies across known wildfire hazard zones (e.g. Western Ghats, Simlipal), allowing offline development and presentation without external registration.
- **Connector Implementation**: `backend/app/connectors/firms.py`.

---

## 3. Geospatial Exposure Datasets

### 3.1 Population Density Raster (WorldPop)
- **Standard Dataset**: WorldPop 100m / 1km unconstrained individual country population counts (GeoTIFF format, WGS84 CRS EPSG:4326).
- **Offline Fixture**: `backend/fixtures/population_sample.tif` provides a synthetically generated georeferenced GeoTIFF with Gaussian population centers centered on major urban corridors (New Delhi, Guwahati, Mumbai, Kolkata).
- **Processing**: The `rasterio` and `rasterio.mask` libraries calculate zonal pixel sums bounded by the disaster hazard polygon.
- **Implementation**: `backend/app/services/impact.py`.

---

### 3.2 OpenStreetMap Building Footprints (Overpass API)
- **Provider**: OpenStreetMap community via the Overpass API public endpoints.
- **Primary Endpoint**: `https://overpass-api.de/api/interpreter`
- **User-Agent**: Custom header identifying `EmergencyResponsePlatform/0.1` per Overpass API Fair Use guidelines.
- **Caching**: In-memory LRU cache stores bounding box counts to minimize redundant network traffic.
- **Fallback Estimator**: When Overpass API is overloaded (HTTP 429 / 504 / timeout), the service calculates estimated building density from zonal area and population count, preventing cascading failure in the ingestion pipeline.
- **Implementation**: `backend/app/services/impact.py`.
