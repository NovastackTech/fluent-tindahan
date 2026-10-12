using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using FluentTindahan.Application.Sync.Commands;
using FluentTindahan.Application.Sync.DTOs;
using FluentTindahan.WebApi.Authorization;

namespace FluentTindahan.WebApi.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Policy = AuthorizationPolicies.TenantResolved)]
public class SyncController : ControllerBase
{
    private readonly IMediator _mediator;
    private readonly ILogger<SyncController> _logger;

    public SyncController(
        IMediator mediator,
        ILogger<SyncController> logger)
    {
        _mediator = mediator;
        _logger = logger;
    }

    /// <summary>
    /// Processes a batch of offline synchronization operations from the client.
    /// Supports append-only ledgers, Last-Write-Wins (LWW) conflict resolution, and poison-pill isolation.
    /// </summary>
    [HttpPost("batch")]
    [ProducesResponseType(typeof(BatchSyncResultDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<ActionResult<BatchSyncResultDto>> ProcessBatch([FromBody] BatchSyncRequestDto request, CancellationToken cancellationToken)
    {
        if (request == null || request.Operations == null)
        {
            return BadRequest(new { message = "Invalid batch sync payload." });
        }

        _logger.LogInformation("Received batch sync from device {DeviceId} with {Count} operations",
            request.DeviceId, request.Operations.Count);

        var result = await _mediator.Send(new ProcessBatchSyncCommand(request), cancellationToken);
        return Ok(result);
    }
}
