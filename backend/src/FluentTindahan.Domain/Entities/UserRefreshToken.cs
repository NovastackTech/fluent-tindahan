using FluentTindahan.Domain.Common;

namespace FluentTindahan.Domain.Entities;

/// <summary>
/// Refresh token record maintaining token families per device.
/// Enables multi-device session support, rotation, reuse detection (revoking only the affected family),
/// and a short grace window for the previous token.
/// </summary>
public class UserRefreshToken : IMustHaveTenant
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public Guid TenantId { get; set; }

    /// <summary>
    /// Identifies the token family (chain of rotated tokens) representing a specific device session.
    /// </summary>
    public string FamilyId { get; set; } = string.Empty;

    /// <summary>
    /// Cryptographic SHA-256 hash of the token ID (JTI).
    /// </summary>
    public string TokenHash { get; set; } = string.Empty;

    /// <summary>
    /// Expiration timestamp of the refresh token.
    /// </summary>
    public DateTimeOffset ExpiresAt { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    /// <summary>
    /// If this token was rotated, the hash of the replacement token.
    /// Null if this is the active/latest token in the family.
    /// </summary>
    public string? ReplacedByTokenHash { get; set; }

    /// <summary>
    /// If rotated, the timestamp until which this previous token is still accepted
    /// without triggering reuse revocation (short grace window).
    /// </summary>
    public DateTimeOffset? GraceExpiresAt { get; set; }

    /// <summary>
    /// Indicates whether this token family has been revoked (e.g. on reuse attack or logout).
    /// </summary>
    public bool IsRevoked { get; set; }

    public DateTimeOffset? RevokedAt { get; set; }

    public User? User { get; set; }
    public Tenant? Tenant { get; set; }
}
