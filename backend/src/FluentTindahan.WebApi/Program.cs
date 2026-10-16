using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using System.Threading.RateLimiting;
using FluentTindahan.Application;
using FluentTindahan.Infrastructure;
using FluentTindahan.Infrastructure.Persistence;
using FluentTindahan.Infrastructure.Services;
using FluentTindahan.WebApi;
using FluentTindahan.WebApi.Authorization;
using FluentTindahan.WebApi.Middleware;

var builder = WebApplication.CreateBuilder(args);

// Configure Forwarded Headers for reverse proxies (edge nginx + compose web nginx)
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    options.KnownNetworks.Clear();
    options.KnownProxies.Clear();
});

// Add Clean Architecture layers
builder.Services.AddApplication();
builder.Services.AddInfrastructure(builder.Configuration);

// Add Controllers & JSON options
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.PropertyNameCaseInsensitive = true;
    });

// CORS: support PWA on Vite and local/mobile development (restricted outside Development)
builder.Services.AddCors(options =>
{
    options.AddPolicy(CorsPolicies.AllowPwaClient, policy =>
    {
        CorsPolicies.ConfigurePwaCors(policy, builder.Configuration, builder.Environment);
    });
});

// Configure Authentication (HMAC-SHA256 Signed JWT Bearer with cryptographic validation)
var jwtSecret = builder.Configuration["Jwt:SecretKey"]
    ?? builder.Configuration["JWT_SECRET_KEY"]
    ?? (builder.Environment.IsDevelopment() ? JwtTokenService.DefaultDevSecretKey : null);

if (string.IsNullOrWhiteSpace(jwtSecret) || jwtSecret.Length < 32)
{
    if (!builder.Environment.IsDevelopment())
    {
        throw new InvalidOperationException("Jwt:SecretKey or JWT_SECRET_KEY must be configured with at least 32 characters (256 bits) in production.");
    }
    jwtSecret = JwtTokenService.DefaultDevSecretKey;
}

if (!builder.Environment.IsDevelopment() &&
    (string.Equals(jwtSecret, JwtTokenService.BurnedSecretKey, StringComparison.Ordinal) ||
     string.Equals(jwtSecret, JwtTokenService.DefaultDevSecretKey, StringComparison.Ordinal)))
{
    throw new InvalidOperationException("The committed JWT secret key has been burned and cannot be used in production. A new unique JWT_SECRET_KEY must be generated and configured per real deployment.");
}

var jwtIssuer = builder.Configuration["Jwt:Issuer"] ?? JwtTokenService.DefaultIssuer;
var jwtAudience = builder.Configuration["Jwt:Audience"] ?? JwtTokenService.DefaultAudience;
var signingKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret));

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.RequireHttpsMetadata = !builder.Environment.IsDevelopment();
        options.SaveToken = true;
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = signingKey,
            ValidateIssuer = true,
            ValidIssuer = jwtIssuer,
            ValidateAudience = true,
            ValidAudience = jwtAudience,
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromMinutes(1)
        };
    });

builder.Services.AddScoped<IAuthorizationHandler, TenantResolvedHandler>();
builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<ApiExceptionHandler>();
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy(AuthorizationPolicies.TenantResolved, policy =>
        policy.AddRequirements(new TenantResolvedRequirement()));
    options.AddPolicy(AuthorizationPolicies.Owner, policy =>
        policy.RequireRole("Owner"));
});
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

    options.AddPolicy("AnonymousDemoProvision", context =>
    {
        if (context.User.Identity?.IsAuthenticated == true)
        {
            return RateLimitPartition.GetNoLimiter("authenticated");
        }

        var clientIp = context.Connection.RemoteIpAddress?.ToString() ?? "unknown";
        return RateLimitPartition.GetFixedWindowLimiter(clientIp, _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = 10,
            Window = TimeSpan.FromMinutes(1),
            QueueLimit = 0,
            AutoReplenishment = true
        });
    });

    options.AddPolicy("AuthSensitive", context =>
    {
        var clientIp = context.Connection.RemoteIpAddress?.ToString() ?? "unknown";
        var userIdentifier = context.User.Identity?.IsAuthenticated == true
            ? (context.User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
               ?? context.User.FindFirst("sub")?.Value
               ?? context.User.FindFirst("user_id")?.Value
               ?? "auth")
            : "anon";

        var partitionKey = $"{clientIp}:{userIdentifier}";
        return RateLimitPartition.GetFixedWindowLimiter(partitionKey, _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = 10,
            Window = TimeSpan.FromMinutes(1),
            QueueLimit = 0,
            AutoReplenishment = true
        });
    });

    options.AddPolicy("PinLogin", context =>
    {
        var clientIp = context.Connection.RemoteIpAddress?.ToString() ?? "unknown";
        return RateLimitPartition.GetFixedWindowLimiter(clientIp, _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = 5,
            Window = TimeSpan.FromMinutes(1),
            QueueLimit = 0,
            AutoReplenishment = true
        });
    });
});

// Swagger / OpenAPI documentation
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "Fluent Tindahan Web API",
        Version = "v1",
        Description = "Offline-First Multi-tenant POS Web API for Philippine Small Businesses (Sari-Sari stores & GCash agents)"
    });

    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Description = "JWT Authorization header using the Bearer scheme. Format: 'Bearer {token}'",
        Name = "Authorization",
        In = ParameterLocation.Header,
        Type = SecuritySchemeType.ApiKey,
        Scheme = "Bearer"
    });

    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference
                {
                    Type = ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            Array.Empty<string>()
        }
    });
});

// Fail fast: billing must never run in a non-Development environment without its secrets
// (a missing webhook secret would otherwise weaken signature verification).
FluentTindahan.Infrastructure.Services.PayMongoPaymentGatewayService.ValidateConfiguration(builder.Configuration, builder.Environment);

var app = builder.Build();
app.UseExceptionHandler();
app.UseForwardedHeaders();

// Migrate and seed database
using (var scope = app.Services.CreateScope())
{
    var services = scope.ServiceProvider;
    var logger = services.GetRequiredService<ILogger<Program>>();
    try
    {
        var db = services.GetRequiredService<AppDbContext>();
        await DatabaseMigrator.MigrateAsync(db, logger);
        await DatabaseSeeder.SeedAsync(db, app.Environment, builder.Configuration);
        logger.LogInformation("Database migrated and seeded successfully.");
    }
    catch (Exception ex)
    {
        logger.LogError(ex, "An error occurred while migrating or seeding the database.");
        if (!app.Environment.IsDevelopment())
        {
            throw;
        }
    }
}

// HTTP request pipeline
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(c =>
    {
        c.SwaggerEndpoint("/swagger/v1/swagger.json", "Fluent Tindahan API v1");
    });
}

app.UseCors("AllowPwaClient");

app.UseRouting();
app.UseAuthentication();
app.UseRateLimiter();
app.UseAuthorization();

app.MapControllers();

app.Run();
