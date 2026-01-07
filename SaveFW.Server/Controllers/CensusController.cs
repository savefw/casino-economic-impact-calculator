using System.Linq;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Npgsql;
using SaveFW.Server.Data;
using SaveFW.Server.Services;

namespace SaveFW.Server.Controllers
{
    [ApiController]
    [Route("api/census")]
    public class CensusController : ControllerBase
    {
        private readonly AppDbContext _db;
        private readonly TigerSeeder _seeder;
        private readonly IMemoryCache _cache;

        public CensusController(AppDbContext db, TigerSeeder seeder, IMemoryCache cache)
        {
            _db = db;
            _seeder = seeder;
            _cache = cache;
        }

        [HttpGet("status")]
        public async Task<IActionResult> GetStatus()
        {
            // We use raw SQL because we haven't mapped these tables to EF entities fully yet
            var stateCount = -1;
            var countyCount = -1;
            var bgCount = -1;

            try 
            {
                var conn = _db.Database.GetDbConnection();
                await conn.OpenAsync();
                
                using (var cmd = conn.CreateCommand())
                {
                    cmd.CommandText = "SELECT COUNT(*) FROM tiger_states";
                    stateCount = Convert.ToInt32(await cmd.ExecuteScalarAsync() ?? 0);
                }
                using (var cmd = conn.CreateCommand())
                {
                    cmd.CommandText = "SELECT COUNT(*) FROM tiger_counties";
                    countyCount = Convert.ToInt32(await cmd.ExecuteScalarAsync() ?? 0);
                }
                 using (var cmd = conn.CreateCommand())
                {
                    cmd.CommandText = "SELECT COUNT(*) FROM census_block_groups";
                    bgCount = Convert.ToInt32(await cmd.ExecuteScalarAsync() ?? 0);
                }
            }
            catch (Exception ex)
            {
                 return Ok(new { Error = ex.Message });
            }

            return Ok(new 
            { 
                States = stateCount,
                Counties = countyCount,
                BlockGroups = bgCount,
                Status = (stateCount > 0 && countyCount > 0) ? "Seeded" : "Incomplete"
            });
        }

        [HttpGet("states")]
        public async Task<IActionResult> GetStates()
        {
            if (_cache.TryGetValue("tiger_states_geojson", out string? cachedJson) && !string.IsNullOrEmpty(cachedJson))
            {
                return Content(cachedJson, "application/json");
            }

            try 
            {
                var conn = _db.Database.GetDbConnection();
                await conn.OpenAsync();
                using var cmd = conn.CreateCommand();
                cmd.CommandText = @"
                    WITH state_pop AS (
                        SELECT substring(geoid, 1, 2) AS state_fips,
                               SUM(pop_total) AS pop_total,
                               SUM(pop_18_plus) AS pop_adult
                        FROM census_block_groups
                        GROUP BY 1
                    )
                    SELECT json_build_object(
                        'type', 'FeatureCollection',
                        'features', COALESCE(json_agg(
                            json_build_object(
                                'type', 'Feature',
                                'geometry', ST_AsGeoJSON(COALESCE(geom_simplified, geom))::json,
                                'properties', json_build_object(
                                    'geoid', geoid,
                                    'name', name,
                                    'stusps', stusps,
                                    'pop_total', COALESCE(sp.pop_total, 0),
                                    'pop_adult', COALESCE(sp.pop_adult, 0)
                                )
                            )
                        ), '[]'::json)
                    )::text
                    FROM tiger_states ts
                    LEFT JOIN state_pop sp ON sp.state_fips = ts.geoid;
                ";

                var json = (string?)await cmd.ExecuteScalarAsync();
                
                if (!string.IsNullOrEmpty(json))
                {
                    _cache.Set("tiger_states_geojson", json, TimeSpan.FromHours(24));
                    return Content(json, "application/json");
                }
                return NotFound("No state data found.");
            }
            catch (Exception ex)
            {
                 return StatusCode(500, ex.Message);
            }
        }

        [HttpGet("counties/{stateFips}")]
        public async Task<IActionResult> GetCounties(string stateFips)
        {
            var cacheKey = $"tiger_counties_{stateFips}_geojson";
            if (_cache.TryGetValue(cacheKey, out string? cachedJson) && !string.IsNullOrEmpty(cachedJson))
            {
                return Content(cachedJson, "application/json");
            }

            try 
            {
                var conn = _db.Database.GetDbConnection();
                await conn.OpenAsync();
                using var cmd = conn.CreateCommand();
                cmd.CommandText = @"
                    WITH county_pop AS (
                        SELECT substring(geoid, 1, 5) AS county_geoid,
                               SUM(pop_total) AS pop_total,
                               SUM(pop_18_plus) AS pop_adult
                        FROM census_block_groups
                        GROUP BY 1
                    )
                    SELECT json_build_object(
                        'type', 'FeatureCollection',
                        'features', COALESCE(json_agg(
                            json_build_object(
                                'type', 'Feature',
                                'geometry', ST_AsGeoJSON(COALESCE(geom_simplified, geom))::json,
                                'properties', json_build_object(
                                    'geoid', geoid,
                                    'name', name,
                                    'state_fp', state_fp,
                                    'pop_total', COALESCE(cp.pop_total, 0),
                                    'pop_adult', COALESCE(cp.pop_adult, 0)
                                )
                            )
                        ), '[]'::json)
                    )::text
                    FROM tiger_counties tc
                    LEFT JOIN county_pop cp ON cp.county_geoid = tc.geoid
                    WHERE tc.state_fp = @fips;
                ";
                
                var p = cmd.CreateParameter();
                p.ParameterName = "fips";
                p.Value = stateFips;
                cmd.Parameters.Add(p);

                var json = (string?)await cmd.ExecuteScalarAsync();
                
                if (!string.IsNullOrEmpty(json))
                {
                    _cache.Set(cacheKey, json, TimeSpan.FromHours(24));
                    return Content(json, "application/json");
                }
                return NotFound($"No county data found for state {stateFips}.");
            }
            catch (Exception ex)
            {
                 return StatusCode(500, ex.Message);
            }
        }

        [HttpPost("seed/force")]
        public async Task<IActionResult> ForceSeed()
        {
            await _seeder.EnsureSeededAsync();
            return Ok("Seeding triggered.");
        }
    }
}
