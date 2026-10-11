using FluentTindahan.Domain.Common;

namespace FluentTindahan.Domain.Entities;

public class GCashTxn : IMustHaveTenant
{
    private string _refNo = string.Empty;

    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public string Type { get; set; } = "CashIn"; // "CashIn" or "CashOut"
    public decimal Amount { get; set; }
    public decimal Fee { get; set; }

    /// <summary>
    /// Reference number for the GCash transaction. RefNo is immutable after insert.
    /// </summary>
    public string RefNo { get; set; } = string.Empty;

    /// <summary>
    /// Trimmed, lower-cased RefNo. Unique per tenant when non-empty (enforced by a partial unique index).
    /// Normalization is set during creation/insert only to preserve legacy rows with an empty RefNoNorm.
    /// </summary>
    public string RefNoNorm { get; set; } = string.Empty;

    public string? CustomerPhone { get; set; }
    public DateTimeOffset Date { get; set; } = DateTimeOffset.UtcNow;
    public string? Notes { get; set; }

    public Tenant? Tenant { get; set; }

    public static string NormalizeRef(string? refNo) => (refNo ?? string.Empty).Trim().ToLowerInvariant();
}
