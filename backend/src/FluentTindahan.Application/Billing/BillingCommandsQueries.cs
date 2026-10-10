using System.Text.Json;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using FluentTindahan.Application.Common;
using FluentTindahan.Application.Common.Interfaces;
using FluentTindahan.Domain.Billing;
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

/// <summary>Outcome of a billing webhook / payment application, mapped to HTTP status by the WebApi layer.</summary>
public enum PaymentWebhookOutcome
{
    /// <summary>Payment applied; subscription extended. (200)</summary>
    Processed,
    /// <summary>Payment id already applied (gateway retry). No-op. (200)</summary>
    Duplicate,
    /// <summary>Validly signed event that we intentionally don't act on (e.g. payment.failed). (200)</summary>
    Ignored,
    /// <summary>Signature missing/invalid/stale. (401)</summary>
    InvalidSignature,
    /// <summary>Signed but semantically invalid (missing metadata, amount mismatch, unknown tenant). (400)</summary>
    Rejected
}

public record WebhookProcessResultDto(
    PaymentWebhookOutcome Outcome,
    string Message,
    Guid? TenantId,
    PlanTier? Tier,
    DateTimeOffset? NewEndDate
)
{
    public bool Success => Outcome is PaymentWebhookOutcome.Processed or PaymentWebhookOutcome.Duplicate or PaymentWebhookOutcome.Ignored;
}

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
    long AmountCentavos,
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
    BillingCycle Cycle = BillingCycle.Monthly
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

        var sessionResult = await _gatewayService.CreateCheckoutSessionAsync(
            tenantId,
            request.TargetTier,
            request.Cycle,
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

/// <summary>
/// Applies an already-verified subscription payment. Shared by the PayMongo webhook path and the
/// Development-only mock-pay endpoint. Enforces price validation and idempotency on <see cref="PaymentId"/>.
/// </summary>
public record ApplySubscriptionPaymentCommand(
    Guid TenantId,
    PlanTier Tier,
    BillingCycle Cycle,
    long AmountCentavos,
    string PaymentId,
    string PaymentMethod
) : IRequest<WebhookProcessResultDto>;

public class ApplySubscriptionPaymentCommandHandler : IRequestHandler<ApplySubscriptionPaymentCommand, WebhookProcessResultDto>
{
    private readonly IApplicationDbContext _context;
    private readonly ILogger<ApplySubscriptionPaymentCommandHandler> _logger;

    public ApplySubscriptionPaymentCommandHandler(
        IApplicationDbContext context,
        ILogger<ApplySubscriptionPaymentCommandHandler> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task<WebhookProcessResultDto> Handle(ApplySubscriptionPaymentCommand request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.PaymentId))
        {
            return Rejected("Missing payment id.", request.TenantId);
        }

        if (!TierPricing.TryGetPriceCentavos(request.Tier, request.Cycle, out var expectedCentavos))
        {
            return Rejected("Invalid tier or billing cycle.", request.TenantId);
        }

        if (request.AmountCentavos != expectedCentavos)
        {
            _logger.LogError(
                "Payment {PaymentId} for tenant {TenantId} amount mismatch: paid {Paid} centavos, expected {Expected} for {Tier}/{Cycle}.",
                request.PaymentId, request.TenantId, request.AmountCentavos, expectedCentavos, request.Tier, request.Cycle);
            return Rejected("Paid amount does not match the plan price.", request.TenantId);
        }

        // Idempotency: gateway retries must never extend the subscription twice.
        if (await PaymentAlreadyAppliedAsync(request.PaymentId, cancellationToken))
        {
            _logger.LogInformation("Duplicate payment {PaymentId} ignored (already applied).", request.PaymentId);
            return new WebhookProcessResultDto(PaymentWebhookOutcome.Duplicate, "Payment already processed.", request.TenantId, null, null);
        }

        var tenant = await _context.Tenants
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(t => t.Id == request.TenantId, cancellationToken);

        if (tenant == null)
        {
            _logger.LogWarning("Payment {PaymentId} received for unknown tenant {TenantId}", request.PaymentId, request.TenantId);
            return Rejected("Unknown tenant.", request.TenantId);
        }

        var now = DateTimeOffset.UtcNow;
        var duration = TierPricing.GetDuration(request.Cycle);
        var newEndDate = (tenant.SubscriptionEndDate.HasValue && tenant.SubscriptionEndDate.Value > now)
            ? tenant.SubscriptionEndDate.Value.Add(duration)
            : now.Add(duration);

        tenant.Tier = request.Tier;
        tenant.SubscriptionEndDate = newEndDate;

        _context.PaymentHistories.Add(new PaymentHistory
        {
            Id = Guid.NewGuid(),
            TenantId = tenant.Id,
            AmountCentavos = request.AmountCentavos,
            Currency = "PHP",
            TierPurchased = request.Tier,
            BillingCycle = request.Cycle,
            GatewayReferenceId = request.PaymentId,
            PaymentMethod = request.PaymentMethod,
            Status = "Paid",
            CreatedAt = now
        });

        try
        {
            // Tenant update + payment row commit atomically in one SaveChanges.
            await _context.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException)
        {
            // Possibly lost a race with a concurrent retry; the unique index on GatewayReferenceId rejected our insert.
            if (!await PaymentAlreadyAppliedAsync(request.PaymentId, CancellationToken.None))
            {
                throw;
            }

            _logger.LogInformation("Concurrent duplicate payment {PaymentId} ignored.", request.PaymentId);
            return new WebhookProcessResultDto(PaymentWebhookOutcome.Duplicate, "Payment already processed.", request.TenantId, null, null);
        }

        _logger.LogInformation("Tenant {TenantId} upgraded to {Tier} via payment {PaymentId}. New expiration: {EndDate}",
            tenant.Id, request.Tier, request.PaymentId, newEndDate);

        return new WebhookProcessResultDto(
            PaymentWebhookOutcome.Processed,
            "Payment processed and subscription updated.",
            tenant.Id,
            request.Tier,
            newEndDate);
    }

    private Task<bool> PaymentAlreadyAppliedAsync(string paymentId, CancellationToken cancellationToken) =>
        _context.PaymentHistories
            .IgnoreQueryFilters()
            .AsNoTracking()
            .AnyAsync(p => p.GatewayReferenceId == paymentId, cancellationToken);

    private static WebhookProcessResultDto Rejected(string message, Guid? tenantId) =>
        new(PaymentWebhookOutcome.Rejected, message, tenantId, null, null);
}

