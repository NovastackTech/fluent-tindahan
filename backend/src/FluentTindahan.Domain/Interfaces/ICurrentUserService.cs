namespace FluentTindahan.Domain.Interfaces;

public interface ICurrentUserService
{
    Guid TenantId { get; }
    Guid? UserId { get; }
    string? FirebaseUid { get; }
    string? Role { get; }
    bool IsAuthenticated { get; }
}
