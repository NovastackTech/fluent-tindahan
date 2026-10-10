using FluentTindahan.Domain.Enums;

namespace FluentTindahan.Domain.Billing;

/// <summary>
/// Canonical subscription price list, expressed in integer centavos (Rule 2).
/// This is the single authority both for creating checkout sessions and for
/// validating that an incoming paid webhook actually paid the right amount.
/// </summary>
public static class TierPricing
{
    public static long GetPriceCentavos(PlanTier tier, BillingCycle cycle) => (tier, cycle) switch
    {
        (PlanTier.TindahanPro, BillingCycle.Weekly) => 3_500,
        (PlanTier.TindahanPro, BillingCycle.Monthly) => 12_900,
        (PlanTier.NegosyoPlus, BillingCycle.Weekly) => 8_900,
        (PlanTier.NegosyoPlus, BillingCycle.Monthly) => 34_900,
        _ => throw new InvalidOperationException($"Invalid tier '{tier}' / cycle '{cycle}', or cannot purchase free tier.")
    };

    public static bool TryGetPriceCentavos(PlanTier tier, BillingCycle cycle, out long centavos)
    {
        try
        {
            centavos = GetPriceCentavos(tier, cycle);
            return true;
        }
        catch (InvalidOperationException)
        {
            centavos = 0;
            return false;
        }
    }

    /// <summary>Converts integer centavos to a two-decimal peso amount for display/API responses.</summary>
    public static decimal ToPesos(long centavos) => centavos / 100m;

    public static TimeSpan GetDuration(BillingCycle cycle) => cycle switch
    {
        BillingCycle.Weekly => TimeSpan.FromDays(7),
        BillingCycle.Monthly => TimeSpan.FromDays(30),
        _ => throw new InvalidOperationException($"Unknown billing cycle '{cycle}'.")
    };
}
