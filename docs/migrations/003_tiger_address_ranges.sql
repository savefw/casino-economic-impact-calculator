-- =====================================================================
-- PHASE 9: TIGER Address Ranges Schema
-- =====================================================================

CREATE TABLE IF NOT EXISTS tiger_address_ranges (
    tlid text,              -- Target Line ID (link to edges)
    side text,              -- L or R (which side of the street)
    from_hn text,           -- Start House Number (can be mixed types)
    to_hn text,             -- End House Number
    zip text,               -- ZIP Code
    street_name text,       -- Full Street Name (normalized)
    geom geometry(LineString, 4326),
    CONSTRAINT pk_tiger_address_ranges PRIMARY KEY (tlid, side, from_hn, to_hn, zip)
);

-- Spatial Index
CREATE INDEX IF NOT EXISTS idx_tiger_addr_geom ON tiger_address_ranges USING GIST (geom);

-- Lookup Indexes
CREATE INDEX IF NOT EXISTS idx_tiger_addr_zip ON tiger_address_ranges (zip);
CREATE INDEX IF NOT EXISTS idx_tiger_addr_street ON tiger_address_ranges (street_name);
CREATE INDEX IF NOT EXISTS idx_tiger_addr_zip_street ON tiger_address_ranges (zip, street_name);
