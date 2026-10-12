using System.Text.RegularExpressions;

namespace FluentTindahan.Domain.Common;

public static class PhilippineMobileNumber
{
    private static readonly Regex Separators = new(@"[\s()-]", RegexOptions.Compiled);
    private static readonly Regex LocalFormat = new(@"^09\d{9}$", RegexOptions.Compiled);
    private static readonly Regex InternationalFormat = new(@"^\+639\d{9}$", RegexOptions.Compiled);

    public static bool TryNormalize(string? value, out string normalized)
    {
        normalized = string.Empty;
        if (string.IsNullOrWhiteSpace(value)) return true;

        var compact = Separators.Replace(value.Trim(), string.Empty);
        if (LocalFormat.IsMatch(compact))
        {
            normalized = compact;
            return true;
        }

        if (InternationalFormat.IsMatch(compact))
        {
            normalized = $"0{compact[3..]}";
            return true;
        }

        return false;
    }
}
