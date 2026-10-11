namespace FluentTindahan.Application.Common;

/// <summary>
/// Philippine Standard Time helpers (Asia/Manila, UTC+08:00, no DST).
/// Billing periods such as "this month" are anchored to the store's local calendar,
/// not UTC — otherwise the month would roll over at 08:00 PH time.
/// </summary>
public static class ManilaTime
{
    public static readonly TimeSpan Offset = TimeSpan.FromHours(8);

    /// <summary>Returns the instant at which the current Manila calendar month began (00:00 PHT on the 1st).</summary>
    public static DateTimeOffset StartOfCurrentMonthUtc(DateTimeOffset? nowOverride = null)
    {
        var manilaNow = (nowOverride ?? DateTimeOffset.UtcNow).ToOffset(Offset);
        return new DateTimeOffset(manilaNow.Year, manilaNow.Month, 1, 0, 0, 0, Offset).ToUniversalTime();
    }
}
