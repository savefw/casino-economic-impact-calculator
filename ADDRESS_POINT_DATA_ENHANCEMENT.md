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

## Ingesting the Data
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

## Import National Address Database (NAD)
Download the CSV version of NAD (easier to parse than GDB). Import it into us_address_points first. Set the source column to 'NAD'.

## Import OpenAddresses (With De-Duplication)
This is the tricky part. You don't want two points for "123 Main St" (one from NAD, one from OA).
    
    The "Lazy" De-Dupe: Since NAD covers Indiana well, you can simply skip importing Indiana files from OpenAddresses entirely.

    The "Smart" De-Dupe (SQL): Import OA into a temporary staging table, then insert into the main table only if no NAD point exists nearby.

    -- Example: Inserting OA data where NAD data doesn't exist within 5 meters
    INSERT INTO us_address_points (street_number, street_name, state, source, geom)
    SELECT oa.number, oa.street, oa.state, 'OA', oa.geom
    FROM staging_openaddresses oa
    WHERE NOT EXISTS (
        SELECT 1 FROM us_address_points nad
        WHERE nad.source = 'NAD'
        AND nad.state = oa.state -- Optimization
        AND ST_DWithin(nad.geom::geography, oa.geom::geography, 5) -- meters
    );

## Step 2: The .NET 10 Implementation
In the C# application, you will want to use Npgsql with the NetTopologySuite plugin. This allows you to treat PostGIS geometry types as native C# objects.

NuGet Packages:

Npgsql.EntityFrameworkCore.PostgreSQL

Npgsql.EntityFrameworkCore.PostgreSQL.NetTopologySuite

C# Query Logic (The Waterfall): Your repository pattern should look like this:

    public async Task<AddressResult?> FindAddressAsync(string street, string zip)
    {
        // 1. Try Exact Point Match (Fastest & Most Accurate)
        var pointMatch = await _context.AddressPoints
            .Where(a => a.Zip == zip && a.StreetName == street)
            .OrderBy(a => a.Source == "NAD" ? 0 : 1) // Prefer NAD
            .FirstOrDefaultAsync();

        if (pointMatch != null)
        {
            return new AddressResult { 
                Lat = pointMatch.Geom.Y, 
                Lon = pointMatch.Geom.X, 
                Type = "Rooftop" 
            };
        }

        // 2. Fallback to TIGER/Line (Interpolation)
        // If you can't find the rooftop, find the street range and estimate location
        return await _tigerService.GeocodeRangeAsync(street, zip);
    }

## Summary of "Best Option"
Download NAD: It covers your Indiana gap perfectly.

Download OpenAddresses: Use it for the rest of the country.

Filter OA: When importing OpenAddresses, exclude files for states where NAD coverage is superior (like IN, DC, NY) to save processing time and duplicates.

Database: Store them in a single PostGIS table.

App: Query the Point table first; fall back to TIGER ranges if no point is found.
