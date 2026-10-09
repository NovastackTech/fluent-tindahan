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
    public void CurrentUserService_HeadersProvided_ResolvesCustomTenantAndUser()
    {
        var expectedTenant = Guid.NewGuid();
        var expectedUser = Guid.NewGuid();

        var context = new DefaultHttpContext();
        context.Request.Headers["X-Tenant-Id"] = expectedTenant.ToString();
        context.Request.Headers["X-User-Id"] = expectedUser.ToString();

        var httpAccessorMock = new Mock<IHttpContextAccessor>();
        httpAccessorMock.Setup(h => h.HttpContext).Returns(context);

        var service = new CurrentUserService(httpAccessorMock.Object);

        service.TenantId.Should().Be(expectedTenant);
        service.UserId.Should().Be(expectedUser);
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
}
