using System.Diagnostics;
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
    private readonly IApplicationDbContext? _context;

    public CreateCheckoutSessionCommandHandler(
        IPaymentGatewayService gatewayService,
        ICurrentUserService currentUserService,
        IApplicationDbContext? context = null)
    {
        _gatewayService = gatewayService;
        _currentUserService = currentUserService;
        _context = context;
    }

    public async Task<CheckoutSessionResponseDto> Handle(CreateCheckoutSessionCommand request, CancellationToken cancellationToken)
    {
        if (request.TargetTier == PlanTier.Libre)
        {
            throw new InvalidOperationException("Cannot initiate checkout session for the free Libre plan.");
        }

        var tenantId = _currentUserService.TenantId;
        if (tenantId == Guid.Empty)
        {
            throw new UnauthorizedAccessException("Tenant is not authenticated or resolved.");
        }

        var sessionResult = await _gatewayService.CreateCheckoutSessionAsync(
            tenantId,
            request.TargetTier,
            request.Cycle,
            cancellationToken);

        if (_context != null)
        {
            var tenant = await _context.Tenants
                .IgnoreQueryFilters()
                .FirstOrDefaultAsync(t => t.Id == tenantId, cancellationToken);

            if (tenant != null)
            {
                tenant.CheckoutSessionId = sessionResult.SessionId;
                await _context.SaveChangesAsync(cancellationToken);
            }
        }

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

        // A payment record is persisted before the subscription update so a later failure can be recovered.
        var paymentHistory = await _context.PaymentHistories
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(p => p.GatewayReferenceId == request.PaymentId, cancellationToken);

        // Idempotency: gateway retries must never extend the subscription twice.
        if (paymentHistory?.Status == "Paid")
        {
            _logger.LogInformation("Duplicate payment {PaymentId} ignored (already applied).", request.PaymentId);
            return new WebhookProcessResultDto(PaymentWebhookOutcome.Duplicate, "Payment already processed.", request.TenantId, null, null);
        }

        if (paymentHistory == null)
        {
            paymentHistory = new PaymentHistory
            {
                Id = Guid.NewGuid(),
                TenantId = request.TenantId,
                AmountCentavos = request.AmountCentavos,
                Currency = "PHP",
                TierPurchased = request.Tier,
                BillingCycle = request.Cycle,
                GatewayReferenceId = request.PaymentId,
                PaymentMethod = request.PaymentMethod,
                Status = "Pending",
                CreatedAt = DateTimeOffset.UtcNow
            };
            _context.PaymentHistories.Add(paymentHistory);

            try
            {
                await _context.SaveChangesAsync(cancellationToken);
            }
            catch (DbUpdateException)
            {
                _context.Entry(paymentHistory).State = EntityState.Detached;
                paymentHistory = await _context.PaymentHistories
                    .IgnoreQueryFilters()
                    .FirstOrDefaultAsync(p => p.GatewayReferenceId == request.PaymentId, cancellationToken);

                if (paymentHistory == null)
                {
                    throw;
                }

                if (paymentHistory.Status == "Paid")
                {
                    return new WebhookProcessResultDto(PaymentWebhookOutcome.Duplicate, "Payment already processed.", request.TenantId, null, null);
                }
            }
        }

        const int maxRetries = 3;
        for (var attempt = 1; attempt <= maxRetries; attempt++)
        {
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

            // Mid-term tier change rule:
            // Renewing the SAME active tier extends the existing SubscriptionEndDate.
            // Switching tiers mid-term (or subscribing for the first time / after expiration) starts the new tier
            // pass from 'now' for the full purchased duration, preventing cheaper tiers from artificially
            // extending premium tier access without payment.
            var isSameTierRenewal = tenant.Tier == request.Tier &&
                                    tenant.SubscriptionEndDate.HasValue &&
                                    tenant.SubscriptionEndDate.Value > now;

            var newEndDate = isSameTierRenewal
                ? tenant.SubscriptionEndDate!.Value.Add(duration)
                : now.Add(duration);

            tenant.Tier = request.Tier;
            tenant.SubscriptionEndDate = newEndDate;

            paymentHistory.Status = "Paid";

            try
            {
                // The payment row was already persisted above; this commit only completes the upgrade.
                await _context.SaveChangesAsync(cancellationToken);

                _logger.LogInformation("Tenant {TenantId} upgraded to {Tier} via payment {PaymentId}. New expiration: {EndDate}",
                    tenant.Id, request.Tier, request.PaymentId, newEndDate);

                return new WebhookProcessResultDto(
                    PaymentWebhookOutcome.Processed,
                    "Payment processed and subscription updated.",
                    tenant.Id,
                    request.Tier,
                    newEndDate);
            }
            catch (DbUpdateConcurrencyException ex)
            {
                _logger.LogWarning(ex, "Concurrency conflict applying payment {PaymentId} to tenant {TenantId} on attempt {Attempt}/{MaxRetries}. Retrying...",
                    request.PaymentId, request.TenantId, attempt, maxRetries);

                _context.Entry(tenant).State = EntityState.Detached;
                paymentHistory.Status = "Pending";
                _context.Entry(paymentHistory).State = EntityState.Unchanged;

                if (attempt >= maxRetries)
                {
                    throw;
                }
            }
            catch (DbUpdateException)
            {
                paymentHistory.Status = "Pending";
                _context.Entry(paymentHistory).State = EntityState.Unchanged;
                throw;
            }
        }

        throw new UnreachableException("Retry loop must either succeed, return duplicate, or rethrow on final attempt.");
    }

    private static WebhookProcessResultDto Rejected(string message, Guid? tenantId) =>
        new(PaymentWebhookOutcome.Rejected, message, tenantId, null, null);
}

