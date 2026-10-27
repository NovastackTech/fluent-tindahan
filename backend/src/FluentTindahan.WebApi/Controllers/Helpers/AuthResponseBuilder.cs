using FluentTindahan.Domain.Entities;
using FluentTindahan.Domain.Enums;

namespace FluentTindahan.WebApi.Controllers.Helpers;

/// <summary>
/// Constructs AuthResponseDto records consistently across registration, login, and token refresh endpoints.
/// </summary>
public static class AuthResponseBuilder
{
    public static AuthController.AuthResponseDto Build(
        User user,
        Tenant? tenant,
        (string Token, DateTimeOffset ExpiresAt) access,
        string? refreshToken = null,
        string? ownerName = null,
        bool isNewUser = false)
    {
        var resolvedTenant = tenant ?? user.Tenant;
        var tier = resolvedTenant?.Tier ?? PlanTier.Libre;
        if (tier != PlanTier.Libre && resolvedTenant?.SubscriptionEndDate.HasValue == true && resolvedTenant.SubscriptionEndDate.Value <= DateTimeOffset.UtcNow)
        {
            tier = PlanTier.Libre;
        }

        return new AuthController.AuthResponseDto(
            resolvedTenant?.Id ?? user.TenantId,
            user.Id,
            user.Email,
            resolvedTenant?.BusinessName ?? string.Empty,
            ownerName ?? user.OwnerName,
            user.Phone,
            user.Role,
            tier,
            tier.ToString(),
            resolvedTenant?.SubscriptionEndDate,
            !string.IsNullOrEmpty(user.PinHash),
            access.Token,
            access.ExpiresAt,
            refreshToken,
            isNewUser,
            user.EmailVerified,
            !user.EmailVerified && !string.IsNullOrWhiteSpace(user.Email)
        );
    }
}
