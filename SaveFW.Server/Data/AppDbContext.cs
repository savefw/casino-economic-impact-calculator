using Microsoft.EntityFrameworkCore;
using SaveFW.Shared;

namespace SaveFW.Server.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
    {
    }

    public DbSet<ImpactFact> ImpactFacts => Set<ImpactFact>();
    public DbSet<Legislator> Legislators => Set<Legislator>();
    
    public DbSet<SaveFW.Server.Data.Entities.County> Counties => Set<SaveFW.Server.Data.Entities.County>();
    public DbSet<SaveFW.Server.Data.Entities.BlockGroup> BlockGroups => Set<SaveFW.Server.Data.Entities.BlockGroup>();
    public DbSet<SaveFW.Server.Data.Entities.IsochroneCache> IsochroneCache => Set<SaveFW.Server.Data.Entities.IsochroneCache>();
    public DbSet<SaveFW.Server.Data.Entities.SiteScore> SiteScores => Set<SaveFW.Server.Data.Entities.SiteScore>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        
        // PostGIS GIST Indexes
        modelBuilder.Entity<SaveFW.Server.Data.Entities.County>()
            .HasIndex(c => c.Geom)
            .HasMethod("gist");

        modelBuilder.Entity<SaveFW.Server.Data.Entities.BlockGroup>()
            .HasIndex(b => b.Geom)
            .HasMethod("gist");
        modelBuilder.Entity<SaveFW.Server.Data.Entities.BlockGroup>()
            .HasIndex(b => b.CountyFips);

        modelBuilder.Entity<SaveFW.Server.Data.Entities.IsochroneCache>()
            .HasIndex(i => i.Geom)
            .HasMethod("gist");
            
        // Unique constraint approximation (application should round before query)
        modelBuilder.Entity<SaveFW.Server.Data.Entities.IsochroneCache>()
            .HasIndex(i => new { i.Lat, i.Lon, i.Minutes, i.SourceHash });
    }
