using FluentTindahan.Domain.Enums;

namespace FluentTindahan.Domain.Entities;

public class Tenant
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string BusinessName { get; set; } = string.Empty;

    private FluentTindahan.Domain.Enums.PlanTier _tier = FluentTindahan.Domain.Enums.PlanTier.Libre;
    public FluentTindahan.Domain.Enums.PlanTier Tier
    {
        get => _tier;
        set
        {
            _tier = value;
            _planTier = value.ToString();
        }
    }

    private string _planTier = "Free";
    public string PlanTier
    {
        get => _planTier;
        set
        {
            _planTier = value;
            if (Enum.TryParse<FluentTindahan.Domain.Enums.PlanTier>(value, true, out var parsed))
            {
                _tier = parsed;
            }
            else if (string.Equals(value, "Free", StringComparison.OrdinalIgnoreCase))
            {
                _tier = FluentTindahan.Domain.Enums.PlanTier.Libre;
            }
            else if (string.Equals(value, "SariSariPro", StringComparison.OrdinalIgnoreCase))
            {
                _tier = FluentTindahan.Domain.Enums.PlanTier.TindahanPro;
            }
        }
    }

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
