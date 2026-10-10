using System.Text.Json;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using FluentTindahan.Application.Common.Interfaces;
using FluentTindahan.Domain.Entities;
using FluentTindahan.Domain.Enums;
using FluentTindahan.Domain.Interfaces;

namespace FluentTindahan.Application.Billing;

public record CheckoutSessionResponseDto(
    string CheckoutUrl,
    string SessionId,
    string ReferenceNumber,
    decimal Amount,
    string Currency,
    PlanTier Tier,
    BillingCycle Cycle
);

public record WebhookProcessResultDto(
    bool Success,
    string Message,
    Guid? TenantId,
    PlanTier? Tier,
    DateTimeOffset? NewEndDate
);

public record TenantSubscriptionDto(
    Guid TenantId,
    string BusinessName,
    PlanTier Tier,
    string TierName,
    bool IsActive,
    DateTimeOffset? SubscriptionEndDate,
    int? DaysRemaining,
    // Tier Limit Caps
    int MaxProducts,
    int MaxCustomers,
    int MaxGCashTransactionsPerMonth,
    int MaxUsers,
    int MaxDevices,
    bool CanImportCsv,
    bool HasWatermarkedReceipts,
    bool HasProfitAnalytics,
    bool HasAuditLogs,
    // Current Usage Counts
    int CurrentProductCount,
    int CurrentCustomerCount,
    int CurrentGCashTransactionsThisMonth
);

public record PaymentHistoryDto(
    Guid Id,
    Guid TenantId,
    decimal Amount,
    string Currency,
    PlanTier TierPurchased,
    string TierName,
    BillingCycle BillingCycle,
    string GatewayReferenceId,
    string Status,
    string PaymentMethod,
    DateTimeOffset CreatedAt
);

// -------------------------------------------------------------
// Commands & Handlers
// -------------------------------------------------------------

public record CreateCheckoutSessionCommand(
    PlanTier TargetTier,
    BillingCycle Cycle = BillingCycle.Monthly,
    string? SuccessUrl = null,
    string? CancelUrl = null
) : IRequest<CheckoutSessionResponseDto>;

public class CreateCheckoutSessionCommandHandler : IRequestHandler<CreateCheckoutSessionCommand, CheckoutSessionResponseDto>
{
    private readonly IPaymentGatewayService _gatewayService;
    private readonly ICurrentUserService _currentUserService;

    public CreateCheckoutSessionCommandHandler(
        IPaymentGatewayService gatewayService,
        ICurrentUserService currentUserService)
    {
        _gatewayService = gatewayService;
        _currentUserService = currentUserService;
    }

    public async Task<CheckoutSessionResponseDto> Handle(CreateCheckoutSessionCommand request, CancellationToken cancellationToken)
    {
        if (request.TargetTier == PlanTier.Libre)
        {
            throw new InvalidOperationException("Cannot initiate checkout session for the free Libre plan.");
        }

        var tenantId = _currentUserService.TenantId;
        var successUrl = request.SuccessUrl ?? "http://localhost:5173/?billing=success";
        var cancelUrl = request.CancelUrl ?? "http://localhost:5173/?billing=cancel";

        var sessionResult = await _gatewayService.CreateCheckoutSessionAsync(
            tenantId,
            request.TargetTier,
            request.Cycle,
            successUrl,
            cancelUrl,
            cancellationToken);

        return new CheckoutSessionResponseDto(
            sessionResult.CheckoutUrl,
            sessionResult.SessionId,
            sessionResult.ReferenceNumber,
            sessionResult.Amount,
            sessionResult.Currency,
            sessionResult.Tier,
            sessionResult.Cycle
        );
    }
}

public record ProcessPaymentWebhookCommand(
    string JsonPayload,
    string? SignatureHeader
) : IRequest<WebhookProcessResultDto>;

