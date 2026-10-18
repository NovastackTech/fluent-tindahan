using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using FluentTindahan.Application.Common.Interfaces;
using FluentTindahan.Domain.Entities;
using FluentTindahan.Domain.Interfaces;

namespace FluentTindahan.WebApi.Controllers.Helpers;

/// <summary>
/// Extracts user identifiers, tenant identifiers, client IP addresses, and session authenticity checks from HTTP requests and claims.
/// </summary>
public static class AuthClaimsHelper
{
    public static string GetClientIpAddress(HttpContext? httpContext)
    {
        var remoteIp = httpContext?.Connection?.RemoteIpAddress?.ToString();
        return string.IsNullOrWhiteSpace(remoteIp) ? "127.0.0.1" : remoteIp;
    }

    public static Guid? ResolveUserId(ICurrentUserService? currentUserService, ClaimsPrincipal? userPrincipal)
    {
        var claimUserId = currentUserService?.UserId;
        if (claimUserId.HasValue && claimUserId.Value != Guid.Empty)
        {
            return claimUserId.Value;
        }

        var sub = userPrincipal?.FindFirst(ClaimTypes.NameIdentifier)?.Value
            ?? userPrincipal?.FindFirst("sub")?.Value
            ?? userPrincipal?.FindFirst("user_id")?.Value;

        if (Guid.TryParse(sub, out var parsedSub) && parsedSub != Guid.Empty)
        {
            return parsedSub;
        }

        return null;
    }

    public static Guid? ResolveTenantId(ICurrentUserService? currentUserService, ClaimsPrincipal? userPrincipal)
    {
        var claimTenantId = currentUserService?.TenantId;
        if (claimTenantId.HasValue && claimTenantId.Value != Guid.Empty)
        {
            return claimTenantId.Value;
        }

        var tClaim = userPrincipal?.FindFirst("tenant_id")?.Value
            ?? userPrincipal?.FindFirst("TenantId")?.Value;

        if (Guid.TryParse(tClaim, out var parsedTenant) && parsedTenant != Guid.Empty)
        {
            return parsedTenant;
        }

        return null;
    }

    public static bool IsAuthenticated(ICurrentUserService? currentUserService, ClaimsPrincipal? userPrincipal)
    {
        return (currentUserService != null && currentUserService.IsAuthenticated)
            || (userPrincipal?.Identity?.IsAuthenticated == true);
    }

    public static async Task<bool> ValidatePlaceholderSessionAsync(
        IJwtTokenService jwtTokenService,
        IApplicationDbContext context,
        User placeholderUser,
        Guid tenantId,
        string? candidateSessionToken,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(candidateSessionToken))
        {
            return false;
        }

        if (!jwtTokenService.ValidateRefreshToken(candidateSessionToken, out var sessionUserId, out var sessionTenantId, out var sessionTokenId))
        {
            return false;
        }

        if (sessionUserId != placeholderUser.Id || sessionTenantId != tenantId)
        {
            return false;
        }

        var incomingTokenIdHash = jwtTokenService.HashTokenId(sessionTokenId);
        var matchesTable = await context.UserRefreshTokens.IgnoreQueryFilters()
            .AnyAsync(r => r.UserId == placeholderUser.Id && r.TokenHash == incomingTokenIdHash && !r.IsRevoked, cancellationToken);

        if (matchesTable)
        {
            return true;
        }

        if (!string.IsNullOrEmpty(placeholderUser.RefreshTokenIdHash))
        {
            return CryptographicOperations.FixedTimeEquals(
                Encoding.UTF8.GetBytes(placeholderUser.RefreshTokenIdHash),
                Encoding.UTF8.GetBytes(incomingTokenIdHash));
        }

        return true;
    }
}
