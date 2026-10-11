using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using FluentTindahan.Application.Common.Interfaces;
using FluentTindahan.Domain.Enums;
using FluentTindahan.Domain.Interfaces;

namespace FluentTindahan.WebApi.Controllers;

[ApiController]
[Route("api/[controller]")]
public class TenantController : ControllerBase
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserService _currentUserService;

    public TenantController(
        IApplicationDbContext context,
        ICurrentUserService currentUserService)
    {
        _context = context;
        _currentUserService = currentUserService;
    }

    public record TenantProfileDto(
        Guid Id,
        string BusinessName,
        PlanTier Tier,
        string PlanTier,
        DateTimeOffset? SubscriptionEndDate,
        bool IsActive
    );

    /// <summary>
    /// Retrieves the current tenant's profile, including active PlanTier and SubscriptionEndDate.
    /// Polled by PWA frontend to detect tier updates and synchronization permissions.
    /// </summary>
    [HttpGet("profile")]
    [ProducesResponseType(typeof(TenantProfileDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<TenantProfileDto>> GetProfile(CancellationToken cancellationToken)
    {
        var tenantId = _currentUserService.TenantId;
        if (tenantId == Guid.Empty)
        {
            return Unauthorized(new { message = "User is not authenticated or tenant is not resolved." });
        }

        var tenant = await _context.Tenants
            .AsNoTracking()
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(t => t.Id == tenantId, cancellationToken);

        if (tenant == null)
        {
            return NotFound(new { message = $"Tenant {tenantId} not found." });
        }

        var now = DateTimeOffset.UtcNow;
        var isExpired = tenant.Tier != PlanTier.Libre &&
                        tenant.SubscriptionEndDate.HasValue &&
                        tenant.SubscriptionEndDate.Value < now;

        var effectiveTier = isExpired ? PlanTier.Libre : tenant.Tier;
        var isActive = effectiveTier != PlanTier.Libre && (!tenant.SubscriptionEndDate.HasValue || tenant.SubscriptionEndDate.Value >= now);

        return Ok(new TenantProfileDto(
            tenant.Id,
            tenant.BusinessName,
            effectiveTier,
            effectiveTier.ToString(),
            tenant.SubscriptionEndDate,
            isActive
        ));
    }
}
