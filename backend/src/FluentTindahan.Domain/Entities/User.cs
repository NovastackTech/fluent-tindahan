using FluentTindahan.Domain.Common;

namespace FluentTindahan.Domain.Entities;

public class User : IMustHaveTenant
{
    public const string NormalizedEmailUniqueIndexName = "IX_Users_NormalizedEmail";

    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public string Email { get; set; } = string.Empty;
    public string NormalizedEmail { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string? PinHash { get; set; }
    public int FailedPinAttempts { get; set; } = 0;
    public DateTimeOffset? PinLockoutEnd { get; set; }
    public int FailedPasswordAttempts { get; set; } = 0;
    public DateTimeOffset? PasswordLockoutEnd { get; set; }
    public string Phone { get; set; } = string.Empty;
    public string Role { get; set; } = "Owner"; // "Owner", "Staff"
    /// <summary>
    /// Legacy external authentication subject identifier (formerly Firebase Auth UID).
    /// Retained for optional federated identity providers or backward compatibility.
    /// The primary authentication mechanism is self-hosted email/password/PIN with native JWT access/refresh tokens.
    /// </summary>
    public string FirebaseUid { get; set; } = string.Empty;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? LastLoginAt { get; set; }
    /// <summary>
    /// Cryptographic SHA-256 hash of the active refresh token ID (JTI).
    /// Used for token rotation and instant revocation on logout, password change, or reuse detection.
    /// </summary>
    public string? RefreshTokenIdHash { get; set; }
    public DateTimeOffset? RefreshTokenExpiresAt { get; set; }

    public Tenant? Tenant { get; set; }
}
