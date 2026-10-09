using FluentTindahan.Domain.Common;

namespace FluentTindahan.Domain.Entities;

public class Sale : IMustHaveTenant
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public decimal TotalAmount { get; set; }
    public string PaymentMethod { get; set; } = "Cash"; // "Cash", "GCash", "Split", "Utang"
    public DateTimeOffset Date { get; set; } = DateTimeOffset.UtcNow;
    public Guid UserId { get; set; }
    public decimal? CashReceived { get; set; }
    public decimal? ChangeGiven { get; set; }
    public Guid? CustomerId { get; set; }

    public Tenant? Tenant { get; set; }
    public User? User { get; set; }
    public Customer? Customer { get; set; }
    public ICollection<SaleItem> Items { get; set; } = new List<SaleItem>();
}
