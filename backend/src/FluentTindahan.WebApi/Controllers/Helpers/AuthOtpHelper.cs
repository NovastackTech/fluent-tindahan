using System.Security.Cryptography;
using System.Text;
using FluentTindahan.Domain.Entities;

namespace FluentTindahan.WebApi.Controllers.Helpers;

public enum OtpVerificationStatus
{
    Success,
    InvalidFormat,
    MissingOrExpired,
    TooManyAttempts,
    InvalidCode
}

/// <summary>
/// Generates, hashes, and validates 6-digit email verification OTPs with expiration, attempt limits, and resend cooldowns.
/// </summary>
public static class AuthOtpHelper
{
    public const int OtpLength = 6;
    public static readonly TimeSpan OtpLifetime = TimeSpan.FromMinutes(10);
    public static readonly TimeSpan ResendCooldown = TimeSpan.FromSeconds(60);
    public const int MaxVerificationAttempts = 5;

    public static string IssueOtp(User user, TimeProvider timeProvider)
    {
        var now = timeProvider.GetUtcNow();
        var code = RandomNumberGenerator.GetInt32(0, 1_000_000).ToString("D6");

        user.EmailOtpHash = ComputeOtpHash(user.Id, user.NormalizedEmail, code);
        user.EmailOtpExpiresAt = now.Add(OtpLifetime);
        user.EmailOtpSentAt = now;
        user.EmailOtpAttempts = 0;

        return code;
    }

    public static bool CanResendOtp(User user, TimeProvider timeProvider, out int retryAfterSeconds)
    {
        var now = timeProvider.GetUtcNow();
        if (user.EmailOtpSentAt.HasValue)
        {
            var nextAllowed = user.EmailOtpSentAt.Value.Add(ResendCooldown);
            if (now < nextAllowed)
            {
                retryAfterSeconds = Math.Max(1, (int)Math.Ceiling((nextAllowed - now).TotalSeconds));
                return false;
            }
        }

        retryAfterSeconds = 0;
        return true;
    }

    public static OtpVerificationStatus VerifyOtp(User user, string? rawOtp, TimeProvider timeProvider)
    {
        var cleaned = rawOtp?.Trim() ?? string.Empty;
        if (cleaned.Length != OtpLength || !cleaned.All(char.IsAsciiDigit))
        {
            return OtpVerificationStatus.InvalidFormat;
        }

        var now = timeProvider.GetUtcNow();
        if (string.IsNullOrEmpty(user.EmailOtpHash) ||
            !user.EmailOtpExpiresAt.HasValue ||
            user.EmailOtpExpiresAt.Value < now)
        {
            return OtpVerificationStatus.MissingOrExpired;
        }

        if (user.EmailOtpAttempts >= MaxVerificationAttempts)
        {
            return OtpVerificationStatus.TooManyAttempts;
        }

        var expectedHash = ComputeOtpHash(user.Id, user.NormalizedEmail, cleaned);
        var isMatch = CryptographicOperations.FixedTimeEquals(
            Encoding.UTF8.GetBytes(user.EmailOtpHash),
            Encoding.UTF8.GetBytes(expectedHash));

        if (!isMatch)
        {
            user.EmailOtpAttempts++;
            return user.EmailOtpAttempts >= MaxVerificationAttempts
                ? OtpVerificationStatus.TooManyAttempts
                : OtpVerificationStatus.InvalidCode;
        }

        user.EmailVerified = true;
        ClearOtp(user);
        return OtpVerificationStatus.Success;
    }

    public static void ClearOtp(User user)
    {
        user.EmailOtpHash = null;
        user.EmailOtpExpiresAt = null;
        user.EmailOtpSentAt = null;
        user.EmailOtpAttempts = 0;
    }

    public static string ComputeOtpHash(Guid userId, string normalizedEmail, string otpCode)
    {
        var payload = $"{userId:N}:{normalizedEmail}:{otpCode}";
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(payload));
        return Convert.ToHexString(bytes);
    }
}
