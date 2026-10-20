using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using FluentTindahan.Application.Common.Interfaces;
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
        if (_environment != null && (_environment.IsDevelopment() || _environment.IsEnvironment("Demo")))
        {
            return true;
        }

        if (_configuration != null)
        {
            var demoEnabled = _configuration["DemoMode"] ?? _configuration["Demo:Enabled"] ?? _configuration["DEMO_MODE"];
            if (string.Equals(demoEnabled, "true", StringComparison.OrdinalIgnoreCase))
            {
                // Security invariant: In Production, DemoMode is strictly ignored unless explicitly opted in for an intentional, documented demo deployment.
                var envName = _environment?.EnvironmentName ?? Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") ?? Environments.Production;
                if (string.Equals(envName, Environments.Production, StringComparison.OrdinalIgnoreCase))
                {
                    var allowInProd = _configuration["AllowDemoModeInProduction"]
                        ?? _configuration["Demo:AllowInProduction"]
                        ?? _configuration["ALLOW_DEMO_MODE_IN_PRODUCTION"];

                    return string.Equals(allowInProd, "true", StringComparison.OrdinalIgnoreCase);
                }

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
            if (httpContext == null)
            {
                return IsDevelopmentOrDemoMode() ? DefaultTenantId : Guid.Empty;
            }

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

                return DefaultTenantId;
            }

            // 3. Fallback to default ID only in Development or Demo mode
            if (IsDevelopmentOrDemoMode())
            {
                return DefaultTenantId;
            }

            // In production, an unauthenticated caller or authenticated caller without a valid tenant claim returns Guid.Empty
            return Guid.Empty;
        }
    }

    public Guid? UserId
    {
        get
        {
            var httpContext = _httpContextAccessor.HttpContext;
            if (httpContext == null)
            {
                return IsDevelopmentOrDemoMode() ? DefaultUserId : null;
            }

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

                return DefaultUserId;
            }

            // 3. Fallback to default ID only in Development or Demo mode
            if (IsDevelopmentOrDemoMode())
            {
                return DefaultUserId;
            }

            // In production, an unauthenticated caller or authenticated caller without a valid sub claim returns null
            return null;
        }
    }

    /// <summary>
    /// Legacy external authentication subject identifier (formerly Firebase Auth UID).
    /// Note: Authentication in Fluent Tindahan is self-hosted via ASP.NET Core native JWTs, not Firebase Auth.
    /// </summary>
    public string? FirebaseUid =>
        _httpContextAccessor.HttpContext?.User.FindFirst("user_id")?.Value
        ?? _httpContextAccessor.HttpContext?.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

    public string? Role
    {
        get
        {
            var user = _httpContextAccessor.HttpContext?.User;
            var roleClaim = user?.FindFirst(ClaimTypes.Role)?.Value
                ?? user?.FindFirst("role")?.Value;

            if (!string.IsNullOrWhiteSpace(roleClaim))
            {
                return roleClaim;
            }

            // Look up from database if user is authenticated and claims are missing the role
            if (_httpContextAccessor.HttpContext != null && UserId.HasValue && UserId != Guid.Empty)
            {
                try
                {
                    var dbContext = _httpContextAccessor.HttpContext.RequestServices.GetService(typeof(IApplicationDbContext)) as IApplicationDbContext;
                    if (dbContext != null)
                    {
                        var dbUser = dbContext.Users.IgnoreQueryFilters()
                            .AsNoTracking()
                            .FirstOrDefault(u => u.Id == UserId.Value);
                        if (dbUser != null && !string.IsNullOrWhiteSpace(dbUser.Role))
                        {
                            return dbUser.Role;
                        }
                    }
                }
                catch
                {
                    // Fall through to less privileged fallback if database lookup fails
                }
            }

            // In Development or Demo mode when unauthenticated, default to Owner to support local dev seeding
            if (IsDevelopmentOrDemoMode() && !IsAuthenticated)
            {
                return "Owner";
            }

            // Make the fallback less privileged: return "Staff" for authenticated users without an explicit role, or null when unauthenticated
            return IsAuthenticated ? "Staff" : null;
        }
    }

    public bool IsAuthenticated =>
        _httpContextAccessor.HttpContext?.User.Identity?.IsAuthenticated ?? false;

    public bool EmailVerified
    {
        get
        {
            var httpContext = _httpContextAccessor.HttpContext;
            if (httpContext == null)
            {
                return IsDevelopmentOrDemoMode();
            }

            if (!IsAuthenticated && IsDevelopmentOrDemoMode())
            {
                return true;
            }

            var user = httpContext.User;
            var claim = user?.FindFirst("email_verified")?.Value;
            if (bool.TryParse(claim, out var parsed))
            {
                return parsed;
            }

            return true;
        }
    }
}