public record ProcessPaymentWebhookCommand(
    string JsonPayload,
    string? SignatureHeader
) : IRequest<WebhookProcessResultDto>;

/// <summary>
/// Verifies and interprets a PayMongo webhook event. Only <c>checkout_session.payment.paid</c> events with
/// complete metadata (tenant_id, tier, cycle) and a paid payment (id, amount) are acted upon; nothing is defaulted.
/// Unexpected failures (e.g. DB outages) propagate so the endpoint returns 5xx and PayMongo retries.
/// </summary>
public class ProcessPaymentWebhookCommandHandler : IRequestHandler<ProcessPaymentWebhookCommand, WebhookProcessResultDto>
{
    public const string PaidEventType = "checkout_session.payment.paid";

    private readonly IPaymentGatewayService _gatewayService;
    private readonly ISender _sender;
    private readonly ILogger<ProcessPaymentWebhookCommandHandler> _logger;

    public ProcessPaymentWebhookCommandHandler(
        IPaymentGatewayService gatewayService,
        ISender sender,
        ILogger<ProcessPaymentWebhookCommandHandler> logger)
    {
        _gatewayService = gatewayService;
        _sender = sender;
        _logger = logger;
    }

    public async Task<WebhookProcessResultDto> Handle(ProcessPaymentWebhookCommand request, CancellationToken cancellationToken)
    {
        if (!_gatewayService.VerifyWebhookSignature(request.JsonPayload, request.SignatureHeader ?? string.Empty))
        {
            _logger.LogWarning("Webhook signature verification failed.");
            return new WebhookProcessResultDto(PaymentWebhookOutcome.InvalidSignature, "Invalid webhook signature.", null, null, null);
        }

        if (!TryParsePaidCheckoutEvent(request.JsonPayload, out var eventType, out var payment, out var error))
        {
            if (eventType != null && eventType != PaidEventType)
            {
                _logger.LogInformation("Ignoring PayMongo event type {EventType}.", eventType);
                return new WebhookProcessResultDto(PaymentWebhookOutcome.Ignored, "Event type ignored.", null, null, null);
            }

            _logger.LogWarning("Rejecting PayMongo webhook: {Reason}", error);
            return new WebhookProcessResultDto(PaymentWebhookOutcome.Rejected, error, null, null, null);
        }

        return await _sender.Send(payment!, cancellationToken);
    }

