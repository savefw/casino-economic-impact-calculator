using Microsoft.EntityFrameworkCore;
using SaveFW.Shared;
using System.Text.Json;

namespace SaveFW.Server.Data;

public static class DbInitializer
{
    public static async Task Seed(AppDbContext db)
    {
        // 1. Ensure database is created
        await db.Database.EnsureCreatedAsync();

        // 2. Seed Impact Facts
        if (!await db.ImpactFacts.AnyAsync())
        {
            var csvPath = Path.Combine(Directory.GetCurrentDirectory(), "../../static_html_to_convert/sources.csv");
            if (File.Exists(csvPath))
            {
                var lines = await File.ReadAllLinesAsync(csvPath);
                var impacts = new List<ImpactFact>();

                // Simple CSV parsing (Category, Description, SourceUrl)
                for (int i = 1; i < lines.Length; i++)
                {
                    var line = lines[i];
                    if (string.IsNullOrWhiteSpace(line)) continue;

                    // Handling commas inside quotes is tricky with simple split, 
                    // but for this specific file we know the structure.
                    // Let's use a slightly more robust split
                    var parts = ParseCsvLine(line);
                    if (parts.Count >= 2)
                    {
                        impacts.Add(new ImpactFact
                        {
                            Category = parts[0].Trim(),
                            Description = parts[1].Trim().Trim('"'),
                            SourceUrl = parts.Count > 2 ? parts[2].Trim().Trim('"') : null
                        });
                    }
                }
                await db.ImpactFacts.AddRangeAsync(impacts);
            }
        }

        // 3. Seed Legislators
        if (!await db.Legislators.AnyAsync())
        {
            var jsonPath = Path.Combine(Directory.GetCurrentDirectory(), "../../static_html_to_convert/data/legislators.json");
            if (File.Exists(jsonPath))
            {
                var json = await File.ReadAllTextAsync(jsonPath);
                using var document = JsonDocument.Parse(json);
                var root = document.RootElement;
                var legislators = new List<Legislator>();

                // City Council
                if (root.TryGetProperty("city_council", out var cityCouncil))
                {
                    foreach (var prop in cityCouncil.EnumerateObject())
                    {
                        if (prop.Name == "at_large")
                        {
                            foreach (var person in prop.Value.EnumerateArray())
                            {
                                legislators.Add(new Legislator
                                {
                                    Name = person.GetProperty("name").GetString() ?? "",
                                    Email = person.GetProperty("email").GetString() ?? "",
                                    Type = "City Council",
                                    District = "At Large"
                                });
                            }
                        }
                        else
                        {
                            legislators.Add(new Legislator
                            {
                                Name = prop.Value.GetProperty("name").GetString() ?? "",
                                Email = prop.Value.GetProperty("email").GetString() ?? "",
                                Type = "City Council",
                                District = prop.Name
                            });
                        }
                    }
                }

                // State House
                if (root.TryGetProperty("state_house", out var stateHouse))
                {
                    foreach (var prop in stateHouse.EnumerateObject())
                    {
                        legislators.Add(new Legislator
                        {
                            Name = prop.Value.GetProperty("name").GetString() ?? "",
                            Email = prop.Value.GetProperty("email").GetString() ?? "",
                            Party = prop.Value.TryGetProperty("party", out var p) ? p.GetString() : null,
                            Type = "State House",
                            District = prop.Name
                        });
                    }
                }

                await db.Legislators.AddRangeAsync(legislators);
            }
        }

        await db.SaveChangesAsync();
    }

    private static List<string> ParseCsvLine(string line)
    {
        var result = new List<string>();
        bool inQuotes = false;
        var current = new System.Text.StringBuilder();

        for (int i = 0; i < line.Length; i++)
        {
            char c = line[i];
            if (c == '"')
            {
                inQuotes = !inQuotes;
            }
            else if (c == ',' && !inQuotes)
            {
                result.Add(current.ToString());
                current.Clear();
            }
            else
            {
                current.Append(c);
            }
        }
        result.Add(current.ToString());
        return result;
    }
}
