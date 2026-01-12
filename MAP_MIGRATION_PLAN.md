# Map + Data Infrastructure Migration Plan

> **Goal**: Migrate the Impact Map from Leaflet.js to MapLibre GL JS, implement Valhalla isochrone visualization, and build a robust address-point geocoding layer using NAD, OpenAddresses, and TIGER data.

---

## Executive Summary

This is a **unified plan** covering two parallel workstreams:

1. **Frontend Map Migration** (Phases 1-8): Transition from Leaflet.js to MapLibre GL JS for GPU-accelerated rendering, native vector tiles, and efficient isochrone visualization.

2. **Backend Data Infrastructure** (Phases 9-12): Build a reliable, updatable, deduplicated address-point layer for geocoding and spatial analytics using NAD, OpenAddresses, and TIGER data.

---

# PART A: MAP MIGRATION (Leaflet → MapLibre GL JS)

## Current Implementation Inventory

### Core Features to Migrate

| Feature | Current Implementation | Complexity |
|---------|----------------------|------------|
| Base map (satellite/street) | ArcGIS/OSM tile layers | 🟢 Easy |
| State/County drill-down | L.geoJSON + click handlers | 🟡 Medium |
| Casino marker | L.icon (SVG) with drag events | 🟡 Medium |
| Impact circles (10/20/50 mi) | L.circle | 🟡 Medium |
| County highlight | L.geoJSON dashed border | 🟢 Easy |
| Block group heatmap | L.geoJSON + custom styling | 🟢 Easy |
| Tract layer | Turf.dissolve + L.geoJSON | 🟡 Medium |
| Fullscreen toggle | L.control custom | 🟢 Easy |
| Risk legend overlay | L.control custom | 🟢 Easy |
| Loading overlay | DOM manipulation | 🟢 Easy |
| Navigation progress UI | DOM manipulation | 🟢 Easy |
| Geocoder (Representative) | L.Control.Geocoder.photon | 🟡 Medium |
| **NEW: Valhalla Isochrones** | Not yet implemented | 🔴 MapLibre-first |

### Key Custom Solutions

**Source file**: `SaveFW.Client/wwwroot/js/components/map.js` (~1,800 lines)

1. **State/County Drill-down UI** - Three-step navigation: US → State → County
2. **Regional Context Caching** - 50-mile radius block groups, lite/full modes
3. **Zero-Latency Impact Calculation** - Client-side Haversine, tier aggregation
4. **Cross-Component Events** - `county-selected-map`, `impact-breakdown-updated`
5. **Representative Geocoder** - Photon + Census API JSONP for districts

---

## Phase 1: Foundation Setup

### 1.1 Install MapLibre GL JS
- [ ] Add `maplibre-gl@5.x` (npm or self-host in `wwwroot/js/lib/`)
- [ ] Add MapLibre GL CSS
- [ ] Update script/CSS references
- [ ] Create `maplibre-map.js` module scaffold

### 1.2 Base Map Tiles
- [ ] Research self-hosted tile options:
  - **Option A**: Protomaps (single `.pmtiles` file)
  - **Option B**: OpenMapTiles Docker
  - **Option C**: Continue using ArcGIS/OSM raster tiles (quick start)
- [ ] Implement satellite/street layer toggle

### 1.3 Basic Map Initialization
- [ ] Create `MapLibreImpactMap` module with `init(containerId)` API
- [ ] Implement settings: `scrollZoom: false`, no attribution, custom zoom position
- [ ] Test ResizeObserver for container size changes

---

## Phase 2: Geographic Layers

### 2.1 State Layer
- [ ] Convert state GeoJSON loading from `/api/census/states`
- [ ] Implement `addSource()` + `addLayer()` for fill/line layers
- [ ] Port hover effect and click handler
- [ ] Port tooltip

### 2.2 County Layer
- [ ] Convert county GeoJSON loading from `/api/census/counties/{stateFips}`
- [ ] Implement county highlight layer (dashed border)
- [ ] Port hover/click interactions