public record ResetTenantSubscriptionCommand(Guid TenantId) : IRequest<bool>;

public class ResetTenantSubscriptionCommandHandler : IRequestHandler<ResetTenantSubscriptionCommand, bool>
{
    private readonly IApplicationDbContext _context;
    private readonly ILogger<ResetTenantSubscriptionCommandHandler> _logger;

    public ResetTenantSubscriptionCommandHandler(
        IApplicationDbContext context,
        ILogger<ResetTenantSubscriptionCommandHandler> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task<bool> Handle(ResetTenantSubscriptionCommand request, CancellationToken cancellationToken)
    {
        var tenant = await _context.Tenants
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(t => t.Id == request.TenantId, cancellationToken);

        if (tenant == null)
        {
            _logger.LogWarning("ResetTenantSubscription: Tenant {TenantId} not found.", request.TenantId);
            return false;
        }

        tenant.Tier = PlanTier.Libre;
        tenant.SubscriptionEndDate = null;

        var payments = await _context.PaymentHistories
            .IgnoreQueryFilters()
            .Where(p => p.TenantId == request.TenantId)
            .ToListAsync(cancellationToken);

        _context.PaymentHistories.RemoveRange(payments);

        await _context.SaveChangesAsync(cancellationToken);
        _logger.LogInformation("ResetTenantSubscription: Tenant {TenantId} reset to Libre tier and payment history cleared.", request.TenantId);
        return true;
    }
}

public record ConfirmCheckoutSessionCommand(Guid TenantId, string? SessionId = null) : IRequest<TenantSubscriptionDto>;

public class ConfirmCheckoutSessionCommandHandler : IRequestHandler<ConfirmCheckoutSessionCommand, TenantSubscriptionDto>
{
    private readonly IApplicationDbContext _context;
    private readonly IPaymentGatewayService _gatewayService;
    private readonly ISender _sender;
    private readonly ILogger<ConfirmCheckoutSessionCommandHandler> _logger;

    public ConfirmCheckoutSessionCommandHandler(
        IApplicationDbContext context,
        IPaymentGatewayService gatewayService,
        ISender sender,
        ILogger<ConfirmCheckoutSessionCommandHandler> logger)
    {
        _context = context;
        _gatewayService = gatewayService;
        _sender = sender;
        _logger = logger;
    }

