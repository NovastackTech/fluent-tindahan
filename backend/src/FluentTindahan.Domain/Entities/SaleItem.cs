using FluentTindahan.Domain.Common;

namespace FluentTindahan.Domain.Entities;

public class SaleItem : IMustHaveTenant
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid SaleId { get; set; }
    public Guid ProductId { get; set; }
    public int Qty { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal Subtotal { get; set; }

    public Tenant? Tenant { get; set; }
    public Sale? Sale { get; set; }
    public Product? Product { get; set; }
}
