using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using SaveFW.Server.Data;
using SaveFW.Shared;
using QuestPDF.Infrastructure;

// Set QuestPDF License
QuestPDF.Settings.License = LicenseType.Community;

var builder = WebApplication.CreateBuilder(args);
builder.WebHost.UseStaticWebAssets();

// Add services to the container.
builder.Services.AddControllersWithViews();
builder.Services.AddMemoryCache();
builder.Services.AddRazorPages();
builder.Services.AddOpenApi();
// builder.Services.AddHttpsRedirection(options =>
// {
//     options.RedirectStatusCode = Microsoft.AspNetCore.Http.StatusCodes.Status307TemporaryRedirect;
//     options.HttpsPort = 443;
// });

// Register DbContext
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection"), 
        o => o.UseNetTopologySuite()));

// Register Valhalla Client
builder.Services.AddHttpClient<SaveFW.Server.Services.Valhalla.ValhallaClient>(client =>
{
    var baseUrl = builder.Configuration["Valhalla:BaseUrl"];
    if (string.IsNullOrEmpty(baseUrl))
    {
        throw new InvalidOperationException("Valhalla:BaseUrl configuration is missing.");
    }
    client.BaseAddress = new Uri(baseUrl);
});

// Register Tiger Services
builder.Services.AddHttpClient<SaveFW.Server.Services.TigerIngestionService>();
builder.Services.AddScoped<TigerSeeder>();

// Register Census Ingestion Service
builder.Services.AddHttpClient<SaveFW.Server.Services.CensusIngestionService>();

// Register Isochrone Seeding Service
builder.Services.AddScoped<SaveFW.Server.Services.IsochroneSeedingService>();

// Register Workers
// builder.Services.AddHostedService<SaveFW.Server.Workers.ScoringWorker>();

var app = builder.Build();

if (args.Contains("--run-allen-isochrones"))
{
    using var scope = app.Services.CreateScope();
    var seeder = scope.ServiceProvider.GetRequiredService<SaveFW.Server.Services.IsochroneSeedingService>();
    await seeder.RunAllenCountyAsync(CancellationToken.None);
    return;
}

// Auto-migrate database
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    // Wait for DB to be ready
    try 
    {
        if (db.Database.GetPendingMigrations().Any())
        {
            Console.WriteLine("Applying pending migrations...");
            db.Database.Migrate();
            Console.WriteLine("Migrations applied successfully.");
        }

    }
    catch (Exception ex)
    {
        Console.WriteLine($"Migration failed: {ex.Message}");
    }
}

// Seed TIGER Data on startup and warm caches (fire-and-forget to avoid blocking startup)
_ = Task.Run(async () =>
{
    using var scope = app.Services.CreateScope();
    var seeder = scope.ServiceProvider.GetRequiredService<TigerSeeder>();
    try
    {
        Console.WriteLine("Starting TIGER Data Seeding Check...");
        await seeder.EnsureSeededAsync();
        Console.WriteLine("TIGER Data Seeding Check Complete.");

        await WarmStateCacheAsync(scope.ServiceProvider);
    }
    catch (Exception ex)
    {
        Console.WriteLine($"Tiger Seeding Failed: {ex}");
    }
});

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseWebAssemblyDebugging();
    app.MapOpenApi();
}

// app.UseHttpsRedirection();
app.UseBlazorFrameworkFiles();
app.UseStaticFiles();

app.UseRouting();

// API Endpoints
app.MapGet("/api/legislators", async (AppDbContext db) =>
    await db.Legislators.ToListAsync());

app.MapGet("/api/impacts", async (AppDbContext db) =>
    await db.ImpactFacts.ToListAsync());

app.MapRazorPages();
app.MapControllers();
app.MapFallbackToFile("index.html");

app.Run();

static async Task WarmStateCacheAsync(IServiceProvider services)
{
    var cache = services.GetRequiredService<IMemoryCache>();
    var db = services.GetRequiredService<AppDbContext>();

    try
    {
        Console.WriteLine("Warming state boundaries cache...");
        var conn = db.Database.GetDbConnection();
        await conn.OpenAsync();
        using var cmd = conn.CreateCommand();
        
        // MUST match the query in CensusController.GetStates()
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
            cache.Set("tiger_states_geojson", json, TimeSpan.FromHours(24));
            Console.WriteLine("State boundaries cache warmed successfully.");
        }
        else
        {
            Console.WriteLine("State boundaries cache warm skipped (no data).");
        }
    }
    catch (Exception ex)
    {
        Console.WriteLine($"State cache warm failed: {ex.Message}");
    }
}
