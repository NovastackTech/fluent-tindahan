using FluentTindahan.Domain.Common;

namespace FluentTindahan.Domain.Entities;

public class Customer : IMustHaveTenant
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public decimal TotalUtangBalance { get; set; } = 0m;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    public Tenant? Tenant { get; set; }
    public ICollection<UtangLedger> UtangLedgers { get; set; } = new List<UtangLedger>();
}
