# Gemini CLI Patch Plan: Valhalla + PostGIS (repo-specific workflow)

This instruction file is meant to be handed to **Gemini CLI** while it has a local clone of:

- `https://github.com/savefw/casino-economic-impact-calculator`

## What I could and could not verify here

GitHub’s web UI for this repo is intermittently returning an “error while loading” shell for individual file bodies, so I could reliably confirm **repo structure** and the **high-level architecture from README**, but not the full `docker-compose.yml` contents from the browser view. The plan below is therefore written so Gemini **must** open and adapt to the real file bodies in your working tree.

From the README, the repo has (at minimum): `SaveFW.Client`, `SaveFW.Server`, `SaveFW.Shared`, `docs`, a root `Dockerfile`, and a root `docker-compose.yml`. The stack is .NET 10 + Blazor WASM + PostgreSQL 18 + Docker + Leaflet. The server project has a `Data` folder for DbContext + seeding.  
Source: repo README + file listing. citeturn15view2turn15view3

---

# 0) Goals and non-goals

## Goals

- [x] 1. Add a **self-hosted Valhalla** container to your existing `docker-compose.yml` so you can compute **isochrones locally** (no per-call API cost).
- [x] 2. Use **PostGIS (already present in your compose)** to make statewide precomputation scalable:
   - cache isochrone polygons
   - spatial joins against block groups/tracts (population, income)
   - store per-grid-point scores (overnight job)
- [x] 3. Integrate Valhalla into the .NET solution:
   - a typed HTTP client (`ValhallaClient`)
   - an internal API endpoint (optional) for admin/debug
   - a background worker (or separate service) to generate/cache scores

## Non-goals (for this patch)

- Real-time traffic modeling (Valhalla’s default “free-flow” speeds are fine for comparative siting).
- Adding QGIS or desktop GIS workflows.
- Producing statewide results in this patch (we build the pipeline and an example “Allen County run”).

---

# 1) Valhalla service: Docker Compose integration

## 1.1 Create an `infra/valhalla/` host directory layout

- [x] In repo root (the directory containing `docker-compose.yml`), add:

```
infra/
  valhalla/
    custom_files/              # persistent graph tiles/config/admins/elevation live here
    osm/                       # optional: local *.osm.pbf files if you want to pre-download
    scripts/
      download-osm.sh          # downloads required PBFs
      README.md                # short notes for maintainers
```

- [x] Add `.gitignore` entries:

- `infra/valhalla/custom_files/**`
- `infra/valhalla/osm/**`
- `*.osm.pbf`
- `valhalla_tiles.tar`
- `.file_hashes.txt` (if it appears under custom_files)

Rationale: Valhalla’s docker image persists tiles/config/admin DB under the mapped `/custom_files` directory and will rebuild as needed when the underlying PBF changes. citeturn13search0

## 1.2 Add `download-osm.sh`

- [x] Create `infra/valhalla/scripts/download-osm.sh`:

- Use Geofabrik PBFs (Indiana + neighbors so isochrones don’t “hit a wall” at state borders).
- Minimum set for Indiana analysis:
  - `indiana-latest.osm.pbf`
  - `ohio-latest.osm.pbf`
  - `michigan-latest.osm.pbf`
  - `illinois-latest.osm.pbf`
  - `kentucky-latest.osm.pbf`

Script behavior:
- idempotent (skip if file exists)
- downloads to `infra/valhalla/osm/`

## 1.3 Compose: add `valhalla` service

Gemini instructions:

- [x] 1. Open the existing `docker-compose.yml`.
- [x] 2. Note that your user is using `network_mode: "host"`. This simplifies networking but changes how we address services.

- [x] 3. Add a new service block (merge into your existing compose conventions):

**Recommended image**
- Use the GIS•OPS Valhalla docker image (archived repo but still documents env var contract; upstream notes exist). citeturn13search0

**Service skeleton (Gemini must adapt names/ports)**
```yaml
  valhalla:
    image: ghcr.io/nilsnolde/docker-valhalla/valhalla:latest
    container_name: savefw_valhalla
    # MATCH EXISTING NETWORK MODE
    network_mode: "host"
    environment:
      - tile_urls=https://download.geofabrik.de/north-america/us/indiana-latest.osm.pbf https://download.geofabrik.de/north-america/us/ohio-latest.osm.pbf https://download.geofabrik.de/north-america/us/michigan-latest.osm.pbf https://download.geofabrik.de/north-america/us/illinois-latest.osm.pbf https://download.geofabrik.de/north-america/us/kentucky-latest.osm.pbf
      - build_admins=True
      - build_time_zones=True
      - build_elevation=False
      - build_tar=True
      - force_rebuild=False
      - server_threads=4
    volumes:
      - ./infra/valhalla/custom_files:/custom_files
      # OPTIONAL: if you want to mount local PBFs instead of tile_urls downloads:
      - ./infra/valhalla/osm:/osm:ro
    restart: unless-stopped
```

