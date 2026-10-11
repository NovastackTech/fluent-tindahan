using MediatR;
using Microsoft.AspNetCore.Mvc;
using FluentTindahan.Application.Sync.Commands;
using FluentTindahan.Application.Sync.DTOs;
using FluentTindahan.Domain.Interfaces;

namespace FluentTindahan.WebApi.Controllers;

[ApiController]
[Route("api/[controller]")]
public class SyncController : ControllerBase
{
    private readonly IMediator _mediator;
    private readonly ICurrentUserService _currentUserService;
    private readonly ILogger<SyncController> _logger;

    public SyncController(
        IMediator mediator,
        ICurrentUserService currentUserService,
        ILogger<SyncController> logger)
    {
        _mediator = mediator;
        _currentUserService = currentUserService;
        _logger = logger;
    }

    /// <summary>
    /// Processes a batch of offline synchronization operations from the client.
    /// Supports append-only ledgers, Last-Write-Wins (LWW) conflict resolution, and poison-pill isolation.
    /// </summary>
    [HttpPost("batch")]
    [ProducesResponseType(typeof(BatchSyncResultDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<BatchSyncResultDto>> ProcessBatch([FromBody] BatchSyncRequestDto request, CancellationToken cancellationToken)
    {
        if (request == null || request.Operations == null)
        {
            return BadRequest(new { message = "Invalid batch sync payload." });
        }

        if (_currentUserService.TenantId == Guid.Empty)
        {
            return Unauthorized(new { message = "A valid tenant is required to sync this device's changes." });
        }

        _logger.LogInformation("Received batch sync from device {DeviceId} with {Count} operations",
            request.DeviceId, request.Operations.Count);

        try
        {
            var result = await _mediator.Send(new ProcessBatchSyncCommand(request), cancellationToken);
            return Ok(result);
        }
        catch (UnauthorizedAccessException ex)
        {
            _logger.LogWarning(ex, "Batch sync rejected because tenant identity could not be resolved.");
            return Unauthorized(new { message = "A valid tenant is required to sync this device's changes." });
        }
    }
}
