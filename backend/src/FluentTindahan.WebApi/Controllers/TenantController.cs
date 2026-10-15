using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Npgsql;
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
    private readonly IJwtTokenService? _jwtTokenService;

    public TenantController(
        IApplicationDbContext context,
        ICurrentUserService currentUserService,
        IJwtTokenService? jwtTokenService = null)
    {
        _context = context;
        _currentUserService = currentUserService;
        _jwtTokenService = jwtTokenService;
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
    public sealed record ProvisionTenantResponse(
        Guid TenantId,
        Guid UserId,
        PlanTier Tier,
        string? Token = null,
        string? RefreshToken = null,
        string? DeviceSessionToken = null);

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
    [EnableRateLimiting("AnonymousDemoProvision")]
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

        Guid ownerId;
        if (_currentUserService.IsAuthenticated)
        {
            var authenticatedUserId = _currentUserService.UserId;
            if (!authenticatedUserId.HasValue || authenticatedUserId.Value == Guid.Empty)
            {
                return Unauthorized(new { message = "The authenticated user does not have a valid user ID." });
            }
            if (request.UserId != authenticatedUserId.Value)
            {
                return BadRequest(new { message = "The owner ID must match the authenticated user." });
            }

            ownerId = authenticatedUserId.Value;
        }
        else
        {
            ownerId = request.UserId;
        }

        var tenant = await _context.Tenants.IgnoreQueryFilters()
            .FirstOrDefaultAsync(candidate => candidate.Id == tenantId, cancellationToken);
        var createsTenant = tenant == null;
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
            .FirstOrDefaultAsync(candidate => candidate.Id == ownerId, cancellationToken);
        if (user != null && user.TenantId != tenantId)
        {
            return Conflict(new { message = "The owner ID is already associated with another tenant." });
        }

        var tenantHasUsers = await _context.Users.IgnoreQueryFilters()
            .AnyAsync(candidate => candidate.TenantId == tenantId, cancellationToken);
        if (user == null)
        {
            if (!createsTenant && tenantHasUsers)
            {
                return Forbid();
            }

            user = new User
            {
                Id = ownerId,
                TenantId = tenantId,
                Phone = request.Phone?.Trim() ?? string.Empty,
                Role = "Owner",
                CreatedAt = DateTimeOffset.UtcNow
            };
            _context.Users.Add(user);
        }
        else if (string.IsNullOrWhiteSpace(user.Phone) && !string.IsNullOrWhiteSpace(request.Phone))
        {
            user.Phone = request.Phone.Trim();
        }

        string? token = null;
        string? refreshToken = null;

        if (_jwtTokenService != null)
        {
            var (accToken, _) = _jwtTokenService.GenerateAccessToken(ownerId, tenantId, role: "Owner");
            var (refToken, refExpiresAt, tokenId) = _jwtTokenService.GenerateRefreshToken(ownerId, tenantId);
            user.RefreshTokenIdHash = _jwtTokenService.HashTokenId(tokenId);
            user.RefreshTokenExpiresAt = refExpiresAt;
            token = accToken;
            refreshToken = refToken;
        }

        try
        {
            await _context.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException ex) when (IsUniqueConstraintViolation(ex))
        {
            _context.ChangeTracker.Clear();

            var existingTenant = await _context.Tenants.IgnoreQueryFilters()
                .FirstOrDefaultAsync(candidate => candidate.Id == tenantId, cancellationToken);
            var existingOwner = await _context.Users.IgnoreQueryFilters()
                .FirstOrDefaultAsync(candidate => candidate.Id == ownerId, cancellationToken);

            if (existingTenant != null && existingOwner?.TenantId == tenantId)
            {
                if (_jwtTokenService != null)
                {
                    var (accToken, _) = _jwtTokenService.GenerateAccessToken(ownerId, tenantId, role: "Owner");
                    var (refToken, refExpiresAt, tokenId) = _jwtTokenService.GenerateRefreshToken(ownerId, tenantId);
                    existingOwner.RefreshTokenIdHash = _jwtTokenService.HashTokenId(tokenId);
                    existingOwner.RefreshTokenExpiresAt = refExpiresAt;
                    await _context.SaveChangesAsync(cancellationToken);
                    return Ok(new ProvisionTenantResponse(tenantId, ownerId, existingTenant.Tier, accToken, refToken, refToken));
                }

                return Ok(new ProvisionTenantResponse(tenantId, ownerId, existingTenant.Tier));
            }

            if (existingOwner != null && existingOwner.TenantId != tenantId)
            {
                return Conflict(new { message = "The owner ID is already associated with another tenant." });
            }

            if (existingTenant != null && await _context.Users.IgnoreQueryFilters()
                    .AnyAsync(candidate => candidate.TenantId == tenantId, cancellationToken))
            {
                return Forbid();
            }

            throw;
        }

        return Ok(new ProvisionTenantResponse(tenantId, ownerId, tenant.Tier, token, refreshToken, refreshToken));
    }

    private static bool IsUniqueConstraintViolation(DbUpdateException exception)
    {
        for (Exception? current = exception; current != null; current = current.InnerException)
        {
            if (current is PostgresException postgresException
                && postgresException.SqlState == PostgresErrorCodes.UniqueViolation)
            {
                return true;
            }
        }

        return false;
    }
}
