using Microsoft.AspNetCore.Mvc;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System;
using System.Threading.Tasks;

namespace SaveFW.Server.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class ReportController : ControllerBase
    {
        private readonly IWebHostEnvironment _env;

        public ReportController(IWebHostEnvironment env)
        {
            _env = env;
        }

        [HttpPost("generate")]
        public IActionResult GenerateReport([FromBody] ReportRequest request)
        {
            // Enable debugging to find layout issues
            QuestPDF.Settings.EnableDebugging = true;

            try
            {
                // Try to find the logo
            byte[] logoBytes = null;
            // Assuming we are in the project root/SaveFW.Server usually. 
            // We'll look in the Client's wwwroot relative to ContentRootPath if possible, 
            // or just try a few known locations.
            var possiblePaths = new[]
            {
                Path.Combine(_env.ContentRootPath, "..", "SaveFW.Client", "wwwroot", "assets", "SAVEFW.jpg"),
                Path.Combine(_env.ContentRootPath, "wwwroot", "assets", "SAVEFW.jpg"),
                Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "assets", "SAVEFW.jpg")
            };

            foreach (var path in possiblePaths)
            {
                if (System.IO.File.Exists(path))
                {
                    try 
                    {
                        logoBytes = System.IO.File.ReadAllBytes(path);
                        break;
                    } 
                    catch { }
                }
            }
            
            var document = Document.Create(container =>
            {
                container.Page(page =>
                {
                    page.Size(PageSizes.A4);
                    page.Margin(2, Unit.Centimetre);
                    page.PageColor(Colors.White);
                    page.DefaultTextStyle(x => x.FontSize(11));

                    // 1. Cover Page
                    page.Content().Column(col =>
                    {
                        col.Spacing(20);
                        
                        col.Item().PaddingTop(2, Unit.Centimetre).AlignCenter().Text("Net Economic Impact Analysis").FontSize(28).Bold().FontColor(Colors.Blue.Darken2);
                        col.Item().AlignCenter().Text("Fort Wayne Casino Proposal").FontSize(18).SemiBold().FontColor(Colors.Grey.Darken1);
                        
                        if (logoBytes != null)
                        {
                            col.Item().Height(6, Unit.Centimetre).AlignCenter().Image(logoBytes).FitArea();
                        }
                        else
                        {
                            col.Item().Height(2, Unit.Centimetre); // Spacer
                        }
                        
                        col.Item().PaddingTop(4, Unit.Centimetre).AlignCenter().Column(c => 
                        {
                             c.Item().Text($"Date: {DateTime.Now:MMMM d, yyyy}").FontSize(14);
                             c.Item().Text("Prepared by: SaveFW Analysis Tool").FontSize(14).Bold();
                        });
                        
                        col.Item().PageBreak();

                        // 2. Table of Contents
                        col.Item().Text("Table of Contents").FontSize(24).Bold().FontColor(Colors.Blue.Darken2);
                        col.Item().PaddingTop(1, Unit.Centimetre).Column(toc => 
                        {
                             toc.Spacing(10);
                             toc.Item().Row(row => { row.RelativeItem().Text("1. Geographic Impact Map").FontSize(14); row.AutoItem().Text("3").FontSize(14); });
                             toc.Item().Row(row => { row.RelativeItem().Text("2. Net Economic Impact Data").FontSize(14); row.AutoItem().Text("4").FontSize(14); });
                             toc.Item().Row(row => { row.RelativeItem().Text("3. Automated Analysis").FontSize(14); row.AutoItem().Text("4").FontSize(14); });
                        });
                        
                        col.Item().PageBreak();

                        // 3. Map Page
                        col.Item().Text("1. Geographic Impact Map").FontSize(20).Bold().FontColor(Colors.Blue.Darken2);
                        
                        if (!string.IsNullOrEmpty(request.MapImageBase64))
                        {
                            try 
                            {
                                // Remove prefix if present
                                var base64Data = request.MapImageBase64;
                                if (base64Data.Contains(","))
                                {
                                    base64Data = base64Data.Substring(base64Data.IndexOf(",") + 1);
                                }
                                var imageBytes = Convert.FromBase64String(base64Data);
                                col.Item().PaddingVertical(1, Unit.Centimetre).MaxHeight(18, Unit.Centimetre).Image(imageBytes).FitArea();
                            }
                            catch (Exception)
                            {
                                col.Item().Text("[Error processing map image]").FontColor(Colors.Red.Medium);
                            }
                        }
                        else 
                        {
                             col.Item().Text("[Map Image Not Provided]");
                        }
                        
                        col.Item().PageBreak();

                        // 4. Data & Analysis Page
                        col.Item().Text("2. Net Economic Impact Data").FontSize(20).Bold().FontColor(Colors.Blue.Darken2);
                        
                        col.Item().PaddingTop(10).Table(table =>
                        {
                            table.ColumnsDefinition(columns =>
                            {
                                columns.RelativeColumn(3);
                                columns.RelativeColumn(1);
                            });

                            table.Header(header =>
                            {
                                header.Cell().Element(CellStyle).Text("Metric").SemiBold();
                                header.Cell().Element(CellStyle).AlignRight().Text("Value").SemiBold();
                            });

                            if (request.TableData != null)
                            {
                                foreach (var item in request.TableData)
                                {
                                    table.Cell().Element(CellStyle).Text(item.Key);
                                    table.Cell().Element(CellStyle).AlignRight().Text(item.Value);
                                }
                            }
                            
                            static IContainer CellStyle(IContainer container)
                            {
                                return container.BorderBottom(1).BorderColor(Colors.Grey.Lighten2).PaddingVertical(5);
                            }
                        });

                        col.Item().PaddingTop(1, Unit.Centimetre).Text("3. Automated Analysis").FontSize(20).Bold().FontColor(Colors.Blue.Darken2);
                        
                        if (!string.IsNullOrEmpty(request.AnalysisText))
                        {
                            col.Item().PaddingTop(10).Text(request.AnalysisText).Justify();
                        }
                        else
                        {
                            col.Item().PaddingTop(10).Text("No analysis text provided.").Italic();
                        }
                    });

                    page.Footer()
                        .AlignCenter()
                        .Text(x =>
                        {
                            x.Span("Page ");
                            x.CurrentPageNumber();
                            x.Span(" | SaveFW.org");
                        });
                });
            });

            var stream = new MemoryStream();
            document.GeneratePdf(stream);
            stream.Position = 0;

            return File(stream, "application/pdf", $"SaveFW_Report_{DateTime.Now:yyyyMMdd}.pdf");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"PDF Generation Error: {ex}");
                return StatusCode(500, new { error = ex.Message, stack = ex.StackTrace });
            }
        }
    }

    public class ReportRequest
    {
        public string? MapImageBase64 { get; set; }
        public string? AnalysisText { get; set; }
        public Dictionary<string, string>? TableData { get; set; }
    }
}
