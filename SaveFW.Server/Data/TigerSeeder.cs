using System.Threading.Tasks;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Npgsql;
using SaveFW.Server.Services;

namespace SaveFW.Server.Data
{
    public class TigerSeeder
    {
        private readonly TigerIngestionService _ingestionService;
        private readonly ILogger<TigerSeeder> _logger;
        private readonly IConfiguration _config;
        private static readonly string[] BlockGroupStateFips = new[]
        {
            "01", "02", "04", "05", "06", "08", "09", "10", "11", "12",
            "13", "15", "16", "17", "18", "19", "20", "21", "22", "23",
            "24", "25", "26", "27", "28", "29", "30", "31", "32", "33",
            "34", "35", "36", "37", "38", "39", "40", "41", "42", "44",
            "45", "46", "47", "48", "49", "50", "51", "53", "54", "55",
            "56", "72"
        };

        public TigerSeeder(TigerIngestionService ingestionService, ILogger<TigerSeeder> logger, IConfiguration config)
        {
            _ingestionService = ingestionService;
            _logger = logger;
            _config = config;
        }

        public async Task EnsureSeededAsync()
        {
            var connString = _config.GetConnectionString("DefaultConnection");
            await using var conn = new NpgsqlConnection(connString);
            await conn.OpenAsync();

            // 1. Check if States exist
            if (!await HasData(conn, "tiger_states"))
            {
                _logger.LogInformation("TigerSeeder: No states found. Seeding National States...");
                await _ingestionService.IngestNationalStates();
            }
            else
            {
                _logger.LogInformation("TigerSeeder: States already seeded.");
            }

            // 2. Check if Counties exist
            // 2. Check if Counties exist
            if (!await HasData(conn, "tiger_counties"))
            {
                _logger.LogInformation("TigerSeeder: No counties found. Seeding National Counties...");
                await _ingestionService.IngestNationalCounties();
            }
             else
            {
                _logger.LogInformation("TigerSeeder: Counties already seeded.");
            }

            // 3. Check if Block Groups exist (checking specifically if any data exists, simplistic for now)
            if (!await HasData(conn, "census_block_groups"))
            {
                _logger.LogInformation("TigerSeeder: No block groups found. Seeding all state block groups...");
                foreach (var fips in BlockGroupStateFips)
                {
                    _logger.LogInformation($"TigerSeeder: Seeding block groups for state {fips}...");
                    await _ingestionService.IngestState(fips);
                }
            }
            else
            {
                _logger.LogInformation("TigerSeeder: Block Groups already seeded.");
            }
        }

        private async Task<bool> HasData(NpgsqlConnection conn, string tableName)
        {
            // First check if table exists to avoid exception
            using var cmdExists = conn.CreateCommand();
            cmdExists.CommandText = $"SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = '{tableName}');";
            var exists = (bool?)await cmdExists.ExecuteScalarAsync();
            if (exists != true) return false;

            // Check if rows exist
            using var cmd = conn.CreateCommand();
            cmd.CommandText = $"SELECT 1 FROM {tableName} LIMIT 1;";
            var res = await cmd.ExecuteScalarAsync();
            return res != null;
        }
    }
}
