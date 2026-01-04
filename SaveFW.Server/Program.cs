using Microsoft.EntityFrameworkCore;
using SaveFW.Server.Data;
using SaveFW.Shared;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllersWithViews();
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

// Register Workers
builder.Services.AddHostedService<SaveFW.Server.Workers.ScoringWorker>();

var app = builder.Build();

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