using FluentTindahan.Domain.Common;
using FluentTindahan.Domain.Enums;

namespace FluentTindahan.Domain.Entities;

public class PaymentHistory : IMustHaveTenant
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    /// <summary>Amount actually paid, in integer centavos (₱129.00 = 12900).</summary>
    public long AmountCentavos { get; set; }
    public string Currency { get; set; } = "PHP";
    public PlanTier TierPurchased { get; set; }
    public BillingCycle BillingCycle { get; set; } = BillingCycle.Monthly;
    public string GatewayReferenceId { get; set; } = string.Empty;
    public string Status { get; set; } = "Paid";
    public string PaymentMethod { get; set; } = "paymongo";
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public Tenant? Tenant { get; set; }
}
