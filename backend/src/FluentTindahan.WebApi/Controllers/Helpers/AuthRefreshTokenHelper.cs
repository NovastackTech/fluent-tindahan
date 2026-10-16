using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using FluentTindahan.Application.Common.Interfaces;
using FluentTindahan.Domain.Entities;

namespace FluentTindahan.WebApi.Controllers.Helpers;

/// <summary>
/// Result of a refresh token rotation attempt.
/// </summary>
public sealed class RefreshRotationResult
{
    public bool IsSuccess { get; init; }
    public User? User { get; init; }
    public string? NewRefreshToken { get; init; }
    public DateTimeOffset? NewRefreshExpiresAt { get; init; }
    public ActionResult? ErrorResult { get; init; }

    public static RefreshRotationResult Success(User user, string refreshToken, DateTimeOffset expiresAt) =>
        new() { IsSuccess = true, User = user, NewRefreshToken = refreshToken, NewRefreshExpiresAt = expiresAt };

    public static RefreshRotationResult Failure(ActionResult errorResult) =>
        new() { IsSuccess = false, ErrorResult = errorResult };
}

/// <summary>
/// Manages refresh token lifecycle, per-device token families, grace-window rotation, and revocation.
/// </summary>
public static class AuthRefreshTokenHelper
{
    public const int DefaultGraceWindowSeconds = 30;

    /// <summary>
    /// Issues a new refresh token and records it in UserRefreshTokens table and the user entity.
    /// </summary>
    public static (string RefreshToken, DateTimeOffset ExpiresAt, string TokenHash, string FamilyId) IssueRefreshToken(
        IApplicationDbContext context,
        IJwtTokenService jwtTokenService,
        User user,
        Guid tenantId,
        TimeProvider timeProvider,
        string? familyId = null)
    {
        var (refToken, refExpiresAt, tokenId, famId) = jwtTokenService.GenerateRefreshToken(user.Id, tenantId, null, familyId);
        var tokenHash = jwtTokenService.HashTokenId(tokenId);

        user.RefreshTokenIdHash = tokenHash;
        user.RefreshTokenExpiresAt = refExpiresAt;

        context.UserRefreshTokens.Add(new UserRefreshToken
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            TenantId = tenantId,
            FamilyId = famId,
            TokenHash = tokenHash,
            ExpiresAt = refExpiresAt,
            CreatedAt = timeProvider.GetUtcNow()
        });

