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

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        // Additional configuration if needed
    }
}
