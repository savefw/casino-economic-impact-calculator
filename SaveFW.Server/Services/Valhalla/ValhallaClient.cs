using System.Text.Json;
using System.Text.Json.Serialization;

namespace SaveFW.Server.Services.Valhalla;

public class ValhallaClient
{
    private readonly HttpClient _httpClient;
    private readonly ILogger<ValhallaClient> _logger;

    public ValhallaClient(HttpClient httpClient, ILogger<ValhallaClient> logger)
    {
        _httpClient = httpClient;
        _logger = logger;
    }

    public async Task<string?> GetIsochroneJsonAsync(double lat, double lon, int minutes, CancellationToken ct = default)
    {
        // Valhalla /isochrone endpoint
        // Ref: https://valhalla.github.io/valhalla/api/isochrone/api-reference/
        
        var request = new
        {
            locations = new[]
            {
                new { lat = lat, lon = lon }
            },
            costing = "auto",
            contours = new[]
            {
                new { time = minutes, color = "ff0000" } 
            },
            polygons = true,
            denoise = 0.1 // cleanup noisy edges
        };

        try
        {
            var response = await _httpClient.PostAsJsonAsync("/isochrone", request, ct);
            response.EnsureSuccessStatusCode();

            // We return the raw string because we'll likely pass it to PostGIS 
            // or parse it into NetTopologySuite objects later.
            return await response.Content.ReadAsStringAsync(ct);
        }
        catch (HttpRequestException ex)
        {
            _logger.LogError(ex, "Error calling Valhalla isochrone API");
            // In a real scenario, consider retry logic or returning null/throwing based on resilience policy
            throw;
        }
    }
}
