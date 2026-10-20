namespace FluentTindahan.Application.Common.Interfaces;

public interface IJwtTokenService
{
    (string Token, DateTimeOffset ExpiresAt) GenerateAccessToken(Guid userId, Guid tenantId, string? email = null, string? role = null, bool emailVerified = true);
    (string RefreshToken, DateTimeOffset ExpiresAt, string TokenId) GenerateRefreshToken(Guid userId, Guid tenantId, string? tokenId = null);
    (string RefreshToken, DateTimeOffset ExpiresAt, string TokenId, string FamilyId) GenerateRefreshToken(Guid userId, Guid tenantId, string? tokenId, string? familyId);
    bool ValidateRefreshToken(string refreshToken, out Guid userId, out Guid tenantId, out string tokenId, out string familyId);
    bool ValidateRefreshToken(string refreshToken, out Guid userId, out Guid tenantId, out string tokenId);
    bool ValidateRefreshToken(string refreshToken, out Guid userId, out Guid tenantId);
    string HashTokenId(string tokenId);
}

