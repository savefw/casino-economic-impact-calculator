using Microsoft.AspNetCore.Mvc;
using SaveFW.Server.Services;

namespace SaveFW.Server.Controllers;

[ApiController]
[Route("api/[controller]")]
public class CensusController : ControllerBase
{
    private readonly CensusIngestionService _service;
    private readonly ILogger<CensusController> _logger;

    public CensusController(CensusIngestionService service, ILogger<CensusController> logger)
    {
        _service = service;
        _logger = logger;
    }

    [HttpPost("ingest")]
    public async Task<IActionResult> IngestData()
    {
        _logger.LogInformation("Received request to start Census data ingestion.");
        
        // Run in background to avoid timeout
        _ = Task.Run(async () => 
        {
            try 
            {
                await _service.RunFullUSIngestionAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Background census ingestion failed.");
            }
        });

        return Accepted(new { message = "Census ingestion started in background. Check server logs for progress." });
    }
}
