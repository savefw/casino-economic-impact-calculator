# Implementation Guide: Census Data Ingestion (Full US)

Do not seed the existing JSON files, found here: SaveFW/SaveFW.Client/wwwroot/data/counties.

Your current JSON files are likely "lossy" (simplified geometry) and lack the specific demographic columns (18+ pop) you need. Seeding them would pollute your clean database with bad data. Discard them. We will fetch the high-resolution "Gold Standard" data directly from the Census Bureau.

Yes, fetch Neighbors. We will create a C# "Seeder" that accepts a list of State FIPS codes. Loop through 01 to 56 for a national rollout now, as opposed to later.

The C# .NET 10 Implementation Plan
Build a CensusIngestionService. It will perform a "Merge in Memory" operation:

Fetch Geometry: Download the official TIGER/Line Shapefiles (high-precision boundaries). Please implement a C# script to fetch/scrap the data, simplify, and seed it.

Fetch Data: Call the Census API to get the exact 2020 P3 (Voting Age Population) counts.

Merge & Insert: Match them by GEOID and bulk-insert them into PostGIS.

1. Prerequisites (NuGet Packages)
You need these packages in your Server/API project (we MIGHT already have them; please check/verify):

Bash

dotnet add package Npgsql.NetTopologySuite       # For PostGIS support
dotnet add package NetTopologySuite.IO.ShapeFile # To read the Census maps
dotnet add package System.IO.Compression.ZipFile # To unzip the downloads
2. The Database Schema
Ensure your PostGIS table is ready to receive this data. Run this SQL once:

