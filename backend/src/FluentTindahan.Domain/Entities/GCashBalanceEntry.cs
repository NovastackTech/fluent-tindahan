using FluentTindahan.Domain.Common;

namespace FluentTindahan.Domain.Entities;

public class GCashBalanceEntry : IMustHaveTenant
{
    public const string OpeningUniqueIndexName = "IX_GCashBalanceEntries_TenantId_Opening";

    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public string Kind { get; set; } = "Adjustment";
    public decimal CashDelta { get; set; }
    public decimal WalletDelta { get; set; }
    public DateTimeOffset Date { get; set; } = DateTimeOffset.UtcNow;
    public string Reason { get; set; } = string.Empty;
    public Guid? OpeningEntryId { get; set; }
    public Tenant? Tenant { get; set; }
}
