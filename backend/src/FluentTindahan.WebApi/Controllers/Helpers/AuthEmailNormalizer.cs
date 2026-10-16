using System.Text;

namespace FluentTindahan.WebApi.Controllers.Helpers;

/// <summary>
/// Provides Unicode NFKC normalization, invisible character stripping, and canonical lowercasing for email addresses.
/// </summary>
public static class AuthEmailNormalizer
{
    /// <summary>
    /// Cleans an email for display: applies Unicode NFKC normalization, removes invisible
    /// control/zero-width formatting characters, and trims Unicode whitespace. Preserves original letter case.
    /// </summary>
    public static string CleanDisplayEmail(string? email)
    {
        if (string.IsNullOrWhiteSpace(email))
        {
            return string.Empty;
        }

        var normalized = email.Normalize(NormalizationForm.FormKC);
        var sb = new StringBuilder(normalized.Length);
        foreach (var ch in normalized)
        {
            // Strip zero-width, bidirectional formatting, and invisible control characters:
            // \u200B: zero-width space
            // \u200C: zero-width non-joiner
            // \u200D: zero-width joiner
            // \uFEFF: zero-width no-break space (BOM)
            // \u200E / \u200F: left-to-right / right-to-left marks
            if (ch == '\u200B' ||
                ch == '\u200C' ||
                ch == '\u200D' ||
                ch == '\uFEFF' ||
                ch == '\u200E' ||
                ch == '\u200F' ||
                char.IsControl(ch))
            {
                continue;
            }

            sb.Append(ch);
        }

        return sb.ToString().Trim();
    }

    /// <summary>
    /// Normalizes an email address using Unicode NFKC normalization, stripping invisible
    /// control/zero-width formatting characters, trimming Unicode whitespace, and converting to invariant lowercase.
    /// Used for unique indexing and collision-free identity lookup.
    /// </summary>
    public static string NormalizeEmail(string? email)
    {
        return CleanDisplayEmail(email).ToLowerInvariant();
    }
}
