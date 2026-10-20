using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using FluentTindahan.Application.Customers;
using FluentTindahan.WebApi.Authorization;

namespace FluentTindahan.WebApi.Controllers;

[ApiController]
[Authorize(Policy = AuthorizationPolicies.TenantResolved)]
[Route("api/[controller]")]
public class CustomersController : ControllerBase
{
    private readonly IMediator _mediator;

    public CustomersController(IMediator mediator)
    {
        _mediator = mediator;
    }

    [HttpGet]
    public async Task<ActionResult<List<CustomerDto>>> GetAll(CancellationToken cancellationToken)
    {
        var result = await _mediator.Send(new GetCustomersQuery(), cancellationToken);
        return Ok(result);
    }

    [HttpPost]
    public async Task<ActionResult<CustomerDto>> Create([FromBody] CreateCustomerCommand command, CancellationToken cancellationToken)
    {
        var result = await _mediator.Send(command, cancellationToken);
        return CreatedAtAction(nameof(GetAll), new { id = result.Id }, result);
    }
}