### 2.3 Block Group Heatmap Layer (Gaussian)
- [ ] Implement as native MapLibre `heatmap` layer (GPU-accelerated Gaussian blur)
- [ ] Use block group centroids as weight points with `POP_ADULT` as intensity
- [ ] Configure `heatmap-radius`, `heatmap-weight`, `heatmap-intensity` properties
- [ ] Port color scale gradient: blue → lime → yellow → orange → red

### 2.4 Census Tract Layer
- [ ] Port `turf.dissolve()` logic (or move server-side)
- [ ] Implement as line layer with dashed pattern

---

## Phase 3: Interactive Elements

### 3.1 Casino Marker
- [ ] Convert to MapLibre `addImage()` + symbol layer
- [ ] Implement drag interaction (HTML overlay or pointer events)
- [ ] Port shadow effect

### 3.2 Impact Circles (10/20/50 mi)
- [ ] Generate GeoJSON circles with Turf.js
- [ ] Port styling for all three tiers
- [ ] Update circle positions on marker drag

### 3.3 Controls
- [ ] Port fullscreen toggle as MapLibre `IControl`
- [ ] Port risk legend overlay

---

## Phase 4: Data & Calculations

### 4.1 Context Loading
- [ ] Port `loadCountyContext()` fetch logic
- [ ] Port caching mechanism
- [ ] Port download progress UI

### 4.2 Impact Calculation Engine
- [ ] Port `calculateImpact()` (pure JS, no Leaflet dependency)
- [ ] Maintain DOM updates and CustomEvent dispatches

### 4.3 State Management
- [ ] Port layer visibility using `setLayoutProperty('visibility')`
- [ ] Port `navigateToStep()` for back navigation

---

## Phase 5: Valhalla Isochrone Integration

### 5.0 Pre-requisite: Verify Backend
- [ ] Verify `ValhallaController.cs` and `ValhallaClient.cs` exist in `SaveFW.Server`
- [ ] Ensure endpoint returns MapLibre-compatible GeoJSON:
  ```json
  { "type": "FeatureCollection", "features": [{ "properties": { "contour": 15 }, "geometry": {...} }] }
  ```

### 5.1 API Integration
- [ ] Create `/api/valhalla/isochrone` endpoint (if not exists)
- [ ] Define request parameters (location, contours: 5/10/15/30 min)
- [ ] Return GeoJSON FeatureCollection with `contour` property

### 5.2 Isochrone Rendering
- [ ] Add isochrone source and fill layer with data-driven styling:
  ```javascript
  'fill-color': [
    'interpolate', ['linear'], ['get', 'contour'],
    5, '#22c55e',   // 5 min - green
    15, '#eab308',  // 15 min - yellow
    30, '#ef4444'   // 30 min - red
  ]
  ```
- [ ] Add line layer for contour outlines
- [ ] Implement layer toggle in UI

### 5.3 Dynamic Updates
- [ ] Trigger isochrone refresh on marker drag (debounced)
- [ ] Add loading state and error handling

---

## Phase 6: Geocoder Migration

### 6.1 Impact Map Geocoder
- [ ] Research MapLibre geocoder options (`@maplibre/maplibre-gl-geocoder` or custom)
- [ ] Implement with bounding box restriction
- [ ] Port search-as-you-type behavior

### 6.2 Representative Geocoder
- [ ] Port Photon geocoder to non-Leaflet implementation
- [ ] Keep Census API JSONP callback logic

---

## Phase 7: Testing & Validation

### 7.1 Visual Parity Checklist
- [ ] US map displays all 50 states
- [ ] State/county hover and click work
- [ ] Casino marker is draggable
- [ ] Impact circles and statistics update on drag
- [ ] Block group heatmap displays when toggled
- [ ] Layer toggle checkboxes function
- [ ] Fullscreen and loading overlay work

### 7.2 Performance Benchmarks
- [ ] Compare initial load time (Leaflet vs MapLibre)
- [ ] Compare frame rate during marker drag with 5000+ block groups
- [ ] Test isochrone rendering performance

