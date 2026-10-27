using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Configuration;
using FluentTindahan.Domain.Enums;
using FluentTindahan.Infrastructure.Persistence;

namespace FluentTindahan.Infrastructure.Services;

public class SubscriptionMonitorService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IConfiguration _configuration;
    private readonly ILogger<SubscriptionMonitorService> _logger;
    private readonly TimeSpan _checkInterval;

    public SubscriptionMonitorService(
        IServiceScopeFactory scopeFactory,
        IConfiguration configuration,
        ILogger<SubscriptionMonitorService> logger)
    {
        _scopeFactory = scopeFactory;
        _configuration = configuration;
        _logger = logger;

        var intervalMinutes = _configuration.GetValue<int>("SubscriptionMonitor:IntervalMinutes", 60);
        _checkInterval = TimeSpan.FromMinutes(Math.Max(1, intervalMinutes));
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("SubscriptionMonitorService started. Checking every {Interval}.", _checkInterval);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await CheckAndDowngradeExpiredSubscriptionsAsync(stoppingToken);
                await ProcessExpiredAccountDeletionsAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Unexpected error occurred during subscription expiration monitoring.");
            }

            try
            {
                await Task.Delay(_checkInterval, stoppingToken);
            }
            catch (OperationCanceledException)
            {
                break;
            }
        }

        _logger.LogInformation("SubscriptionMonitorService stopping.");
    }

    public async Task<int> ProcessExpiredAccountDeletionsAsync(CancellationToken cancellationToken = default)
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var now = DateTimeOffset.UtcNow;

        var expiredUsers = await db.Users
            .IgnoreQueryFilters()
            .Include(u => u.Tenant)
            .Where(u => u.AccountStatus == Domain.Entities.User.StatusPendingDeletion &&
                        u.DeletionScheduledAt.HasValue &&
                        u.DeletionScheduledAt.Value <= now)
            .ToListAsync(cancellationToken);

        if (expiredUsers.Count == 0)
        {
            return 0;
        }

        foreach (var user in expiredUsers)
        {
            await AccountDeletionHelper.AnonymizeUserAndTenantAsync(db, user, user.Tenant, now, cancellationToken);
        }

        await db.SaveChangesAsync(cancellationToken);
        _logger.LogInformation("Anonymized {Count} accounts whose 30-day deletion grace period expired.", expiredUsers.Count);
        return expiredUsers.Count;
    }

    public async Task<int> CheckAndDowngradeExpiredSubscriptionsAsync(CancellationToken cancellationToken = default)
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var now = DateTimeOffset.UtcNow;

        if (db.Database.IsNpgsql())
        {
            // Atomically downgrade expired subscriptions in a single SQL UPDATE without loading tracked entities
            // into memory. The WHERE clause ensures that if a webhook renewed SubscriptionEndDate concurrently,
            // the row won't match and will NOT be downgraded.
            var downgradedCount = await db.Tenants
                .IgnoreQueryFilters()
                .Where(t => t.Tier != PlanTier.Libre &&
                            t.SubscriptionEndDate.HasValue &&
                            t.SubscriptionEndDate.Value <= now)
                .ExecuteUpdateAsync(s => s.SetProperty(t => t.Tier, PlanTier.Libre), cancellationToken);

            if (downgradedCount > 0)
            {
                _logger.LogInformation("Successfully downgraded {Count} expired tenant subscriptions to Libre.", downgradedCount);
            }
            return downgradedCount;
        }

        // In-memory fallback for unit testing
        var expiredTenants = await db.Tenants
            .IgnoreQueryFilters()
            .Where(t => t.Tier != PlanTier.Libre &&
                        t.SubscriptionEndDate.HasValue &&
                        t.SubscriptionEndDate.Value <= now)
            .ToListAsync(cancellationToken);

        if (expiredTenants.Count == 0)
        {
            return 0;
        }

        foreach (var tenant in expiredTenants)
        {
            _logger.LogInformation("Subscription expired for tenant {TenantId} ({BusinessName}). Downgrading from {PreviousTier} to Libre.",
                tenant.Id, tenant.BusinessName, tenant.Tier);

            tenant.Tier = PlanTier.Libre;
        }

        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            _logger.LogInformation("Concurrency conflict detected while downgrading subscriptions; leaving concurrent update intact.");
            return 0;
        }

        _logger.LogInformation("Successfully downgraded {Count} expired tenant subscriptions to Libre.", expiredTenants.Count);
        return expiredTenants.Count;
    }
}
