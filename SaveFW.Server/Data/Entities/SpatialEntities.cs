using NetTopologySuite.Geometries;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SaveFW.Server.Data.Entities;

[Table("counties")]
public class County
{
    [Key]
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string StateFips { get; set; } = string.Empty;
    public string CountyFips { get; set; } = string.Empty;
    
    [Column(TypeName = "geometry(MultiPolygon, 4326)")]
    public MultiPolygon Geom { get; set; } = null!;
}

[Table("block_groups")]
public class BlockGroup
{
    [Key]
    public string GeoId { get; set; } = string.Empty;
    public string CountyFips { get; set; } = string.Empty;
    public int Population { get; set; }
    public int? MedianIncome { get; set; }

    [Column(TypeName = "geometry(MultiPolygon, 4326)")]
    public MultiPolygon Geom { get; set; } = null!;
}

[Table("isochrone_cache")]
public class IsochroneCache
{
    [Key]
    public long Id { get; set; }
    public double Lat { get; set; }
    public double Lon { get; set; }
    public int Minutes { get; set; }
    public DateTime CreatedAt { get; set; }
    public string? SourceHash { get; set; }

    [Column(TypeName = "geometry(MultiPolygon, 4326)")]
    public MultiPolygon Geom { get; set; } = null!;
}

[Table("site_scores")]
public class SiteScore
{
    [Key]
    public long Id { get; set; }
    public int CountyId { get; set; }
    public double Lat { get; set; }
    public double Lon { get; set; }
    public int Minutes { get; set; }
    public double PopEst { get; set; }
    public double? IncomeEst { get; set; }
    public double Score { get; set; }
    public DateTime ComputedAt { get; set; }
    public string? SourceHash { get; set; }
}
