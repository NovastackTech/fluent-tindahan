using MediatR;
using Microsoft.AspNetCore.Mvc;
using FluentTindahan.Application.Utang;

namespace FluentTindahan.WebApi.Controllers;

[ApiController]
[Route("api/[controller]")]
public class UtangController : ControllerBase
{
    private readonly IMediator _mediator;

    public UtangController(IMediator mediator)
    {
        _mediator = mediator;
    }

    [HttpGet]
    public async Task<ActionResult<List<UtangLedgerDto>>> GetAll([FromQuery] Guid? customerId, CancellationToken cancellationToken)
    {
        var result = await _mediator.Send(new GetUtangLedgerQuery(customerId), cancellationToken);
        return Ok(result);
    }

    [HttpPost]
    public async Task<ActionResult<UtangLedgerDto>> Record([FromBody] RecordUtangCommand command, CancellationToken cancellationToken)
    {
        var result = await _mediator.Send(command, cancellationToken);
        return Ok(result);
    }
}
