# TIGER Data Ingestion Plan & Status

## Objective
Automate the downloading, processing, and storage of U.S. Census Bureau TIGER/Line Shapefiles (States, Counties, Block Groups) into PostGIS to support the SaveFW Map's drill-down functionality.

## Architecture
- **Source:** US Census Bureau HTTP (`https://www2.census.gov/geo/tiger/TIGER2025/`)
- **Ingestion Service:** `TigerIngestionService.cs` (C# .NET 10)
- **Database:** PostGIS (`tiger_states`, `tiger_counties`, `census_block_groups`)
- **Seeding:** `TigerSeeder.cs` (Runs on startup or via manual API trigger)
- **Simplified Geometry:** `geom_simplified` columns added for visualization

## Current Status (2026-01-07)

### ✅ Completed
1.  **Ingestion Logic:** `TigerIngestionService` uses `HttpClient` + `NetTopologySuite` to read/insert shapefiles.
2.  **TIGER 2025 Sources:** `TigerYear=2025` and base URL updated to `TIGER2025`.
3.  **Local County Zip Support:** If `/root/tl_2025_us_county.zip` exists, it is used directly.
4.  **API Endpoints:** `/api/census/status`, `/api/census/states`, `/api/census/counties/{stateFips}`, `/api/census/seed/force`.
5.  **State Boundary Cache:** `api/census/states` returns cached GeoJSON.
6.  **County Pop Aggregation:** `/api/census/counties/{stateFips}` now includes `pop_total` and `pop_adult`.
7.  **Simplified Geometry Columns:** `geom_simplified` added to `tiger_states`, `tiger_counties`, `census_block_groups`.
8.  **Simplification on Seed:** Batch simplification uses `ST_SimplifyPreserveTopology(ST_Transform(geom, 3857), tol)` with:
    - States: `100m`
    - Counties: `100m`
    - Block Groups: `10m`
9.  **Simplified Geometry in APIs:** Endpoints use `COALESCE(geom_simplified, geom)` for map payloads.
10. **County Load Optimization:** `loadCountyContext` now defaults to `lite=true` (no geometry), reducing payload size significantly. Full geometry is fetched only when visualization layers (blocks/heatmap) are enabled.

### 🚧 In Progress / Critical Blockers
1.  **Simplification Run Time:**
    *   Simplification runs in batches at startup only when `geom_simplified` is NULL.
    *   Large block group sets can still take time on first run.

### Next Immediate Actions
1.  **Finish Simplification:** Allow batch simplification to complete without restarting.
2.  **Trace County Load Hang:** Profile the county context payload and client processing path.
3.  **Confirm BG Sources:** Block groups are still downloaded per-state via `tl_2025_##_bg.zip`.
