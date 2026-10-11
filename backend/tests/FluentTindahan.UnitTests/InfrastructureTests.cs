using System.Security.Claims;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Moq;
using FluentTindahan.Application.Common.Interfaces;
using FluentTindahan.Domain.Interfaces;
using FluentTindahan.Infrastructure;
using FluentTindahan.Infrastructure.Persistence;
using FluentTindahan.Infrastructure.Services;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.Extensions.Hosting;
using Xunit;

namespace FluentTindahan.UnitTests;

public class InfrastructureTests
{
    [Fact]
    public void CurrentUserService_NullHttpContext_ReturnsDefaults()
    {
        var httpAccessorMock = new Mock<IHttpContextAccessor>();
        httpAccessorMock.Setup(h => h.HttpContext).Returns((HttpContext?)null);

        var service = new CurrentUserService(httpAccessorMock.Object);

        service.TenantId.Should().Be(CurrentUserService.DefaultTenantId);
        service.UserId.Should().Be(CurrentUserService.DefaultUserId);
        service.FirebaseUid.Should().BeNull();
        service.Role.Should().Be("Owner");
        service.IsAuthenticated.Should().BeFalse();
    }

    [Fact]
    public void CurrentUserService_HeadersProvided_InDevelopment_ResolvesCustomTenantAndUserWhenUnauthenticated()
    {
        var expectedTenant = Guid.NewGuid();
        var expectedUser = Guid.NewGuid();

        var context = new DefaultHttpContext();
        context.Request.Headers["X-Tenant-Id"] = expectedTenant.ToString();
        context.Request.Headers["X-User-Id"] = expectedUser.ToString();

        var httpAccessorMock = new Mock<IHttpContextAccessor>();
        httpAccessorMock.Setup(h => h.HttpContext).Returns(context);

        var envMock = new Mock<IHostEnvironment>();
        envMock.Setup(e => e.EnvironmentName).Returns(Environments.Development);

        var service = new CurrentUserService(httpAccessorMock.Object, envMock.Object);

        service.TenantId.Should().Be(expectedTenant);
        service.UserId.Should().Be(expectedUser);
    }

    [Fact]
    public void CurrentUserService_HeadersProvided_InProduction_IgnoresHeadersAndReturnsDefaults()
    {
        var spoofedTenant = Guid.NewGuid();
        var spoofedUser = Guid.NewGuid();

        var context = new DefaultHttpContext();
        context.Request.Headers["X-Tenant-Id"] = spoofedTenant.ToString();
        context.Request.Headers["X-User-Id"] = spoofedUser.ToString();

        var httpAccessorMock = new Mock<IHttpContextAccessor>();
        httpAccessorMock.Setup(h => h.HttpContext).Returns(context);

        var envMock = new Mock<IHostEnvironment>();
        envMock.Setup(e => e.EnvironmentName).Returns(Environments.Production);

        var service = new CurrentUserService(httpAccessorMock.Object, envMock.Object);

        // Security invariant: In production, unauthenticated headers MUST be ignored
        service.TenantId.Should().Be(CurrentUserService.DefaultTenantId);
        service.UserId.Should().Be(CurrentUserService.DefaultUserId);
        service.TenantId.Should().NotBe(spoofedTenant);
        service.UserId.Should().NotBe(spoofedUser);
    }

    [Fact]
    public void CurrentUserService_AuthenticatedWithoutClaims_IgnoresHeadersAndReturnsDefaults()
    {
        var spoofedTenant = Guid.NewGuid();
        var spoofedUser = Guid.NewGuid();

        // Caller is authenticated, but claims lack tenant_id / sub
        var claims = new[] { new Claim("some_other_claim", "val") };
        var identity = new ClaimsIdentity(claims, "Bearer");
        var principal = new ClaimsPrincipal(identity);

        var context = new DefaultHttpContext { User = principal };
        context.Request.Headers["X-Tenant-Id"] = spoofedTenant.ToString();
        context.Request.Headers["X-User-Id"] = spoofedUser.ToString();

        var httpAccessorMock = new Mock<IHttpContextAccessor>();
        httpAccessorMock.Setup(h => h.HttpContext).Returns(context);

        var envMock = new Mock<IHostEnvironment>();
        envMock.Setup(e => e.EnvironmentName).Returns(Environments.Development);

        var service = new CurrentUserService(httpAccessorMock.Object, envMock.Object);

        // Security invariant: Authenticated callers can never spoof headers, even in Development
        service.IsAuthenticated.Should().BeTrue();
        service.TenantId.Should().Be(CurrentUserService.DefaultTenantId);
        service.UserId.Should().Be(CurrentUserService.DefaultUserId);
        service.TenantId.Should().NotBe(spoofedTenant);
        service.UserId.Should().NotBe(spoofedUser);
    }

