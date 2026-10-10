using FluentTindahan.Domain.Enums;

namespace FluentTindahan.Domain.Billing;

/// <summary>
/// Canonical subscription price list, expressed in integer centavos (Rule 2).
/// This is the single authority both for creating checkout sessions and for
/// validating that an incoming paid webhook actually paid the right amount.
/// </summary>
public static class TierPricing
{
    public static bool TryGetPriceCentavos(PlanTier tier, BillingCycle cycle, out long centavos)
    {
        switch (tier, cycle)
        {
            case (PlanTier.TindahanPro, BillingCycle.Weekly):
                centavos = 3_500;
                return true;
            case (PlanTier.TindahanPro, BillingCycle.Monthly):
                centavos = 12_900;
                return true;
            case (PlanTier.NegosyoPlus, BillingCycle.Weekly):
                centavos = 8_900;
                return true;
            case (PlanTier.NegosyoPlus, BillingCycle.Monthly):
                centavos = 34_900;
                return true;
            default:
                centavos = 0;
                return false;
        }
    }

    public static long GetPriceCentavos(PlanTier tier, BillingCycle cycle) =>
        TryGetPriceCentavos(tier, cycle, out var centavos)
            ? centavos
            : throw new InvalidOperationException($"Invalid tier '{tier}' / cycle '{cycle}', or cannot purchase free tier.");

    /// <summary>Converts integer centavos to a two-decimal peso amount for display/API responses.</summary>
    public static decimal ToPesos(long centavos) => centavos / 100m;

    public static TimeSpan GetDuration(BillingCycle cycle) => cycle switch
    {
        BillingCycle.Weekly => TimeSpan.FromDays(7),
        BillingCycle.Monthly => TimeSpan.FromDays(30),
        _ => throw new InvalidOperationException($"Unknown billing cycle '{cycle}'.")
    };
}
