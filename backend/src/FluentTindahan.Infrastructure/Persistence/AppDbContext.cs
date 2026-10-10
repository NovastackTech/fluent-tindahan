using System.Linq.Expressions;
using Microsoft.EntityFrameworkCore;
using FluentTindahan.Application.Common.Interfaces;
using FluentTindahan.Domain.Common;
using FluentTindahan.Domain.Entities;
using FluentTindahan.Domain.Interfaces;

namespace FluentTindahan.Infrastructure.Persistence;

public class AppDbContext : DbContext, IApplicationDbContext
{
    private readonly ICurrentUserService _currentUserService;

    public AppDbContext(DbContextOptions<AppDbContext> options, ICurrentUserService currentUserService)
        : base(options)
    {
        _currentUserService = currentUserService;
    }

    public DbSet<Tenant> Tenants => Set<Tenant>();
    public DbSet<User> Users => Set<User>();
    public DbSet<Product> Products => Set<Product>();
    public DbSet<Customer> Customers => Set<Customer>();
    public DbSet<UtangLedger> UtangLedgers => Set<UtangLedger>();
    public DbSet<Sale> Sales => Set<Sale>();
    public DbSet<SaleItem> SaleItems => Set<SaleItem>();
    public DbSet<GCashTxn> GCashTransactions => Set<GCashTxn>();
    public DbSet<PaymentHistory> PaymentHistories => Set<PaymentHistory>();

    protected override void ConfigureConventions(ModelConfigurationBuilder configurationBuilder)
    {
        base.ConfigureConventions(configurationBuilder);
        configurationBuilder.Properties<DateTimeOffset>()
            .HaveConversion(typeof(DateTimeOffsetUtcConverter));
    }

    private class DateTimeOffsetUtcConverter : Microsoft.EntityFrameworkCore.Storage.ValueConversion.ValueConverter<DateTimeOffset, DateTimeOffset>
    {
        public DateTimeOffsetUtcConverter()
            : base(d => d.ToUniversalTime(), d => d.ToUniversalTime())
        {
        }
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // PostgreSQL extensions
        modelBuilder.HasPostgresExtension("uuid-ossp");
        modelBuilder.HasPostgresExtension("pgcrypto");

        // Tenant
        modelBuilder.Entity<Tenant>(builder =>
        {
            builder.ToTable("Tenants");
            builder.HasKey(t => t.Id);
            builder.Property(t => t.Id).HasDefaultValueSql("gen_random_uuid()");
            builder.Property(t => t.BusinessName).IsRequired().HasMaxLength(200);
            builder.Property(t => t.Tier).HasConversion<int>().IsRequired();
            builder.Property(t => t.SubscriptionEndDate);
            builder.Property(t => t.ExternalCustomerId).HasMaxLength(128);
        });

