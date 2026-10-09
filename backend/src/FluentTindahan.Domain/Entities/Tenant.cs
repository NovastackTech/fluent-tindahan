namespace FluentTindahan.Domain.Entities;

public class Tenant
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string BusinessName { get; set; } = string.Empty;
    public string PlanTier { get; set; } = "Free";
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public ICollection<User> Users { get; set; } = new List<User>();
    public ICollection<Product> Products { get; set; } = new List<Product>();
    public ICollection<Customer> Customers { get; set; } = new List<Customer>();
    public ICollection<Sale> Sales { get; set; } = new List<Sale>();
    public ICollection<UtangLedger> UtangLedgers { get; set; } = new List<UtangLedger>();
    public ICollection<GCashTxn> GCashTransactions { get; set; } = new List<GCashTxn>();
}
