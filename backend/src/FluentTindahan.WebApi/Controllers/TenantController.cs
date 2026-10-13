using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using FluentTindahan.Application.Common.Interfaces;
using FluentTindahan.Domain.Entities;
using FluentTindahan.Domain.Enums;
using FluentTindahan.Domain.Interfaces;
using FluentTindahan.WebApi.Authorization;

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

    /// <summary>Initial store identity sent before syncing offline changes.</summary>
    public sealed record ProvisionTenantRequest
    {
        [Required]
        public Guid UserId { get; init; }

        [Required, StringLength(200, MinimumLength = 2)]
        public string BusinessName { get; init; } = string.Empty;

        [StringLength(30)]
        public string? Phone { get; init; }
    }

    /// <summary>Confirms the current tenant and owner user are ready for sync.</summary>
    public sealed record ProvisionTenantResponse(Guid TenantId, Guid UserId, PlanTier Tier);

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

    /// <summary>
    /// Ensures the server-resolved tenant and its owner exist before uploading offline changes.
    /// Existing subscription data is preserved, making this operation safe to retry.
    /// </summary>
    [HttpPut("provision")]
    [Authorize(Policy = AuthorizationPolicies.TenantResolved)]
    [ProducesResponseType(typeof(ProvisionTenantResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<ProvisionTenantResponse>> Provision(
        [FromBody] ProvisionTenantRequest request,
        CancellationToken cancellationToken)
    {
        var tenantId = _currentUserService.TenantId;
        if (tenantId == Guid.Empty)
        {
            return Unauthorized(new { message = "A valid tenant is required to provision a store." });
        }

        var businessName = request.BusinessName.Trim();
        if (request.UserId == Guid.Empty || businessName.Length < 2)
        {
            return BadRequest(new { message = "A valid owner ID and store name are required." });
        }

        var tenant = await _context.Tenants.IgnoreQueryFilters()
            .FirstOrDefaultAsync(candidate => candidate.Id == tenantId, cancellationToken);
        if (tenant == null)
        {
            tenant = new Tenant
            {
                Id = tenantId,
                BusinessName = businessName,
                Tier = PlanTier.Libre,
                CreatedAt = DateTimeOffset.UtcNow
            };
            _context.Tenants.Add(tenant);
        }
        else if (string.IsNullOrWhiteSpace(tenant.BusinessName))
        {
            tenant.BusinessName = businessName;
        }

        var user = await _context.Users.IgnoreQueryFilters()
            .FirstOrDefaultAsync(candidate => candidate.Id == request.UserId, cancellationToken);
        if (user != null && user.TenantId != tenantId)
        {
            return Conflict(new { message = "The owner ID is already associated with another tenant." });
        }

        if (user == null)
        {
            _context.Users.Add(new User
            {
                Id = request.UserId,
                TenantId = tenantId,
                Phone = request.Phone?.Trim() ?? string.Empty,
                Role = "Owner",
                CreatedAt = DateTimeOffset.UtcNow
            });
        }
        else if (string.IsNullOrWhiteSpace(user.Phone) && !string.IsNullOrWhiteSpace(request.Phone))
        {
            user.Phone = request.Phone.Trim();
        }

        await _context.SaveChangesAsync(cancellationToken);
        return Ok(new ProvisionTenantResponse(tenantId, request.UserId, tenant.Tier));
    }
}
