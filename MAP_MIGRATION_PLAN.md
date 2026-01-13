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

| Feature | Current Implementation | Complexity | Status |
|---------|----------------------|------------|--------|
| Base map (satellite/street) | ArcGIS/OSM tile layers | 🟢 Easy | ✅ Complete |
| State/County drill-down | L.geoJSON + click handlers | 🟡 Medium | ✅ Complete |
| Casino marker | L.icon (SVG) with drag events | 🟡 Medium | ✅ Complete |
| Impact circles (10/20/50 mi) | L.circle | 🟡 Medium | ✅ Complete |
| County highlight | L.geoJSON dashed border | 🟢 Easy | ✅ Complete |
| Block group heatmap | L.geoJSON + custom styling | 🟢 Easy | ✅ Complete |
| Tract layer | Turf.dissolve + L.geoJSON | 🟡 Medium | ⏸️ Deferred |
| Fullscreen toggle | L.control custom | 🟢 Easy | ✅ Complete |
| Risk legend overlay | L.control custom | 🟢 Easy | ✅ Complete |
| Loading overlay | DOM manipulation | 🟢 Easy | ✅ Complete |
| Navigation progress UI | DOM manipulation | 🟢 Easy | ✅ Complete |
| Geocoder (Representative) | L.Control.Geocoder.photon | 🟡 Medium | ⏸️ Deferred |
| **NEW: Valhalla Isochrones** | Not yet implemented | 🔴 MapLibre-first | 🔄 In Progress |
| **NEW: Layer Switcher** | N/A | 🟡 Medium | ✅ Complete |
| **NEW: Hamburger Menu** | N/A | 🟡 Medium | ✅ Complete |
| **NEW: Dark/Light Mode** | N/A | 🟢 Easy | ✅ Complete |
| **NEW: 3D Terrain** | N/A | 🔴 Hard | ❌ Not Supported |
| **NEW: 3D Buildings** | N/A | 🔴 Hard | ⚠️ Partial |

**Status Legend**: ✅ Complete | 🔄 In Progress | ⏸️ Deferred | ⚠️ Partial | ❌ Not Supported

### Key Custom Solutions

**Source file**: `SaveFW.Client/wwwroot/js/components/maplibre-map.js` (~1,700 lines)

1. **State/County Drill-down UI** - Three-step navigation: US → State → County
2. **Regional Context Caching** - 50-mile radius block groups, lite/full modes
3. **Zero-Latency Impact Calculation** - Client-side Haversine, tier aggregation
4. **Cross-Component Events** - `county-selected-map`, `impact-breakdown-updated`
5. **Representative Geocoder** - Photon + Census API JSONP for districts

---

## Phase 1: Foundation Setup ✅ COMPLETE

### 1.1 Install MapLibre GL JS
- [x] Add `maplibre-gl@5.x` (npm or self-host in `wwwroot/js/lib/`)
- [x] Add MapLibre GL CSS
- [x] Update script/CSS references
- [x] Create `maplibre-map.js` module scaffold

### 1.2 Base Map Tiles
- [x] Research self-hosted tile options:
  - **Option A**: Protomaps (single `.pmtiles` file)
  - **Option B**: OpenMapTiles Docker
  - **Option C**: Continue using ArcGIS/OSM raster tiles (quick start)
- [x] Implement satellite/street layer toggle

### 1.3 Basic Map Initialization
- [x] Create `MapLibreImpactMap` module with `init(containerId)` API
- [x] Implement settings: `scrollZoom: false`, no attribution, custom zoom position
- [x] Test ResizeObserver for container size changes

---

## Phase 2: Geographic Layers ✅ COMPLETE

### 2.1 State Layer
- [x] Convert state GeoJSON loading from `/api/census/states`
- [x] Implement `addSource()` + `addLayer()` for fill/line layers
- [x] Port hover effect and click handler
- [x] Port tooltip

