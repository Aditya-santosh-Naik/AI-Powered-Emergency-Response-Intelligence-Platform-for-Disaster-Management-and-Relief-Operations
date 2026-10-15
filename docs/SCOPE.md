# Scope Gate

```
ACTIVE_WEEKS: 1-2
```

## IN_SCOPE

| ID | Requirement |
|----|-------------|
| R1 | Ingestion — Real-time disaster event data from GDACS, USGS, NDMA, and satellite imagery APIs |
| R2 | Geospatial impact assessment — Combine flood/earthquake extent with population density rasters and OSM building footprints |
| R3 | Resource inventory — Track food packets, water, medical kits, rescue vehicles, and personnel at depots |
| R4 | Zone classification — Grid cells with impact severity scores (0–100) |
| R5 | PostGIS database — disaster zones, resource depots, field operations, with Alembic migrations |
| P1 | Structure — Three top-level folders: `frontend/`, `backend/`, `ml/` (blank) |
| P2 | Connection — Frontend talks to backend, provably |
| P3 | Ingestion works — Data from sources flows into the database |
| P4 | Instructions — A stranger can set up and run it from the README |
| D1 | Donor entity — Track donors and link donations to inventory (user-directed addition) |

## OUT_OF_SCOPE

Everything in Weeks 3–8: demand prediction, ML, vulnerability weighting, scenario simulation, optimization, routing, priority overrides, full command dashboard, mission assignment, field team tracking, situation reports, cloud deployment, CI/CD, load testing, cross-browser validation, mobile polish, tooltips, auth/login/role systems.