    /// <summary>
    /// Strictly parses a PayMongo event envelope:
    /// <c>data.attributes.type</c> → event type, <c>data.attributes.data</c> → checkout_session resource.
    /// </summary>
    internal static bool TryParsePaidCheckoutEvent(
        string json,
        out string? eventType,
        out ApplySubscriptionPaymentCommand? payment,
        out string error)
    {
        eventType = null;
        payment = null;
        error = "Malformed webhook payload.";

        JsonDocument doc;
        try
        {
            doc = JsonDocument.Parse(json);
        }
        catch (JsonException)
        {
            return false;
        }

        using (doc)
        {
            var root = doc.RootElement;
            if (!TryGetObject(root, "data", out var evt) || !TryGetObject(evt, "attributes", out var evtAttr))
            {
                return false;
            }

            eventType = TryGetString(evtAttr, "type");
            if (eventType == null)
            {
                error = "Missing event type.";
                return false;
            }

            if (eventType != PaidEventType)
            {
                error = "Event type ignored.";
                return false;
            }

            if (!TryGetObject(evtAttr, "data", out var session) || !TryGetObject(session, "attributes", out var sessionAttr))
            {
                error = "Missing checkout session resource.";
                return false;
            }

            if (!TryGetObject(sessionAttr, "metadata", out var metadata))
            {
                error = "Missing checkout metadata.";
                return false;
            }

            if (!Guid.TryParse(TryGetString(metadata, "tenant_id"), out var tenantId) || tenantId == Guid.Empty)
            {
                error = "Missing or invalid tenant_id metadata.";
                return false;
            }

            if (!TryParseEnum<PlanTier>(TryGetString(metadata, "tier"), out var tier) || tier == PlanTier.Libre)
            {
                error = "Missing or invalid tier metadata.";
                return false;
            }

            if (!TryParseEnum<BillingCycle>(TryGetString(metadata, "cycle"), out var cycle))
            {
                error = "Missing or invalid cycle metadata.";
                return false;
            }

            if (!sessionAttr.TryGetProperty("payments", out var payments) ||
                payments.ValueKind != JsonValueKind.Array ||
                payments.GetArrayLength() == 0)
            {
                error = "Missing payment record.";
                return false;
            }

            var firstPayment = payments[0];
            var paymentId = TryGetString(firstPayment, "id");
            if (string.IsNullOrWhiteSpace(paymentId) || !TryGetObject(firstPayment, "attributes", out var payAttr))
            {
                error = "Missing payment id.";
                return false;
            }

            var status = TryGetString(payAttr, "status");
            if (!string.Equals(status, "paid", StringComparison.OrdinalIgnoreCase))
            {
                error = "Payment is not in paid status.";
                return false;
            }

            var currency = TryGetString(payAttr, "currency");
            if (currency != null && !string.Equals(currency, "PHP", StringComparison.OrdinalIgnoreCase))
            {
                error = "Unsupported currency.";
                return false;
            }

            if (!payAttr.TryGetProperty("amount", out var amountElem) ||
                amountElem.ValueKind != JsonValueKind.Number ||
                !amountElem.TryGetInt64(out var amountCentavos))
            {
                error = "Missing payment amount.";
                return false;
            }

            var method = "paymongo";
            if (TryGetObject(payAttr, "source", out var source))
            {
                method = TryGetString(source, "type") ?? method;
            }

            payment = new ApplySubscriptionPaymentCommand(tenantId, tier, cycle, amountCentavos, paymentId, method);
            error = string.Empty;
            return true;
        }
    }

    private static bool TryGetObject(JsonElement parent, string name, out JsonElement value)
    {
        if (parent.ValueKind == JsonValueKind.Object &&
            parent.TryGetProperty(name, out value) &&
            value.ValueKind == JsonValueKind.Object)
        {
            return true;
        }

        value = default;
        return false;
    }

    private static string? TryGetString(JsonElement parent, string name) =>
        parent.ValueKind == JsonValueKind.Object &&
        parent.TryGetProperty(name, out var value) &&
        value.ValueKind == JsonValueKind.String
            ? value.GetString()
            : null;

    // Enum.TryParse accepts numeric strings like "99"; require a defined, named value.
    private static bool TryParseEnum<TEnum>(string? raw, out TEnum value) where TEnum : struct, Enum
    {
        value = default;
        return !string.IsNullOrWhiteSpace(raw) &&
               !char.IsDigit(raw[0]) && raw[0] != '-' &&
               Enum.TryParse(raw, ignoreCase: true, out value) &&
               Enum.IsDefined(value);
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

        // "This month" is the Asia/Manila calendar month (same boundary as the sync handler and the PWA).
        var startOfMonth = ManilaTime.StartOfCurrentMonthUtc(now);
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
        var rows = await _context.PaymentHistories
            .AsNoTracking()
            .OrderByDescending(p => p.CreatedAt)
            .ToListAsync(cancellationToken);

        return rows.Select(p => new PaymentHistoryDto(
                p.Id,
                p.TenantId,
                p.AmountCentavos,
                TierPricing.ToPesos(p.AmountCentavos),
                p.Currency,
                p.TierPurchased,
                p.TierPurchased.ToString(),
                p.BillingCycle,
                p.GatewayReferenceId,
                p.Status,
                p.PaymentMethod,
                p.CreatedAt))
            .ToList();
    }
}
