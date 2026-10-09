using MediatR;
using Microsoft.AspNetCore.Mvc;
using FluentTindahan.Application.GCash;

namespace FluentTindahan.WebApi.Controllers;

[ApiController]
[Route("api/[controller]")]
public class GCashController : ControllerBase
{
    private readonly IMediator _mediator;

    public GCashController(IMediator mediator)
    {
        _mediator = mediator;
    }

    [HttpGet]
    public async Task<ActionResult<List<GCashTxnDto>>> GetAll(CancellationToken cancellationToken)
    {
        var result = await _mediator.Send(new GetGCashTransactionsQuery(), cancellationToken);
        return Ok(result);
    }

    [HttpPost]
    public async Task<ActionResult<GCashTxnDto>> Record([FromBody] RecordGCashTxnCommand command, CancellationToken cancellationToken)
    {
        var result = await _mediator.Send(command, cancellationToken);
        return Ok(result);
    }
}