    public async Task<TenantSubscriptionDto> Handle(ConfirmCheckoutSessionCommand request, CancellationToken cancellationToken)
    {
        var tenant = await _context.Tenants
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(t => t.Id == request.TenantId, cancellationToken);

        if (tenant == null)
        {
            throw new InvalidOperationException($"Tenant {request.TenantId} not found.");
        }

        // Security invariant: Client-supplied SessionId is strictly ignored; use only the CheckoutSessionId saved on the tenant.
        var sessionId = tenant.CheckoutSessionId;

        if (string.IsNullOrWhiteSpace(sessionId))
        {
            _logger.LogInformation("ConfirmCheckoutSession: No checkout session ID found for tenant {TenantId}.", request.TenantId);
            return await _sender.Send(new GetTenantSubscriptionQuery(), cancellationToken);
        }

        _logger.LogInformation("ConfirmCheckoutSession: Verifying session {SessionId} for tenant {TenantId}...", sessionId, request.TenantId);

        try
        {
            if (sessionId.StartsWith("pi_", StringComparison.OrdinalIgnoreCase))
            {
                var intentStatus = await _gatewayService.RetrievePaymentIntentStatusAsync(sessionId, cancellationToken);
                if (!intentStatus.IsPaid)
                {
                    _logger.LogInformation("ConfirmCheckoutSession: Payment intent {SessionId} is not in paid status ({Status}).", sessionId, intentStatus.Status);
                    return await _sender.Send(new GetTenantSubscriptionQuery(), cancellationToken);
                }

                if (intentStatus.Metadata == null ||
                    !intentStatus.Metadata.TryGetValue("tenant_id", out var rawTenantId) ||
                    !Guid.TryParse(rawTenantId, out var intentTenantId) ||
                    intentTenantId == Guid.Empty ||
                    intentTenantId != request.TenantId)
                {
                    _logger.LogWarning("ConfirmCheckoutSession: Payment intent tenant metadata missing or mismatched for {SessionId}.", sessionId);
                    return await _sender.Send(new GetTenantSubscriptionQuery(), cancellationToken);
                }

                var rawTier = intentStatus.Metadata.TryGetValue("target_tier", out var tt) ? tt
                    : intentStatus.Metadata.TryGetValue("tier", out var t) ? t : null;
                var rawCycle = intentStatus.Metadata.TryGetValue("cycle", out var c) ? c : null;

                if (!Enum.TryParse<PlanTier>(rawTier, ignoreCase: true, out var intentTier) ||
                    !Enum.IsDefined(intentTier) ||
                    intentTier == PlanTier.Libre ||
                    !Enum.TryParse<BillingCycle>(rawCycle, ignoreCase: true, out var intentCycle) ||
                    !Enum.IsDefined(intentCycle))
                {
                    _logger.LogWarning("ConfirmCheckoutSession: Payment intent plan/cycle metadata invalid for {SessionId}.", sessionId);
                    return await _sender.Send(new GetTenantSubscriptionQuery(), cancellationToken);
                }

                if (!TierPricing.TryGetPriceCentavos(intentTier, intentCycle, out var expectedQrCentavos) ||
                    intentStatus.AmountCentavos != expectedQrCentavos)
                {
                    _logger.LogError(
                        "ConfirmCheckoutSession: QR Ph paid amount mismatch for tenant {TenantId}. Paid {Paid}, expected {Expected}.",
                        request.TenantId,
                        intentStatus.AmountCentavos,
                        expectedQrCentavos);
                    return await _sender.Send(new GetTenantSubscriptionQuery(), cancellationToken);
                }

                var qrOutcome = await _sender.Send(new ApplySubscriptionPaymentCommand(
                    request.TenantId,
                    intentTier,
                    intentCycle,
                    intentStatus.AmountCentavos,
                    intentStatus.PaymentId ?? sessionId,
                    "QRPh"
                ), cancellationToken);
                _logger.LogInformation("ConfirmCheckoutSession: QR Ph payment applied with outcome {Outcome} for tenant {TenantId}.", qrOutcome.Outcome, request.TenantId);
                return await _sender.Send(new GetTenantSubscriptionQuery(), cancellationToken);
            }

            var sessionDetails = await _gatewayService.RetrieveCheckoutSessionAsync(sessionId, cancellationToken);
            if (sessionDetails == null)
            {
                _logger.LogWarning("ConfirmCheckoutSession: Session {SessionId} could not be retrieved from gateway.", sessionId);
                return await _sender.Send(new GetTenantSubscriptionQuery(), cancellationToken);
            }

            if (!sessionDetails.IsPaid)
            {
                _logger.LogInformation("ConfirmCheckoutSession: Session {SessionId} is not in paid status ({Status}).", sessionId, sessionDetails.Status);
                return await _sender.Send(new GetTenantSubscriptionQuery(), cancellationToken);
            }

            // Security invariant: Require session's tenant metadata to be present and equal to the caller's tenant.
            if (sessionDetails.TenantId == Guid.Empty || sessionDetails.TenantId != request.TenantId)
            {
                _logger.LogWarning(
                    "ConfirmCheckoutSession: Session tenant metadata missing or mismatched ({SessionTenant} != {RequestTenant}).",
                    sessionDetails.TenantId,
                    request.TenantId);
                return await _sender.Send(new GetTenantSubscriptionQuery(), cancellationToken);
            }

            if (sessionDetails.Tier == PlanTier.Libre)
            {
                _logger.LogWarning("ConfirmCheckoutSession: Session has Libre tier; cannot upgrade.");
                return await _sender.Send(new GetTenantSubscriptionQuery(), cancellationToken);
            }

            // Security invariant: Ensure the paid amount matches the canonical plan price.
            if (!TierPricing.TryGetPriceCentavos(sessionDetails.Tier, sessionDetails.Cycle, out var expectedCentavos) ||
                sessionDetails.AmountCentavos != expectedCentavos)
            {
                _logger.LogError(
                    "ConfirmCheckoutSession: Paid amount mismatch for tenant {TenantId}. Paid {Paid} centavos, expected {Expected} for {Tier}/{Cycle}.",
                    request.TenantId,
                    sessionDetails.AmountCentavos,
                    expectedCentavos,
                    sessionDetails.Tier,
                    sessionDetails.Cycle);
                return await _sender.Send(new GetTenantSubscriptionQuery(), cancellationToken);
            }

            var applyCommand = new ApplySubscriptionPaymentCommand(
                request.TenantId,
                sessionDetails.Tier,
                sessionDetails.Cycle,
                sessionDetails.AmountCentavos,
                sessionDetails.PaymentId,
                sessionDetails.PaymentMethod
            );

            var result = await _sender.Send(applyCommand, cancellationToken);
            _logger.LogInformation("ConfirmCheckoutSession: Payment applied with outcome {Outcome} for tenant {TenantId}.", result.Outcome, request.TenantId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "ConfirmCheckoutSession: Error verifying session {SessionId} for tenant {TenantId}.", sessionId, request.TenantId);
        }

        return await _sender.Send(new GetTenantSubscriptionQuery(), cancellationToken);
    }
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
    public const string PaymentPaidEventType = "payment.paid";

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
            if (eventType != null && (eventType != PaidEventType && eventType != PaymentPaidEventType || error == "Event type ignored."))
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
    public static bool TryParsePaidCheckoutEvent(
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

            if (eventType != PaidEventType && eventType != PaymentPaidEventType)
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

            if (!TryParseEnum<PlanTier>(TryGetString(metadata, "tier") ?? TryGetString(metadata, "target_tier"), out var tier) || tier == PlanTier.Libre)
            {
                error = "Missing or invalid tier metadata.";
                return false;
            }

            if (!TryParseEnum<BillingCycle>(TryGetString(metadata, "cycle"), out var cycle))
            {
                error = "Missing or invalid cycle metadata.";
                return false;
            }

            if (eventType == PaymentPaidEventType)
            {
                var directPaymentId = TryGetString(session, "id");
                var directStatus = TryGetString(sessionAttr, "status");
                if (string.IsNullOrWhiteSpace(directPaymentId) || !string.Equals(directStatus, "paid", StringComparison.OrdinalIgnoreCase))
                {
                    error = "No payment in paid status found.";
                    return false;
                }

                var directCurrency = TryGetString(sessionAttr, "currency");
                if (directCurrency != null && !string.Equals(directCurrency, "PHP", StringComparison.OrdinalIgnoreCase))
                {
                    error = "Unsupported currency.";
                    return false;
                }

                if (!sessionAttr.TryGetProperty("amount", out var directAmountElem) ||
                    directAmountElem.ValueKind != JsonValueKind.Number ||
                    !directAmountElem.TryGetInt64(out var directAmountCentavos))
                {
                    error = "Missing payment amount.";
                    return false;
                }

                var directMethod = "QRPh";
                if (TryGetObject(sessionAttr, "source", out var directSource))
                {
                    directMethod = TryGetString(directSource, "type") ?? directMethod;
                }

                payment = new ApplySubscriptionPaymentCommand(tenantId, tier, cycle, directAmountCentavos, directPaymentId, directMethod);
                error = string.Empty;
                return true;
            }

            if (!sessionAttr.TryGetProperty("payments", out var payments) ||
                payments.ValueKind != JsonValueKind.Array ||
                payments.GetArrayLength() == 0)
            {
                error = "Missing payment record.";
                return false;
            }

            JsonElement? paidPayment = null;
            JsonElement paidAttr = default;
            string? paidPaymentId = null;

            foreach (var p in payments.EnumerateArray())
            {
                var pid = TryGetString(p, "id");
                if (string.IsNullOrWhiteSpace(pid) || !TryGetObject(p, "attributes", out var pAttr))
                    continue;

                var pStatus = TryGetString(pAttr, "status");
                if (string.Equals(pStatus, "paid", StringComparison.OrdinalIgnoreCase))
                {
                    paidPayment = p;
                    paidAttr = pAttr;
                    paidPaymentId = pid;
                    break;
                }
            }

            if (paidPayment == null || string.IsNullOrWhiteSpace(paidPaymentId))
            {
                error = "No payment in paid status found in checkout session.";
                return false;
            }

            var currency = TryGetString(paidAttr, "currency");
            if (currency != null && !string.Equals(currency, "PHP", StringComparison.OrdinalIgnoreCase))
            {
                error = "Unsupported currency.";
                return false;
            }

            if (!paidAttr.TryGetProperty("amount", out var amountElem) ||
                amountElem.ValueKind != JsonValueKind.Number ||
                !amountElem.TryGetInt64(out var amountCentavos))
            {
                error = "Missing payment amount.";
                return false;
            }

            var method = "paymongo";
            if (TryGetObject(paidAttr, "source", out var source))
            {
                method = TryGetString(source, "type") ?? method;
            }

            payment = new ApplySubscriptionPaymentCommand(tenantId, tier, cycle, amountCentavos, paidPaymentId, method);
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
        if (tenantId == Guid.Empty)
        {
            throw new UnauthorizedAccessException("Tenant is not authenticated or resolved.");
        }

        var tenant = await _context.Tenants
            .AsNoTracking()
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(t => t.Id == tenantId, cancellationToken);

        var now = DateTimeOffset.UtcNow;

        var rawTier = tenant?.Tier ?? PlanTier.Libre;
        var endDate = tenant?.SubscriptionEndDate;

        // If tier is paid but subscriptionEndDate has passed, effective tier is Libre.
        // A null SubscriptionEndDate on a paid tier represents a lifetime plan with no expiration.
        var isExpired = rawTier != PlanTier.Libre && endDate.HasValue && endDate.Value < now;
        var effectiveTier = isExpired ? PlanTier.Libre : rawTier;
        var isActive = effectiveTier != PlanTier.Libre && (!endDate.HasValue || endDate.Value >= now);

        int? daysRemaining = (endDate.HasValue && endDate.Value > now)
            ? (int)Math.Ceiling((endDate.Value - now).TotalDays)
            : null;

        // Compute tier limit caps from canonical domain TierLimits
        int maxProducts = TierLimits.GetMaxProducts(effectiveTier);
        int maxCustomers = TierLimits.GetMaxCustomers(effectiveTier);
        int maxGCashTxns = TierLimits.GetMaxGCashTransactionsPerMonth(effectiveTier);
        int maxUsers = TierLimits.GetMaxUsers(effectiveTier);
        int maxDevices = TierLimits.GetMaxDevices(effectiveTier);

        bool canImportCsv = TierLimits.CanImportCsv(effectiveTier);
        bool hasWatermarkedReceipts = TierLimits.HasWatermarkedReceipts(effectiveTier);
        bool hasProfitAnalytics = TierLimits.HasProfitAnalytics(effectiveTier);
        bool hasAuditLogs = TierLimits.HasAuditLogs(effectiveTier);

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
