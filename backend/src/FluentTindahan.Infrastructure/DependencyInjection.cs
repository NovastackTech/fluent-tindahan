using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Hosting;
using FluentTindahan.Application.Common.Interfaces;
using FluentTindahan.Domain.Interfaces;
using FluentTindahan.Infrastructure.Persistence;
using FluentTindahan.Infrastructure.Services;

namespace FluentTindahan.Infrastructure;

public static class DependencyInjection
{
    public const string DefaultDevConnectionString =
        "Host=localhost;Port=5432;Database=fluent_tindahan;Username=fluent;Password=fluent_dev_change_me";

    public static IServiceCollection AddInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration,
        IHostEnvironment? environment = null)
    {
        services.AddHttpContextAccessor();
        services.AddScoped<ICurrentUserService, CurrentUserService>();

        environment ??= services.FirstOrDefault(d => d.ServiceType == typeof(IHostEnvironment))?.ImplementationInstance as IHostEnvironment;
        var envName = environment?.EnvironmentName
            ?? configuration["ASPNETCORE_ENVIRONMENT"]
            ?? configuration["DOTNET_ENVIRONMENT"]
            ?? Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT")
            ?? Environment.GetEnvironmentVariable("DOTNET_ENVIRONMENT")
            ?? Environments.Development;
        var isDevelopment = string.Equals(envName, Environments.Development, StringComparison.OrdinalIgnoreCase);

        var connectionString = configuration.GetConnectionString("DefaultConnection")
            ?? configuration["ConnectionStrings:DefaultConnection"]
            ?? configuration["DATABASE_URL"];

        if (string.IsNullOrWhiteSpace(connectionString))
        {
            if (!isDevelopment)
            {
                throw new InvalidOperationException("ConnectionStrings:DefaultConnection must be configured in production.");
            }

            connectionString = DefaultDevConnectionString;
        }

        services.AddDbContext<AppDbContext>((sp, options) =>
        {
            options.UseNpgsql(connectionString, npgsqlOptions =>
            {
                npgsqlOptions.MigrationsAssembly(typeof(AppDbContext).Assembly.FullName);
                npgsqlOptions.EnableRetryOnFailure(3);
            });
        });

        services.AddScoped<IApplicationDbContext>(sp => sp.GetRequiredService<AppDbContext>());

        services.TryAddSingleton(TimeProvider.System);
        services.AddSingleton<IJwtTokenService, JwtTokenService>();
        services.TryAddScoped<IEmailOtpSender, SmtpEmailOtpSender>();
        services.AddHttpClient<IPaymentGatewayService, PayMongoPaymentGatewayService>();
        services.AddHttpClient<IGoogleAuthService, GoogleAuthService>(client =>
        {
            client.Timeout = TimeSpan.FromSeconds(10);
        });
        services.AddHostedService<SubscriptionMonitorService>();

        return services;
    }
}
