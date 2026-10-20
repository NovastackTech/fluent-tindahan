using Microsoft.EntityFrameworkCore;
using FluentTindahan.Application.Common.Interfaces;
using FluentTindahan.Domain.Entities;
using FluentTindahan.Domain.Enums;

namespace FluentTindahan.Infrastructure.Services;

public static class AccountDeletionHelper
{
    public const int GracePeriodDays = 30;

    /// <summary>
    /// Stage 2 Hard Anonymization: Scrubs PII on User, Tenant, and Customer records,
    /// soft-deletes Products, revokes all refresh tokens, and retains append-only financial ledgers
    /// decoupled from personal data for statutory audit compliance (RA 10173 / BIR).
    /// </summary>
    public static async Task AnonymizeUserAndTenantAsync(
        IApplicationDbContext context,
        User user,
        Tenant? tenant,
        DateTimeOffset now,
        CancellationToken cancellationToken = default)
    {
        var anonymizedEmail = $"deleted_{user.Id:N}@anonymized.local";
        user.Email = anonymizedEmail;
        user.NormalizedEmail = anonymizedEmail;
        user.OwnerName = "Deleted User";
        user.Phone = string.Empty;
        user.PasswordHash = string.Empty;
        user.PinHash = null;
        user.FirebaseUid = string.Empty;
        user.EmailVerified = false;
        user.EmailOtpHash = null;
        user.EmailOtpExpiresAt = null;
        user.EmailOtpSentAt = null;
        user.EmailOtpAttempts = 0;
        user.FailedPasswordAttempts = 0;
        user.PasswordLockoutEnd = null;
        user.FailedPinAttempts = 0;
        user.PinLockoutEnd = null;
        user.RefreshTokenIdHash = null;
        user.RefreshTokenExpiresAt = null;
        user.AccountStatus = User.StatusDeleted;
        user.DeletionScheduledAt = now;
        user.SessionsInvalidatedAt = now;

        var refreshTokens = await context.UserRefreshTokens.IgnoreQueryFilters()
            .Where(r => r.UserId == user.Id && !r.IsRevoked)
            .ToListAsync(cancellationToken);

        foreach (var token in refreshTokens)
        {
            token.IsRevoked = true;
            token.RevokedAt = now;
        }

        var resolvedTenant = tenant ?? user.Tenant;
        if (resolvedTenant == null && user.TenantId != Guid.Empty)
        {
            resolvedTenant = await context.Tenants.IgnoreQueryFilters()
                .FirstOrDefaultAsync(t => t.Id == user.TenantId, cancellationToken);
        }

        if (resolvedTenant != null)
        {
            resolvedTenant.BusinessName = "Deleted Store";
            resolvedTenant.Tier = PlanTier.Libre;
            resolvedTenant.SubscriptionEndDate = null;
            resolvedTenant.ExternalCustomerId = null;
            resolvedTenant.CheckoutSessionId = null;

            var products = await context.Products.IgnoreQueryFilters()
                .Where(p => p.TenantId == resolvedTenant.Id && !p.IsDeleted)
                .ToListAsync(cancellationToken);
            foreach (var product in products)
            {
                product.IsDeleted = true;
                product.UpdatedAt = now;
            }

            var customers = await context.Customers.IgnoreQueryFilters()
                .Where(c => c.TenantId == resolvedTenant.Id)
                .ToListAsync(cancellationToken);
            foreach (var customer in customers)
            {
                customer.Name = "Deleted Customer";
                customer.Phone = string.Empty;
                customer.IsDeleted = true;
                customer.UpdatedAt = now;
            }
        }
    }
}
