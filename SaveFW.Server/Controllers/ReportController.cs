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
                
                var brandColor = Color.FromHex("#0f172a");
            
                var document = Document.Create(container =>
                {
                    container.Page(page =>
                    {
                        page.Size(PageSizes.A4);
                        page.Margin(2, Unit.Centimetre);
                        page.PageColor(Colors.White);
                        page.DefaultTextStyle(x => x.FontSize(10));

                        // 1. Cover Page
                        page.Content().Column(col =>
                        {
                            col.Spacing(20);
                            
                            col.Item().PaddingTop(2, Unit.Centimetre).AlignCenter().Text("Net Economic Impact Analysis").FontSize(28).Bold().FontColor(brandColor);
                            col.Item().AlignCenter().Text("Fort Wayne Casino Proposal").FontSize(18).SemiBold().FontColor(Colors.Grey.Darken1);
                            
                            if (logoBytes != null)
                            {
                                col.Item().Height(6, Unit.Centimetre).AlignCenter().Image(logoBytes).FitArea();
                            }
                            
                            col.Item().PaddingTop(4, Unit.Centimetre).AlignCenter().Column(c => 
                            {
                                 c.Item().Text($"Date: {DateTime.Now:MMMM d, yyyy}").FontSize(14);
                                 c.Item().Text("Prepared by: SaveFW Analytics").FontSize(14).Bold();
                            });
                            
                            col.Item().PageBreak();

                            // 2. Table of Contents
                            col.Item().Text("Table of Contents").FontSize(24).Bold().FontColor(brandColor);
                            col.Item().PaddingTop(1, Unit.Centimetre).Column(toc => 
                            {
                                 toc.Spacing(10);
                                 toc.Item().Row(row => { row.RelativeItem().Text("1. Geographic Impact Map").FontSize(14); row.AutoItem().Text("3").FontSize(14); });
                                 toc.Item().Row(row => { row.RelativeItem().Text("2. Net Economic Impact Table").FontSize(14); row.AutoItem().Text("4").FontSize(14); });
                                 toc.Item().Row(row => { row.RelativeItem().Text("3. Detailed Cost Breakdown").FontSize(14); row.AutoItem().Text("5").FontSize(14); });
                                 toc.Item().Row(row => { row.RelativeItem().Text("4. Automated Analysis").FontSize(14); row.AutoItem().Text("6").FontSize(14); });
                            });
                            
                            col.Item().PageBreak();

                            // 3. Map Page
                            col.Item().Text("1. Geographic Impact Map").FontSize(20).Bold().FontColor(brandColor);
                            
                            if (!string.IsNullOrEmpty(request.MapImageBase64))
                            {
                                try 
                                {
                                    var base64Data = request.MapImageBase64;
                                    if (base64Data.Contains(",")) base64Data = base64Data.Substring(base64Data.IndexOf(",") + 1);
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

                            // 4. Net Economic Impact Table
                            col.Item().Text("2. Net Economic Impact Table").FontSize(20).Bold().FontColor(brandColor);
                            
                            if (request.MainTable != null && request.MainTable.Rows != null && request.MainTable.Rows.Count > 0)
                            {
                                col.Item().PaddingTop(10).Table(table =>
                                {
                                    var colCount = request.MainTable.Headers?.Count ?? request.MainTable.Rows[0].Count;
                                    table.ColumnsDefinition(columns =>
                                    {
                                        // First column wider (Labels)
                                        columns.RelativeColumn(2.5f);
                                        for(int i=1; i < colCount; i++) columns.RelativeColumn();
                                    });

                                    // Header
                                    if (request.MainTable.Headers != null)
                                    {
                                        table.Header(header =>
                                        {
                                            foreach (var h in request.MainTable.Headers)
                                            {
                                                header.Cell().Element(HeaderCellStyle).Text(h);
                                            }
                                        });
                                    }

                                    // Rows
                                    foreach (var row in request.MainTable.Rows)
                                    {
                                        foreach (var cell in row)
                                        {
                                            // Detect row type by content? Or just style generally.
                                            // The UI uses bold for Totals/Subtotals. 
                                            // We can check if the first cell starts with "Subtotal" or "Total".
                                            bool isTotal = row[0].Contains("Total", StringComparison.OrdinalIgnoreCase) || row[0].Contains("Subtotal", StringComparison.OrdinalIgnoreCase);
                                            
                                            table.Cell().Element(c => CellStyle(c, isTotal)).Text(cell);
                                        }
                                    }
                                });
                            }
                            else
                            {
                                col.Item().Text("No table data available.");
                            }

                            col.Item().PageBreak();

                            // 5. Detailed Breakdown (Supplementary)
                            col.Item().Text("3. Detailed Cost Breakdown").FontSize(20).Bold().FontColor(brandColor);
                            col.Item().Text("Supplementary analysis of social costs per problem gambler.").FontSize(10).Italic().FontColor(Colors.Grey.Medium);

                            // Subject County
                            col.Item().PaddingTop(10).Text("Subject County Analysis").FontSize(14).Bold().FontColor(Colors.Grey.Darken3);
                            RenderBreakdownTable(col, request.BreakdownTable);

                            // Other Counties
                            col.Item().PaddingTop(15).Text("Other Counties Analysis (Regional Spillover)").FontSize(14).Bold().FontColor(Colors.Grey.Darken3);
                            RenderBreakdownTable(col, request.BreakdownOtherTable);

                            col.Item().PageBreak();

                            // 6. Analysis Text
                            col.Item().Text("4. Automated Analysis").FontSize(20).Bold().FontColor(brandColor);
                            
                            if (!string.IsNullOrEmpty(request.AnalysisText))
                            {
                                col.Item().PaddingTop(10).Text(request.AnalysisText).Justify();
                            }
                        });

                        page.Footer()
                            .Row(row => {
                                if (logoBytes != null)
                                {
                                    row.RelativeItem().AlignLeft().Height(0.8f, Unit.Centimetre).Image(logoBytes).FitArea();
                                }
                                else
                                {
                                     row.RelativeItem().AlignLeft().Text("SaveFW.org").FontSize(10).FontColor(Colors.Grey.Medium);
                                }
                                
                                row.RelativeItem().AlignRight().Text(x =>
                                {
                                    x.Span("Page ");
                                    x.CurrentPageNumber();
                                    x.Span(" of ");
                                    x.TotalPages();
                                });
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

        private void RenderBreakdownTable(ColumnDescriptor col, List<List<string>>? data)
        {
            if (data == null || data.Count == 0)
            {
                col.Item().Text("No data available.");
                return;
            }

            col.Item().PaddingTop(5).Table(table =>
            {
                table.ColumnsDefinition(columns =>
                {
                    columns.RelativeColumn(2); // Category
                    columns.RelativeColumn();  // Victims
                    columns.RelativeColumn();  // Cost Per
                    columns.RelativeColumn();  // Total
                });

                table.Header(header =>
                {
                    header.Cell().Element(HeaderCellStyle).Text("Category");
                    header.Cell().Element(HeaderCellStyle).AlignRight().Text("Victims");
                    header.Cell().Element(HeaderCellStyle).AlignRight().Text("Cost Per Victim");
                    header.Cell().Element(HeaderCellStyle).AlignRight().Text("Total Cost");
                });

                foreach (var row in data)
                {
                    if (row.Count < 4) continue;
                    bool isTotal = row[0].Contains("Total", StringComparison.OrdinalIgnoreCase);

                    table.Cell().Element(c => CellStyle(c, isTotal)).Text(row[0]);
                    table.Cell().Element(c => CellStyle(c, isTotal)).AlignRight().Text(row[1]);
                    table.Cell().Element(c => CellStyle(c, isTotal)).AlignRight().Text(row[2]);
                    table.Cell().Element(c => CellStyle(c, isTotal)).AlignRight().Text(row[3]);
                }
            });
        }

        static IContainer HeaderCellStyle(IContainer container)
        {
            return container.DefaultTextStyle(x => x.SemiBold()).PaddingVertical(5).BorderBottom(1).BorderColor(Colors.Black);
        }

        static IContainer CellStyle(IContainer container, bool isTotal = false)
        {
            return container.BorderBottom(1).BorderColor(Colors.Grey.Lighten2).PaddingVertical(5).DefaultTextStyle(x => isTotal ? x.Bold() : x);
        }
    }

    public class ReportRequest
    {
        public string? MapImageBase64 { get; set; }
        public string? AnalysisText { get; set; }
        public TableData? MainTable { get; set; }
        public List<List<string>>? BreakdownTable { get; set; }
        public List<List<string>>? BreakdownOtherTable { get; set; }
    }

    public class TableData
    {
        public List<string>? Headers { get; set; }
        public List<List<string>>? Rows { get; set; }
    }
}
