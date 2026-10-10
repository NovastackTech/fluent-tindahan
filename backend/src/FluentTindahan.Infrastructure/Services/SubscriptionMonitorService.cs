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

    public async Task<int> CheckAndDowngradeExpiredSubscriptionsAsync(CancellationToken cancellationToken = default)
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var now = DateTimeOffset.UtcNow;

        var expiredTenants = await db.Tenants
            .IgnoreQueryFilters()
            .Where(t => t.Tier != PlanTier.Libre &&
                        t.SubscriptionEndDate.HasValue &&
                        t.SubscriptionEndDate.Value < now)
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

        await db.SaveChangesAsync(cancellationToken);
        _logger.LogInformation("Successfully downgraded {Count} expired tenant subscriptions to Libre.", expiredTenants.Count);
        return expiredTenants.Count;
    }
}
