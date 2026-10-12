using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using FluentTindahan.Application;
using FluentTindahan.Infrastructure;
using FluentTindahan.Infrastructure.Persistence;
using FluentTindahan.WebApi.Authorization;
using FluentTindahan.WebApi.Middleware;

var builder = WebApplication.CreateBuilder(args);

// Add Clean Architecture layers
builder.Services.AddApplication();
builder.Services.AddInfrastructure(builder.Configuration);

// Add Controllers & JSON options
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.PropertyNameCaseInsensitive = true;
    });

// CORS: support PWA on Vite and local/mobile development
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowPwaClient", policy =>
    {
        policy.SetIsOriginAllowed(_ => true) // Allow any localhost/LAN origin for PWA testing
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

// Configure Authentication (Firebase JWT Bearer with graceful fallback)
var firebaseProjectId = builder.Configuration["Firebase:ProjectId"] ?? "fluent-tindahan-dev";
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.Authority = $"https://securetoken.google.com/{firebaseProjectId}";
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = $"https://securetoken.google.com/{firebaseProjectId}",
            ValidateAudience = true,
            ValidAudience = firebaseProjectId,
            ValidateLifetime = true
        };
        // For development/offline demo where firebase tokens might be mock
        options.Events = new JwtBearerEvents
        {
            OnAuthenticationFailed = context =>
            {
                // Skip exception so dev mode can still proceed if using dev tokens
                context.NoResult();
                return Task.CompletedTask;
            }
        };
    });

builder.Services.AddScoped<IAuthorizationHandler, TenantResolvedHandler>();
builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<ApiExceptionHandler>();
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy(AuthorizationPolicies.TenantResolved, policy =>
        policy.AddRequirements(new TenantResolvedRequirement()));
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

// Migrate and seed database
using (var scope = app.Services.CreateScope())
{
    var services = scope.ServiceProvider;
    var logger = services.GetRequiredService<ILogger<Program>>();
    try
    {
        var db = services.GetRequiredService<AppDbContext>();
        await DatabaseMigrator.MigrateAsync(db, logger);
        await DatabaseSeeder.SeedAsync(db);
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

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();
