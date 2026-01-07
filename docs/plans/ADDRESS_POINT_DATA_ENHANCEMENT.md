# Address Point Data Enhancement Plan (NAD + OpenAddresses + TIGER)

## Objective

Build a **reliable, updatable, deduplicated** address-point layer for geocoding and spatial analytics by combining:

- **Tier 1:** National Address Database (NAD) points (preferred where available)
- **Tier 2:** OpenAddresses (OA) points (fill coverage gaps)
- **Tier 3:** TIGER/Line address ranges (interpolation fallback only; **kept separate from points**)

The goal is not just “load data once,” but to support **repeatable ingestion**, **incremental refresh**, and **deterministic query behavior**.

---

## Design Principles

1. **Source precedence:** NAD > OA > TIGER
2. **Identity is mandatory:** every stored point must be traceable back to its upstream record
3. **Deduplication must be attribute-aware:** proximity alone is not sufficient
4. **Keep TIGER separate:** TIGER ranges are used for interpolation, not mixed into point truth data
5. **Query semantics must reflect real address lookups:** ZIP + street name alone is not unique

---

## Data Sources

### Tier 1: NAD (National Address Database)
- Used as the preferred address-point layer when coverage exists.
- Update cadence: monitor monthly (or whenever NAD publishes updates).

### Tier 2: OpenAddresses
- Used to fill gaps when NAD does not cover an area sufficiently.
- Useful for coverage breadth; quality varies by jurisdiction/source.

### Tier 3: TIGER/Line Address Ranges
- Used only when point geocoding fails.
- Stored as line/range features and interpolated at query time (or via a precomputed interpolation service).

---

## Storage Architecture (PostGIS)

### 1) Address Points Table (Unified, Source-Aware)

This table stores *only point-based sources* (NAD and OA). It includes stable identity fields to support incremental updates.

```sql
CREATE TABLE address_points (
    id                 BIGSERIAL PRIMARY KEY,

    -- Source identity (critical for deterministic upserts)
    source             TEXT NOT NULL CHECK (source IN ('NAD', 'OpenAddresses')),
    source_id          TEXT NOT NULL,   -- upstream unique identifier (or computed stable id if none exists)
    source_updated_at  TIMESTAMPTZ NULL, -- upstream last-modified if available
    ingested_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_active          BOOLEAN NOT NULL DEFAULT TRUE,

    -- Normalized address fields (store both raw + normalized)
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

    -- Geometry and metadata
    geom               GEOMETRY(Point, 4326) NOT NULL,

    -- Optional: raw upstream payload for troubleshooting/future enrichment
    raw                JSONB NULL,

    -- Optional: quality scoring/ranking
    source_rank        SMALLINT NOT NULL DEFAULT 99
);

CREATE UNIQUE INDEX ux_address_points_source_key
    ON address_points (source, source_id);

CREATE INDEX ix_address_points_geom
    ON address_points USING GIST (geom);

CREATE INDEX ix_address_points_state_zip
    ON address_points (state, zip);

CREATE INDEX ix_address_points_lookup_exact
    ON address_points (state, zip, street_name_norm, house_number);

-- Optional for fuzzy street matching later:
-- CREATE EXTENSION IF NOT EXISTS pg_trgm;
-- CREATE INDEX ix_address_points_street_trgm ON address_points USING gin (street_name_norm gin_trgm_ops);
```

**Notes**
- `source_id` should be the upstream ID when available. If a dataset lacks a durable ID, compute one deterministically (e.g., a hash of upstream row keys) during ingestion.
- `source_rank` encodes preference: NAD=1, OA=2 (defaults allow future sources).
- `is_active` + `last_seen_at` allow audit-friendly handling of upstream deletions.

---

### 2) TIGER Ranges Table (Separate)

```sql
CREATE TABLE tiger_address_ranges (
    id           BIGSERIAL PRIMARY KEY,
    state        TEXT NOT NULL,
    countyfp     TEXT NULL,

    lfromhn      TEXT NULL,
    ltohn        TEXT NULL,
    rfromhn      TEXT NULL,
    rtohn        TEXT NULL,

    fullname     TEXT NULL,
    name_norm    TEXT NULL,

    geom         GEOMETRY(LineString, 4326) NOT NULL
);

CREATE INDEX ix_tiger_ranges_geom
    ON tiger_address_ranges USING GIST (geom);

CREATE INDEX ix_tiger_ranges_lookup
    ON tiger_address_ranges (state, name_norm);
```

---

## Ingestion Pipeline

### Stage A: Extract + Normalize
- Parse address components and produce `street_name_norm` consistently across sources.
- Normalize casing, whitespace, directional abbreviations, and street types.
- Preserve `street_name_raw` for traceability.

### Stage B: Upsert (Incremental-Friendly)

Use `(source, source_id)` as the deterministic key and upsert:

