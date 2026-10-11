using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using FluentTindahan.Domain.Interfaces;

namespace FluentTindahan.Infrastructure.Services;

public class CurrentUserService : ICurrentUserService
{
    private readonly IHttpContextAccessor _httpContextAccessor;
    private readonly IHostEnvironment? _environment;
    private readonly IConfiguration? _configuration;

    public static readonly Guid DefaultTenantId = Guid.Parse("11111111-1111-1111-1111-111111111111");
    public static readonly Guid DefaultUserId = Guid.Parse("22222222-2222-2222-2222-222222222222");

    public CurrentUserService(
        IHttpContextAccessor httpContextAccessor,
        IHostEnvironment? environment = null,
        IConfiguration? configuration = null)
    {
        _httpContextAccessor = httpContextAccessor;
        _environment = environment;
        _configuration = configuration;
    }

    private bool IsDevelopmentOrDemoMode()
    {
        if (_environment != null)
        {
            if (_environment.IsDevelopment() || _environment.IsEnvironment("Demo"))
            {
                return true;
            }
        }

        if (_configuration != null)
        {
            var demoEnabled = _configuration["DemoMode"] ?? _configuration["Demo:Enabled"];
            if (string.Equals(demoEnabled, "true", StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }
        }

        return false;
    }

    public Guid TenantId
    {
        get
        {
            var httpContext = _httpContextAccessor.HttpContext;
            if (httpContext == null) return DefaultTenantId;

            // 1. Check verified JWT claims first for authenticated users (prevents header spoofing)
            var user = httpContext.User;
            var tenantClaim = user?.FindFirst("tenant_id")?.Value ?? user?.FindFirst("TenantId")?.Value;
            if (!string.IsNullOrEmpty(tenantClaim) && Guid.TryParse(tenantClaim, out var claimTenantId) && claimTenantId != Guid.Empty)
            {
                return claimTenantId;
            }

            // 2. Custom header fallback: ONLY permitted when unauthenticated AND running in Development or demo mode
            if (!IsAuthenticated && IsDevelopmentOrDemoMode())
            {
                if (httpContext.Request.Headers.TryGetValue("X-Tenant-Id", out var tenantHeader) &&
                    Guid.TryParse(tenantHeader, out var parsedTenantId) &&
                    parsedTenantId != Guid.Empty)
                {
                    return parsedTenantId;
                }
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

            // 1. Check verified JWT claims first
            var user = httpContext.User;
            var sub = user?.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? user?.FindFirst("sub")?.Value;
            if (!string.IsNullOrEmpty(sub) && Guid.TryParse(sub, out var parsedSub) && parsedSub != Guid.Empty)
            {
                return parsedSub;
            }

            // 2. Custom header fallback: ONLY permitted when unauthenticated AND running in Development or demo mode
            if (!IsAuthenticated && IsDevelopmentOrDemoMode())
            {
                if (httpContext.Request.Headers.TryGetValue("X-User-Id", out var userHeader) &&
                    Guid.TryParse(userHeader, out var parsedUserId) &&
                    parsedUserId != Guid.Empty)
                {
                    return parsedUserId;
                }
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
