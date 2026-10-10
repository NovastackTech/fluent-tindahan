using MediatR;
using Microsoft.AspNetCore.Mvc;
using FluentTindahan.Application.Billing;
using FluentTindahan.Application.Common.Interfaces;
using FluentTindahan.Domain.Billing;
using FluentTindahan.Domain.Enums;
using FluentTindahan.Domain.Interfaces;

namespace FluentTindahan.WebApi.Controllers;

[ApiController]
[Route("api/[controller]")]
public class BillingController : ControllerBase
{
    private readonly IMediator _mediator;
    private readonly ICurrentUserService _currentUserService;
    private readonly IHostEnvironment _environment;
    private readonly ILogger<BillingController> _logger;

    public BillingController(
        IMediator mediator,
        ICurrentUserService currentUserService,
        IHostEnvironment environment,
        ILogger<BillingController> logger)
    {
        _mediator = mediator;
        _currentUserService = currentUserService;
        _environment = environment;
        _logger = logger;
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
    /// Creates a PayMongo Checkout Session for upgrading to Tindahan Pro or Negosyo Plus.
    /// </summary>
    [HttpPost("checkout")]
    [ProducesResponseType(typeof(CheckoutSessionResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status502BadGateway)]
    public async Task<ActionResult<CheckoutSessionResponseDto>> CreateCheckout(
        [FromBody] CreateCheckoutRequest request,
        CancellationToken cancellationToken)
    {
        if (request.TargetTier == PlanTier.Libre ||
            !TierPricing.TryGetPriceCentavos(request.TargetTier, request.Cycle, out _))
        {
            return BadRequest(new { message = "Invalid plan or billing cycle." });
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
    /// Retrieves current tenant subscription status, limits, and usage counts.
    /// </summary>
    [HttpGet("subscription")]
    [ProducesResponseType(typeof(TenantSubscriptionDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<TenantSubscriptionDto>> GetSubscription(CancellationToken cancellationToken)
    {
        var result = await _mediator.Send(new GetTenantSubscriptionQuery(), cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Retrieves payment history for the tenant.
    /// </summary>
    [HttpGet("history")]
    [ProducesResponseType(typeof(List<PaymentHistoryDto>), StatusCodes.Status200OK)]
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
    [ApiExplorerSettings(IgnoreApi = true)]
    public async Task<ActionResult<WebhookProcessResultDto>> MockPay(
        [FromBody] MockPayRequest request,
        CancellationToken cancellationToken)
    {
        if (!_environment.IsDevelopment())
        {
            return NotFound();
        }

        if (!TierPricing.TryGetPriceCentavos(request.TargetTier, request.Cycle, out var priceCentavos))
        {
            return BadRequest(new { message = "Invalid plan or billing cycle." });
        }

        var result = await _mediator.Send(new ApplySubscriptionPaymentCommand(
            _currentUserService.TenantId,
            request.TargetTier,
            request.Cycle,
            priceCentavos,
            $"mock_pay_{Guid.NewGuid():N}",
            "mock"), cancellationToken);

        return result.Success ? Ok(result) : BadRequest(new { message = result.Message });
    }
}
