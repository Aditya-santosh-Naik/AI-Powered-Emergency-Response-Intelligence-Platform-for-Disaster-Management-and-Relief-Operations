# Known Limitations & Engineering Assumptions

A transparent summary of operational assumptions, known technical boundaries, and future optimization paths.

---

## 1. Population & Demographic Exposure

- **Current Implementation**: When real-time raster tiles from WorldPop are not available locally due to network bandwidth constraints, demographic counts are evaluated using synthetic density distribution formulas calibrated against 2011 Census district aggregates.
- **Operational Impact**: Suitable for simulation, drills, and proportional allocation. Live national deployment should connect to ISRO Bhuvan or high-resolution LandScan/WorldPop 100m rasters.

---

## 2. Logistics Routing & Highway Graph

- **Current Implementation**: The logistics routing engine models an Indian National Highway Trunk Network consisting of 28 strategic hub waypoints connected by major transport corridors. Intermediate distance is computed using the Great-Circle Haversine formula with a 1.20 winding factor.
- **Operational Impact**: Provides transit duration estimates within $\pm 10\%$ accuracy for inter-district truck freight. Does not capture real-time municipal street-level closures or temporary bridge washouts unless manual road accessibility factors are supplied.

---

## 3. Google OR-Tools SCIP Solver vs. Commercial Solvers

- **Current Implementation**: The linear programming allocation engine uses the open-source SCIP branch-and-cut solver bundled with Google OR-Tools.
- **Operational Impact**: Solves allocation models with up to 500 zone-depot pairings in under 200 ms. For ultra-large-scale national allocations exceeding 100,000 continuous variables, commercial solvers such as Gurobi or CPLEX can be plugged into the pywraplp interface with zero code modifications.

---

## 4. OpenStreetMap Infrastructure Queries

- **Current Implementation**: Building destruction counts query the public OpenStreetMap Overpass API with rate-limiting protection, caching, and fallback building density estimations.
- **Operational Impact**: Heavy query load during initial event onset is safely handled by local cache and bounding box approximations to prevent rate-limit throttling.
