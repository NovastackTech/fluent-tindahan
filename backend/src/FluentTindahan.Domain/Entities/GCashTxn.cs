using FluentTindahan.Domain.Common;

namespace FluentTindahan.Domain.Entities;

public class GCashTxn : IMustHaveTenant
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public string Type { get; set; } = "CashIn"; // "CashIn" or "CashOut"
    public decimal Amount { get; set; }
    public decimal Fee { get; set; }
    public string RefNo { get; set; } = string.Empty;
    public string? CustomerPhone { get; set; }
    public DateTimeOffset Date { get; set; } = DateTimeOffset.UtcNow;
    public string? Notes { get; set; }

    public Tenant? Tenant { get; set; }
}
