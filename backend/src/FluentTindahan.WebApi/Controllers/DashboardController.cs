using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using FluentTindahan.Application.Dashboard;
using FluentTindahan.WebApi.Authorization;

namespace FluentTindahan.WebApi.Controllers;

[ApiController]
[Authorize(Policy = AuthorizationPolicies.TenantResolved)]
[Route("api/[controller]")]
public class DashboardController : ControllerBase
{
    private readonly IMediator _mediator;

    public DashboardController(IMediator mediator)
    {
        _mediator = mediator;
    }

    [HttpGet("summary")]
    public async Task<ActionResult<DashboardSummaryDto>> GetSummary(CancellationToken cancellationToken)
    {
        var result = await _mediator.Send(new GetDashboardSummaryQuery(), cancellationToken);
        return Ok(result);
    }
}
