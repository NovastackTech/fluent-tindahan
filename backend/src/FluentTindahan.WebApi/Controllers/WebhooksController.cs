using MediatR;
using Microsoft.AspNetCore.Mvc;
using FluentTindahan.Application.Billing;

namespace FluentTindahan.WebApi.Controllers;

[ApiController]
[Route("api/[controller]")]
public class WebhooksController : ControllerBase
{
    private readonly IMediator _mediator;
    private readonly ILogger<WebhooksController> _logger;

    public WebhooksController(IMediator mediator, ILogger<WebhooksController> logger)
    {
        _mediator = mediator;
        _logger = logger;
    }

    /// <summary>
    /// PayMongo Webhook ingestion endpoint.
    /// Validates signature, parses payment event, updates tenant subscription tier and end date, and appends payment history.
    /// </summary>
    [HttpPost("billing/paymongo")]
    public async Task<IActionResult> PayMongoWebhook(CancellationToken cancellationToken)
    {
        string payload;
        using (var reader = new StreamReader(Request.Body))
        {
            payload = await reader.ReadToEndAsync(cancellationToken);
        }

        var signature = Request.Headers["paymongo-signature"].ToString();

        _logger.LogInformation("Received PayMongo billing webhook. Payload length: {Length}, Has Signature: {HasSig}",
            payload.Length, !string.IsNullOrEmpty(signature));

        var command = new ProcessPaymentWebhookCommand(payload, signature);

        WebhookProcessResultDto result;
        try
        {
            result = await _mediator.Send(command, cancellationToken);
        }
        catch (Exception ex)
        {
            // Real failures (DB outage etc.) must be 5xx so PayMongo retries; never leak exception text.
            _logger.LogError(ex, "Unexpected error while processing PayMongo webhook.");
            return StatusCode(StatusCodes.Status500InternalServerError, new { message = "Internal error." });
        }

        switch (result.Outcome)
        {
            case PaymentWebhookOutcome.Processed:
                return Ok(new { status = "processed", tier = result.Tier?.ToString(), endDate = result.NewEndDate });
            case PaymentWebhookOutcome.Duplicate:
                return Ok(new { status = "duplicate" });
            case PaymentWebhookOutcome.Ignored:
                return Ok(new { status = "ignored" });
            case PaymentWebhookOutcome.InvalidSignature:
                _logger.LogWarning("Webhook rejected: invalid signature.");
                return Unauthorized(new { message = "Invalid signature." });
            default:
                _logger.LogWarning("Webhook rejected: {Message}", result.Message);
                return BadRequest(new { message = result.Message });
        }
    }
}
