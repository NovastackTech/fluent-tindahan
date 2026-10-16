using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.IdentityModel.Tokens;
using FluentTindahan.Application.Common.Interfaces;

namespace FluentTindahan.Infrastructure.Services;

public class JwtTokenService : IJwtTokenService
{
    public const string BurnedSecretKey = "FluentTindahan_SuperSecretSigningKey_Minimum32Chars_DevKey!";
    public const string DefaultDevSecretKey = "FluentTindahan_LocalDevOnly_Key_DoNotUseInProduction32Chars!";
    public const string DefaultIssuer = "FluentTindahan";
    public const string DefaultAudience = "FluentTindahanClient";
    public const int DefaultExpiryMinutes = 60;
    public const int DefaultRefreshExpiryDays = 30;

    private readonly SymmetricSecurityKey _signingKey;
    private readonly string _issuer;
    private readonly string _audience;
    private readonly int _expiryMinutes;
    private readonly int _refreshExpiryDays;
    private readonly TimeProvider _timeProvider;

    public JwtTokenService(
        IConfiguration configuration,
        IHostEnvironment environment,
        TimeProvider? timeProvider = null)
    {
        var secret = configuration["Jwt:SecretKey"]
            ?? configuration["JWT_SECRET_KEY"]
            ?? (environment.IsDevelopment() ? DefaultDevSecretKey : null);

        if (string.IsNullOrWhiteSpace(secret) || secret.Length < 32)
        {
            if (!environment.IsDevelopment())
            {
                throw new InvalidOperationException(
                    "Jwt:SecretKey or JWT_SECRET_KEY must be configured with at least 32 characters (256 bits) in production.");
            }
            secret = DefaultDevSecretKey;
        }

        if (!environment.IsDevelopment() &&
            (string.Equals(secret, BurnedSecretKey, StringComparison.Ordinal) ||
             string.Equals(secret, DefaultDevSecretKey, StringComparison.Ordinal)))
        {
            throw new InvalidOperationException(
                "The committed JWT secret key has been burned and cannot be used in production. A new unique key must be generated per real deployment.");
        }

        _signingKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret));
        _issuer = configuration["Jwt:Issuer"] ?? DefaultIssuer;
        _audience = configuration["Jwt:Audience"] ?? DefaultAudience;

        _expiryMinutes = int.TryParse(configuration["Jwt:ExpiryMinutes"], out var exp) && exp != 0
            ? exp
            : DefaultExpiryMinutes;

        _refreshExpiryDays = int.TryParse(configuration["Jwt:RefreshExpiryDays"], out var rExp) && rExp != 0
            ? rExp
            : DefaultRefreshExpiryDays;

        _timeProvider = timeProvider ?? TimeProvider.System;
    }

    public (string Token, DateTimeOffset ExpiresAt) GenerateAccessToken(
        Guid userId,
        Guid tenantId,
        string? email = null,
        string? role = null)
    {
        var now = _timeProvider.GetUtcNow();
        var expiresAt = now.AddMinutes(_expiryMinutes);

        // Include principal identifiers and role claim in token payload.
        // Fallback role is the least privileged ("Staff") when not explicitly provided.
        var effectiveRole = !string.IsNullOrWhiteSpace(role) ? role : "Staff";
        var claims = new List<Claim>
        {
            new Claim(JwtRegisteredClaimNames.Sub, userId.ToString()),
            new Claim("user_id", userId.ToString()),
            new Claim("tenant_id", tenantId.ToString()),
            new Claim("TenantId", tenantId.ToString()),
            new Claim("aud", _audience),
            new Claim("token_type", "access"),
            new Claim(ClaimTypes.Role, effectiveRole),
            new Claim("role", effectiveRole)
        };

        var notBefore = expiresAt < now ? expiresAt.AddMinutes(-5).UtcDateTime : now.UtcDateTime;
        var tokenDescriptor = new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(claims),
            Issuer = _issuer,
            Audience = _audience,
            IssuedAt = notBefore,
            NotBefore = notBefore,
            Expires = expiresAt.UtcDateTime,
            SigningCredentials = new SigningCredentials(_signingKey, SecurityAlgorithms.HmacSha256)
        };

        var tokenHandler = new JwtSecurityTokenHandler();
        var token = tokenHandler.CreateToken(tokenDescriptor);
        return (tokenHandler.WriteToken(token), expiresAt);
    }

    public (string RefreshToken, DateTimeOffset ExpiresAt, string TokenId) GenerateRefreshToken(
        Guid userId,
        Guid tenantId,
        string? tokenId = null)
    {
        var result = GenerateRefreshToken(userId, tenantId, tokenId, familyId: null);
        return (result.RefreshToken, result.ExpiresAt, result.TokenId);
    }

    public (string RefreshToken, DateTimeOffset ExpiresAt, string TokenId, string FamilyId) GenerateRefreshToken(
        Guid userId,
        Guid tenantId,
        string? tokenId,
        string? familyId)
    {
        var now = _timeProvider.GetUtcNow();
        var expiresAt = now.AddDays(_refreshExpiryDays);
        var resolvedTokenId = string.IsNullOrWhiteSpace(tokenId) ? Guid.NewGuid().ToString("N") : tokenId.Trim();
        var resolvedFamilyId = string.IsNullOrWhiteSpace(familyId) ? Guid.NewGuid().ToString("N") : familyId.Trim();

        var claims = new List<Claim>
        {
            new Claim(JwtRegisteredClaimNames.Sub, userId.ToString()),
            new Claim(JwtRegisteredClaimNames.Jti, resolvedTokenId),
            new Claim("family_id", resolvedFamilyId),
            new Claim("user_id", userId.ToString()),
            new Claim("tenant_id", tenantId.ToString()),
            new Claim("aud", _audience),
            new Claim("token_type", "refresh")
        };

        var notBefore = expiresAt < now ? expiresAt.AddMinutes(-5).UtcDateTime : now.UtcDateTime;
        var tokenDescriptor = new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(claims),
            Issuer = _issuer,
            Audience = _audience,
            IssuedAt = notBefore,
            NotBefore = notBefore,
            Expires = expiresAt.UtcDateTime,
            SigningCredentials = new SigningCredentials(_signingKey, SecurityAlgorithms.HmacSha256)
        };

        var tokenHandler = new JwtSecurityTokenHandler();
        var token = tokenHandler.CreateToken(tokenDescriptor);
        return (tokenHandler.WriteToken(token), expiresAt, resolvedTokenId, resolvedFamilyId);
    }

    public bool ValidateRefreshToken(string refreshToken, out Guid userId, out Guid tenantId, out string tokenId, out string familyId)
    {
        userId = Guid.Empty;
        tenantId = Guid.Empty;
        tokenId = string.Empty;
        familyId = string.Empty;

        if (string.IsNullOrWhiteSpace(refreshToken))
        {
            return false;
        }

        var tokenHandler = new JwtSecurityTokenHandler
        {
            MapInboundClaims = false
        };

        var validationParameters = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = _signingKey,
            ValidateIssuer = true,
            ValidIssuer = _issuer,
            ValidateAudience = true,
            ValidAudience = _audience,
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromMinutes(1)
        };

        try
        {
            var principal = tokenHandler.ValidateToken(refreshToken, validationParameters, out var validatedToken);
            if (validatedToken is not JwtSecurityToken jwtToken ||
                !jwtToken.Header.Alg.Equals(SecurityAlgorithms.HmacSha256, StringComparison.InvariantCultureIgnoreCase))
            {
                return false;
            }

            var tokenType = principal.FindFirst("token_type")?.Value;
            if (!string.Equals(tokenType, "refresh", StringComparison.Ordinal))
            {
                return false;
            }

            var sub = principal.FindFirst(JwtRegisteredClaimNames.Sub)?.Value
                ?? principal.FindFirst(ClaimTypes.NameIdentifier)?.Value
                ?? principal.FindFirst("user_id")?.Value;

            var tenantStr = principal.FindFirst("tenant_id")?.Value;
            var jti = principal.FindFirst(JwtRegisteredClaimNames.Jti)?.Value
                ?? principal.FindFirst("jti")?.Value;
            var fid = principal.FindFirst("family_id")?.Value
                ?? principal.FindFirst("familyId")?.Value;

            if (Guid.TryParse(sub, out var parsedUser) &&
                Guid.TryParse(tenantStr, out var parsedTenant) &&
                !string.IsNullOrWhiteSpace(jti))
            {
                userId = parsedUser;
                tenantId = parsedTenant;
                tokenId = jti;
                familyId = !string.IsNullOrWhiteSpace(fid) ? fid : string.Empty;
                return true;
            }

            return false;
        }
        catch
        {
            return false;
        }
    }

    public bool ValidateRefreshToken(string refreshToken, out Guid userId, out Guid tenantId, out string tokenId)
    {
        return ValidateRefreshToken(refreshToken, out userId, out tenantId, out tokenId, out _);
    }

    public bool ValidateRefreshToken(string refreshToken, out Guid userId, out Guid tenantId)
    {
        return ValidateRefreshToken(refreshToken, out userId, out tenantId, out _, out _);
    }

    public string HashTokenId(string tokenId)
    {
        if (string.IsNullOrWhiteSpace(tokenId))
        {
            return string.Empty;
        }

        var bytes = Encoding.UTF8.GetBytes(tokenId.Trim());
        var hash = SHA256.HashData(bytes);
        return Convert.ToHexString(hash).ToLowerInvariant();
    }
}
