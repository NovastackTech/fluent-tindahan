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
        var result = await _mediator.Send(command, cancellationToken);

        if (!result.Success)
        {
            _logger.LogWarning("Webhook processing rejected: {Message}", result.Message);
            return BadRequest(new { message = result.Message });
        }

        return Ok(new { status = "success", message = result.Message, tier = result.Tier?.ToString(), endDate = result.NewEndDate });
    }
}