public class ProcessPaymentWebhookCommandHandler : IRequestHandler<ProcessPaymentWebhookCommand, WebhookProcessResultDto>
{
    private readonly IApplicationDbContext _context;
    private readonly IPaymentGatewayService _gatewayService;
    private readonly ILogger<ProcessPaymentWebhookCommandHandler> _logger;

    public ProcessPaymentWebhookCommandHandler(
        IApplicationDbContext context,
        IPaymentGatewayService gatewayService,
        ILogger<ProcessPaymentWebhookCommandHandler> logger)
    {
        _context = context;
        _gatewayService = gatewayService;
        _logger = logger;
    }

    public async Task<WebhookProcessResultDto> Handle(ProcessPaymentWebhookCommand request, CancellationToken cancellationToken)
    {
        // Signature validation
        if (!_gatewayService.VerifyWebhookSignature(request.JsonPayload, request.SignatureHeader ?? string.Empty))
        {
            _logger.LogWarning("Webhook signature verification failed.");
            return new WebhookProcessResultDto(false, "Invalid webhook signature.", null, null, null);
        }

        Guid? parsedTenantId = null;
        PlanTier targetTier = PlanTier.TindahanPro;
        BillingCycle cycle = BillingCycle.Monthly;
        decimal amount = 129.00m;
        string referenceNumber = $"wh_{DateTimeOffset.UtcNow.ToUnixTimeSeconds()}";
        string paymentMethod = "paymongo";

        try
        {
            using var doc = JsonDocument.Parse(request.JsonPayload);
            var root = doc.RootElement;

            // 1. Check PayMongo Standard Event format
            if (root.TryGetProperty("data", out var dataElem) &&
                dataElem.TryGetProperty("attributes", out var attrElem))
            {
                var eventType = attrElem.TryGetProperty("type", out var typeElem) ? typeElem.GetString() : null;

                if (attrElem.TryGetProperty("data", out var innerData) &&
                    innerData.TryGetProperty("attributes", out var innerAttr))
                {
                    if (innerAttr.TryGetProperty("reference_number", out var refProp))
                    {
                        referenceNumber = refProp.GetString() ?? referenceNumber;
                    }

                    if (innerAttr.TryGetProperty("metadata", out var metaElem))
                    {
                        if (metaElem.TryGetProperty("tenant_id", out var tIdElem) &&
                            Guid.TryParse(tIdElem.GetString(), out var tId))
                        {
                            parsedTenantId = tId;
                        }

                        if (metaElem.TryGetProperty("tier", out var tierElem) &&
                            Enum.TryParse<PlanTier>(tierElem.GetString(), true, out var t))
                        {
                            targetTier = t;
                        }

                        if (metaElem.TryGetProperty("cycle", out var cycleElem) &&
                            Enum.TryParse<BillingCycle>(cycleElem.GetString(), true, out var c))
                        {
                            cycle = c;
                        }
                    }

                    if (innerAttr.TryGetProperty("payments", out var paymentsElem) &&
                        paymentsElem.ValueKind == JsonValueKind.Array &&
                        paymentsElem.GetArrayLength() > 0)
                    {
                        var firstPayment = paymentsElem[0];
                        if (firstPayment.TryGetProperty("attributes", out var payAttr))
                        {
                            if (payAttr.TryGetProperty("amount", out var amountElem))
                            {
                                amount = amountElem.GetInt64() / 100m;
                            }
                            if (payAttr.TryGetProperty("source", out var sourceElem) &&
                                sourceElem.TryGetProperty("type", out var srcType))
                            {
                                paymentMethod = srcType.GetString() ?? paymentMethod;
                            }
                        }
                    }
                }
            }
            // 2. Direct JSON format (useful for tests and manual webhooks)
            else
            {
                if (root.TryGetProperty("tenant_id", out var tProp) &&
                    Guid.TryParse(tProp.GetString(), out var directTenantId))
                {
                    parsedTenantId = directTenantId;
                }

                if (root.TryGetProperty("tier", out var tierProp) &&
                    Enum.TryParse<PlanTier>(tierProp.GetString(), true, out var directTier))
                {
                    targetTier = directTier;
                }

                if (root.TryGetProperty("cycle", out var cycleProp) &&
                    Enum.TryParse<BillingCycle>(cycleProp.GetString(), true, out var directCycle))
                {
                    cycle = directCycle;
                }

                if (root.TryGetProperty("amount", out var amountProp))
                {
                    amount = amountProp.GetDecimal();
                }

                if (root.TryGetProperty("reference_id", out var refProp))
                {
                    referenceNumber = refProp.GetString() ?? referenceNumber;
                }
            }

            if (!parsedTenantId.HasValue)
            {
                return new WebhookProcessResultDto(false, "Missing or invalid tenant_id in payload.", null, null, null);
            }

            // Find tenant in database
            var tenant = await _context.Tenants
                .IgnoreQueryFilters()
                .FirstOrDefaultAsync(t => t.Id == parsedTenantId.Value, cancellationToken);

            if (tenant == null)
            {
                _logger.LogWarning("Webhook received for unknown tenant {TenantId}", parsedTenantId.Value);
                return new WebhookProcessResultDto(false, $"Tenant {parsedTenantId.Value} not found.", parsedTenantId, null, null);
            }

            // Calculate duration: 7 days for weekly pass, 30 days for monthly
            var duration = cycle == BillingCycle.Weekly ? TimeSpan.FromDays(7) : TimeSpan.FromDays(30);

            var now = DateTimeOffset.UtcNow;
            var newEndDate = (tenant.SubscriptionEndDate.HasValue && tenant.SubscriptionEndDate.Value > now)
                ? tenant.SubscriptionEndDate.Value.Add(duration)
                : now.Add(duration);

            tenant.Tier = targetTier;
            tenant.SubscriptionEndDate = newEndDate;

            // Log Payment History
            var paymentHistory = new PaymentHistory
            {
                Id = Guid.NewGuid(),
                TenantId = tenant.Id,
                Amount = amount,
                Currency = "PHP",
                TierPurchased = targetTier,
                BillingCycle = cycle,
                GatewayReferenceId = referenceNumber,
                PaymentMethod = paymentMethod,
                Status = "Paid",
                CreatedAt = now
            };

            _context.PaymentHistories.Add(paymentHistory);
            await _context.SaveChangesAsync(cancellationToken);

            _logger.LogInformation("Tenant {TenantId} successfully upgraded to {Tier}. New expiration: {EndDate}",
                tenant.Id, targetTier, newEndDate);

            return new WebhookProcessResultDto(
                Success: true,
                Message: "Payment processed and subscription updated.",
                TenantId: tenant.Id,
                Tier: targetTier,
                NewEndDate: newEndDate
            );
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to parse and process billing webhook.");
            return new WebhookProcessResultDto(false, $"Webhook processing error: {ex.Message}", null, null, null);
        }
    }
}

