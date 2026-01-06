# TigerIngestionService Technical Plan

## Objective
Create a robust C# service (`TigerIngestionService`) to automate the retrieval, processing, and storage of U.S. Census Bureau TIGER/Line Shapefiles (geospatial boundaries) directly into the PostGIS database. This eliminates manual Mapshaper workflows and reliance on static JSON files.

## Data Source
*   **Base URL:** `https://www2.census.gov/geo/tiger/TIGER{YEAR}/`
    *   **Counties:** `COUNTY/tl_{YEAR}_us_county.zip` (National file)
    *   **States:** `STATE/tl_{YEAR}_us_state.zip` (National file)
    *   **Block Groups:** `BG/tl_{YEAR}_{STATE_FIPS}_bg.zip` (State-level files)

## Architecture

### 1. `TigerIngestionService.cs` (Server-Side)
This service will function as a background task or on-demand executable.

**Core Responsibilities:**
1.  **Download Manager:**
    *   Connect to Census HTTP(S) directory.
    *   Smart caching: Check if `.zip` already exists locally in a temp dir before re-downloading.
    *   Extract `.zip` contents (Shapefiles: `.shp`, `.shx`, `.dbf`, `.prj`) to a temporary workspace.

2.  **Shapefile Reader (NetTopologySuite):**
    *   Use `NetTopologySuite.IO.ShapeFile` (requires `NetTopologySuite.IO.Esri.Shapefile` NuGet package) to read the `.shp` files directly in memory or stream them.
    *   Read geometry (Polygon/MultiPolygon) and attributes (GEOID, NAME, ALAND, etc.).

3.  **Database Seeder (EF Core / Npgsql):**
    *   **Direct SQL/COPY:** For maximum speed with massive files (like Block Groups), efficient `COPY` commands or batch inserts are preferred over individual EF Core entity tracking.
    *   **Geometry Transformation:** Ensure coordinate system is SRID 4326 (WGS 84). TIGER files are usually NAD83 (SRID 4269). We must transform them.
        *   *Option A:* Transform in C# using NTS `ProjNet`.
        *   *Option B (Preferred):* Insert raw as 4269, then execute `UPDATE table SET geom = ST_Transform(geom, 4326)` inside PostGIS.

### 2. Database Schema (PostGIS)
We will likely need new tables or straightforward mapping to existing ones.

*   `tiger_states`: Simplified state boundaries (Level 1 navigation).
*   `tiger_counties`: Simplified county boundaries (Level 2 navigation).
*   `census_block_groups` (Existing): We are already using this. We will refine it to be the "Level 3" detailed layer.

### 3. Usage Workflow (Future State)
1.  **Administrator Endpoint:** `POST /api/admin/ingest/tiger/states` -> Triggers national state download.
2.  **Administrator Endpoint:** `POST /api/admin/ingest/tiger/counties` -> Triggers national county download.
3.  **Administrator Endpoint:** `POST /api/admin/ingest/tiger/bg/{stateFips}` -> Downloads specific state's block groups.

## Implementation Steps

1.  **Dependencies:** Install `NetTopologySuite.IO.Esri.Shapefile` and `System.IO.Compression`.
2.  **Scaffold Service:** Create `TigerIngestionService` class.
3.  **Implement Download Logic:** `HttpClient` download + `ZipFile.ExtractToDirectory`.
4.  **Implement DB Logic:** Write the raw Shapefile features into PostGIS.
5.  **Post-Processing:** Run SQL `ST_SimplifyPreserveTopology` to create "lightweight" versions for display, while keeping "heavynet" for analysis if needed.

## Why PostGIS over Mapshaper?
*   **Scale:** Mapshaper runs in RAM. Loading the entire US datasets might crash it. PostGIS handles big data on disk.
*   **Automation:** Zero manual "drag-and-drop" steps. It's fully scriptable code.
