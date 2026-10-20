namespace FluentTindahan.Domain.Interfaces;

public interface ICurrentUserService
{
    Guid TenantId { get; }
    Guid? UserId { get; }
    /// <summary>
    /// Legacy external authentication subject identifier (formerly Firebase Auth UID).
    /// Resolved from token sub/user_id claims.
    /// </summary>
    string? FirebaseUid { get; }
    string? Role { get; }
    bool IsAuthenticated { get; }
    bool EmailVerified { get; }
}