// -------------------------------------------------------------
// Queries & Handlers
// -------------------------------------------------------------

public record GetTenantSubscriptionQuery : IRequest<TenantSubscriptionDto>;

public class GetTenantSubscriptionQueryHandler : IRequestHandler<GetTenantSubscriptionQuery, TenantSubscriptionDto>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserService _currentUserService;

    public GetTenantSubscriptionQueryHandler(
        IApplicationDbContext context,
        ICurrentUserService currentUserService)
    {
        _context = context;
        _currentUserService = currentUserService;
    }

    public async Task<TenantSubscriptionDto> Handle(GetTenantSubscriptionQuery request, CancellationToken cancellationToken)
    {
        var tenantId = _currentUserService.TenantId;
        var tenant = await _context.Tenants
            .AsNoTracking()
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(t => t.Id == tenantId, cancellationToken);

        var now = DateTimeOffset.UtcNow;

        var rawTier = tenant?.Tier ?? PlanTier.Libre;
        var endDate = tenant?.SubscriptionEndDate;

        // If tier is paid but subscriptionEndDate has passed, effective tier is Libre
        var isExpired = rawTier != PlanTier.Libre && endDate.HasValue && endDate.Value < now;
        var effectiveTier = isExpired ? PlanTier.Libre : rawTier;
        var isActive = effectiveTier != PlanTier.Libre && (!endDate.HasValue || endDate.Value >= now);

        int? daysRemaining = (endDate.HasValue && endDate.Value > now)
            ? (int)Math.Ceiling((endDate.Value - now).TotalDays)
            : null;

        // Compute tier limit caps
        int maxProducts = effectiveTier switch
        {
            PlanTier.Libre => 50,
            _ => -1 // Unlimited
        };

        int maxCustomers = effectiveTier switch
        {
            PlanTier.Libre => 30,
            _ => -1 // Unlimited
        };

        int maxGCashTxns = effectiveTier switch
        {
            PlanTier.Libre => 30,
            _ => -1 // Unlimited
        };

        int maxUsers = effectiveTier switch
        {
            PlanTier.NegosyoPlus => 5,
            _ => 1
        };

        int maxDevices = effectiveTier switch
        {
            PlanTier.Libre => 1,
            PlanTier.TindahanPro => 2,
            PlanTier.NegosyoPlus => 4,
            _ => 1
        };

        bool canImportCsv = effectiveTier != PlanTier.Libre;
        bool hasWatermarkedReceipts = effectiveTier == PlanTier.Libre;
        bool hasProfitAnalytics = effectiveTier != PlanTier.Libre;
        bool hasAuditLogs = effectiveTier == PlanTier.NegosyoPlus;

        // Usage counts
        var productCount = await _context.Products.CountAsync(cancellationToken);
        var customerCount = await _context.Customers.CountAsync(cancellationToken);

        var startOfMonth = new DateTimeOffset(now.Year, now.Month, 1, 0, 0, 0, TimeSpan.Zero);
        var gcashCount = await _context.GCashTransactions
            .Where(g => g.Date >= startOfMonth)
            .CountAsync(cancellationToken);

        return new TenantSubscriptionDto(
            TenantId: tenantId,
            BusinessName: tenant?.BusinessName ?? "My Tindahan",
            Tier: effectiveTier,
            TierName: effectiveTier.ToString(),
            IsActive: isActive,
            SubscriptionEndDate: endDate,
            DaysRemaining: daysRemaining,
            MaxProducts: maxProducts,
            MaxCustomers: maxCustomers,
            MaxGCashTransactionsPerMonth: maxGCashTxns,
            MaxUsers: maxUsers,
            MaxDevices: maxDevices,
            CanImportCsv: canImportCsv,
            HasWatermarkedReceipts: hasWatermarkedReceipts,
            HasProfitAnalytics: hasProfitAnalytics,
            HasAuditLogs: hasAuditLogs,
            CurrentProductCount: productCount,
            CurrentCustomerCount: customerCount,
            CurrentGCashTransactionsThisMonth: gcashCount
        );
    }
}

public record GetPaymentHistoryQuery : IRequest<List<PaymentHistoryDto>>;

public class GetPaymentHistoryQueryHandler : IRequestHandler<GetPaymentHistoryQuery, List<PaymentHistoryDto>>
{
    private readonly IApplicationDbContext _context;

    public GetPaymentHistoryQueryHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<List<PaymentHistoryDto>> Handle(GetPaymentHistoryQuery request, CancellationToken cancellationToken)
    {
        return await _context.PaymentHistories
            .AsNoTracking()
            .OrderByDescending(p => p.CreatedAt)
            .Select(p => new PaymentHistoryDto(
                p.Id,
                p.TenantId,
                p.Amount,
                p.Currency,
                p.TierPurchased,
                p.TierPurchased.ToString(),
                p.BillingCycle,
                p.GatewayReferenceId,
                p.Status,
                p.PaymentMethod,
                p.CreatedAt))
            .ToListAsync(cancellationToken);
    }
}
