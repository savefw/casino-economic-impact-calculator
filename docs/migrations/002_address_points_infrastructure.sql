-- =====================================================================
-- MAP MIGRATION PLAN: Phase 9-12 Database Migration
-- Address Points Infrastructure (NAD, OpenAddresses, TIGER)
-- =====================================================================
-- Run this migration AFTER EF Core has created the base tables
-- via `dotnet ef database update` or startup migration.
-- =====================================================================

-- =====================================================================
-- PHASE 9: Additional Table Constraints (beyond EF Core defaults)
-- =====================================================================

-- Check constraint for source field
ALTER TABLE address_points
ADD CONSTRAINT chk_address_points_source 
CHECK (source IN ('NAD', 'OpenAddresses'));

-- =====================================================================
-- PHASE 11: Deduplication Strategy - Preferred View
-- =====================================================================
-- Non-destructive deduplication: both rows are kept in address_points,
-- but this view returns only the "best" row per unique address.
-- Priority: NAD > OpenAddresses, then freshest update wins.
-- =====================================================================

CREATE OR REPLACE VIEW address_points_preferred AS
SELECT DISTINCT ON (state, COALESCE(zip, ''), street_name_norm, house_number, COALESCE(unit, '')) *
FROM address_points
WHERE is_active = TRUE
ORDER BY
    state,
    COALESCE(zip, ''),
    street_name_norm,
    house_number,
    COALESCE(unit, ''),
    source_rank ASC,                     -- NAD (rank 1) wins over OpenAddresses (rank 2)
    source_updated_at DESC NULLS LAST,   -- Freshest wins within same source
    ingested_at DESC;

COMMENT ON VIEW address_points_preferred IS 
'Deduplicated view of address_points, returning only the best match per unique address. Uses source_rank to prefer NAD over OpenAddresses.';

-- =====================================================================
-- PHASE 12: Helper Functions for Geocoding
-- =====================================================================

-- Function: Normalize street name for matching
-- Converts to uppercase, standardizes abbreviations
CREATE OR REPLACE FUNCTION normalize_street_name(raw_name TEXT)
RETURNS TEXT AS $$
DECLARE
    result TEXT;
BEGIN
    -- Uppercase and trim
    result := UPPER(TRIM(raw_name));
    
    -- Standardize directionals
    result := REGEXP_REPLACE(result, '\bNORTH\b', 'N', 'g');
    result := REGEXP_REPLACE(result, '\bSOUTH\b', 'S', 'g');
    result := REGEXP_REPLACE(result, '\bEAST\b', 'E', 'g');
    result := REGEXP_REPLACE(result, '\bWEST\b', 'W', 'g');
    result := REGEXP_REPLACE(result, '\bNORTHEAST\b', 'NE', 'g');
    result := REGEXP_REPLACE(result, '\bNORTHWEST\b', 'NW', 'g');
    result := REGEXP_REPLACE(result, '\bSOUTHEAST\b', 'SE', 'g');
    result := REGEXP_REPLACE(result, '\bSOUTHWEST\b', 'SW', 'g');
    
    -- Standardize street types (expand to full name for matching)
    result := REGEXP_REPLACE(result, '\bST\b$', 'STREET', 'g');
    result := REGEXP_REPLACE(result, '\bAVE\b$', 'AVENUE', 'g');
    result := REGEXP_REPLACE(result, '\bBLVD\b$', 'BOULEVARD', 'g');
    result := REGEXP_REPLACE(result, '\bDR\b$', 'DRIVE', 'g');
    result := REGEXP_REPLACE(result, '\bLN\b$', 'LANE', 'g');
    result := REGEXP_REPLACE(result, '\bRD\b$', 'ROAD', 'g');
    result := REGEXP_REPLACE(result, '\bCT\b$', 'COURT', 'g');
    result := REGEXP_REPLACE(result, '\bPL\b$', 'PLACE', 'g');
    result := REGEXP_REPLACE(result, '\bPKWY\b$', 'PARKWAY', 'g');
    result := REGEXP_REPLACE(result, '\bCIR\b$', 'CIRCLE', 'g');
    result := REGEXP_REPLACE(result, '\bHWY\b$', 'HIGHWAY', 'g');
    result := REGEXP_REPLACE(result, '\bWY\b$', 'WAY', 'g');
    
    -- Collapse multiple spaces
    result := REGEXP_REPLACE(result, '\s+', ' ', 'g');
    
    RETURN result;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function: Exact match geocoding query
