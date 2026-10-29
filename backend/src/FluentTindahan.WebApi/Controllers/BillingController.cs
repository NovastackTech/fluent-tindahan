using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using FluentTindahan.Application.Billing;
using FluentTindahan.Application.Common.Interfaces;
using FluentTindahan.Domain.Billing;
using FluentTindahan.Domain.Entities;
using FluentTindahan.Domain.Enums;
using FluentTindahan.Domain.Interfaces;
using FluentTindahan.WebApi.Authorization;

namespace FluentTindahan.WebApi.Controllers;

/// <summary>
/// Handles SaaS plan upgrades, subscription queries, and checkout session generation.
/// Authenticated endpoints require a valid resolved tenant.
/// </summary>
[Authorize(Policy = AuthorizationPolicies.TenantResolved)]
[ApiController]
[Route("api/[controller]")]
public class BillingController : ControllerBase
{
    private readonly IMediator _mediator;
    private readonly ICurrentUserService _currentUserService;
    private readonly IPaymentGatewayService _gatewayService;
    private readonly IHostEnvironment _environment;
    private readonly ILogger<BillingController> _logger;
    private readonly IApplicationDbContext? _dbContext;
    private readonly IConfiguration? _configuration;

    [ActivatorUtilitiesConstructor]
    public BillingController(
        IMediator mediator,
        ICurrentUserService currentUserService,
        IPaymentGatewayService gatewayService,
        IHostEnvironment environment,
        ILogger<BillingController> logger,
        IApplicationDbContext? dbContext = null,
        IConfiguration? configuration = null)
    {
        _mediator = mediator;
        _currentUserService = currentUserService;
        _gatewayService = gatewayService;
        _environment = environment;
        _logger = logger;
        _dbContext = dbContext;
        _configuration = configuration;
    }

    public BillingController(
        IMediator mediator,
        ICurrentUserService currentUserService,
        IHostEnvironment environment,
        ILogger<BillingController> logger)
        : this(mediator, currentUserService, null!, environment, logger, null, null)
    {
    }

    private bool IsLibreUpgradeAllowed()
    {
        var config = _configuration ?? HttpContext?.RequestServices.GetService<IConfiguration>();
        if (config == null) return false;
        return string.Equals(config["Billing:AllowLibreUpgrade"], "true", StringComparison.OrdinalIgnoreCase);
    }

