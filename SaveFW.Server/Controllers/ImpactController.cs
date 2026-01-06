using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using SaveFW.Server.Data;
using System.Data;

namespace SaveFW.Server.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ImpactController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IConfiguration _config;

    public ImpactController(AppDbContext db, IConfiguration config)
    {
        _db = db;
        _config = config;
    }

    [HttpGet("calculate")]
    public async Task<IActionResult> CalculateImpact(double lat, double lon)
    {
        var connString = _config.GetConnectionString("DefaultConnection");
        await using var conn = new NpgsqlConnection(connString);
        await conn.OpenAsync();

        // 10 miles = 16093.4 meters
        // 20 miles = 32186.9 meters
        var sql = @"
            WITH point AS (
                SELECT ST_SetSRID(ST_MakePoint(@lon, @lat), 4326)::geography AS pt
            ),
            buffers AS (
                SELECT
                    ST_Buffer(pt, 16093.4)::geometry as geom_10,
                    ST_Buffer(pt, 32186.9)::geometry as geom_20
                FROM point
            ),
            -- Identify the county FIPS (State+County) that contains the center point
            center_county AS (
                SELECT SUBSTRING(geoid, 1, 5) as fips
                FROM census_block_groups
                WHERE ST_Intersects(geom, ST_SetSRID(ST_MakePoint(@lon, @lat), 4326))
                LIMIT 1
            ),
            -- Aggregate total county stats
            county_stats AS (
                SELECT 
                    SUM(pop_total) as c_total, 
                    SUM(pop_18_plus) as c_adults
                FROM census_block_groups
                WHERE geoid LIKE (SELECT fips FROM center_county) || '%'
            )
            SELECT
                -- Zone 1 (0-10 miles) - Adults
                COALESCE(SUM(
                    CASE 
                        WHEN ST_Intersects(b.geom, buf.geom_10) THEN
                            b.pop_18_plus * (ST_Area(ST_Intersection(b.geom, buf.geom_10)) / ST_Area(b.geom))
                        ELSE 0 
                    END
                ), 0) as pop_10,
                
                -- Zone 2 (0-20 miles) - Adults (for later subtraction)
                COALESCE(SUM(
                    CASE 
                        WHEN ST_Intersects(b.geom, buf.geom_20) THEN
                            b.pop_18_plus * (ST_Area(ST_Intersection(b.geom, buf.geom_20)) / ST_Area(b.geom))
                        ELSE 0 
                    END
                ), 0) as pop_20_total,

                -- County Stats
                (SELECT c_total FROM county_stats) as county_total,
                (SELECT c_adults FROM county_stats) as county_adults

            FROM census_block_groups b, buffers buf
            WHERE ST_Intersects(b.geom, buf.geom_20);
        ";

        await using var cmd = new NpgsqlCommand(sql, conn);
        cmd.Parameters.AddWithValue("lat", lat);
        cmd.Parameters.AddWithValue("lon", lon);

        await using var reader = await cmd.ExecuteReaderAsync();
        if (await reader.ReadAsync())
        {
            var pop10 = reader.IsDBNull(0) ? 0 : reader.GetDouble(0);
            var pop20Total = reader.IsDBNull(1) ? 0 : reader.GetDouble(1);
            var countyTotal = reader.IsDBNull(2) ? 0 : reader.GetInt64(2);
            var countyAdults = reader.IsDBNull(3) ? 0 : reader.GetInt64(3);
            
            // pop_20 in the UI acts as the "Elevated Risk" band (10-20 miles), so we subtract pop_10
            var pop10_20 = Math.Max(0, pop20Total - pop10);

            return Ok(new 
            { 
                t1 = (long)pop10, 
                t2 = (long)pop10_20,
                county_total = countyTotal,
                county_adults = countyAdults
            });
        }
        
        return Ok(new { t1 = 0, t2 = 0, county_total = 0, county_adults = 0 });
    }
    [HttpGet("county-context/{fips}")]
    public async Task<IActionResult> GetCountyContext(string fips)
    {
        var connString = _config.GetConnectionString("DefaultConnection");
        await using var conn = new NpgsqlConnection(connString);
        await conn.OpenAsync();

        // 50 miles = ~80467 meters
        // We select all block groups that intersect a 50-mile buffer around the target county
        var sql = @"
            WITH target_county_geom AS (
                -- Union all block groups for this county to make the base shape
                -- (Note: Faster if we had a counties table, but this works given our ingestion)
                SELECT ST_Union(geom) as geom
                FROM census_block_groups
                WHERE state_fp || substring(geoid, 3, 3) = @fips
                   OR geoid LIKE @fips || '%' -- Handle both 5-digit FIPS or just state+county prefix match
            ),
            search_area AS (
                SELECT ST_Buffer(geom::geography, 80467)::geometry as geom
                FROM target_county_geom
            )
            SELECT json_build_object(
                'type', 'FeatureCollection',
                'features', json_agg(
                    json_build_object(
                        'type', 'Feature',
                        'geometry', ST_AsGeoJSON(b.geom)::json,
                        'properties', json_build_object(
                            'POPULATION', b.pop_total,    -- Keeping generic name for compatibility if needed
                            'POP_ADULT', b.pop_18_plus,
                            'GEOID', b.geoid
                        )
                    )
                )
            )
            FROM census_block_groups b, search_area s
            WHERE ST_Intersects(b.geom, s.geom);
        ";

        await using var cmd = new NpgsqlCommand(sql, conn);
        // Ensure FIPS is 5 digits. If user passed '003' (Allen partial), we might need to handle. 
        // But map.js uses '003' for Allen in 'IndianaCounties'. The ingestion used full state FIPS (18) + County (003). 
        // For robustness, let's assume the FIPS passed is '18003' or construct it if needed. 
        // Map.js 'currentCountyId' is '003', but we know Indiana is '18'. 
        // Actually, map.js passes what? 
        // Let's assume the client will now pass the full '18003' or we fix it here.
        // Indiana is 18.
        var targetFips = fips.Length == 3 ? "18" + fips : fips;

        cmd.Parameters.AddWithValue("fips", targetFips);

        // ExecuteScalar returns the JSON string directly
        var jsonResult = await cmd.ExecuteScalarAsync();
        
        if (jsonResult == null || jsonResult == DBNull.Value) 
            return NotFound();

        return Content(jsonResult.ToString(), "application/json");
    }
}
