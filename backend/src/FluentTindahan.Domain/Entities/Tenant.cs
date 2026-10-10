using FluentTindahan.Domain.Enums;

namespace FluentTindahan.Domain.Entities;

public class Tenant
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string BusinessName { get; set; } = string.Empty;

    /// <summary>
    /// Single source of truth for the subscription tier.
    /// (The legacy free-text <c>PlanTier</c> column was backfilled into this and dropped
    /// by the <c>AddBillingSubscriptions</c> migration.)
    /// </summary>
    public PlanTier Tier { get; set; } = PlanTier.Libre;

    public DateTimeOffset? SubscriptionEndDate { get; set; }
    public string? ExternalCustomerId { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public ICollection<User> Users { get; set; } = new List<User>();
    public ICollection<Product> Products { get; set; } = new List<Product>();
    public ICollection<Customer> Customers { get; set; } = new List<Customer>();
    public ICollection<Sale> Sales { get; set; } = new List<Sale>();
    public ICollection<UtangLedger> UtangLedgers { get; set; } = new List<UtangLedger>();
    public ICollection<GCashTxn> GCashTransactions { get; set; } = new List<GCashTxn>();
    public ICollection<PaymentHistory> PaymentHistories { get; set; } = new List<PaymentHistory>();
}
