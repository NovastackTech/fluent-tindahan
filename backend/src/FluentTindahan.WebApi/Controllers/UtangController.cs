using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using FluentTindahan.Application.Utang;
using FluentTindahan.WebApi.Authorization;

namespace FluentTindahan.WebApi.Controllers;

[ApiController]
[Authorize(Policy = AuthorizationPolicies.TenantResolved)]
[Route("api/[controller]")]
public class UtangController : ControllerBase
{
    private readonly IMediator _mediator;

    public UtangController(IMediator mediator)
    {
        _mediator = mediator;
    }

    [HttpGet]
    public async Task<ActionResult<List<UtangLedgerDto>>> GetAll([FromQuery] Guid? customerId, [FromQuery] int? limit, CancellationToken cancellationToken)
    {
        var result = await _mediator.Send(new GetUtangLedgerQuery(customerId, limit), cancellationToken);
        return Ok(result);
    }

    [HttpPost]
    public async Task<ActionResult<UtangLedgerDto>> Record([FromBody] RecordUtangCommand command, CancellationToken cancellationToken)
    {
        var result = await _mediator.Send(command, cancellationToken);
        return Ok(result);
    }
}
