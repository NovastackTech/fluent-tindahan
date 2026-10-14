using System.Text.RegularExpressions;

namespace FluentTindahan.Domain.Common;

public static class PhilippineMobileNumber
{
    private static readonly Regex Separators = new(@"[\s()-]", RegexOptions.Compiled);
    private static readonly Regex LocalFormat = new(@"^09[0-9]{9}$", RegexOptions.Compiled);
    private static readonly Regex InternationalFormat = new(@"^\+639[0-9]{9}$", RegexOptions.Compiled);
    private static readonly Regex InternationalWithoutPlusFormat = new(@"^639[0-9]{9}$", RegexOptions.Compiled);
    private static readonly Regex NationalWithoutLeadingZeroFormat = new(@"^9[0-9]{9}$", RegexOptions.Compiled);

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

        if (InternationalWithoutPlusFormat.IsMatch(compact))
        {
            normalized = $"0{compact[2..]}";
            return true;
        }

        if (NationalWithoutLeadingZeroFormat.IsMatch(compact))
        {
            normalized = $"0{compact}";
            return true;
        }

        return false;
    }
}
