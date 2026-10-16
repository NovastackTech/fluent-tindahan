using FluentTindahan.Domain.Interfaces;
using Microsoft.AspNetCore.Authorization;

namespace FluentTindahan.WebApi.Authorization;

public static class AuthorizationPolicies
{
    public const string TenantResolved = "TenantResolved";
    public const string Owner = "Owner";
}

public sealed class TenantResolvedRequirement : IAuthorizationRequirement;

public sealed class TenantResolvedHandler : AuthorizationHandler<TenantResolvedRequirement>
{
    private readonly ICurrentUserService _currentUserService;

    public TenantResolvedHandler(ICurrentUserService currentUserService)
    {
        _currentUserService = currentUserService;
    }

    protected override Task HandleRequirementAsync(
        AuthorizationHandlerContext context,
        TenantResolvedRequirement requirement)
    {
        if (_currentUserService.TenantId != Guid.Empty)
        {
            context.Succeed(requirement);
        }

        return Task.CompletedTask;
    }
}