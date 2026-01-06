# TIGER Data Ingestion Plan & Status

## Objective
Automate the downloading, processing, and storage of U.S. Census Bureau TIGER/Line Shapefiles (States, Counties, Block Groups) into PostGIS to support the SaveFW Map's drill-down functionality.

## Architecture
- **Source:** US Census Bureau FTP/HTTP (`https://www2.census.gov/geo/tiger/TIGER2020/`)
- **Ingestion Service:** `TigerIngestionService.cs` (C# .NET 10)
- **Database:** PostGIS (`tiger_states`, `tiger_counties`, `census_block_groups`)
- **Seeding:** `TigerSeeder.cs` (Runs on startup or via manual API trigger)

## Current Status (2026-01-06)

### ✅ Completed
1.  **Ingestion Logic:** `TigerIngestionService` uses `HttpClient` to download and `NetTopologySuite` to read/insert shapefiles.
2.  **Database Integration:** PostGIS methods (`ST_Transform`, `ST_AsGeoJSON`) are working. `tiger_states` was successfully ingested.
3.  **API Endpoints:** Created `/api/census/status` and `/api/census/seed/force` for control/visibility.
4.  **State Boundary Caching:** Implemented `api/census/states` to serve cached GeoJSON (replacing local JSON files).

### 🚧 In Progress / Critical Blockers
1.  **Census Bureau Blocking:**
    *   **Issue:** Requests to `https://www2.census.gov/.../tl_2020_us_county.zip` are being intercepted by a "Lapse in Funding" HTML notice page, even though the server returns `200 OK`.
    *   **Result:** The "downloaded" zip file is actually an 8KB HTML file, causing `InvalidDataException` during extraction.
    *   **Attempted Fixes:**
        *   Added `User-Agent` header (Result: Still blocked).
        *   Tried `wget` and `curl` (Result: Still blocked/redirected to HTML).
        *   Tried `ftp2.census.gov` (Result: Redirects to www2 HTML page).
    *   **Current Strategy:** Implement a **Cookie Bypass** mechanism. The HTML interceptor sets a cookie and uses a JS redirect. We are updating `TigerIngestionService` to:
        1.  Detect the HTML intercept (small size/content-type).
        2.  Capture the `Set-Cookie` header.
        3.  Wait 12 seconds (mimicking the JS timer).
        4.  Re-request the file with the valid Cookie.

        ### NOTE FROM USER:
        I do not believe there is county-level zip files available to download individiually. You must download the state zip, which is indexed by state code. For example:
            tl_2020_01_bg.zip
            tl_2020_02_bg.zip
            tl_2020_04_bg.zip
            tl_2020_05_bg.zip
            tl_2020_06_bg.zip
        The website these are reached at is here: https://www2.census.gov/geo/tiger/TIGER2020/BG/
        The website is VERY slow to load. I imagine each zip file is also slow to download. Take that into account.

2.  **Code Syntax Error:**
    *   **Issue:** A copy-paste error introduced duplicate method signatures in `TigerIngestionService.cs`, causing Build Error `CS1513: } expected`.
    *   **Action:** Need to remove the duplicate start of `ProcessTigerFile` (lines 61-66) to restore build stability.

### Next Immediate Actions
1.  **Fix Syntax:** Clean up `TigerIngestionService.cs`.
2.  **Verify Bypass:** Run the `ForceSeed` endpoint and verify the "Cookie Replay" logic successfully downloads the real 100MB+ zip file.
3.  **Frontend Update:** Once data is verified in DB, update `map.js` to consume the new API endpoints.
