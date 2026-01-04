using SaveFW.Server.Data;
using SaveFW.Server.Services.Valhalla;
using Microsoft.EntityFrameworkCore;
using NetTopologySuite.Geometries;

namespace SaveFW.Server.Workers;

public class ScoringWorker : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<ScoringWorker> _logger;

    public ScoringWorker(IServiceScopeFactory scopeFactory, ILogger<ScoringWorker> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Simple loop or one-off run
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await RunScoringBatchAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in ScoringWorker");
            }

            // Run every hour or just sleep for now
            await Task.Delay(TimeSpan.FromHours(1), stoppingToken);
        }
    }

    private async Task RunScoringBatchAsync(CancellationToken ct)
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var valhalla = scope.ServiceProvider.GetRequiredService<ValhallaClient>();

        // 1. Example: Pick a test point (e.g., Allen County Courthouse / approximate center)
        // In real impl, this comes from ST_SquareGrid over the county geometry
        var lat = 41.079273;
        var lon = -85.139351;
        var minutes = 15;

        // 2. Check if cached
        // Note: Needs strict rounding logic in real app
        var exists = await db.IsochroneCache
            .AnyAsync(i => i.Lat == lat && i.Lon == lon && i.Minutes == minutes, ct);

        if (exists)
        {
            _logger.LogInformation("Isochrone for {Lat},{Lon} already cached.", lat, lon);
            return;
        }

        // 3. Call Valhalla
        _logger.LogInformation("Fetching isochrone for {Lat},{Lon}...", lat, lon);
        var json = await valhalla.GetIsochroneJsonAsync(lat, lon, minutes, ct);

        if (string.IsNullOrEmpty(json))
        {
            _logger.LogWarning("Valhalla returned empty response.");
            return;
        }

        // 4. Save to DB (Parsing JSON to Geom would happen here)
        // For this skeleton, we just log success. 
        // Real impl: Parse GeoJSON -> NTS Geometry -> Save
        _logger.LogInformation("Successfully fetched isochrone from Valhalla (Length: {Length}). Integration working.", json.Length);
        
        // TODO: deserialization and saving logic
    }
}