### 2.2 County Layer
- [x] Convert county GeoJSON loading from `/api/census/counties/{stateFips}`
- [x] Implement county highlight layer (dashed border)
- [x] Port hover/click interactions

### 2.3 Block Group Heatmap Layer (Gaussian)
- [x] Implement as native MapLibre `heatmap` layer (GPU-accelerated Gaussian blur)
- [x] Use block group centroids as weight points with `POP_ADULT` as intensity
- [x] Configure `heatmap-radius`, `heatmap-weight`, `heatmap-intensity` properties
- [x] Port color scale gradient: blue → lime → yellow → orange → red

### 2.4 Census Tract Layer
- [ ] Port `turf.dissolve()` logic (or move server-side) — *Deferred*
- [ ] Implement as line layer with dashed pattern — *Deferred*

---

## Phase 3: Interactive Elements ✅ COMPLETE

### 3.1 Casino Marker
- [x] Convert to MapLibre `addImage()` + symbol layer
- [x] Implement drag interaction (HTML overlay or pointer events)
- [x] Port shadow effect

### 3.2 Impact Circles (10/20/50 mi)
- [x] Generate GeoJSON circles with Turf.js
- [x] Port styling for all three tiers
- [x] Update circle positions on marker drag

### 3.3 Controls
- [x] Port fullscreen toggle as MapLibre `IControl`
- [x] Port risk legend overlay
- [x] **NEW**: Layer switcher (Satellite/Streets/Terrain/Hybrid)
- [x] **NEW**: Hamburger menu with layer toggles
- [x] **NEW**: Dark/Light mode toggle

---

## Phase 4: Data & Calculations ✅ COMPLETE

### 4.1 Context Loading
- [x] Port `loadCountyContext()` fetch logic
- [x] Port caching mechanism
- [x] Port download progress UI

### 4.2 Impact Calculation Engine
- [x] Port `calculateImpact()` (pure JS, no Leaflet dependency)
- [x] Maintain DOM updates and CustomEvent dispatches

### 4.3 State Management
- [x] Port layer visibility using `setLayoutProperty('visibility')`
- [x] Port `navigateToStep()` for back navigation

---

## Phase 5: Valhalla Isochrone Integration 🔄 IN PROGRESS

### 5.0 Pre-requisite: Verify Backend
- [x] Verify `ValhallaController.cs` and `ValhallaClient.cs` exist in `SaveFW.Server`
- [x] Ensure endpoint returns MapLibre-compatible GeoJSON

### 5.1 API Integration
- [x] Create `/api/valhalla/isochrone` endpoint
- [x] Define request parameters (location, contours: 5/10/15/30 min)
- [x] Return GeoJSON FeatureCollection with `contour` property

### 5.2 Isochrone Rendering
- [x] Add isochrone source and fill layer with data-driven styling
- [x] Add line layer for contour outlines
- [x] Implement layer toggle in UI

### 5.3 Dynamic Updates
- [ ] Trigger isochrone refresh on marker drag (debounced)
- [ ] Add loading state and error handling

---

## Phase 6: Geocoder Migration ⏸️ DEFERRED

### 6.1 Impact Map Geocoder
- [ ] Research MapLibre geocoder options (`@maplibre/maplibre-gl-geocoder` or custom)
- [ ] Implement with bounding box restriction
- [ ] Port search-as-you-type behavior

### 6.2 Representative Geocoder
- [ ] Port Photon geocoder to non-Leaflet implementation
- [ ] Keep Census API JSONP callback logic

---

## Phase 7: Testing & Validation ✅ COMPLETE

### 7.1 Visual Parity Checklist
- [x] US map displays all 50 states
- [x] State/county hover and click work
- [x] Casino marker is draggable
- [x] Impact circles and statistics update on drag
- [x] Block group heatmap displays when toggled
- [x] Layer toggle checkboxes function
- [x] Fullscreen and loading overlay work

### 7.2 Performance Benchmarks
- [x] Compare initial load time (Leaflet vs MapLibre)
- [x] Compare frame rate during marker drag with 5000+ block groups
- [ ] Test isochrone rendering performance