Notes:
- `tile_urls`, `build_admins`, `build_time_zones`, `build_elevation`, `build_tar`, `force_rebuild` are documented env vars for this docker image. citeturn13search0
- Your earlier plan used `build_admins=True` specifically for admin/border logic; keep it. citeturn13search0
- The first start will “cook” tiles and can be RAM-heavy. That is expected.
- **Port Mapping**: With `network_mode: "host"`, the container's internal port `8002` is automatically exposed on the host's port `8002`. No `ports:` mapping is needed.

- [ ] 4. Ensure no conflicting services are running on port 8002.

## 1.4 Smoke test Valhalla locally

- [ ] After `docker compose up -d`:

- Check container logs until graph build finishes.
- Validate isochrone endpoint returns GeoJSON.
- URL to test: `http://localhost:8002/isochrone` (or your server IP)

Valhalla isochrone API reference (request shape, `polygons`, `denoise`, `contours`): citeturn12search0

---

# 2) PostGIS usage: schema for caching + scoring

Valhalla does **not** require PostGIS. The value is making your “grid scoring” pipeline fast:
- store/cache polygons
- do spatial joins in SQL
- build indexes for intersects/contains

## 2.1 Create baseline tables (migrations)

Gemini instructions:

- [x] 1. In `SaveFW.Server` find your DbContext (README says `SaveFW.Server/Data` contains DbContext and seeding). citeturn15view2
- [x] 2. Ensure EF Core is already used (README says EF Core). citeturn15view2
- [x] 3. Add/confirm spatial mapping:
   - `Npgsql.EntityFrameworkCore.PostgreSQL.NetTopologySuite`

- [x] 4. Add these tables (names can be adjusted to your conventions):

### `counties`
- `id` (int / uuid)
- `state_fips` (text) optional
- `county_fips` (text) optional
- `name` (text)
- `geom` geometry(MultiPolygon, 4326)

Indexes:
- `GIST (geom)`

### `block_groups` (or tracts—use what you already have or can source)
- `geoid` (text PK)
- `county_fips` (text)
- `population` (int)
- `median_income` (int) optional
- `geom` geometry(MultiPolygon, 4326)

Indexes:
- `GIST (geom)`
- btree on `county_fips`

### `isochrone_cache`
- `id` (bigint)
- `lat` (double)
- `lon` (double)
- `minutes` (int)
- `geom` geometry(MultiPolygon, 4326)
- `created_at` (timestamptz)
- `source_hash` (text) optional (Valhalla tile hash / PBF hash / dataset revision)
- `UNIQUE(lat_round, lon_round, minutes, source_hash)` (see below)

Recommended:
- store rounded keys: `lat_round`, `lon_round` (e.g., round to 4–5 decimals) to prevent cache fragmentation.

Indexes:
- `GIST (geom)`
- unique constraint above

### `site_scores`
- `id`
- `county_id`
- `lat` / `lon`
- `minutes` (int)
- `pop_est` (double)
- `income_est` (double) optional
- `score` (double)
- `computed_at` (timestamptz)
- `UNIQUE(county_id, lat_round, lon_round, minutes, source_hash)`

## 2.2 Grid point generation inside PostGIS

If you’re doing statewide scoring, do not generate grids in Blazor. Generate candidate cells in SQL (fast) then sample centroids.

PostGIS provides `ST_SquareGrid(size, bounds)` and `ST_HexagonGrid(size, bounds)` to build tilings over a bounds geometry. citeturn11search0turn11search2

Pattern (square grid):

```sql
WITH county AS (
  SELECT id, ST_Transform(geom, 26916) AS g  -- UTM 16N for Indiana (meters)
  FROM counties
  WHERE id = @county_id
),
grid AS (
  SELECT (ST_SquareGrid(@cell_size_meters, (SELECT g FROM county))).geom AS cell
)
SELECT
  ST_Y(ST_Transform(ST_Centroid(cell), 4326)) AS lat,
  ST_X(ST_Transform(ST_Centroid(cell), 4326)) AS lon
FROM grid
WHERE ST_Intersects(cell, (SELECT g FROM county));
```

If you prefer hex grids, use `ST_HexagonGrid` similarly. citeturn11search2

---

# 3) .NET integration: calling Valhalla and caching results

## 3.1 Add a typed Valhalla client in `SaveFW.Server`

Gemini instructions:

- [x] 1. In `SaveFW.Server`, add `Services/Valhalla/ValhallaClient.cs`.
- [x] 2. Configure as `HttpClient` via DI in `Program.cs`.

### Configuration

- [x] Add to `SaveFW.Server/appsettings.json` (or your existing config file):

```json
{
  "Valhalla": {
    "BaseUrl": "http://localhost:8002"
  }
}
```

(Since `network_mode: "host"` is used, `localhost` on the container refers to the host machine interface where port 8002 is listening).

### Isochrone request

Use Valhalla’s isochrone service contract:
- `locations` array
- `costing` (use `"auto"` for drive-time)
- `contours` with `time` in minutes
- `polygons: true`
- `denoise` (0–1) as needed
citeturn12search0

- [x] Implement:

