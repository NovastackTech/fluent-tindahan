using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using FluentTindahan.Domain.Interfaces;

namespace FluentTindahan.Infrastructure.Services;

public class CurrentUserService : ICurrentUserService
{
    private readonly IHttpContextAccessor _httpContextAccessor;

    public static readonly Guid DefaultTenantId = Guid.Parse("11111111-1111-1111-1111-111111111111");
    public static readonly Guid DefaultUserId = Guid.Parse("22222222-2222-2222-2222-222222222222");

    public CurrentUserService(IHttpContextAccessor httpContextAccessor)
    {
        _httpContextAccessor = httpContextAccessor;
    }

    public Guid TenantId
    {
        get
        {
            var httpContext = _httpContextAccessor.HttpContext;
            if (httpContext == null) return DefaultTenantId;

            // 1. Check custom header (useful for client device sync)
            if (httpContext.Request.Headers.TryGetValue("X-Tenant-Id", out var tenantHeader) &&
                Guid.TryParse(tenantHeader, out var parsedTenantId))
            {
                return parsedTenantId;
            }

            // 2. Check JWT claims
            var user = httpContext.User;
            var tenantClaim = user.FindFirst("tenant_id")?.Value ?? user.FindFirst("TenantId")?.Value;
            if (!string.IsNullOrEmpty(tenantClaim) && Guid.TryParse(tenantClaim, out var claimTenantId))
            {
                return claimTenantId;
            }

            return DefaultTenantId;
        }
    }

    public Guid? UserId
    {
        get
        {
            var httpContext = _httpContextAccessor.HttpContext;
            if (httpContext == null) return DefaultUserId;

            if (httpContext.Request.Headers.TryGetValue("X-User-Id", out var userHeader) &&
                Guid.TryParse(userHeader, out var parsedUserId))
            {
                return parsedUserId;
            }

            var user = httpContext.User;
            var sub = user.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? user.FindFirst("sub")?.Value;
            if (!string.IsNullOrEmpty(sub) && Guid.TryParse(sub, out var parsedSub))
            {
                return parsedSub;
            }

            return DefaultUserId;
        }
    }

    public string? FirebaseUid =>
        _httpContextAccessor.HttpContext?.User.FindFirst("user_id")?.Value
        ?? _httpContextAccessor.HttpContext?.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

    public string? Role =>
        _httpContextAccessor.HttpContext?.User.FindFirst(ClaimTypes.Role)?.Value ?? "Owner";

    public bool IsAuthenticated =>
        _httpContextAccessor.HttpContext?.User.Identity?.IsAuthenticated ?? false;
}
