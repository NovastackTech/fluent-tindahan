using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using FluentTindahan.Application.GCash;
using FluentTindahan.WebApi.Authorization;

namespace FluentTindahan.WebApi.Controllers;

[ApiController]
[Authorize(Policy = AuthorizationPolicies.TenantResolved)]
[Route("api/[controller]")]
public class GCashController : ControllerBase
{
    private readonly IMediator _mediator;

    public GCashController(IMediator mediator)
    {
        _mediator = mediator;
    }

    [HttpGet]
    public async Task<ActionResult<List<GCashTxnDto>>> GetAll([FromQuery] int? limit, CancellationToken cancellationToken)
    {
        var result = await _mediator.Send(new GetGCashTransactionsQuery(limit), cancellationToken);
        return Ok(result);
    }

    [HttpPost]
    [ProducesResponseType(typeof(GCashTxnDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<GCashTxnDto>> Record([FromBody] RecordGCashTxnCommand command, CancellationToken cancellationToken)
    {
        try
        {
            var result = await _mediator.Send(command, cancellationToken);
            return Ok(result);
        }
        catch (DuplicateGCashRefException ex)
        {
            return Conflict(new { message = ex.Message });
        }
        // Defensive fallback if a provider exception escapes the command handler.
        catch (Microsoft.EntityFrameworkCore.DbUpdateException ex) when (RecordGCashTxnCommandHandler.IsUniqueIndexViolation(ex))
        {
            return Conflict(new { message = $"Duplicate GCash reference number '{command.RefNo?.Trim()}' for this tenant." });
        }
    }
}

