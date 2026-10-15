namespace FluentTindahan.Application.Common.Interfaces;

public interface IJwtTokenService
{
    (string Token, DateTimeOffset ExpiresAt) GenerateAccessToken(Guid userId, Guid tenantId, string? email = null, string? role = null);
    (string RefreshToken, DateTimeOffset ExpiresAt, string TokenId) GenerateRefreshToken(Guid userId, Guid tenantId, string? tokenId = null);
    bool ValidateRefreshToken(string refreshToken, out Guid userId, out Guid tenantId, out string tokenId);
    bool ValidateRefreshToken(string refreshToken, out Guid userId, out Guid tenantId);
    string HashTokenId(string tokenId);
}