- method `Task<GeoJsonFeatureCollection> GetIsochroneAsync(double lat, double lon, int minutes, CancellationToken ct)`
- POST to `/isochrone` (use JSON body form, not querystring, unless you already standardize on querystring)
- include `polygons=true`

- [x] Also implement basic resiliency:
- timeouts (isochrones can be expensive during tile build)
- retries only on transient errors (not on 4xx)

## 3.2 Optional: a minimal internal endpoint for testing

- [x] Add `SaveFW.Server/Controllers/ValhallaController.cs`:

- `GET /api/valhalla/isochrone?lat=..&lon=..&minutes=..`
- returns GeoJSON

This endpoint is not for end-user “grid compute”. It’s for:
- debugging
- verifying the container is reachable from the app network
- inspecting polygon quality

---

# 4) Background computation: overnight statewide scoring

Your key architectural point is correct: **visitors should never run statewide grids.** This is a batch job.

Implement as either:

A) `BackgroundService` inside `SaveFW.Server` (simpler deployment)  
B) Separate `SaveFW.Worker` console project + separate container (cleaner isolation)

Recommendation: **B** once this gets heavy.

## 4.1 Worker responsibilities

- [x] For each county:

1. Generate candidate points (SQL grid → centroids).
2. For each point:
   - check `isochrone_cache` for `(lat_round, lon_round, minutes, source_hash)`
   - if miss: call Valhalla isochrone, store geometry
3. Compute overlays in SQL:
   - population inside polygon (area-weighted estimate when pop is per block group)
4. Compute score:
   - revenue proxy: population * disposable income proxy (if available)
   - social-cost proxy: proximity-weighted pop (optional extension)
   - store `site_scores`

## 4.2 Area-weighted population query

If you only have population per polygon (block group), estimate population inside the isochrone by overlap fraction:

```sql
SELECT
  SUM(
    bg.population
    * (ST_Area(ST_Intersection(bg.geom, i.geom)::geography) / NULLIF(ST_Area(bg.geom::geography), 0))
  ) AS pop_est
FROM block_groups bg
JOIN isochrone_cache i
  ON ST_Intersects(bg.geom, i.geom)
WHERE i.id = @isochrone_id;
```

Key functions:
- `ST_Intersects` for index-friendly prefilter
- `ST_Intersection` to compute overlap geometry
- `ST_Area(…::geography)` to measure in meters² on geodesic surface

(These are standard PostGIS patterns; if you want to hard-source each function definition, Gemini can reference PostGIS docs.)

## 4.3 Scheduling

If you want “annual updates”:
- [ ] run worker manually, or via host cron calling `docker compose run --rm savefw_worker ...`
- [x] or add a simple `Quartz.NET` schedule inside worker (still best to keep it explicit)

- [x] Also add a `source_hash` concept:
- When you update your census data / GeoJSON / tiles, bump a `DATASET_REVISION` setting so cached isochrones + scores can be recomputed cleanly.

---

# 5) Blazor integration: reading precomputed results

Gemini instructions:

- [x] 1. In the map page/component (README says Leaflet via JS interop in `SaveFW.Client`). citeturn15view2
- [x] 2. Add a new API call:
   - `GET /api/sitescores?countyId=..&minutes=15`
- [x] 3. Render results as:
   - heatmap layer, or
   - clustered markers, or
   - vector grid bins

Don’t push thousands of markers to the browser. Prefer:
- server-side aggregation by tile / zoom level
- return simplified geometry or aggregated bins

---

# 6) Answer to “Do I need PostGIS for Valhalla?”

No. Valhalla runs fine without it.

But for your use case (statewide grids + polygon overlays), PostGIS is the difference between:
- “this is a fun idea that never finishes”
and
- “overnight runs complete reliably and visitors only read cached outputs.”

Valhalla gives you the polygons; PostGIS makes the scoring pipeline scalable.

---

# 7) Gemini CLI execution checklist (do this in order)

- [x] 1. **Open repo** locally and locate the directory containing `docker-compose.yml` (README path may be slightly out of date; rely on filesystem truth). citeturn15view3
- [x] 2. Create `infra/valhalla/` directories + `.gitignore` updates.
- [x] 3. Patch `docker-compose.yml`:
   - add `valhalla` service as described
   - keep existing PostGIS service (already present per Tucker)
- [x] 4. Add Server config:
   - `Valhalla:BaseUrl`
- [x] 5. Add `ValhallaClient` + DI wiring
- [x] 6. Add optional controller endpoint for isochrone test
- [x] 7. Add EF Core spatial support (NetTopologySuite) and migrations for:
   - `counties`, `block_groups`, `isochrone_cache`, `site_scores`
- [x] 8. Add worker (in-process or separate) that:
   - generates grid points (PostGIS `ST_SquareGrid`/`ST_HexagonGrid`) citeturn11search0turn11search2
   - calls Valhalla isochrone API citeturn12search0
   - stores/cache polygons + computes overlays
- [x] 9. Add API endpoint to query precomputed scores for the map
- [ ] 10. Run:
    - `docker compose up --build -d`
    - seed DB
    - run worker for Allen County as initial validation