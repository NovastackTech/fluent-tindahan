using MediatR;
using Microsoft.AspNetCore.Mvc;
using FluentTindahan.Application.Billing;
using FluentTindahan.Domain.Enums;
using FluentTindahan.Domain.Interfaces;

namespace FluentTindahan.WebApi.Controllers;

[ApiController]
[Route("api/[controller]")]
public class BillingController : ControllerBase
{
    private readonly IMediator _mediator;
    private readonly ICurrentUserService _currentUserService;
    private readonly ILogger<BillingController> _logger;

    public BillingController(
        IMediator mediator,
        ICurrentUserService currentUserService,
        ILogger<BillingController> logger)
    {
        _mediator = mediator;
        _currentUserService = currentUserService;
        _logger = logger;
    }

    public record CreateCheckoutRequest(
        PlanTier TargetTier,
        BillingCycle Cycle = BillingCycle.Monthly,
        string? SuccessUrl = null,
        string? CancelUrl = null
    );

    /// <summary>
    /// Creates a PayMongo Checkout Session for upgrading to Tindahan Pro or Negosyo Plus.
    /// </summary>
    [HttpPost("checkout")]
    [ProducesResponseType(typeof(CheckoutSessionResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<CheckoutSessionResponseDto>> CreateCheckout(
        [FromBody] CreateCheckoutRequest request,
        CancellationToken cancellationToken)
    {
        if (request.TargetTier == PlanTier.Libre)
        {
            return BadRequest(new { message = "Cannot checkout Libre tier." });
        }

        try
        {
            var command = new CreateCheckoutSessionCommand(
                request.TargetTier,
                request.Cycle,
                request.SuccessUrl,
                request.CancelUrl
            );

            var result = await _mediator.Send(command, cancellationToken);
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to create checkout session.");
            return BadRequest(new { message = ex.Message });
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
        BillingCycle Cycle = BillingCycle.Monthly,
        decimal? Amount = null
    );

    /// <summary>
    /// Development/Testing helper: Simulates payment completion without calling external gateway.
    /// </summary>
    [HttpPost("mock-pay")]
    public async Task<ActionResult<WebhookProcessResultDto>> MockPay(
        [FromBody] MockPayRequest request,
        CancellationToken cancellationToken)
    {
        var tenantId = _currentUserService.TenantId;
        var amount = request.Amount ?? (request.TargetTier == PlanTier.NegosyoPlus
            ? (request.Cycle == BillingCycle.Weekly ? 89m : 349m)
            : (request.Cycle == BillingCycle.Weekly ? 35m : 129m));

        var json = System.Text.Json.JsonSerializer.Serialize(new
        {
            tenant_id = tenantId.ToString(),
            tier = request.TargetTier.ToString(),
            cycle = request.Cycle.ToString(),
            amount = amount,
            reference_id = $"mock_tx_{DateTimeOffset.UtcNow.ToUnixTimeSeconds()}"
        });

        var result = await _mediator.Send(new ProcessPaymentWebhookCommand(json, "mock"), cancellationToken);
        return Ok(result);
    }
}