    [Fact]
    public void CurrentUserService_DemoModeViaConfig_ResolvesCustomTenantAndUserWhenUnauthenticated()
    {
        var expectedTenant = Guid.NewGuid();
        var expectedUser = Guid.NewGuid();

        var context = new DefaultHttpContext();
        context.Request.Headers["X-Tenant-Id"] = expectedTenant.ToString();
        context.Request.Headers["X-User-Id"] = expectedUser.ToString();

        var httpAccessorMock = new Mock<IHttpContextAccessor>();
        httpAccessorMock.Setup(h => h.HttpContext).Returns(context);

        var envMock = new Mock<IHostEnvironment>();
        envMock.Setup(e => e.EnvironmentName).Returns(Environments.Production);

        var configMock = new Mock<IConfiguration>();
        configMock.Setup(c => c["DemoMode"]).Returns("true");

        var service = new CurrentUserService(httpAccessorMock.Object, envMock.Object, configMock.Object);

        service.TenantId.Should().Be(expectedTenant);
        service.UserId.Should().Be(expectedUser);
    }

    [Fact]
    public void CurrentUserService_NullEnvironment_DefaultsToSecureProductionBehavior()
    {
        var spoofedTenant = Guid.NewGuid();
        var spoofedUser = Guid.NewGuid();

        var context = new DefaultHttpContext();
        context.Request.Headers["X-Tenant-Id"] = spoofedTenant.ToString();
        context.Request.Headers["X-User-Id"] = spoofedUser.ToString();

        var httpAccessorMock = new Mock<IHttpContextAccessor>();
        httpAccessorMock.Setup(h => h.HttpContext).Returns(context);

        // No environment or config provided (null) -> must fail safe to secure behavior
        var service = new CurrentUserService(httpAccessorMock.Object);

        service.TenantId.Should().Be(CurrentUserService.DefaultTenantId);
        service.UserId.Should().Be(CurrentUserService.DefaultUserId);
    }

    [Fact]
    public void CurrentUserService_HeadersWithEmptyGuid_InDevelopment_ReturnsDefaults()
    {
        var context = new DefaultHttpContext();
        context.Request.Headers["X-Tenant-Id"] = Guid.Empty.ToString();
        context.Request.Headers["X-User-Id"] = Guid.Empty.ToString();

        var httpAccessorMock = new Mock<IHttpContextAccessor>();
        httpAccessorMock.Setup(h => h.HttpContext).Returns(context);

        var envMock = new Mock<IHostEnvironment>();
        envMock.Setup(e => e.EnvironmentName).Returns(Environments.Development);

        var service = new CurrentUserService(httpAccessorMock.Object, envMock.Object);

        service.TenantId.Should().Be(CurrentUserService.DefaultTenantId);
        service.UserId.Should().Be(CurrentUserService.DefaultUserId);
    }

    [Fact]
    public void CurrentUserService_ClaimsWithEmptyGuid_ReturnsDefaults()
    {
        var claims = new[]
        {
            new Claim("tenant_id", Guid.Empty.ToString()),
            new Claim("sub", Guid.Empty.ToString())
        };
        var identity = new ClaimsIdentity(claims, "Bearer");
        var principal = new ClaimsPrincipal(identity);

        var context = new DefaultHttpContext { User = principal };

        var httpAccessorMock = new Mock<IHttpContextAccessor>();
        httpAccessorMock.Setup(h => h.HttpContext).Returns(context);

        var service = new CurrentUserService(httpAccessorMock.Object);

        service.TenantId.Should().Be(CurrentUserService.DefaultTenantId);
        service.UserId.Should().Be(CurrentUserService.DefaultUserId);
    }

    [Fact]
    public void CurrentUserService_ClaimsProvided_ResolvesFromClaimsPrincipal()
    {
        var expectedTenant = Guid.NewGuid();
        var expectedUser = Guid.NewGuid();

        var claims = new[]
        {
            new Claim("tenant_id", expectedTenant.ToString()),
            new Claim("sub", expectedUser.ToString()),
            new Claim("user_id", "firebase_abc_123"),
            new Claim(ClaimTypes.Role, "Staff")
        };
        var identity = new ClaimsIdentity(claims, "TestAuth");
        var principal = new ClaimsPrincipal(identity);

        var context = new DefaultHttpContext { User = principal };

        var httpAccessorMock = new Mock<IHttpContextAccessor>();
        httpAccessorMock.Setup(h => h.HttpContext).Returns(context);

        var service = new CurrentUserService(httpAccessorMock.Object);

        service.TenantId.Should().Be(expectedTenant);
        service.UserId.Should().Be(expectedUser);
        service.FirebaseUid.Should().Be("firebase_abc_123");
        service.Role.Should().Be("Staff");
        service.IsAuthenticated.Should().BeTrue();
    }