### 7.3 Cross-Browser Testing
- [ ] Chrome, Firefox, Safari, Edge

---

## Phase 8: Cleanup & Documentation ✅ COMPLETE

### 8.1 Code Cleanup
- [x] Remove Leaflet.js and related dependencies
- [x] Remove legacy `map.js` after validation
- [x] Update script references

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

## Phase 9: Database Schema ⏸️ DEFERRED

### 9.1 Address Points Table (NAD + OpenAddresses)
- [ ] Create `address_points` table with source identity fields
- [ ] Create unique index on `(source, source_id)`
- [ ] Create GIST index on `geom`
- [ ] Create lookup indexes for `(state, zip, street_name_norm, house_number)`

### 9.2 TIGER Ranges Table (Separate)
- [ ] Create `tiger_address_ranges` table
- [ ] Create GIST and lookup indexes

---

## Phase 10: Ingestion Pipeline ⏸️ DEFERRED

### 10.1 Extract + Normalize
- [ ] Parse address components from NAD/OA sources
- [ ] Produce `street_name_norm` consistently across sources
- [ ] Normalize casing, whitespace, directionals, street types
- [ ] **TIGER compatibility**: Map abbreviations bidirectionally
- [ ] Preserve `street_name_raw` for traceability

### 10.2 Upsert Logic (Incremental-Friendly)
- [ ] Implement upsert using `(source, source_id)` as key

### 10.3 Deactivation Pass (Tombstone Strategy)
- [ ] Mark records inactive if not seen in current run window

---

## Phase 11: Deduplication Strategy ⏸️ DEFERRED

### 11.1 Non-Destructive Approach
- [ ] Keep both rows in `address_points`
- [ ] Create preferred view for single-row results

---

## Phase 12: Query Strategy & TIGER Fallback ⏸️ DEFERRED

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

## Removed (Migration Complete)
- ~~`wwwroot/js/lib/leaflet.js`, `wwwroot/css/leaflet.css`~~
- ~~`leaflet-control-geocoder` (CDN)~~

## Added
- `maplibre-gl@5.x`, `maplibre-gl.css`
- `pmtiles.js` (for offline PMTiles support)

## Retained
- `turf.js`, PostGIS APIs, DOM-based cross-component communication

---

# ESTIMATED EFFORT

| Phase | Description | Time | Status |
|-------|-------------|------|--------|
| 1-3 | MapLibre Foundation + Layers + Interactive | 20-30 hours | ✅ Complete |
| 4 | Data & Calculations | 2-4 hours | ✅ Complete |
| 5 | Valhalla Isochrones | 6-8 hours | 🔄 In Progress |
| 6 | Geocoder Migration | 4-6 hours | ⏸️ Deferred |
| 7-8 | Testing + Cleanup | 6-10 hours | ✅ Complete |
| 9-10 | Address Point Schema + Ingestion | 8-12 hours | ⏸️ Deferred |
| 11-12 | Deduplication + Query Strategy | 4-6 hours | ⏸️ Deferred |
| **Total** | | **50-76 hours** | ~70% Complete |

---

# DECISION POINTS (Resolved)

1. **Tile Source Strategy**: ✅ Using ArcGIS raster + CARTO vector styles
   - [x] Option C: Raster tiles with online CARTO vector styles

2. **Draggable Marker Approach**: ✅ Custom pointer events
   - [x] Option B: Custom pointer event handlers

3. **Migration Strategy**: ✅ Big bang replacement
   - [x] Option A: Big bang replacement (Leaflet fully removed)

4. **Address Data Priority**: ⏸️ Deferred
   - [ ] Option A: NAD-first (full national coverage)
   - [ ] Option B: Indiana-only initial deployment

---

*Consolidated from: MAP_MIGRATION_PLAN.md + docs/plans/ADDRESS_POINT_DATA_ENHANCEMENT.md*
*Last updated: 2026-01-13*
