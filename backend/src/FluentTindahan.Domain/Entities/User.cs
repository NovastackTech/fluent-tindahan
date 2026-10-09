using FluentTindahan.Domain.Common;

namespace FluentTindahan.Domain.Entities;

public class User : IMustHaveTenant
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public string Phone { get; set; } = string.Empty;
    public string Role { get; set; } = "Owner"; // "Owner", "Staff"
    public string FirebaseUid { get; set; } = string.Empty;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public Tenant? Tenant { get; set; }
}
