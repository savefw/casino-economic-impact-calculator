using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using SaveFW.Server.Data;
using SaveFW.Shared;

var builder = WebApplication.CreateBuilder(args);

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

// Register Workers
// builder.Services.AddHostedService<SaveFW.Server.Workers.ScoringWorker>();

var app = builder.Build();

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
        var conn = db.Database.GetDbConnection();
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
            cache.Set("tiger_states_geojson", json, TimeSpan.FromHours(24));
            Console.WriteLine("State boundaries cache warmed.");
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
