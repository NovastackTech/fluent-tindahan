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
using FluentTindahan.Application.Sync.Commands;
using FluentTindahan.Application.Sync.DTOs;
using FluentTindahan.Application.Products;
using FluentTindahan.Application.Customers;
using FluentTindahan.Application.Sales;
using FluentTindahan.Application.Utang;
using FluentTindahan.Application.GCash;
using FluentTindahan.Application.Billing;
using FluentTindahan.Domain.Entities;
using Xunit;

namespace FluentTindahan.UnitTests;

public class InfrastructureTests
{
    [Fact]
    public void CurrentUserService_NullHttpContext_InDevelopment_ReturnsDefaults()
    {
        var httpAccessorMock = new Mock<IHttpContextAccessor>();
        httpAccessorMock.Setup(h => h.HttpContext).Returns((HttpContext?)null);

        var envMock = new Mock<IHostEnvironment>();
        envMock.Setup(e => e.EnvironmentName).Returns(Environments.Development);

        var service = new CurrentUserService(httpAccessorMock.Object, envMock.Object);

        service.TenantId.Should().Be(CurrentUserService.DefaultTenantId);
        service.UserId.Should().Be(CurrentUserService.DefaultUserId);
        service.FirebaseUid.Should().BeNull();
        service.Role.Should().Be("Owner");
        service.IsAuthenticated.Should().BeFalse();
    }

    [Fact]
    public void CurrentUserService_NullHttpContext_InProduction_ReturnsEmptyAndNull()
    {
        var httpAccessorMock = new Mock<IHttpContextAccessor>();
        httpAccessorMock.Setup(h => h.HttpContext).Returns((HttpContext?)null);

        var envMock = new Mock<IHostEnvironment>();
        envMock.Setup(e => e.EnvironmentName).Returns(Environments.Production);

        var service = new CurrentUserService(httpAccessorMock.Object, envMock.Object);

        service.TenantId.Should().Be(Guid.Empty);
        service.UserId.Should().BeNull();
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
    public void CurrentUserService_HeadersProvided_InProduction_IgnoresHeadersAndReturnsEmptyAndNull()
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

        // Security invariant: In production, unauthenticated headers MUST be ignored and return Guid.Empty / null
        service.TenantId.Should().Be(Guid.Empty);
        service.UserId.Should().BeNull();
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
    public void CurrentUserService_DemoModeViaEnvVar_ResolvesCustomTenantAndUserWhenUnauthenticated()
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
        configMock.Setup(c => c["DEMO_MODE"]).Returns("true");

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

        // No environment or config provided (null) -> must fail safe to secure behavior (Guid.Empty / null)
        var service = new CurrentUserService(httpAccessorMock.Object);

        service.TenantId.Should().Be(Guid.Empty);
        service.UserId.Should().BeNull();
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
    public void CurrentUserService_ClaimsWithEmptyGuid_InDevelopment_ReturnsDefaults()
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

        var envMock = new Mock<IHostEnvironment>();
        envMock.Setup(e => e.EnvironmentName).Returns(Environments.Development);

        var service = new CurrentUserService(httpAccessorMock.Object, envMock.Object);

        service.TenantId.Should().Be(CurrentUserService.DefaultTenantId);
        service.UserId.Should().Be(CurrentUserService.DefaultUserId);
    }

    [Fact]
    public void CurrentUserService_ClaimsWithEmptyGuid_InProduction_ReturnsEmptyAndNull()
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

        var envMock = new Mock<IHostEnvironment>();
        envMock.Setup(e => e.EnvironmentName).Returns(Environments.Production);

        var service = new CurrentUserService(httpAccessorMock.Object, envMock.Object);

        service.TenantId.Should().Be(Guid.Empty);
        service.UserId.Should().BeNull();
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
        productCount.Should().Be(50); // 50-item sari-sari store catalog

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

    [Fact]
    public void AppDbContext_GCashReferenceIndexUsesSharedName()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql("Host=localhost;Database=test")
            .Options;
        var userMock = new Mock<ICurrentUserService>();
        using var context = new AppDbContext(options, userMock.Object);

        var index = context.Model.FindEntityType(typeof(GCashTxn))!
            .GetIndexes()
            .Single(i => i.IsUnique && i.Properties.Any(p => p.Name == nameof(GCashTxn.RefNoNorm)));