### 7.3 Cross-Browser Testing
- [ ] Chrome, Firefox, Safari, Edge

---

## Phase 8: Cleanup & Documentation

### 8.1 Code Cleanup
- [ ] Remove Leaflet.js and related dependencies
- [ ] Remove legacy `map.js` after validation
- [ ] Update script references

### 8.2 Documentation Updates
- [ ] Update KI: `ui_component_implementations/artifacts/map/implementation.md`
- [ ] Document MapLibre-specific patterns
- [ ] Add isochrone documentation to Spatial Analysis KI

---

# PART B: ADDRESS POINT DATA INFRASTRUCTURE

## Design Principles

1. **Source precedence**: NAD > OpenAddresses > TIGER
2. **Identity is mandatory**: every point must be traceable to upstream record
3. **Deduplication must be attribute-aware**: proximity alone is insufficient
4. **Keep TIGER separate**: ranges used for interpolation only, not mixed into points
5. **Query semantics must reflect real address lookups**: ZIP + street alone is not unique

---

## Data Sources

| Tier | Source | Usage | Update Cadence |
|------|--------|-------|----------------|
| 1 | NAD (National Address Database) | Preferred address points | Monthly |
| 2 | OpenAddresses | Fill coverage gaps | As available |
| 3 | TIGER/Line Address Ranges | Interpolation fallback only | Annual |

---

## Phase 9: Database Schema

### 9.1 Address Points Table (NAD + OpenAddresses)
- [ ] Create `address_points` table with source identity fields:
  ```sql
  CREATE TABLE address_points (
      id                 BIGSERIAL PRIMARY KEY,
      source             TEXT NOT NULL CHECK (source IN ('NAD', 'OpenAddresses')),
      source_id          TEXT NOT NULL,
      source_updated_at  TIMESTAMPTZ NULL,
      ingested_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
      last_seen_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
      is_active          BOOLEAN NOT NULL DEFAULT TRUE,
      house_number       TEXT NOT NULL,
      street_name_raw    TEXT NOT NULL,
      street_name_norm   TEXT NOT NULL,
      street_predir      TEXT NULL,
      street_type        TEXT NULL,
      street_postdir     TEXT NULL,
      unit               TEXT NULL,
      city               TEXT NULL,
      state              TEXT NOT NULL,
      zip                TEXT NULL,
      geom               GEOMETRY(Point, 4326) NOT NULL,
      raw                JSONB NULL,
      source_rank        SMALLINT NOT NULL DEFAULT 99,
      usps_dpv_key       TEXT NULL  -- Optional: for future USPS validation integration
  );
  ```
- [ ] Create unique index on `(source, source_id)`
- [ ] Create GIST index on `geom`
- [ ] Create lookup indexes for `(state, zip, street_name_norm, house_number)`

### 9.2 TIGER Ranges Table (Separate)
- [ ] Create `tiger_address_ranges` table:
  ```sql
  CREATE TABLE tiger_address_ranges (
      id           BIGSERIAL PRIMARY KEY,
      state        TEXT NOT NULL,
      countyfp     TEXT NULL,
      lfromhn      TEXT NULL, ltohn TEXT NULL,
      rfromhn      TEXT NULL, rtohn TEXT NULL,
      fullname     TEXT NULL,
      name_norm    TEXT NULL,
      geom         GEOMETRY(LineString, 4326) NOT NULL
  );
  ```
- [ ] Create GIST and lookup indexes

---

## Phase 10: Ingestion Pipeline

### 10.1 Extract + Normalize
- [ ] Parse address components from NAD/OA sources
- [ ] Produce `street_name_norm` consistently across sources
- [ ] Normalize casing, whitespace, directionals, street types
- [ ] **TIGER compatibility**: Map abbreviations bidirectionally (ST↔STREET, AVE↔AVENUE, etc.)
- [ ] Preserve `street_name_raw` for traceability

