namespace FluentTindahan.Application.Common.Interfaces;

public interface IJwtTokenService
{
    (string Token, DateTimeOffset ExpiresAt) GenerateAccessToken(Guid userId, Guid tenantId, string? email = null, string? role = null);
    (string RefreshToken, DateTimeOffset ExpiresAt) GenerateRefreshToken(Guid userId, Guid tenantId);
    bool ValidateRefreshToken(string refreshToken, out Guid userId, out Guid tenantId);
}
