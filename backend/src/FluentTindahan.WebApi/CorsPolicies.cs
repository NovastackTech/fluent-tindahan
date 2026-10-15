using Microsoft.AspNetCore.Cors.Infrastructure;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;

namespace FluentTindahan.WebApi;

public static class CorsPolicies
{
    public const string AllowPwaClient = "AllowPwaClient";

    public static void ConfigurePwaCors(CorsPolicyBuilder policy, IConfiguration configuration, IHostEnvironment environment)
    {
        if (environment.IsDevelopment())
        {
            policy.SetIsOriginAllowed(_ => true) // Allow any localhost/LAN origin for PWA testing
                  .AllowAnyHeader()
                  .AllowAnyMethod()
                  .AllowCredentials();
            return;
        }

        var allowedOrigins = GetAllowedOrigins(configuration);
        if (allowedOrigins.Count > 0)
        {
            policy.WithOrigins(allowedOrigins.ToArray())
                  .SetIsOriginAllowed(origin => allowedOrigins.Contains(origin))
                  .AllowAnyHeader()
                  .AllowAnyMethod()
                  .AllowCredentials();
        }
        else
        {
            policy.AllowAnyHeader()
                  .AllowAnyMethod();
        }
    }

    public static HashSet<string> GetAllowedOrigins(IConfiguration configuration)
    {
        var allowedOrigins = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        void AddOrigin(string? raw)
        {
            if (!string.IsNullOrWhiteSpace(raw) &&
                Uri.TryCreate(raw.Trim(), UriKind.Absolute, out var uri) &&
                (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps))
            {
                allowedOrigins.Add(uri.GetLeftPart(UriPartial.Authority));
            }
        }

        AddOrigin(configuration["PAYMONGO_FRONTEND_ORIGIN"]);
        AddOrigin(configuration["PayMongo:FrontendOrigin"]);
        AddOrigin(configuration["PUBLIC_ORIGIN"]);
        AddOrigin(configuration["PublicOrigin"]);

        return allowedOrigins;
    }
}
