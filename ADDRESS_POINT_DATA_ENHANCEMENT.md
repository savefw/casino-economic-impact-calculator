# Goal:
United States address point data integrated into PostgreSQL/PostGIS database.

## Hybrid Approach
Don't choose one database. Use a waterfall approach. You should build a unified US_ADDRESS_POINTS table that ingests data from two sources, prioritizing the one with better local coverage.

## Hierarchy of Truth
    1. Tier 1 (Gold Standard): National Address Database (NAD). Since it comes directly from the DOT and fills your Indiana gap, treat this as the "master" where available.
            NAD file geodatabase version: https://data.transportation.gov/download/yw36-suxr/application%2Fx-zip-compressed
            NAD comma delimited ASCII: https://data.transportation.gov/download/fc2s-wawr/application%2Fx-zip-compressed
            NAD file geodatabase template: https://data.transportation.gov/download/ep8g-siwv/application%2Fx-zip-compressed
            Last updated: October 9, 2025

            Note: We should setup a monitoring service that checks the website to see the data last updated. Maybe checking once a month. If the date has changed it downloads the data and performs an update to the database.

    2. Tier 2 (Bulk Fill): OpenAddresses. Use this to fill the massive gaps that NAD still has (NAD is growing but still misses parts of the country that OA captures). https://openaddresses.io/

    3. Tier 3 (Fallback): TIGER/Line (which you already have). Do not mix this into your points table. Keep it separate. If a point lookup fails in Tiers 1 & 2, fall back to TIGER to interpolate the address range.

## Normalization
The data comes raw. You will likely need to write a script to standardize things like "St." vs "Street" or "Apt" vs "Unit" if you want strict consistency.

# Ingesting the Data
Since we are using PostGIS, we want to get both NAD and OA into a uniform structure. Create a Unified Table Create a table optimized for fast spatial lookups.
    
    CREATE TABLE us_address_points (
        id SERIAL PRIMARY KEY,
        street_number TEXT,
        street_name TEXT,
        unit TEXT,
        city TEXT,
        state TEXT,
        zip TEXT,
        source TEXT, -- 'NAD' or 'OA'
        geom GEOMETRY(Point, 4326) -- Store as WGS84
    );

    -- Crucial for performance
    CREATE INDEX idx_us_addr_geom ON us_address_points USING GIST (geom);
    CREATE INDEX idx_us_addr_state ON us_address_points (state);