### 10.2 Upsert Logic (Incremental-Friendly)
- [ ] Implement upsert using `(source, source_id)` as key:
  ```sql
  INSERT INTO address_points (...) VALUES (...)
  ON CONFLICT (source, source_id)
  DO UPDATE SET
      source_updated_at = EXCLUDED.source_updated_at,
      last_seen_at = now(),
      is_active = TRUE,
      ...
  ```

### 10.3 Deactivation Pass (Tombstone Strategy)
- [ ] Mark records inactive if not seen in current run window:
  ```sql
  UPDATE address_points SET is_active = FALSE
  WHERE last_seen_at < now() - interval '7 days';
  ```

---

## Phase 11: Deduplication Strategy

### 11.1 Non-Destructive Approach
- [ ] Keep both rows in `address_points`
- [ ] Create preferred view for single-row results:
  ```sql
  CREATE VIEW address_points_preferred AS
  SELECT DISTINCT ON (state, COALESCE(zip,''), street_name_norm, house_number, COALESCE(unit,'')) *
  FROM address_points
  WHERE is_active = TRUE
  ORDER BY
    state, COALESCE(zip,''), street_name_norm, house_number, COALESCE(unit,''),
    source_rank ASC,                    -- NAD wins over OA
    source_updated_at DESC NULLS LAST,  -- freshest wins within same source
    ingested_at DESC;
  ```

---

## Phase 12: Query Strategy & TIGER Fallback

### 12.1 Exact Match Query (Primary)
- [ ] Query must use: `state` + `zip` + `street_name_norm` + `house_number` + optionally `unit`
- [ ] Do NOT query on `Zip + StreetName` alone (not unique)

### 12.2 Fallback Tiers
- [ ] Nearby street number match (same street, nearest point)
- [ ] Nearest neighbor within radius (if approximate location known)
- [ ] TIGER interpolation if no points exist

### 12.3 TIGER Interpolation
- [ ] Find candidate street segments matching `state + name_norm`
- [ ] Pick nearest segment
- [ ] Interpolate along segment based on left/right ranges and parity

---

# DEPENDENCIES

## Current (to remove after migration)
- `wwwroot/js/lib/leaflet.js`, `wwwroot/css/leaflet.css`
- `leaflet-control-geocoder` (CDN)

## New (to add)
- `maplibre-gl@5.x`, `maplibre-gl.css`
- (Optional) `@maplibre/maplibre-gl-geocoder`

## Retained
- `turf.js`, PostGIS APIs, DOM-based cross-component communication

---

# ESTIMATED EFFORT

| Phase | Description | Time |
|-------|-------------|------|
| 1-3 | MapLibre Foundation + Layers + Interactive | 20-30 hours |
| 4 | Data & Calculations | 2-4 hours |
| 5 | Valhalla Isochrones | 6-8 hours |
| 6 | Geocoder Migration | 4-6 hours |
| 7-8 | Testing + Cleanup | 6-10 hours |
| 9-10 | Address Point Schema + Ingestion | 8-12 hours |
| 11-12 | Deduplication + Query Strategy | 4-6 hours |
| **Total** | | **50-76 hours** |

---

# DECISION POINTS (Requires User Input)

1. **Tile Source Strategy**: *(Recommended: Protomaps)*
   - [x] Option A: Protomaps (self-hosted `.pmtiles`) — **RECOMMENDED** for existing Docker setup
   - [ ] Option B: OpenMapTiles Docker
   - [ ] Option C: Stay with raster tiles initially

2. **Draggable Marker Approach**:
   - [ ] Option A: HTML overlay with CSS transforms
   - [ ] Option B: Custom pointer event handlers

3. **Migration Strategy**:
   - [ ] Option A: Big bang replacement
   - [ ] Option B: Parallel implementation with feature flag

4. **Address Data Priority**:
   - [ ] Option A: NAD-first (full national coverage)
   - [ ] Option B: Indiana-only initial deployment

---

*Consolidated from: MAP_MIGRATION_PLAN.md + docs/plans/ADDRESS_POINT_DATA_ENHANCEMENT.md*
*Last updated: 2026-01-12*