        // User
        modelBuilder.Entity<User>(builder =>
        {
            builder.ToTable("Users");
            builder.HasKey(u => u.Id);
            builder.Property(u => u.Id).HasDefaultValueSql("gen_random_uuid()");
            builder.Property(u => u.Phone).IsRequired().HasMaxLength(30);
            builder.Property(u => u.Role).IsRequired().HasMaxLength(50);
            builder.Property(u => u.FirebaseUid).HasMaxLength(128);

            builder.HasIndex(u => u.TenantId);
            builder.HasIndex(u => u.FirebaseUid);

            builder.HasOne(u => u.Tenant)
                .WithMany(t => t.Users)
                .HasForeignKey(u => u.TenantId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // Product
        modelBuilder.Entity<Product>(builder =>
        {
            builder.ToTable("Products");
            builder.HasKey(p => p.Id);
            builder.Property(p => p.Id).HasDefaultValueSql("gen_random_uuid()");
            builder.Property(p => p.Name).IsRequired().HasMaxLength(200);
            builder.Property(p => p.Price).HasPrecision(12, 2);
            builder.Property(p => p.Cost).HasPrecision(12, 2);
            builder.Property(p => p.Barcode).HasMaxLength(100);
            builder.Property(p => p.Category).HasMaxLength(100);

            builder.HasIndex(p => p.TenantId);
            builder.HasIndex(p => new { p.TenantId, p.Barcode });
            builder.HasIndex(p => new { p.TenantId, p.Name });

            builder.HasOne(p => p.Tenant)
                .WithMany(t => t.Products)
                .HasForeignKey(p => p.TenantId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // Customer
        modelBuilder.Entity<Customer>(builder =>
        {
            builder.ToTable("Customers");
            builder.HasKey(c => c.Id);
            builder.Property(c => c.Id).HasDefaultValueSql("gen_random_uuid()");
            builder.Property(c => c.Name).IsRequired().HasMaxLength(200);
            builder.Property(c => c.Phone).HasMaxLength(30);
            builder.Property(c => c.TotalUtangBalance).HasPrecision(12, 2);

            builder.HasIndex(c => c.TenantId);
            builder.HasIndex(c => new { c.TenantId, c.Phone });
            builder.HasIndex(c => new { c.TenantId, c.Name });

            builder.HasOne(c => c.Tenant)
                .WithMany(t => t.Customers)
                .HasForeignKey(c => c.TenantId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // UtangLedger
        modelBuilder.Entity<UtangLedger>(builder =>
        {
            builder.ToTable("UtangLedgers");
            builder.HasKey(u => u.Id);
            builder.Property(u => u.Id).HasDefaultValueSql("gen_random_uuid()");
            builder.Property(u => u.Amount).HasPrecision(12, 2);
            builder.Property(u => u.Type).IsRequired().HasMaxLength(30);
            builder.Property(u => u.Notes).HasMaxLength(500);

            builder.HasIndex(u => u.TenantId);
            builder.HasIndex(u => new { u.TenantId, u.CustomerId });
            builder.HasIndex(u => new { u.TenantId, u.Date });

            builder.HasOne(u => u.Tenant)
                .WithMany(t => t.UtangLedgers)
                .HasForeignKey(u => u.TenantId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasOne(u => u.Customer)
                .WithMany(c => c.UtangLedgers)
                .HasForeignKey(u => u.CustomerId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasOne(u => u.RefSale)
                .WithMany()
                .HasForeignKey(u => u.RefSaleId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        // Sale
        modelBuilder.Entity<Sale>(builder =>
        {
            builder.ToTable("Sales");
            builder.HasKey(s => s.Id);
            builder.Property(s => s.Id).HasDefaultValueSql("gen_random_uuid()");
            builder.Property(s => s.TotalAmount).HasPrecision(12, 2);
            builder.Property(s => s.PaymentMethod).IsRequired().HasMaxLength(50);
            builder.Property(s => s.CashReceived).HasPrecision(12, 2);
            builder.Property(s => s.ChangeGiven).HasPrecision(12, 2);

            builder.HasIndex(s => s.TenantId);
            builder.HasIndex(s => new { s.TenantId, s.Date });

            builder.HasOne(s => s.Tenant)
                .WithMany(t => t.Sales)
                .HasForeignKey(s => s.TenantId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasOne(s => s.Customer)
                .WithMany()
                .HasForeignKey(s => s.CustomerId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        // SaleItem
        modelBuilder.Entity<SaleItem>(builder =>
        {
            builder.ToTable("SaleItems");
            builder.HasKey(i => i.Id);
            builder.Property(i => i.Id).HasDefaultValueSql("gen_random_uuid()");
            builder.Property(i => i.UnitPrice).HasPrecision(12, 2);
            builder.Property(i => i.Subtotal).HasPrecision(12, 2);

            builder.HasIndex(i => i.TenantId);
            builder.HasIndex(i => new { i.TenantId, i.SaleId });

            builder.HasOne(i => i.Sale)
                .WithMany(s => s.Items)
                .HasForeignKey(i => i.SaleId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasOne(i => i.Product)
                .WithMany()
                .HasForeignKey(i => i.ProductId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        // GCashTxn
        modelBuilder.Entity<GCashTxn>(builder =>
        {
            builder.ToTable("GCashTransactions");
            builder.HasKey(g => g.Id);
            builder.Property(g => g.Id).HasDefaultValueSql("gen_random_uuid()");
            builder.Property(g => g.Type).IsRequired().HasMaxLength(30);
            builder.Property(g => g.Amount).HasPrecision(12, 2);
            builder.Property(g => g.Fee).HasPrecision(12, 2);
            builder.Property(g => g.RefNo).IsRequired().HasMaxLength(100);
            builder.Property(g => g.CustomerPhone).HasMaxLength(30);
            builder.Property(g => g.Notes).HasMaxLength(500);

            builder.HasIndex(g => g.TenantId);
            builder.HasIndex(g => new { g.TenantId, g.Date });
            builder.HasIndex(g => new { g.TenantId, g.RefNo });

            builder.HasOne(g => g.Tenant)
                .WithMany(t => t.GCashTransactions)
                .HasForeignKey(g => g.TenantId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // PaymentHistory
        modelBuilder.Entity<PaymentHistory>(builder =>
        {
            builder.ToTable("PaymentHistories");
            builder.HasKey(p => p.Id);
            builder.Property(p => p.Id).HasDefaultValueSql("gen_random_uuid()");
            builder.Property(p => p.AmountCentavos).IsRequired();
            builder.Property(p => p.Currency).IsRequired().HasMaxLength(10);
            builder.Property(p => p.TierPurchased).HasConversion<int>().IsRequired();
            builder.Property(p => p.BillingCycle).HasConversion<int>().IsRequired();
            builder.Property(p => p.GatewayReferenceId).IsRequired().HasMaxLength(150);
            builder.Property(p => p.Status).IsRequired().HasMaxLength(50);
            builder.Property(p => p.PaymentMethod).HasMaxLength(50);

            builder.HasIndex(p => p.TenantId);
            builder.HasIndex(p => new { p.TenantId, p.CreatedAt });
            // Unique: PayMongo retries webhooks; a duplicate payment id must never extend a subscription twice.
            builder.HasIndex(p => p.GatewayReferenceId).IsUnique();

            builder.HasOne(p => p.Tenant)
                .WithMany(t => t.PaymentHistories)
                .HasForeignKey(p => p.TenantId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // Global Query Filters for multi-tenancy isolation
        ConfigureTenantFilter<User>(modelBuilder);
        ConfigureTenantFilter<Product>(modelBuilder);
        ConfigureTenantFilter<Customer>(modelBuilder);
        ConfigureTenantFilter<UtangLedger>(modelBuilder);
        ConfigureTenantFilter<Sale>(modelBuilder);
        ConfigureTenantFilter<SaleItem>(modelBuilder);
        ConfigureTenantFilter<GCashTxn>(modelBuilder);
        ConfigureTenantFilter<PaymentHistory>(modelBuilder);
    }

    private void ConfigureTenantFilter<TEntity>(ModelBuilder modelBuilder) where TEntity : class, IMustHaveTenant
    {
        modelBuilder.Entity<TEntity>().HasQueryFilter(e => e.TenantId == _currentUserService.TenantId);
    }

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        // Enforce TenantId on all added IMustHaveTenant entities if not already set
        foreach (var entry in ChangeTracker.Entries<IMustHaveTenant>())
        {
            if (entry.State == EntityState.Added && entry.Entity.TenantId == Guid.Empty)
            {
                entry.Entity.TenantId = _currentUserService.TenantId;
            }
        }

        return base.SaveChangesAsync(cancellationToken);
    }
}