-- Returns the best address point for an exact address match
CREATE OR REPLACE FUNCTION geocode_exact(
    p_state TEXT,
    p_zip TEXT,
    p_street_norm TEXT,
    p_house_number TEXT,
    p_unit TEXT DEFAULT NULL
)
RETURNS TABLE (
    id BIGINT,
    geom GEOMETRY,
    matched_address TEXT,
    source TEXT,
    confidence NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ap.id,
        ap.geom,
        ap.house_number || ' ' || ap.street_name_raw || 
            CASE WHEN ap.city IS NOT NULL THEN ', ' || ap.city ELSE '' END ||
            ', ' || ap.state ||
            CASE WHEN ap.zip IS NOT NULL THEN ' ' || ap.zip ELSE '' END AS matched_address,
        ap.source,
        1.0::NUMERIC AS confidence
    FROM address_points_preferred ap
    WHERE ap.state = UPPER(p_state)
      AND ap.street_name_norm = normalize_street_name(p_street_norm)
      AND ap.house_number = p_house_number
      AND (p_zip IS NULL OR ap.zip = p_zip)
      AND (p_unit IS NULL OR ap.unit = UPPER(p_unit))
    LIMIT 1;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function: Nearby match (same street, nearest house number)
CREATE OR REPLACE FUNCTION geocode_nearby(
    p_state TEXT,
    p_zip TEXT,
    p_street_norm TEXT,
    p_house_number TEXT,
    p_max_distance_pct NUMERIC DEFAULT 0.1  -- 10% of house number range
)
RETURNS TABLE (
    id BIGINT,
    geom GEOMETRY,
    matched_address TEXT,
    source TEXT,
    confidence NUMERIC
) AS $$
DECLARE
    target_num INTEGER;
BEGIN
    -- Try to parse house number as integer
    BEGIN
        target_num := p_house_number::INTEGER;
    EXCEPTION WHEN OTHERS THEN
        RETURN;  -- Can't do numeric comparison
    END;
    
    RETURN QUERY
    SELECT 
        ap.id,
        ap.geom,
        ap.house_number || ' ' || ap.street_name_raw || 
            CASE WHEN ap.city IS NOT NULL THEN ', ' || ap.city ELSE '' END ||
            ', ' || ap.state ||
            CASE WHEN ap.zip IS NOT NULL THEN ' ' || ap.zip ELSE '' END AS matched_address,
        ap.source,
        -- Confidence decreases with distance from target
        (1.0 - LEAST(1.0, ABS(ap.house_number::INTEGER - target_num)::NUMERIC / 
            NULLIF(GREATEST(target_num, 100), 0)))::NUMERIC AS confidence
    FROM address_points_preferred ap
    WHERE ap.state = UPPER(p_state)
      AND ap.street_name_norm = normalize_street_name(p_street_norm)
      AND (p_zip IS NULL OR ap.zip = p_zip)
      AND ap.house_number ~ '^\d+$'  -- Only numeric house numbers
    ORDER BY ABS(ap.house_number::INTEGER - target_num)
    LIMIT 1;
END;
$$ LANGUAGE plpgsql STABLE;

-- =====================================================================
-- PHASE 12: TIGER Interpolation Functions
-- =====================================================================

-- Function: Interpolate address along TIGER line segment
-- Returns interpolated point when no exact or nearby match exists
CREATE OR REPLACE FUNCTION geocode_tiger_interpolate(
    p_state TEXT,
    p_street_norm TEXT,
    p_house_number TEXT
)
RETURNS TABLE (
    geom GEOMETRY,
    matched_address TEXT,
    source TEXT,
    confidence NUMERIC
) AS $$
DECLARE
    target_num INTEGER;
    seg RECORD;
    interp_pct NUMERIC;
    use_left BOOLEAN;
    from_num INTEGER;
    to_num INTEGER;
BEGIN
    -- Parse house number
    BEGIN
        target_num := p_house_number::INTEGER;
    EXCEPTION WHEN OTHERS THEN
        RETURN;
    END;
    
    -- Find best matching TIGER segment
    SELECT * INTO seg
    FROM tiger_address_ranges t
    WHERE t.state = UPPER(p_state)
      AND t.name_norm = normalize_street_name(p_street_norm)
      AND (
          (t.l_from_hn ~ '^\d+$' AND t.l_to_hn ~ '^\d+$') OR
          (t.r_from_hn ~ '^\d+$' AND t.r_to_hn ~ '^\d+$')
      )
    ORDER BY 
        -- Prefer segments where house number is in range
        CASE 
            WHEN target_num BETWEEN LEAST(COALESCE(t.l_from_hn::INT, 0), COALESCE(t.l_to_hn::INT, 0))
                             AND GREATEST(COALESCE(t.l_from_hn::INT, 0), COALESCE(t.l_to_hn::INT, 0)) THEN 0
            WHEN target_num BETWEEN LEAST(COALESCE(t.r_from_hn::INT, 0), COALESCE(t.r_to_hn::INT, 0))
                             AND GREATEST(COALESCE(t.r_from_hn::INT, 0), COALESCE(t.r_to_hn::INT, 0)) THEN 0
            ELSE 1
        END,
        -- Then by distance from range
        LEAST(
            ABS(target_num - COALESCE(t.l_from_hn::INT, 999999)),
            ABS(target_num - COALESCE(t.r_from_hn::INT, 999999))
        )
    LIMIT 1;
    
    IF seg IS NULL THEN
        RETURN;
    END IF;
    
    -- Determine which side (left/right) based on parity (odd=left typically)
    use_left := (target_num % 2 = 1);  -- Odd numbers typically on left
    
    IF use_left AND seg.l_from_hn IS NOT NULL AND seg.l_to_hn IS NOT NULL THEN
        from_num := seg.l_from_hn::INTEGER;
        to_num := seg.l_to_hn::INTEGER;
    ELSIF seg.r_from_hn IS NOT NULL AND seg.r_to_hn IS NOT NULL THEN
        from_num := seg.r_from_hn::INTEGER;
        to_num := seg.r_to_hn::INTEGER;
    ELSIF seg.l_from_hn IS NOT NULL AND seg.l_to_hn IS NOT NULL THEN
        from_num := seg.l_from_hn::INTEGER;
        to_num := seg.l_to_hn::INTEGER;
    ELSE
        RETURN;
    END IF;
    
    -- Calculate interpolation percentage
    IF to_num = from_num THEN
        interp_pct := 0.5;
    ELSE
        interp_pct := GREATEST(0, LEAST(1, 
            (target_num - from_num)::NUMERIC / (to_num - from_num)::NUMERIC
        ));
    END IF;
    
    -- Return interpolated point
    RETURN QUERY
    SELECT 
        ST_LineInterpolatePoint(seg.geom, interp_pct),
        p_house_number || ' ' || seg.full_name || ', ' || p_state AS matched_address,
        'TIGER-INTERPOLATED' AS source,
        0.5::NUMERIC AS confidence;
    
    RETURN;
END;
$$ LANGUAGE plpgsql STABLE;

-- =====================================================================
-- Combined Geocoding Function (uses all fallback tiers)
-- =====================================================================
CREATE OR REPLACE FUNCTION geocode_address(
    p_state TEXT,
    p_zip TEXT,
    p_street TEXT,
    p_house_number TEXT,
    p_unit TEXT DEFAULT NULL
)
RETURNS TABLE (
    geom GEOMETRY,
    matched_address TEXT,
    source TEXT,
    confidence NUMERIC,
    match_type TEXT
) AS $$
DECLARE
    street_norm TEXT;
    result RECORD;
BEGIN
    street_norm := normalize_street_name(p_street);
    
    -- Tier 1: Exact match
    SELECT * INTO result FROM geocode_exact(p_state, p_zip, street_norm, p_house_number, p_unit);
    IF result IS NOT NULL AND result.geom IS NOT NULL THEN
        RETURN QUERY SELECT result.geom, result.matched_address, result.source, result.confidence, 'EXACT'::TEXT;
        RETURN;
    END IF;
    
    -- Tier 2: Nearby match (same street, nearest house number)
    SELECT * INTO result FROM geocode_nearby(p_state, p_zip, street_norm, p_house_number);
    IF result IS NOT NULL AND result.geom IS NOT NULL THEN
        RETURN QUERY SELECT result.geom, result.matched_address, result.source, result.confidence, 'NEARBY'::TEXT;
        RETURN;
    END IF;
    
    -- Tier 3: TIGER interpolation
    SELECT * INTO result FROM geocode_tiger_interpolate(p_state, street_norm, p_house_number);
    IF result IS NOT NULL AND result.geom IS NOT NULL THEN
        RETURN QUERY SELECT result.geom, result.matched_address, result.source, result.confidence, 'TIGER'::TEXT;
        RETURN;
    END IF;
    
    -- No match found
    RETURN;
END;
$$ LANGUAGE plpgsql STABLE;

-- =====================================================================
-- PHASE 10: Ingestion Support Functions
-- =====================================================================

-- Procedure: Mark stale records as inactive (tombstone strategy)
CREATE OR REPLACE PROCEDURE deactivate_stale_addresses(
    p_days_threshold INTEGER DEFAULT 7
)
AS $$
BEGIN
    UPDATE address_points
    SET is_active = FALSE
    WHERE last_seen_at < NOW() - (p_days_threshold || ' days')::INTERVAL
      AND is_active = TRUE;
    
    RAISE NOTICE 'Deactivated % stale address records', 
        (SELECT COUNT(*) FROM address_points WHERE is_active = FALSE AND last_seen_at < NOW() - (p_days_threshold || ' days')::INTERVAL);
END;
$$ LANGUAGE plpgsql;

-- =====================================================================
-- Grant permissions (adjust as needed for your setup)
-- =====================================================================
-- GRANT SELECT ON address_points_preferred TO app_readonly;
-- GRANT EXECUTE ON FUNCTION geocode_address TO app_readonly;

COMMENT ON FUNCTION geocode_address IS 
'Main geocoding entry point. Attempts exact match, then nearby match, then TIGER interpolation.';

COMMENT ON FUNCTION normalize_street_name IS 
'Normalizes street names for consistent matching across NAD, OpenAddresses, and TIGER data.';