    private bool IsHostedCheckoutEnabled()
    {
        var config = _configuration ?? HttpContext?.RequestServices.GetService<IConfiguration>();
        if (config == null) return true;
        var raw = config["Billing:EnableHostedCheckout"];
        return string.IsNullOrWhiteSpace(raw) || string.Equals(raw, "true", StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>
    /// Checkout request. Redirect URLs are intentionally not accepted from the client;
    /// they are built server-side from <c>PayMongo:FrontendOrigin</c>.
    /// </summary>
    public record CreateCheckoutRequest(
        PlanTier TargetTier,
        BillingCycle Cycle = BillingCycle.Monthly
    );

    /// <summary>
    /// Creates a PayMongo Checkout Session for Tindahan Pro monthly.
    /// </summary>
    [HttpPost("checkout")]
    [ProducesResponseType(typeof(CheckoutSessionResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status502BadGateway)]
    public async Task<ActionResult<CheckoutSessionResponseDto>> CreateCheckout(
        [FromBody] CreateCheckoutRequest request,
        CancellationToken cancellationToken)
    {
        if (_currentUserService.TenantId == Guid.Empty)
        {
            return Unauthorized(new { message = "A valid tenant is required." });
        }

        if (request.TargetTier != PlanTier.TindahanPro || request.Cycle != BillingCycle.Monthly ||
            !TierPricing.TryGetPriceCentavos(request.TargetTier, request.Cycle, out _))
        {
            return BadRequest(new { message = "Invalid plan or billing cycle." });
        }

        var dbContext = _dbContext ?? HttpContext?.RequestServices.GetService<IApplicationDbContext>();
        Tenant? tenant = null;
        if (dbContext != null)
        {
            tenant = await dbContext.Tenants
                .IgnoreQueryFilters()
                .FirstOrDefaultAsync(t => t.Id == _currentUserService.TenantId, cancellationToken);
        }

        var isRenewal = tenant != null && (tenant.Tier != PlanTier.Libre || tenant.SubscriptionEndDate.HasValue);
        if (!IsLibreUpgradeAllowed() && !isRenewal)
        {
            return BadRequest(new { message = "Upgrading from Libre to Tindahan Pro is temporarily paused." });
        }

        if (!IsHostedCheckoutEnabled())
        {
            return BadRequest(new { message = "Hosted checkout is currently disabled." });
        }

        try
        {
            var result = await _mediator.Send(new CreateCheckoutSessionCommand(request.TargetTier, request.Cycle), cancellationToken);
            return Ok(result);
        }
        catch (PaymentGatewayException ex)
        {
            // PaymentGatewayException messages are client-safe by contract; details are logged in the gateway service.
            _logger.LogError(ex, "Failed to create checkout session.");
            return StatusCode(StatusCodes.Status502BadGateway, new { message = ex.Message });
        }
    }

    /// <summary>
    /// Generates a PayMongo Dynamic QR Ph payment intent for upgrading or renewing the tenant's subscription.
    /// </summary>
    [HttpPost("qrph/generate")]
    [ProducesResponseType(typeof(QrPhPaymentIntentResult), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status502BadGateway)]
    public async Task<ActionResult<QrPhPaymentIntentResult>> GenerateQrPhSubscription(
        [FromBody] CreateCheckoutRequest request,
        CancellationToken cancellationToken)
    {
        if (_currentUserService.TenantId == Guid.Empty)
        {
            return Unauthorized(new { message = "A valid tenant is required." });
        }

        if (request.TargetTier != PlanTier.TindahanPro || request.Cycle != BillingCycle.Monthly ||
            !TierPricing.TryGetPriceCentavos(request.TargetTier, request.Cycle, out var priceCentavos))
        {
            return BadRequest(new { message = "Invalid plan or billing cycle." });
        }

        var tenantId = _currentUserService.TenantId;
        var dbContext = _dbContext ?? HttpContext?.RequestServices.GetService<IApplicationDbContext>();
        Tenant? tenant = null;
        FluentTindahan.Domain.Entities.User? owner = null;
        if (dbContext != null)
        {
            tenant = await dbContext.Tenants
                .IgnoreQueryFilters()
                .FirstOrDefaultAsync(t => t.Id == tenantId, cancellationToken);
            owner = await dbContext.Users
                .AsNoTracking()
                .IgnoreQueryFilters()
                .Where(u => u.TenantId == tenantId && u.AccountStatus != FluentTindahan.Domain.Entities.User.StatusDeleted)
                .OrderByDescending(u => u.Role == "Owner")
                .ThenBy(u => u.CreatedAt)
                .FirstOrDefaultAsync(cancellationToken);
        }

        var isRenewal = tenant != null && (tenant.Tier != PlanTier.Libre || tenant.SubscriptionEndDate.HasValue);
        if (!IsLibreUpgradeAllowed() && !isRenewal)
        {
            return BadRequest(new { message = "Upgrading from Libre to Tindahan Pro is temporarily paused." });
        }

        var orderRef = $"sub_{tenantId.ToString("N")[..8]}_{request.TargetTier}_{request.Cycle}_{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}";
        var businessName = !string.IsNullOrWhiteSpace(tenant?.BusinessName) ? tenant!.BusinessName.Trim() : null;
        var ownerName = !string.IsNullOrWhiteSpace(owner?.OwnerName) ? owner!.OwnerName!.Trim() : null;
        var ownerEmail = !string.IsNullOrWhiteSpace(owner?.Email) ? owner!.Email.Trim() : null;
        var ownerPhone = !string.IsNullOrWhiteSpace(owner?.Phone) ? owner!.Phone.Trim() : null;

        var description = businessName != null
            ? $"Fluent Tindahan - Tindahan Pro (Monthly) - {businessName} (Tenant: {tenantId})"
            : $"Fluent Tindahan - Tindahan Pro (Monthly) (Tenant: {tenantId})";

        var metadata = new Dictionary<string, string>
        {
            { "tenant_id", tenantId.ToString() },
            { "target_tier", request.TargetTier.ToString() },
            { "cycle", request.Cycle.ToString() },
            { "purpose", "subscription" }
        };
        if (businessName != null) metadata["business_name"] = businessName;
        if (ownerEmail != null) metadata["owner_email"] = ownerEmail;
        if (ownerPhone != null) metadata["owner_phone"] = ownerPhone;

        try
        {
            var result = await _gatewayService.CreateQrPhPaymentIntentAsync(new CreateQrPhPaymentIntentRequest(
                AmountCentavos: priceCentavos,
                Description: description,
                OrderId: orderRef,
                Customer: new CustomerBillingDetails(
                    Name: businessName ?? ownerName ?? "Tindahan Store Owner",
                    Email: ownerEmail ?? "owner@fluent-tindahan.ph",
                    Phone: ownerPhone ?? "09000000000"
                ),
                Metadata: metadata
            ), cancellationToken);

            if (dbContext != null && tenant != null)
            {
                tenant.CheckoutSessionId = result.PaymentIntentId;
                await dbContext.SaveChangesAsync(cancellationToken);
            }

            return Ok(result);
        }
        catch (PaymentGatewayException ex)
        {
            _logger.LogError(ex, "Failed to create QR Ph payment intent for subscription.");
            return StatusCode(StatusCodes.Status502BadGateway, new { message = ex.Message });
        }
    }

    /// <summary>
    /// Checks status of a QR Ph payment intent.
    /// </summary>
    [HttpGet("qrph/{paymentIntentId}/status")]
    [ProducesResponseType(typeof(QrPhPaymentStatusResult), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status502BadGateway)]
    public async Task<ActionResult<QrPhPaymentStatusResult>> GetQrPhPaymentStatus(
        string paymentIntentId,
        CancellationToken cancellationToken)
    {
        var tenantId = _currentUserService.TenantId;
        if (tenantId == Guid.Empty)
        {
            return Unauthorized(new { message = "A valid tenant is required." });
        }

        try
        {
            var result = await _gatewayService.RetrievePaymentIntentStatusAsync(paymentIntentId, cancellationToken);
            if (result.Metadata == null ||
                !result.Metadata.TryGetValue("tenant_id", out var intentTenantId) ||
                !string.Equals(intentTenantId, tenantId.ToString(), StringComparison.OrdinalIgnoreCase))
            {
                _logger.LogWarning("Tenant {TenantId} attempted to access QR Ph status for intent {IntentId} belonging to another tenant or with missing tenant metadata.",
                    tenantId, paymentIntentId);
                return StatusCode(StatusCodes.Status403Forbidden, new { message = "Payment intent does not belong to the current store." });
            }

            if (result.IsPaid &&
                (result.Metadata.TryGetValue("target_tier", out var rawTier) || result.Metadata.TryGetValue("tier", out rawTier)) &&
                Enum.TryParse<PlanTier>(rawTier, ignoreCase: true, out var parsedTier) &&
                parsedTier == PlanTier.TindahanPro &&
                result.Metadata.TryGetValue("cycle", out var rawCycle) &&
                Enum.TryParse<BillingCycle>(rawCycle, ignoreCase: true, out var parsedCycle) &&
                TierPricing.TryGetPriceCentavos(parsedTier, parsedCycle, out var expectedPriceCentavos) &&
                result.AmountCentavos == expectedPriceCentavos &&
                (!result.Metadata.TryGetValue("purpose", out var purpose) ||
                 string.IsNullOrWhiteSpace(purpose) ||
                 string.Equals(purpose, "subscription", StringComparison.OrdinalIgnoreCase)) &&
                string.Equals(result.Currency, "PHP", StringComparison.OrdinalIgnoreCase) &&
                !string.IsNullOrWhiteSpace(result.PaymentId) &&
                result.PaidAt.HasValue)
            {
                await _mediator.Send(new ApplySubscriptionPaymentCommand(
                    tenantId,
                    parsedTier,
                    parsedCycle,
                    expectedPriceCentavos,
                    result.PaymentId,
                    "QRPh",
                    result.Currency!,
                    result.PaidAt,
                    purpose ?? "subscription"
                ), cancellationToken);
            }

            return Ok(result);
        }
        catch (PaymentGatewayException ex)
        {
            _logger.LogError(ex, "Failed to retrieve QR Ph payment status.");
            return StatusCode(StatusCodes.Status502BadGateway, new { message = ex.Message });
        }
    }

    public record ConfirmQrPhSubscriptionRequest(
        string PaymentIntentId,
        PlanTier TargetTier,
        BillingCycle Cycle = BillingCycle.Monthly
    );

    /// <summary>
    /// Verifies that a QR Ph subscription payment intent was paid, and applies the subscription upgrade.
    /// </summary>
    [HttpPost("qrph/confirm")]
    [ProducesResponseType(typeof(TenantSubscriptionDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status502BadGateway)]
    public async Task<ActionResult<TenantSubscriptionDto>> ConfirmQrPhSubscription(
        [FromBody] ConfirmQrPhSubscriptionRequest request,
        CancellationToken cancellationToken)
    {
        if (_currentUserService.TenantId == Guid.Empty)
        {
            return Unauthorized(new { message = "A valid tenant is required to confirm subscription." });
        }

        if (string.IsNullOrWhiteSpace(request.PaymentIntentId))
        {
            return BadRequest(new { message = "PaymentIntentId is required." });
        }

        if (request.TargetTier != PlanTier.TindahanPro || request.Cycle != BillingCycle.Monthly ||
            !TierPricing.TryGetPriceCentavos(request.TargetTier, request.Cycle, out var expectedCentavos))
        {
            return BadRequest(new { message = "Invalid plan or billing cycle." });
        }

        try
        {
            var statusResult = await _gatewayService.RetrievePaymentIntentStatusAsync(request.PaymentIntentId, cancellationToken);
            if (!statusResult.IsPaid)
            {
                return BadRequest(new { message = $"Payment is not completed. Current status: {statusResult.Status}" });
            }

            if (statusResult.Metadata == null ||
                !statusResult.Metadata.TryGetValue("tenant_id", out var intentTenantId) ||
                !string.Equals(intentTenantId, _currentUserService.TenantId.ToString(), StringComparison.OrdinalIgnoreCase))
            {
                _logger.LogWarning("Payment intent {IntentId} does not belong to tenant {TenantId}.",
                    request.PaymentIntentId, _currentUserService.TenantId);
                return StatusCode(StatusCodes.Status403Forbidden, new { message = "Payment intent does not belong to the current store." });
            }

            if (!(statusResult.Metadata.TryGetValue("target_tier", out var intentTier) || statusResult.Metadata.TryGetValue("tier", out intentTier)) ||
                !string.Equals(intentTier, request.TargetTier.ToString(), StringComparison.OrdinalIgnoreCase))
            {
                return BadRequest(new { message = "Payment intent target plan does not match requested plan." });
            }

            if (!statusResult.Metadata.TryGetValue("cycle", out var intentCycle) ||
                !string.Equals(intentCycle, request.Cycle.ToString(), StringComparison.OrdinalIgnoreCase))
            {
                return BadRequest(new { message = "Payment intent billing cycle does not match requested cycle." });
            }

            string? purpose = null;
            if (statusResult.Metadata.TryGetValue("purpose", out purpose) &&
                !string.IsNullOrWhiteSpace(purpose) &&
                !string.Equals(purpose, "subscription", StringComparison.OrdinalIgnoreCase))
            {
                return BadRequest(new { message = "Payment intent is not for a subscription." });
            }

            if (!string.Equals(statusResult.Currency, "PHP", StringComparison.OrdinalIgnoreCase))
            {
                return BadRequest(new { message = "Payment currency must be PHP." });
            }

            if (string.IsNullOrWhiteSpace(statusResult.PaymentId) || !statusResult.PaidAt.HasValue)
            {
                return BadRequest(new { message = "Payment verification is incomplete. Please retry shortly." });
            }

            if (statusResult.AmountCentavos != expectedCentavos)
            {
                _logger.LogError("Paid amount {Paid} does not match expected {Expected} for tier {Tier}.",
                    statusResult.AmountCentavos, expectedCentavos, request.TargetTier);
                return BadRequest(new { message = "Payment amount does not match plan price." });
            }

            var outcome = await _mediator.Send(new ApplySubscriptionPaymentCommand(
                _currentUserService.TenantId,
                request.TargetTier,
                request.Cycle,
                expectedCentavos,
                statusResult.PaymentId,
                "QRPh",
                statusResult.Currency!,
                statusResult.PaidAt,
                purpose ?? "subscription"
            ), cancellationToken);

            if (!outcome.Success)
            {
                return BadRequest(new { message = outcome.Message });
            }

            var subscription = await _mediator.Send(new GetTenantSubscriptionQuery(), cancellationToken);
            return Ok(subscription with
            {
                PaymentConfirmed = true,
                AllowLibreUpgrade = IsLibreUpgradeAllowed(),
                EnableHostedCheckout = IsHostedCheckoutEnabled()
            });
        }
        catch (PaymentGatewayException ex)
        {
            _logger.LogError(ex, "Failed to confirm QR Ph subscription payment.");
            return StatusCode(StatusCodes.Status502BadGateway, new { message = ex.Message });
        }
    }

    public record ConfirmCheckoutRequest(string? SessionId = null);

    /// <summary>
    /// Confirms and synchronizes a PayMongo checkout session with the tenant's subscription.
    /// Provides an immediate, reliable fallback when webhooks are delayed, unregistered, or failed.
    /// </summary>
    [HttpPost("confirm-session")]
    [ProducesResponseType(typeof(TenantSubscriptionDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status502BadGateway)]
    public async Task<ActionResult<TenantSubscriptionDto>> ConfirmSession(
        [FromBody] ConfirmCheckoutRequest? request,
        CancellationToken cancellationToken)
    {
        if (_currentUserService.TenantId == Guid.Empty)
        {
            return Unauthorized(new { message = "A valid tenant is required to confirm checkout." });
        }

        try
        {
            var result = await _mediator.Send(
                new ConfirmCheckoutSessionCommand(_currentUserService.TenantId, request?.SessionId),
                cancellationToken);
            return Ok(result with
            {
                AllowLibreUpgrade = IsLibreUpgradeAllowed(),
                EnableHostedCheckout = IsHostedCheckoutEnabled()
            });
        }
        catch (PaymentGatewayException ex)
        {
            _logger.LogError(ex, "Payment gateway failure during checkout confirmation.");
            return StatusCode(StatusCodes.Status502BadGateway, new { message = ex.Message });
        }
    }

    /// <summary>
    /// Retrieves current tenant subscription status, limits, and usage counts.
    /// </summary>
    [HttpGet("subscription")]
    [ProducesResponseType(typeof(TenantSubscriptionDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<TenantSubscriptionDto>> GetSubscription(CancellationToken cancellationToken)
    {
        if (_currentUserService.TenantId == Guid.Empty)
        {
            return Unauthorized(new { message = "A valid tenant is required to retrieve subscription details." });
        }

        try
        {
            var result = await _mediator.Send(new GetTenantSubscriptionQuery(), cancellationToken);
            return Ok(result with
            {
                AllowLibreUpgrade = IsLibreUpgradeAllowed(),
                EnableHostedCheckout = IsHostedCheckoutEnabled()
            });
        }
        catch (UnauthorizedAccessException ex)
        {
            _logger.LogWarning(ex, "Subscription details requested without a resolved tenant.");
            return Unauthorized(new { message = "A valid tenant is required to retrieve subscription details." });
        }
    }

    /// <summary>
    /// Retrieves payment history for the tenant.
    /// </summary>
    [HttpGet("history")]
    [ProducesResponseType(typeof(List<PaymentHistoryDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<List<PaymentHistoryDto>>> GetHistory(CancellationToken cancellationToken)
    {
        var result = await _mediator.Send(new GetPaymentHistoryQuery(), cancellationToken);
        return Ok(result);
    }

    public record MockPayRequest(
        PlanTier TargetTier,
        BillingCycle Cycle = BillingCycle.Monthly
    );

    /// <summary>
    /// DEVELOPMENT ONLY: simulates a successful payment at the canonical plan price.
    /// Returns 404 in every non-Development environment.
    /// </summary>
    [HttpPost("mock-pay")]
    [AllowAnonymous]
    [ApiExplorerSettings(IgnoreApi = true)]
    public async Task<ActionResult<WebhookProcessResultDto>> MockPay(
        [FromBody] MockPayRequest request,
        CancellationToken cancellationToken)
    {
        if (!_environment.IsDevelopment())
        {
            return NotFound();
        }

        if (request.TargetTier != PlanTier.TindahanPro || request.Cycle != BillingCycle.Monthly ||
            !TierPricing.TryGetPriceCentavos(request.TargetTier, request.Cycle, out var priceCentavos))
        {
            return BadRequest(new { message = "Invalid plan or billing cycle." });
        }

        var tenantId = _currentUserService.TenantId;
        var dbContext = _dbContext ?? HttpContext?.RequestServices.GetService<IApplicationDbContext>();
        Tenant? tenant = null;
        if (dbContext != null)
        {
            tenant = await dbContext.Tenants
                .IgnoreQueryFilters()
                .FirstOrDefaultAsync(t => t.Id == tenantId, cancellationToken);
        }

        var isRenewal = tenant != null && (tenant.Tier != PlanTier.Libre || tenant.SubscriptionEndDate.HasValue);
        if (!IsLibreUpgradeAllowed() && !isRenewal)
        {
            return BadRequest(new { message = "Upgrading from Libre to Tindahan Pro is temporarily paused." });
        }

        var result = await _mediator.Send(new ApplySubscriptionPaymentCommand(
            tenantId,
            request.TargetTier,
            request.Cycle,
            priceCentavos,
            $"mock_pay_{Guid.NewGuid():N}",
            "mock",
            "PHP",
            DateTimeOffset.UtcNow,
            "subscription"), cancellationToken);

        return result.Success ? Ok(result) : BadRequest(new { message = result.Message });
    }

    /// <summary>
    /// DEVELOPMENT ONLY: resets the tenant subscription to the free Libre tier and clears payment history.
    /// </summary>
    [HttpPost("reset")]
    [AllowAnonymous]
    [ApiExplorerSettings(IgnoreApi = true)]
    public async Task<IActionResult> ResetSubscription(CancellationToken cancellationToken)
    {
        if (!_environment.IsDevelopment())
        {
            return NotFound();
        }

        var tenantId = _currentUserService.TenantId;
        if (tenantId == Guid.Empty)
        {
            return BadRequest(new { message = "No resolved tenant to reset." });
        }

        await _mediator.Send(new ResetTenantSubscriptionCommand(tenantId), cancellationToken);
        return Ok(new { message = "Subscription successfully reset to Libre." });
    }
}