        index.GetDatabaseName().Should().Be(GCashTxn.RefNoNormUniqueIndexName);
    }

    [Fact]
    public async Task Handlers_RejectEmptyTenant_ThrowsUnauthorizedAccessException()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;
        var userMock = new Mock<ICurrentUserService>();
        userMock.Setup(u => u.TenantId).Returns(Guid.Empty);
        using var context = new AppDbContext(options, userMock.Object);

        // 1. ProcessBatchSyncCommand
        var syncHandler = new ProcessBatchSyncCommandHandler(
            context,
            userMock.Object,
            Mock.Of<Microsoft.Extensions.Logging.ILogger<ProcessBatchSyncCommandHandler>>());
        var syncAct = () => syncHandler.Handle(
            new ProcessBatchSyncCommand(new BatchSyncRequestDto { DeviceId = Guid.NewGuid(), Operations = new List<SyncOperationDto>() }),
            CancellationToken.None);
        await syncAct.Should().ThrowAsync<UnauthorizedAccessException>();

        // 2. CreateProductCommand
        var productHandler = new CreateProductCommandHandler(context, userMock.Object);
        var productAct = () => productHandler.Handle(
            new CreateProductCommand("Prod", 10m, 5m, "123", "Cat", 10),
            CancellationToken.None);
        await productAct.Should().ThrowAsync<UnauthorizedAccessException>();

        // 3. CreateCustomerCommand
        var customerHandler = new CreateCustomerCommandHandler(context, userMock.Object);
        var customerAct = () => customerHandler.Handle(
            new CreateCustomerCommand("Cust", "09170001122"),
            CancellationToken.None);
        await customerAct.Should().ThrowAsync<UnauthorizedAccessException>();

        // 4. CreateSaleCommand
        var saleHandler = new CreateSaleCommandHandler(context, userMock.Object);
        var saleAct = () => saleHandler.Handle(
            new CreateSaleCommand(10m, "Cash", new List<CreateSaleItemInput>(), 20m, 10m, null),
            CancellationToken.None);
        await saleAct.Should().ThrowAsync<UnauthorizedAccessException>();

        // 5. RecordUtangCommand
        var utangHandler = new RecordUtangCommandHandler(context, userMock.Object);
        var utangAct = () => utangHandler.Handle(
            new RecordUtangCommand(Guid.NewGuid(), 10m, "Credit", null, "Notes"),
            CancellationToken.None);
        await utangAct.Should().ThrowAsync<UnauthorizedAccessException>();

        // 6. RecordGCashTxnCommand
        var gcashHandler = new RecordGCashTxnCommandHandler(context, userMock.Object);
        var gcashAct = () => gcashHandler.Handle(
            new RecordGCashTxnCommand("CashIn", 100m, 10m, "REF1", "09170001122", "Notes"),
            CancellationToken.None);
        await gcashAct.Should().ThrowAsync<UnauthorizedAccessException>();

        // 7. CreateCheckoutSessionCommand
        var gatewayMock = new Mock<IPaymentGatewayService>();
        var checkoutHandler = new CreateCheckoutSessionCommandHandler(gatewayMock.Object, userMock.Object);
        var checkoutAct = () => checkoutHandler.Handle(
            new CreateCheckoutSessionCommand(Domain.Enums.PlanTier.TindahanPro),
            CancellationToken.None);
        await checkoutAct.Should().ThrowAsync<UnauthorizedAccessException>();

        // 8. GetTenantSubscriptionQuery
        var subHandler = new GetTenantSubscriptionQueryHandler(context, userMock.Object);
        var subAct = () => subHandler.Handle(
            new GetTenantSubscriptionQuery(),
            CancellationToken.None);
        await subAct.Should().ThrowAsync<UnauthorizedAccessException>();

        // 9. AppDbContext SaveChangesAsync with entity lacking tenant
        context.Products.Add(new Domain.Entities.Product
        {
            Id = Guid.NewGuid(),
            TenantId = Guid.Empty,
            Name = "P",
            Price = 1,
            Cost = 1,
            Category = "C"
        });
        var saveAct = () => context.SaveChangesAsync();
        await saveAct.Should().ThrowAsync<UnauthorizedAccessException>();
    }

    [Fact]
    public async Task AppDbContext_SoftDeletedCustomer_DoesNotDropDependentUtangLedgerOrSaleOnInclude()
    {
        var tenantId = Guid.Parse("33333333-3333-3333-3333-333333333333");
        var userMock = new Mock<ICurrentUserService>();
        userMock.Setup(u => u.TenantId).Returns(tenantId);
        userMock.Setup(u => u.UserId).Returns(Guid.NewGuid());

        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        using var context = new AppDbContext(options, userMock.Object);

        var custId = Guid.NewGuid();
        var prodId = Guid.NewGuid();
        var utangId = Guid.NewGuid();
        var saleId = Guid.NewGuid();

        // Customer is soft-deleted
        context.Customers.Add(new Domain.Entities.Customer
        {
            Id = custId,
            TenantId = tenantId,
            Name = "Deleted Suki",
            Phone = "09181112222",
            TotalUtangBalance = 0m,
            IsDeleted = true,
            UpdatedAt = DateTimeOffset.UtcNow
        });

        // Product is soft-deleted
        context.Products.Add(new Domain.Entities.Product
        {
            Id = prodId,
            TenantId = tenantId,
            Name = "Deleted Shampoo Sachet",
            Price = 7m,
            Cost = 5m,
            Category = "Hair Care",
            IsDeleted = true
        });

        // UtangLedger referencing soft-deleted customer
        context.UtangLedgers.Add(new Domain.Entities.UtangLedger
        {
            Id = utangId,
            TenantId = tenantId,
            CustomerId = custId,
            Amount = 50m,
            Type = "Credit",
            Date = DateTimeOffset.UtcNow
        });

        // Sale referencing soft-deleted customer and containing item with soft-deleted product
        var sale = new Domain.Entities.Sale
        {
            Id = saleId,
            TenantId = tenantId,
            CustomerId = custId,
            TotalAmount = 14m,
            PaymentMethod = "Cash",
            Date = DateTimeOffset.UtcNow
        };
        sale.Items.Add(new Domain.Entities.SaleItem
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            SaleId = saleId,
            ProductId = prodId,
            Qty = 2,
            UnitPrice = 7m,
            Subtotal = 14m
        });
        context.Sales.Add(sale);

        await context.SaveChangesAsync();
        context.ChangeTracker.Clear();

        // 1. UtangLedgers with Include(u => u.Customer) must NOT drop the ledger row even though customer is soft-deleted
        var ledgersWithInclude = await context.UtangLedgers
            .AsNoTracking()
            .Include(u => u.Customer)
            .ToListAsync();
        ledgersWithInclude.Should().HaveCount(1);
        ledgersWithInclude[0].Id.Should().Be(utangId);
        ledgersWithInclude[0].CustomerId.Should().Be(custId);
        // Customer is null due to global query filter (!c.IsDeleted), but ledger row is preserved
        ledgersWithInclude[0].Customer.Should().BeNull();

        // 2. Sales with Include(s => s.Customer) and ThenInclude(i => i.Product) must NOT drop the sale or items
        var salesWithInclude = await context.Sales
            .AsNoTracking()
            .Include(s => s.Customer)
            .Include(s => s.Items)
                .ThenInclude(i => i.Product)
            .ToListAsync();
        salesWithInclude.Should().HaveCount(1);
        salesWithInclude[0].Id.Should().Be(saleId);
        salesWithInclude[0].Customer.Should().BeNull();
        salesWithInclude[0].Items.Should().HaveCount(1);
        salesWithInclude[0].Items.First().Product.Should().BeNull();

        // 3. With IgnoreQueryFilters(), the soft-deleted customer and product are both populated
        var rawLedgers = await context.UtangLedgers
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Include(u => u.Customer)
            .Where(u => u.TenantId == tenantId)
            .ToListAsync();
        rawLedgers[0].Customer.Should().NotBeNull();
        rawLedgers[0].Customer!.Name.Should().Be("Deleted Suki");

        var rawSales = await context.Sales
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Include(s => s.Customer)
            .Include(s => s.Items)
                .ThenInclude(i => i.Product)
            .Where(s => s.TenantId == tenantId)
            .ToListAsync();
        rawSales[0].Customer.Should().NotBeNull();
        rawSales[0].Customer!.Name.Should().Be("Deleted Suki");
        rawSales[0].Items.First().Product.Should().NotBeNull();
        rawSales[0].Items.First().Product!.Name.Should().Be("Deleted Shampoo Sachet");
    }

    [Theory]
    [InlineData("simple_password", "Host=db;Port=5432;Database=db;Username=user;Password='simple_password'", "simple_password")]
    [InlineData("pass;word=123", "Host=db;Port=5432;Database=db;Username=user;Password='pass;word=123'", "pass;word=123")]
    [InlineData("pass\"word", "Host=db;Port=5432;Database=db;Username=user;Password='pass\"word'", "pass\"word")]
    public void NpgsqlConnectionString_QuotedPassword_ParsesCorrectly(string expected, string connStr, string _)
    {
        var builder = new Npgsql.NpgsqlConnectionStringBuilder(connStr);
        builder.Password.Should().Be(expected);
    }
}
