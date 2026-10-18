using System.Net.Http.Headers;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using FluentTindahan.Application.Common.Interfaces;

namespace FluentTindahan.Infrastructure.Services;

public class GoogleAuthService : IGoogleAuthService
{
    private readonly HttpClient _httpClient;
    private readonly IConfiguration _configuration;
    private readonly ILogger<GoogleAuthService> _logger;

    public GoogleAuthService(
        HttpClient httpClient,
        IConfiguration configuration,
        ILogger<GoogleAuthService> logger)
    {
        _httpClient = httpClient;
        _configuration = configuration;
        _logger = logger;
    }

    public async Task<GoogleUserInfo?> VerifyGoogleTokenAsync(
        string? accessToken,
        string? idToken,
        CancellationToken cancellationToken = default)
    {
        if (!string.IsNullOrWhiteSpace(accessToken))
        {
            return await VerifyAccessTokenAsync(accessToken.Trim(), cancellationToken);
        }

        if (!string.IsNullOrWhiteSpace(idToken))
        {
            return await VerifyIdTokenAsync(idToken.Trim(), cancellationToken);
        }

        return null;
    }

    private string? GetConfiguredClientId()
    {
        var expectedClientId = _configuration["Google:ClientId"] ?? _configuration["GOOGLE_CLIENT_ID"];
        if (string.IsNullOrWhiteSpace(expectedClientId))
        {
            _logger.LogWarning("Google:ClientId or GOOGLE_CLIENT_ID is not configured");
            return null;
        }

        return expectedClientId;
    }

    private static GoogleUserInfo? ExtractGoogleUserInfo(JsonElement root)
    {
        if (!root.TryGetProperty("sub", out var subProp) || string.IsNullOrWhiteSpace(subProp.GetString()))
        {
            return null;
        }

        var sub = subProp.GetString()!;
        var email = root.TryGetProperty("email", out var emailProp) ? emailProp.GetString() ?? string.Empty : string.Empty;

        var emailVerified = false;
        if (root.TryGetProperty("email_verified", out var evProp))
        {
            if (evProp.ValueKind == JsonValueKind.True || evProp.ValueKind == JsonValueKind.False)
            {
                emailVerified = evProp.GetBoolean();
            }
            else if (evProp.ValueKind == JsonValueKind.String && bool.TryParse(evProp.GetString(), out var parsedEv))
            {
                emailVerified = parsedEv;
            }
        }

        var name = root.TryGetProperty("name", out var nameProp) ? nameProp.GetString() : null;
        var givenName = root.TryGetProperty("given_name", out var gnProp) ? gnProp.GetString() : null;

        return new GoogleUserInfo(sub, email, emailVerified, name, givenName);
    }

    private async Task<GoogleUserInfo?> VerifyAccessTokenAsync(string accessToken, CancellationToken cancellationToken)
    {
        try
        {
            var expectedClientId = GetConfiguredClientId();
            if (expectedClientId == null)
            {
                return null;
            }

            var tokenInfoUrl = $"https://oauth2.googleapis.com/tokeninfo?access_token={Uri.EscapeDataString(accessToken)}";
            var tokenInfoTask = _httpClient.GetAsync(tokenInfoUrl, cancellationToken);

            using var request = new HttpRequestMessage(HttpMethod.Get, "https://www.googleapis.com/oauth2/v3/userinfo");
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
            var userInfoTask = _httpClient.SendAsync(request, cancellationToken);

            HttpResponseMessage? infoResp = null;
            HttpResponseMessage? response = null;

            try
            {
                await Task.WhenAll(tokenInfoTask, userInfoTask);
                infoResp = await tokenInfoTask;
                response = await userInfoTask;
            }
            catch
            {
                if (tokenInfoTask.IsCompletedSuccessfully)
                {
                    tokenInfoTask.Result.Dispose();
                }
                if (userInfoTask.IsCompletedSuccessfully)
                {
                    userInfoTask.Result.Dispose();
                }
                throw;
            }

            using (infoResp)
            using (response)
            {
                if (!infoResp.IsSuccessStatusCode)
                {
                    _logger.LogWarning("Google tokeninfo verification failed with status {StatusCode}", infoResp.StatusCode);
                    return null;
                }

                var infoJson = await infoResp.Content.ReadAsStringAsync(cancellationToken);
                using var infoDoc = JsonDocument.Parse(infoJson);
                var infoRoot = infoDoc.RootElement;

                var aud = infoRoot.TryGetProperty("aud", out var audProp) ? audProp.GetString() : null;
                var azp = infoRoot.TryGetProperty("azp", out var azpProp) ? azpProp.GetString() : null;
                if (!string.Equals(aud, expectedClientId, StringComparison.Ordinal) &&
                    !string.Equals(azp, expectedClientId, StringComparison.Ordinal))
                {
                    _logger.LogWarning("Google access token audience {Aud} / azp {Azp} did not match expected client id", aud, azp);
                    return null;
                }

                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogWarning("Google userinfo verification failed with status {StatusCode}", response.StatusCode);
                    return null;
                }

                var json = await response.Content.ReadAsStringAsync(cancellationToken);
                using var doc = JsonDocument.Parse(json);
                return ExtractGoogleUserInfo(doc.RootElement);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error verifying Google access token");
            return null;
        }
    }

    private async Task<GoogleUserInfo?> VerifyIdTokenAsync(string idToken, CancellationToken cancellationToken)
    {
        try
        {
            var expectedClientId = GetConfiguredClientId();
            if (expectedClientId == null)
            {
                return null;
            }

            var url = $"https://oauth2.googleapis.com/tokeninfo?id_token={Uri.EscapeDataString(idToken)}";
            using var response = await _httpClient.GetAsync(url, cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("Google tokeninfo verification failed with status {StatusCode}", response.StatusCode);
                return null;
            }

            var json = await response.Content.ReadAsStringAsync(cancellationToken);
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;

            if (!root.TryGetProperty("aud", out var audProp) ||
                !string.Equals(audProp.GetString(), expectedClientId, StringComparison.Ordinal))
            {
                _logger.LogWarning("Google tokeninfo audience missing or mismatched");
                return null;
            }

            return ExtractGoogleUserInfo(root);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error verifying Google ID token");
            return null;
        }
    }
}