```bash
dotnet add package Npgsql.NetTopologySuite       
dotnet add package NetTopologySuite.IO.ShapeFile 
dotnet add package System.IO.Compression.ZipFile 
2. Database Schema (PostGIS)
Execute the following SQL on your database to create the table that will hold the merged census data.

SQL

-- Ensure PostGIS is enabled
CREATE EXTENSION IF NOT EXISTS postgis;

-- Create the table for Block Groups
CREATE TABLE census_block_groups (
    geoid VARCHAR(15) PRIMARY KEY,       -- The unique FIPS code (State+County+Tract+BG)
    state_fp VARCHAR(2),                 -- State FIPS (e.g., '18' for Indiana)
    pop_total INT,                       -- P1_001N (Reference: Total Population)
    pop_18_plus INT,                     -- P3_001N (Critical: Voting Age Population)
    geom GEOMETRY(MultiPolygon, 4326)    -- The Spatial Shape
);

-- Index for fast spatial querying
CREATE INDEX idx_census_bg_geom ON census_block_groups USING GIST (geom);
3. The C# Seeder Service
Add the following class (CensusIngestionService.cs) to your .NET project. This service fetches the "Gold Standard" TIGER/Line Shapefiles and the official 2020 Decennial Census data (Table P3) for the entire Continental US, merges them in memory, and bulk inserts them into PostGIS.

C#

using System.IO.Compression;
using System.Text.Json;
using NetTopologySuite.Geometries;
using NetTopologySuite.IO;
using Npgsql;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

public class CensusIngestionService
{
    private readonly string _connString;
    private readonly HttpClient _http;
    private readonly ILogger<CensusIngestionService> _logger;

    // FIPS Codes for Lower 48 States + DC (Ordered Numerically)
    // Excludes AK (02), HI (15), PR (72)
    private readonly string[] _targetStates = new[] 
    {
        "01", "04", "05", "06", "08", "09", "10", "11", "12", "13", // AL, AZ, AR, CA, CO, CT, DE, DC, FL, GA
        "16", "17", "18", "19", "20", "21", "22", "23", "24", "25", // ID, IL, IN, IA, KS, KY, LA, ME, MD, MA
        "26", "27", "28", "29", "30", "31", "32", "33", "34", "35", // MI, MN, MS, MO, MT, NE, NV, NH, NJ, NM
        "36", "37", "38", "39", "40", "41", "42", "44", "45", "46", // NY, NC, ND, OH, OK, OR, PA, RI, SC, SD
        "47", "48", "49", "50", "51", "53", "54", "55", "56"        // TN, TX, UT, VT, VA, WA, WV, WI, WY
    };

    public CensusIngestionService(IConfiguration config, HttpClient http, ILogger<CensusIngestionService> logger)
    {
        _connString = config.GetConnectionString("DefaultConnection");
        _http = http;
        _logger = logger;
    }

    // Call this method from a BackgroundService or Controller to start the process
    public async Task RunFullUSIngestionAsync()
    {
        _logger.LogInformation("Starting Continental US Census Ingestion...");

        foreach (var stateFips in _targetStates)
        {
            _logger.LogInformation($"Processing State FIPS: {stateFips}...");
            try 
            {
                // 1. Fetch Demographics (Population 18+) from Census API
                var demographics = await FetchCensusData(stateFips);
                
                // 2. Download and Parse TIGER/Line Shapefile
                var features = await DownloadAndParseShapefile(stateFips);

                // 3. Merge & Bulk Insert into PostGIS
                await BulkInsertToPostgis(features, demographics, stateFips);
                
                _logger.LogInformation($"State {stateFips} Complete.");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Failed to process state {stateFips}");
            }
        }
    }

    private async Task<Dictionary<string, (int Total, int Adult)>> FetchCensusData(string stateFips)
    {
        // P1_001N = Total Population
        // P3_001N = Population 18 Years and Over
        var url = $"[https://api.census.gov/data/2020/dec/pl?get=P1_001N,P3_001N&for=block%20group:*&in=state](https://api.census.gov/data/2020/dec/pl?get=P1_001N,P3_001N&for=block%20group:*&in=state):{stateFips}";
        
        var json = await _http.GetStringAsync(url);
        using var doc = JsonDocument.Parse(json);
        var rows = doc.RootElement.EnumerateArray().ToList();
        var result = new Dictionary<string, (int, int)>();

        // Skip header row (index 0)
        foreach (var row in rows.Skip(1))
        {
            var p1 = int.Parse(row[0].GetString() ?? "0");
            var p3 = int.Parse(row[1].GetString() ?? "0");
            
            // Census API returns GEOID parts: State(2), County(3), Tract(4), BlockGroup(5)
            // We concatenate them to form the full 12-digit GEOID
            var geoid = $"{row[2].GetString()}{row[3].GetString()}{row[4].GetString()}{row[5].GetString()}";
            result[geoid] = (p1, p3);
        }
        return result;
    }

    private async Task<FeatureCollection> DownloadAndParseShapefile(string stateFips)
    {
        var fileUrl = $"[https://www2.census.gov/geo/tiger/TIGER2020/BG/tl_2020](https://www2.census.gov/geo/tiger/TIGER2020/BG/tl_2020)_{stateFips}_bg.zip";
        var zipPath = Path.Combine(Path.GetTempPath(), $"bg_{stateFips}.zip");
        var extractPath = Path.Combine(Path.GetTempPath(), $"bg_{stateFips}");

        // Download
        if (!File.Exists(zipPath))
        {
            _logger.LogInformation($"Downloading Shapefile for {stateFips}...");
            var bytes = await _http.GetByteArrayAsync(fileUrl);
            await File.WriteAllBytesAsync(zipPath, bytes);
        }

        // Unzip
        if (Directory.Exists(extractPath)) Directory.Delete(extractPath, true);
        ZipFile.ExtractToDirectory(zipPath, extractPath);

        // Find .shp file
        var shpFile = Directory.GetFiles(extractPath, "*.shp").First();
        var factory = new GeometryFactory();
        var reader = new ShapefileDataReader(shpFile, factory);

        var collection = new FeatureCollection();
        while (reader.Read())
        {
            var feature = new Feature();
            feature.Geometry = reader.Geometry;
            
            // TIGER Shapefiles usually store the GEOID in a column named "GEOID"
            var geoidIdx = reader.GetOrdinal("GEOID");
            if (geoidIdx >= 0)
            {
                feature.Attributes.Add("GEOID", reader.GetValue(geoidIdx));
            }
            collection.Add(feature);
        }
        
        reader.Close();
        return collection;
    }

    private async Task BulkInsertToPostgis(FeatureCollection features, Dictionary<string, (int Total, int Adult)> data, string stateFips)
    {
        await using var conn = new NpgsqlConnection(_connString);
        await conn.OpenAsync();

        // Use Binary COPY for high-performance bulk insertion
        using var writer = conn.BeginBinaryImport("COPY census_block_groups (geoid, state_fp, pop_total, pop_18_plus, geom) FROM STDIN (FORMAT BINARY)");

        foreach (var feature in features)
        {
            var geoid = feature.Attributes["GEOID"]?.ToString();
            
            // Only insert if we have matching population data
            if (geoid != null && data.TryGetValue(geoid, out var pops))
            {
                writer.StartRow();
                writer.Write(geoid);            // geoid
                writer.Write(stateFips);        // state_fp
                writer.Write(pops.Total);       // pop_total
                writer.Write(pops.Adult);       // pop_18_plus
                writer.Write(feature.Geometry); // geom (Npgsql handles the conversion)
            }
        }

        await writer.CompleteAsync();
    }
}




NOTE: If there are additional data fields that you think would be beneficial for our analysis to store in the database, either from the JSON or the Census API, please feel free to do so while providing an explanation to me why you did what you did.



Once the preceding steps are completed, we can then update the Map.js file to use real population data instead of the estimatoin by block land area.