        return (refToken, refExpiresAt, tokenHash, famId);
    }

    /// <summary>
    /// Rotates the presented refresh token by marking the old token as replaced with a grace window
    /// and issuing a new refresh token within the same device family.
    /// Returns nulls if the presented token is already revoked or reused outside the grace window.
    /// </summary>
    public static async Task<(string? RefreshToken, DateTimeOffset? ExpiresAt, string? TokenHash, string? FamilyId)> RotatePresentedRefreshTokenAsync(
        IApplicationDbContext context,
        IJwtTokenService jwtTokenService,
        User user,
        Guid tenantId,
        TimeProvider timeProvider,
        string tokenId,
        string familyId,
        CancellationToken cancellationToken = default)
    {
        var now = timeProvider.GetUtcNow();
        var presentedTokenHash = jwtTokenService.HashTokenId(tokenId);

        var matchingToken = await context.UserRefreshTokens.IgnoreQueryFilters()
            .FirstOrDefaultAsync(r => r.UserId == user.Id && r.FamilyId == familyId && r.TokenHash == presentedTokenHash, cancellationToken);

        // Refuse to issue a new token when the row is missing, revoked, or already replaced
        if (matchingToken == null || matchingToken.IsRevoked || matchingToken.ReplacedByTokenHash != null)
        {
            return (null, null, null, null);
        }

        if (matchingToken.ExpiresAt < now)
        {
            matchingToken.IsRevoked = true;
            matchingToken.RevokedAt = now;
            return (null, null, null, null);
        }

        var (newRefToken, newExpires, newTokenId, famId) = jwtTokenService.GenerateRefreshToken(
            user.Id,
            tenantId,
            tokenId: null,
            familyId: familyId);

        var newTokenHash = jwtTokenService.HashTokenId(newTokenId);

        if (matchingToken != null)
        {
            matchingToken.ReplacedByTokenHash = newTokenHash;
            matchingToken.GraceExpiresAt = now.AddSeconds(DefaultGraceWindowSeconds);
        }

        user.RefreshTokenIdHash = newTokenHash;
        user.RefreshTokenExpiresAt = newExpires;

        context.UserRefreshTokens.Add(new UserRefreshToken
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            TenantId = tenantId,
            FamilyId = famId,
            TokenHash = newTokenHash,
            ExpiresAt = newExpires,
            CreatedAt = now
        });

        return (newRefToken, newExpires, newTokenHash, famId);
    }

    /// <summary>
    /// Revokes only the specified token family (e.g. for a single device logout or reuse detection).
    /// </summary>
    public static async Task RevokeFamilyAsync(
        IApplicationDbContext context,
        User? user,
        Guid userId,
        string familyId,
        TimeProvider timeProvider,
        CancellationToken cancellationToken)
    {
        var now = timeProvider.GetUtcNow();
        var familyTokens = await context.UserRefreshTokens.IgnoreQueryFilters()
            .Where(r => r.UserId == userId && r.FamilyId == familyId)
            .ToListAsync(cancellationToken);

        foreach (var tok in familyTokens)
        {
            tok.IsRevoked = true;
            tok.RevokedAt = now;
        }

        if (user != null && user.RefreshTokenIdHash != null && familyTokens.Any(r => r.TokenHash == user.RefreshTokenIdHash))
        {
            user.RefreshTokenIdHash = null;
            user.RefreshTokenExpiresAt = null;
        }
    }

    /// <summary>
    /// Revokes all refresh tokens for a user across all devices (e.g. on password change, PIN change, or full logout).
    /// </summary>
    public static async Task RevokeAllForUserAsync(
        IApplicationDbContext context,
        User? user,
        Guid userId,
        TimeProvider timeProvider,
        CancellationToken cancellationToken)
    {
        var now = timeProvider.GetUtcNow();
        var allTokens = await context.UserRefreshTokens.IgnoreQueryFilters()
            .Where(r => r.UserId == userId)
            .ToListAsync(cancellationToken);

        foreach (var tok in allTokens)
        {
            tok.IsRevoked = true;
            tok.RevokedAt = now;
        }

        if (user != null)
        {
            user.RefreshTokenIdHash = null;
            user.RefreshTokenExpiresAt = null;
        }
    }

    /// <summary>
    /// Revokes all refresh tokens for a user across other device families, retaining only the caller's current family.
    /// If currentFamilyId is null or empty, all refresh tokens for the user are revoked.
    /// </summary>
    public static async Task RevokeOtherSessionsForUserAsync(
        IApplicationDbContext context,
        User? user,
        Guid userId,
        string? currentFamilyId,
        TimeProvider timeProvider,
        CancellationToken cancellationToken)
    {
        var now = timeProvider.GetUtcNow();
        var query = context.UserRefreshTokens.IgnoreQueryFilters()
            .Where(r => r.UserId == userId && !r.IsRevoked);

        if (!string.IsNullOrWhiteSpace(currentFamilyId))
        {
            query = query.Where(r => r.FamilyId != currentFamilyId);
        }

        var tokensToRevoke = await query.ToListAsync(cancellationToken);
        foreach (var tok in tokensToRevoke)
        {
            tok.IsRevoked = true;
            tok.RevokedAt = now;
        }

        if (string.IsNullOrWhiteSpace(currentFamilyId) && user != null)
        {
            user.RefreshTokenIdHash = null;
            user.RefreshTokenExpiresAt = null;
        }
    }

    /// <summary>
    /// Executes the full refresh token rotation pipeline: validates token, checks family status,
    /// rotates token with grace window, prunes expired grace records, and revokes family on reuse.
    /// </summary>
    public static async Task<RefreshRotationResult> RotateRefreshTokenAsync(
        IApplicationDbContext context,
        IJwtTokenService jwtTokenService,
        TimeProvider timeProvider,
        string? rawRefreshToken,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(rawRefreshToken) ||
            !jwtTokenService.ValidateRefreshToken(rawRefreshToken, out var userId, out var tenantId, out var tokenId, out var familyId))
        {
            return RefreshRotationResult.Failure(new UnauthorizedObjectResult(new
            {
                message = "Di-wasto o paso na ang session. Pakiusap mag-login muli. / Invalid or expired refresh token."
            }));
        }

        var user = await context.Users.IgnoreQueryFilters()
            .Include(u => u.Tenant)
            .FirstOrDefaultAsync(u => u.Id == userId && u.TenantId == tenantId, cancellationToken);

        if (user == null || user.Tenant == null)
        {
            return RefreshRotationResult.Failure(new UnauthorizedObjectResult(new
            {
                message = "Hindi natagpuan ang account. / Account not found."
            }));
        }

        var now = timeProvider.GetUtcNow();
        var incomingTokenHash = jwtTokenService.HashTokenId(tokenId);

        // Retrieve tokens for this family
        var familyTokens = await context.UserRefreshTokens.IgnoreQueryFilters()
            .Where(r => r.UserId == user.Id && r.FamilyId == familyId)
            .OrderByDescending(r => r.CreatedAt)
            .ToListAsync(cancellationToken);

        // Fallback for tokens issued before UserRefreshToken table was introduced
        if (familyTokens.Count == 0)
        {
            if (!string.IsNullOrEmpty(user.RefreshTokenIdHash) &&
                CryptographicOperations.FixedTimeEquals(
                    Encoding.UTF8.GetBytes(user.RefreshTokenIdHash),
                    Encoding.UTF8.GetBytes(incomingTokenHash)))
            {
                if (user.RefreshTokenExpiresAt.HasValue && user.RefreshTokenExpiresAt.Value < now)
                {
                    user.RefreshTokenIdHash = null;
                    user.RefreshTokenExpiresAt = null;
                    await context.SaveChangesAsync(cancellationToken);
                    return RefreshRotationResult.Failure(new UnauthorizedObjectResult(new
                    {
                        message = "Paso na ang session. Pakiusap mag-login muli. / Refresh token expired."
                    }));
                }

                var initialToken = new UserRefreshToken
                {
                    Id = Guid.NewGuid(),
                    UserId = user.Id,
                    TenantId = user.TenantId,
                    FamilyId = !string.IsNullOrWhiteSpace(familyId) ? familyId : Guid.NewGuid().ToString("N"),
                    TokenHash = incomingTokenHash,
                    ExpiresAt = user.RefreshTokenExpiresAt ?? now.AddDays(30),
                    CreatedAt = now
                };
                context.UserRefreshTokens.Add(initialToken);
                familyTokens.Add(initialToken);
            }
            else
            {
                return RefreshRotationResult.Failure(new UnauthorizedObjectResult(new
                {
                    message = "Paso na o binawi ang session. Pakiusap mag-login muli. / Session revoked. Please log in again."
                }));
            }
        }

        // Check if this family is revoked
        if (familyTokens.Any(r => r.IsRevoked))
        {
            return RefreshRotationResult.Failure(new UnauthorizedObjectResult(new
            {
                message = "Paso na o binawi ang session. Pakiusap mag-login muli. / Session revoked. Please log in again."
            }));
        }

        var matchingToken = familyTokens.FirstOrDefault(r =>
            CryptographicOperations.FixedTimeEquals(
                Encoding.UTF8.GetBytes(r.TokenHash),
                Encoding.UTF8.GetBytes(incomingTokenHash)));

        string newRefreshToken;
        DateTimeOffset newRefreshExpiresAt;

        if (matchingToken != null && matchingToken.ReplacedByTokenHash == null)
        {
            // Case 1: Active token in the family being rotated
            if (matchingToken.ExpiresAt < now)
            {
                matchingToken.IsRevoked = true;
                matchingToken.RevokedAt = now;
                await context.SaveChangesAsync(cancellationToken);
                return RefreshRotationResult.Failure(new UnauthorizedObjectResult(new
                {
                    message = "Paso na ang session. Pakiusap mag-login muli. / Refresh token expired."
                }));
            }

            var (newRefToken, newExpires, newTokenId, _) = jwtTokenService.GenerateRefreshToken(
                user.Id,
                user.TenantId,
                tokenId: null,
                familyId: matchingToken.FamilyId);

            var newTokenHash = jwtTokenService.HashTokenId(newTokenId);

            // Rotate: mark previous token replaced and grant short grace window
            matchingToken.ReplacedByTokenHash = newTokenHash;
            matchingToken.GraceExpiresAt = now.AddSeconds(DefaultGraceWindowSeconds);

            var newRecord = new UserRefreshToken
            {
                Id = Guid.NewGuid(),
                UserId = user.Id,
                TenantId = user.TenantId,
                FamilyId = matchingToken.FamilyId,
                TokenHash = newTokenHash,
                ExpiresAt = newExpires,
                CreatedAt = now
            };
            context.UserRefreshTokens.Add(newRecord);

            // Prune older tokens in this family that are outside grace window to keep table small
            var prunedTokens = familyTokens.Where(r =>
                r.Id != matchingToken.Id &&
                r.ReplacedByTokenHash != null &&
                r.GraceExpiresAt.HasValue &&
                r.GraceExpiresAt.Value < now).ToList();
            if (prunedTokens.Count > 0)
            {
                context.UserRefreshTokens.RemoveRange(prunedTokens);
            }

            user.RefreshTokenIdHash = newTokenHash;
            user.RefreshTokenExpiresAt = newExpires;
            user.LastLoginAt = now;
            await context.SaveChangesAsync(cancellationToken);

            newRefreshToken = newRefToken;
            newRefreshExpiresAt = newExpires;
        }
        else if (matchingToken != null && matchingToken.ReplacedByTokenHash != null)
        {
            // Case 2: Token was previously rotated; check grace window
            var isWithinGrace = matchingToken.GraceExpiresAt.HasValue && now <= matchingToken.GraceExpiresAt.Value;
            if (isWithinGrace)
            {
                // Grace window: allow the previous token to obtain refreshed tokens without revoking the family
                var (graceRefToken, graceExpires, graceTokenId, _) = jwtTokenService.GenerateRefreshToken(
                    user.Id,
                    user.TenantId,
                    tokenId: null,
                    familyId: matchingToken.FamilyId);

                var graceTokenHash = jwtTokenService.HashTokenId(graceTokenId);
                var activeToken = familyTokens.FirstOrDefault(r => r.ReplacedByTokenHash == null && !r.IsRevoked);
                if (activeToken != null)
                {
                    activeToken.ReplacedByTokenHash = graceTokenHash;
                    activeToken.GraceExpiresAt = now.AddSeconds(DefaultGraceWindowSeconds);
                }

                var newGraceRecord = new UserRefreshToken
                {
                    Id = Guid.NewGuid(),
                    UserId = user.Id,
                    TenantId = user.TenantId,
                    FamilyId = matchingToken.FamilyId,
                    TokenHash = graceTokenHash,
                    ExpiresAt = graceExpires,
                    CreatedAt = now
                };
                context.UserRefreshTokens.Add(newGraceRecord);

                user.RefreshTokenIdHash = graceTokenHash;
                user.RefreshTokenExpiresAt = graceExpires;
                user.LastLoginAt = now;
                await context.SaveChangesAsync(cancellationToken);

                newRefreshToken = graceRefToken;
                newRefreshExpiresAt = graceExpires;
            }
            else
            {
                // Reuse detected outside grace window! Revoke only the affected family
                foreach (var famToken in familyTokens)
                {
                    famToken.IsRevoked = true;
                    famToken.RevokedAt = now;
                }

                if (user.RefreshTokenIdHash != null &&
                    familyTokens.Any(r => r.TokenHash == user.RefreshTokenIdHash))
                {
                    user.RefreshTokenIdHash = null;
                    user.RefreshTokenExpiresAt = null;
                }

                await context.SaveChangesAsync(cancellationToken);
                return RefreshRotationResult.Failure(new UnauthorizedObjectResult(new
                {
                    message = "Di-wasto o nagamit na ang refresh token. Pakiusap mag-login muli. / Invalid or already used refresh token."
                }));
            }
        }
        else
        {
            // Case 3: Token not found in active records for this family, but family exists -> reuse outside grace window!
            // Revoke only the affected family
            foreach (var famToken in familyTokens)
            {
                famToken.IsRevoked = true;
                famToken.RevokedAt = now;
            }

            if (user.RefreshTokenIdHash != null &&
                familyTokens.Any(r => r.TokenHash == user.RefreshTokenIdHash))
            {
                user.RefreshTokenIdHash = null;
                user.RefreshTokenExpiresAt = null;
            }

            await context.SaveChangesAsync(cancellationToken);
            return RefreshRotationResult.Failure(new UnauthorizedObjectResult(new
            {
                message = "Di-wasto o nagamit na ang refresh token. Pakiusap mag-login muli. / Invalid or already used refresh token."
            }));
        }

        return RefreshRotationResult.Success(user, newRefreshToken, newRefreshExpiresAt);
    }
}