    [Fact]
    public void CurrentUserService_AuthenticatedClaimsTakePrecedenceOverHeader()
    {
        var claimTenant = Guid.NewGuid();
        var claimUser = Guid.NewGuid();
        var spoofedHeaderTenant = Guid.NewGuid();
        var spoofedHeaderUser = Guid.NewGuid();

        var claims = new[]
        {
            new Claim("tenant_id", claimTenant.ToString()),
            new Claim("sub", claimUser.ToString())
        };
        var identity = new ClaimsIdentity(claims, "Bearer");
        var principal = new ClaimsPrincipal(identity);

        var context = new DefaultHttpContext { User = principal };
        // Attacker attempts to spoof tenant and user IDs via headers
        context.Request.Headers["X-Tenant-Id"] = spoofedHeaderTenant.ToString();
        context.Request.Headers["X-User-Id"] = spoofedHeaderUser.ToString();

        var httpAccessorMock = new Mock<IHttpContextAccessor>();
        httpAccessorMock.Setup(h => h.HttpContext).Returns(context);

        var service = new CurrentUserService(httpAccessorMock.Object);

        // Cryptographically verified claims must take precedence over unverified headers
        service.TenantId.Should().Be(claimTenant);
        service.UserId.Should().Be(claimUser);
        service.TenantId.Should().NotBe(spoofedHeaderTenant);
        service.UserId.Should().NotBe(spoofedHeaderUser);
    }

    [Fact]
    public async Task DatabaseSeeder_SeedAsync_SeedsTenantUserProductsAndIsIdempotent()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;

        var userMock = new Mock<ICurrentUserService>();
        userMock.Setup(u => u.TenantId).Returns(CurrentUserService.DefaultTenantId);

        var dbContext = new AppDbContext(options, userMock.Object);

        // Run seeder first time
        await DatabaseSeeder.SeedAsync(dbContext);

        var tenant = await dbContext.Tenants.IgnoreQueryFilters().FirstOrDefaultAsync(t => t.Id == CurrentUserService.DefaultTenantId);
        tenant.Should().NotBeNull();
        tenant!.BusinessName.Should().Contain("Aling Nena");

        var user = await dbContext.Users.IgnoreQueryFilters().FirstOrDefaultAsync(u => u.Id == CurrentUserService.DefaultUserId);
        user.Should().NotBeNull();

        var productCount = await dbContext.Products.IgnoreQueryFilters().CountAsync();
        productCount.Should().BeGreaterThan(50); // Full 138-item sari-sari catalog

        var customerCount = await dbContext.Customers.IgnoreQueryFilters().CountAsync();
        customerCount.Should().BeGreaterThan(0); // Sample debtors

        // Run seeder second time (should be idempotent without duplicate key exceptions)
        await DatabaseSeeder.SeedAsync(dbContext);

        var secondProductCount = await dbContext.Products.IgnoreQueryFilters().CountAsync();
        secondProductCount.Should().Be(productCount);
    }

    [Fact]
    public void DependencyInjection_AddInfrastructure_RegistersServices()
    {
        var services = new ServiceCollection();
        var configMock = new Mock<IConfiguration>();
        var configSectionMock = new Mock<IConfigurationSection>();
        configSectionMock.Setup(s => s.Value).Returns("Host=localhost;Database=test;Username=postgres;Password=test");
        configMock.Setup(c => c.GetSection("ConnectionStrings")).Returns(new Mock<IConfigurationSection>().Object);

        services.AddInfrastructure(configMock.Object);

        services.Any(s => s.ServiceType == typeof(ICurrentUserService)).Should().BeTrue();
        services.Any(s => s.ServiceType == typeof(IApplicationDbContext)).Should().BeTrue();
        services.Any(s => s.ServiceType == typeof(AppDbContext)).Should().BeTrue();
    }

    [Fact]
    public void DependencyInjection_CanResolveCurrentUserService()
    {
        var services = new ServiceCollection();
        var configMock = new Mock<IConfiguration>();
        var connStringsSection = new Mock<IConfigurationSection>();
        connStringsSection.Setup(s => s["DefaultConnection"]).Returns("Host=localhost;Database=test");
        configMock.Setup(c => c.GetSection("ConnectionStrings")).Returns(connStringsSection.Object);

        var envMock = new Mock<IHostEnvironment>();
        envMock.Setup(e => e.EnvironmentName).Returns(Environments.Development);

        services.AddSingleton(envMock.Object);
        services.AddInfrastructure(configMock.Object);

        using var provider = services.BuildServiceProvider();
        using var scope = provider.CreateScope();
        var service = scope.ServiceProvider.GetService<ICurrentUserService>();

        service.Should().NotBeNull();
        service.Should().BeOfType<CurrentUserService>();
    }

    [Fact]
    public void AppDbContext_HasNoPendingModelChanges()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql("Host=localhost;Database=test")
            .Options;
        var userMock = new Mock<ICurrentUserService>();
        using var context = new AppDbContext(options, userMock.Object);

        var differ = context.GetService<IMigrationsModelDiffer>();
        var runtimeInitializer = context.GetService<IModelRuntimeInitializer>();
        var snapshot = new FluentTindahan.Infrastructure.Persistence.Migrations.AppDbContextModelSnapshot();

        var snapshotModel = snapshot.Model;
        if (snapshotModel is IConventionModel conventionModel)
        {
            snapshotModel = conventionModel.FinalizeModel();
        }
        snapshotModel = runtimeInitializer.Initialize(snapshotModel);

        var hasDifferences = differ.HasDifferences(
            snapshotModel.GetRelationalModel(),
            context.GetService<IDesignTimeModel>().Model.GetRelationalModel());

        hasDifferences.Should().BeFalse("the database model must match the latest EF Core migrations and snapshot with no pending changes");
    }
}
