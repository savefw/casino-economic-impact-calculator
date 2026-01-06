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
                    SELECT json_build_object(
                        'type', 'FeatureCollection',
                        'features', COALESCE(json_agg(
                            json_build_object(
                                'type', 'Feature',
                                'geometry', ST_AsGeoJSON(geom)::json,
                                'properties', json_build_object(
                                    'geoid', geoid,
                                    'name', name,
                                    'stusps', stusps
                                )
                            )
                        ), '[]'::json)
                    )::text
                    FROM tiger_states;
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
                    SELECT json_build_object(
                        'type', 'FeatureCollection',
                        'features', COALESCE(json_agg(
                            json_build_object(
                                'type', 'Feature',
                                'geometry', ST_AsGeoJSON(geom)::json,
                                'properties', json_build_object(
                                    'geoid', geoid,
                                    'name', name,
                                    'state_fp', state_fp
                                )
                            )
                        ), '[]'::json)
                    )::text
                    FROM tiger_counties
                    WHERE state_fp = @fips;
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
