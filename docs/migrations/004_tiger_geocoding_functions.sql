-- =====================================================================
-- PHASE 11 & 12: Geocoding & Classification Logic (TIGER Ranges)
-- =====================================================================

-- Function: Normalize street name (Consolidated)
CREATE OR REPLACE FUNCTION normalize_street_name_v2(raw_name TEXT)
RETURNS TEXT AS $$
DECLARE
    result TEXT;
BEGIN
    result := UPPER(TRIM(raw_name));
    -- Basic standardizations (expand as needed)
    result := REGEXP_REPLACE(result, '\bST\b', 'STREET', 'g');
    result := REGEXP_REPLACE(result, '\bAVE\b', 'AVENUE', 'g');
    result := REGEXP_REPLACE(result, '\bRD\b', 'ROAD', 'g');
    result := REGEXP_REPLACE(result, '\bBLVD\b', 'BOULEVARD', 'g');
    result := REGEXP_REPLACE(result, '\bLN\b', 'LANE', 'g');
    result := REGEXP_REPLACE(result, '\bDR\b', 'DRIVE', 'g');
    result := REGEXP_REPLACE(result, '\bCT\b', 'COURT', 'g');
    return result;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function: Segment Interpolation
CREATE OR REPLACE FUNCTION geocode_tiger_interpolate(
    p_zip TEXT,
    p_street_name TEXT,
    p_house_number TEXT
)
RETURNS TABLE (
    geom GEOMETRY,
    matched_address TEXT,
    confidence NUMERIC
) AS $$
DECLARE
    target_hn INTEGER;
    seg RECORD;
    interp_pct NUMERIC;
    from_num INTEGER;
    to_num INTEGER;
BEGIN
    -- Try parse house number
    BEGIN
        target_hn := p_house_number::INTEGER;
    EXCEPTION WHEN OTHERS THEN
        RETURN;
    END;

    -- Find matching range
    -- We look for a segment where the house number is within range
    -- and parity matches (odd/even) if possible, though TIGER ranges usually split parity by side.
    -- The table structure (from 003) has separate rows for L and R sides.
    SELECT * INTO seg
    FROM tiger_address_ranges t
    WHERE t.zip = p_zip
      AND t.street_name = normalize_street_name_v2(p_street_name)
      AND target_hn BETWEEN LEAST(t.from_hn::INT, t.to_hn::INT) AND GREATEST(t.from_hn::INT, t.to_hn::INT)
      -- Check parity matches (both odd or both even)
      AND (t.from_hn::INT % 2) = (target_hn % 2)
    LIMIT 1;

    -- Fallback: If no parity match, try just range match
    IF seg IS NULL THEN
        SELECT * INTO seg
        FROM tiger_address_ranges t
        WHERE t.zip = p_zip
          AND t.street_name = normalize_street_name_v2(p_street_name)
          AND target_hn BETWEEN LEAST(t.from_hn::INT, t.to_hn::INT) AND GREATEST(t.from_hn::INT, t.to_hn::INT)
        LIMIT 1;
    END IF;

    IF seg IS NULL THEN
        RETURN; -- No match found
    END IF;

    from_num := seg.from_hn::INTEGER;
    to_num := seg.to_hn::INTEGER;

    -- Calculate interpolation
    IF to_num = from_num THEN
        interp_pct := 0.5;
    ELSE
         -- TIGER ranges follow the digitizing direction of the line.
         -- If 'from' < 'to', it increases along line.
         -- If 'from' > 'to', it decreases along line.
         -- We just need ratio of (target - from) / (to - from).
        interp_pct := (target_hn - from_num)::NUMERIC / (to_num - from_num)::NUMERIC;
    END IF;

    RETURN QUERY
    SELECT 
        ST_LineInterpolatePoint(seg.geom, interp_pct) as geom,
        (p_house_number || ' ' || seg.street_name || ', ' || seg.zip) as matched_address,
        0.8::NUMERIC as confidence;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function: Classification API (Coordinate -> Jurisdictions)
-- This assumes census_block_groups and other layers exist
CREATE OR REPLACE FUNCTION classify_location(
    p_geom GEOMETRY
)
RETURNS TABLE (
    block_group_id TEXT,
    tract_id TEXT,
    county_fp TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        bg.geoid as block_group_id,
        LEFT(bg.geoid, 11) as tract_id,
        LEFT(bg.geoid, 5) as county_fp
    FROM census_block_groups bg
    WHERE ST_Intersects(bg.geom, p_geom)
    LIMIT 1;
END;
$$ LANGUAGE plpgsql STABLE;