```sql
INSERT INTO address_points (
    source, source_id, source_updated_at, last_seen_at,
    house_number, street_name_raw, street_name_norm,
    street_predir, street_type, street_postdir, unit,
    city, state, zip, geom, raw, source_rank
)
VALUES (...)
ON CONFLICT (source, source_id)
DO UPDATE SET
    source_updated_at = EXCLUDED.source_updated_at,
    last_seen_at      = now(),
    is_active         = TRUE,

    house_number      = EXCLUDED.house_number,
    street_name_raw   = EXCLUDED.street_name_raw,
    street_name_norm  = EXCLUDED.street_name_norm,
    street_predir     = EXCLUDED.street_predir,
    street_type       = EXCLUDED.street_type,
    street_postdir    = EXCLUDED.street_postdir,
    unit              = EXCLUDED.unit,
    city              = EXCLUDED.city,
    state             = EXCLUDED.state,
    zip               = EXCLUDED.zip,
    geom              = EXCLUDED.geom,
    raw               = EXCLUDED.raw,
    source_rank       = EXCLUDED.source_rank,
    ingested_at       = now();
```

### Stage C: Deactivation Pass (Tombstone Strategy)
After loading the latest snapshot:
- Mark records inactive if they have not been “seen” in the current run window.

Example (time-window based):

```sql
UPDATE address_points
SET is_active = FALSE
WHERE last_seen_at < now() - interval '7 days';
```

Choose a window that matches your ingestion schedule.

---

## Deduplication Strategy (Do Not Use Proximity Alone)

**Problem:** a “within 5 meters” filter can:
- drop legitimate distinct addresses in dense areas
- miss duplicates if sources are offset >5m

### Recommended Approach: Attribute Agreement + Preference (Non-Destructive)

Keep both rows in `address_points`, then expose a **preferred** single-row result set using a view.

```sql
CREATE VIEW address_points_preferred AS
SELECT DISTINCT ON (state, COALESCE(zip,''), street_name_norm, house_number, COALESCE(unit,'')) *
FROM address_points
WHERE is_active = TRUE
ORDER BY
  state, COALESCE(zip,''), street_name_norm, house_number, COALESCE(unit,''),
  source_rank ASC,                  -- NAD wins over OA
  source_updated_at DESC NULLS LAST, -- freshest wins within same source
  ingested_at DESC;
```

If you must hard-dedupe for storage reasons, do it only when:
- the normalized address key matches (number + street + zip/state)
- and distance is within a threshold

---

## Query Strategy (.NET / API)

### Exact Match Tier (Primary)
Do not query on `Zip + StreetName` alone; it is not unique and will produce wrong matches.

Use:
- `state`
- `zip` (if present)
- `street_name_norm`
- `house_number`
- optionally `unit` (if supplied)

Example SQL:

```sql
SELECT id, source, house_number, street_name_raw, city, state, zip, geom
FROM address_points_preferred
WHERE state = @state
  AND (@zip IS NULL OR zip = @zip)
  AND street_name_norm = @streetNameNorm
  AND house_number = @houseNumber
  AND (@unit IS NULL OR unit = @unit);
```

### Fallback Tiers (If Exact Match Fails)
1. **Nearby street number match** (same street, nearest point by distance)
2. **Nearest neighbor** within a radius (only if you have an approximate location)
3. **TIGER interpolation** if no points exist for the address

---

## TIGER Interpolation (Fallback Only)

If point geocoding fails, interpolate against TIGER ranges:
- find candidate street segments matching `state + name_norm`
- pick nearest segment
- interpolate along segment based on left/right ranges and parity rules

This logic can be done:
- at query time (acceptable for low volume)
- or via a self-hosted routing/geocoding engine (preferred for scale)

---

## Operational Considerations

### Performance
- Keep points and ranges separate tables.
- Use the lookup indexes listed above.
- Consider partitioning `address_points` by `state` for national-scale deployments.

### Auditing and Debuggability
- Store `raw` JSONB for upstream payload when practical.
- Keep `source_updated_at`, `ingested_at`, and `last_seen_at` so you can answer:
  - why did this record change?
  - when was it updated?
  - which source produced it?

### Data Quality Metrics (Recommended)
Track coverage and conflict rates:
- NAD coverage % by county/ZIP
- OA-only coverage % (gap fill)
- duplicate/conflict counts per run
- geocode hit rate by tier (exact match vs fallback vs TIGER)

---

## Summary

This plan provides:
- A **source-aware** unified points layer (NAD + OA) with deterministic identity and incremental updates
- A **non-destructive** dedupe strategy via a “preferred” view (NAD wins but OA preserved)
- A **separate TIGER ranges** layer used only for interpolation fallback
- Query semantics that align with real address uniqueness (house number + normalized street + ZIP/state)

If you implement only one improvement, make it this: **add source identity fields and upsert by (source, source_id)**. Everything else becomes easier once records are stable and traceable.
