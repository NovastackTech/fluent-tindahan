namespace FluentTindahan.Application.Common.Interfaces;

public sealed record GoogleUserInfo(
    string Subject,
    string Email,
    bool EmailVerified,
    string? FullName,
    string? GivenName
);

public interface IGoogleAuthService
{
    Task<GoogleUserInfo?> VerifyGoogleTokenAsync(
        string? accessToken,
        string? idToken,
        CancellationToken cancellationToken = default);
}
