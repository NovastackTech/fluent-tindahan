using FluentTindahan.Domain.Common;

namespace FluentTindahan.Domain.Entities;

public class UtangLedger : IMustHaveTenant
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid CustomerId { get; set; }
    public decimal Amount { get; set; } // Positive decimal value
    public string Type { get; set; } = "Credit"; // "Credit" (borrowed/utang) or "Payment" (bayad)
    public DateTimeOffset Date { get; set; } = DateTimeOffset.UtcNow;
    public Guid? RefSaleId { get; set; }
    public string? Notes { get; set; }

    public Tenant? Tenant { get; set; }
    public Customer? Customer { get; set; }
    public Sale? RefSale { get; set; }
}
