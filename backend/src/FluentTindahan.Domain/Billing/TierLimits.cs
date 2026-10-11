using FluentTindahan.Domain.Enums;

namespace FluentTindahan.Domain.Billing;

/// <summary>
/// Canonical resource limits and feature gating by subscription tier.
/// Centralizes limits across sync validation, billing queries, and API layers.
/// </summary>
public static class TierLimits
{
    public const int LibreMaxProducts = 50;
    public const int LibreMaxCustomers = 30;
    public const int LibreMaxGCashTransactionsPerMonth = 30;

    public const int Unlimited = -1;

    public static int GetMaxProducts(PlanTier tier) => tier switch
    {
        PlanTier.Libre => LibreMaxProducts,
        _ => Unlimited
    };

    public static int GetMaxCustomers(PlanTier tier) => tier switch
    {
        PlanTier.Libre => LibreMaxCustomers,
        _ => Unlimited
    };

    public static int GetMaxGCashTransactionsPerMonth(PlanTier tier) => tier switch
    {
        PlanTier.Libre => LibreMaxGCashTransactionsPerMonth,
        _ => Unlimited
    };

    public static int GetMaxUsers(PlanTier tier) => tier switch
    {
        PlanTier.NegosyoPlus => 5,
        _ => 1
    };

    public static int GetMaxDevices(PlanTier tier) => tier switch
    {
        PlanTier.Libre => 1,
        PlanTier.TindahanPro => 2,
        PlanTier.NegosyoPlus => 4,
        _ => 1
    };

    public static bool CanImportCsv(PlanTier tier) => tier != PlanTier.Libre;
    public static bool HasWatermarkedReceipts(PlanTier tier) => tier == PlanTier.Libre;
    public static bool HasProfitAnalytics(PlanTier tier) => tier != PlanTier.Libre;
    public static bool HasAuditLogs(PlanTier tier) => tier == PlanTier.NegosyoPlus;
}
