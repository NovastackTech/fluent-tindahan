using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using FluentTindahan.Application.Billing;
using FluentTindahan.Application.Common.Interfaces;
using FluentTindahan.Application.Sync.Commands;
using FluentTindahan.Application.Sync.DTOs;
using FluentTindahan.Domain.Entities;
using FluentTindahan.Domain.Enums;
using FluentTindahan.Domain.Interfaces;
using FluentTindahan.Infrastructure.Persistence;
using FluentTindahan.Infrastructure.Services;
using Xunit;

namespace FluentTindahan.UnitTests;

public class BillingTests
{
    private readonly Guid _testTenantId = Guid.Parse("33333333-3333-3333-3333-333333333333");
    private readonly Mock<ICurrentUserService> _currentUserServiceMock;

    public BillingTests()
    {
        _currentUserServiceMock = new Mock<ICurrentUserService>();
        _currentUserServiceMock.Setup(s => s.TenantId).Returns(_testTenantId);
        _currentUserServiceMock.Setup(s => s.UserId).Returns(Guid.NewGuid());
    }

    private AppDbContext CreateInMemoryDbContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;

        var context = new AppDbContext(options, _currentUserServiceMock.Object);

        // Seed a default test tenant
        context.Tenants.Add(new Tenant
        {
            Id = _testTenantId,
            BusinessName = "Test Sari-Sari Store",
            Tier = PlanTier.Libre,
            CreatedAt = DateTimeOffset.UtcNow
        });
        context.SaveChanges();

        return context;
    }

    [Theory]
    [InlineData(PlanTier.TindahanPro, BillingCycle.Weekly, 35.00)]
    [InlineData(PlanTier.TindahanPro, BillingCycle.Monthly, 129.00)]
    [InlineData(PlanTier.NegosyoPlus, BillingCycle.Weekly, 89.00)]
    [InlineData(PlanTier.NegosyoPlus, BillingCycle.Monthly, 349.00)]
    public void PayMongoPaymentGatewayService_GetTierPrice_ShouldReturnAccuratePrice(PlanTier tier, BillingCycle cycle, decimal expectedPrice)
    {
        var price = PayMongoPaymentGatewayService.GetTierPrice(tier, cycle);
        price.Should().Be(expectedPrice);
    }

    [Fact]
    public void PayMongoPaymentGatewayService_GetTierPrice_ForLibre_ShouldThrow()
    {
        var act = () => PayMongoPaymentGatewayService.GetTierPrice(PlanTier.Libre, BillingCycle.Monthly);
        act.Should().Throw<InvalidOperationException>();
    }

    [Fact]
    public async Task CreateCheckoutSessionCommandHandler_ForLibre_ShouldThrow()
    {
        using var context = CreateInMemoryDbContext();
        var gatewayMock = new Mock<IPaymentGatewayService>();

        var handler = new CreateCheckoutSessionCommandHandler(gatewayMock.Object, _currentUserServiceMock.Object);

        var act = async () => await handler.Handle(
            new CreateCheckoutSessionCommand(PlanTier.Libre),
            CancellationToken.None);

        await act.Should().ThrowAsync<InvalidOperationException>();
    }

    [Fact]
    public async Task CreateCheckoutSessionCommandHandler_ValidTier_ShouldReturnCheckoutResponse()
    {
        var gatewayMock = new Mock<IPaymentGatewayService>();
        gatewayMock.Setup(g => g.CreateCheckoutSessionAsync(
            _testTenantId,
            PlanTier.TindahanPro,
            BillingCycle.Monthly,
            It.IsAny<string>(),
            It.IsAny<string>(),
            It.IsAny<CancellationToken>()))
            .ReturnsAsync(new CheckoutSessionResult(
                CheckoutUrl: "https://checkout.paymongo.com/cs_test123",
                SessionId: "cs_test123",
                ReferenceNumber: "sub_ref123",
                Amount: 129m,
                Currency: "PHP",
                Tier: PlanTier.TindahanPro,
                Cycle: BillingCycle.Monthly));

        var handler = new CreateCheckoutSessionCommandHandler(gatewayMock.Object, _currentUserServiceMock.Object);

        var result = await handler.Handle(
            new CreateCheckoutSessionCommand(PlanTier.TindahanPro, BillingCycle.Monthly),
            CancellationToken.None);

        result.CheckoutUrl.Should().Be("https://checkout.paymongo.com/cs_test123");
        result.Tier.Should().Be(PlanTier.TindahanPro);
        result.Amount.Should().Be(129m);
    }

    [Fact]
    public async Task ProcessPaymentWebhookCommandHandler_ValidPayload_ShouldUpgradeTenantAndRecordPayment()
    {
        using var context = CreateInMemoryDbContext();
        var gatewayMock = new Mock<IPaymentGatewayService>();
        gatewayMock.Setup(g => g.VerifyWebhookSignature(It.IsAny<string>(), It.IsAny<string>()))
            .Returns(true);

        var handler = new ProcessPaymentWebhookCommandHandler(
            context,
            gatewayMock.Object,
            NullLogger<ProcessPaymentWebhookCommandHandler>.Instance);

        var payload = $$"""
        {
            "tenant_id": "{{_testTenantId}}",
            "tier": "TindahanPro",
            "cycle": "Monthly",
            "amount": 129.00,
            "reference_id": "test_ref_001"
        }
        """;

        var result = await handler.Handle(new ProcessPaymentWebhookCommand(payload, "sig_123"), CancellationToken.None);

        result.Success.Should().BeTrue();
        result.Tier.Should().Be(PlanTier.TindahanPro);
        result.NewEndDate.Should().BeAfter(DateTimeOffset.UtcNow.AddDays(29));

        var tenant = await context.Tenants.IgnoreQueryFilters().FirstAsync(t => t.Id == _testTenantId);
        tenant.Tier.Should().Be(PlanTier.TindahanPro);
        tenant.SubscriptionEndDate.Should().Be(result.NewEndDate);

        var payments = await context.PaymentHistories.IgnoreQueryFilters().Where(p => p.TenantId == _testTenantId).ToListAsync();
        payments.Should().HaveCount(1);
        payments[0].Amount.Should().Be(129m);
        payments[0].TierPurchased.Should().Be(PlanTier.TindahanPro);
        payments[0].GatewayReferenceId.Should().Be("test_ref_001");
    }

    [Fact]
    public async Task ProcessPaymentWebhookCommandHandler_ActiveSubscription_ShouldExtendExistingEndDate()
    {
        using var context = CreateInMemoryDbContext();
        var tenant = await context.Tenants.IgnoreQueryFilters().FirstAsync(t => t.Id == _testTenantId);
        var existingEnd = DateTimeOffset.UtcNow.AddDays(10);
        tenant.Tier = PlanTier.TindahanPro;
        tenant.SubscriptionEndDate = existingEnd;
        await context.SaveChangesAsync();

        var gatewayMock = new Mock<IPaymentGatewayService>();
        gatewayMock.Setup(g => g.VerifyWebhookSignature(It.IsAny<string>(), It.IsAny<string>()))
            .Returns(true);

        var handler = new ProcessPaymentWebhookCommandHandler(
            context,
            gatewayMock.Object,
            NullLogger<ProcessPaymentWebhookCommandHandler>.Instance);

        var payload = $$"""
        {
            "tenant_id": "{{_testTenantId}}",
            "tier": "TindahanPro",
            "cycle": "Weekly",
            "amount": 35.00,
            "reference_id": "test_ref_weekly"
        }
        """;

        var result = await handler.Handle(new ProcessPaymentWebhookCommand(payload, "sig_123"), CancellationToken.None);

        result.Success.Should().BeTrue();
        // Existing end + 7 days
        result.NewEndDate.Should().BeCloseTo(existingEnd.AddDays(7), precision: TimeSpan.FromSeconds(5));
    }

    [Fact]
    public async Task GetTenantSubscriptionQueryHandler_LibreTier_ShouldReturnLibreLimits()
    {
        using var context = CreateInMemoryDbContext();

        var handler = new GetTenantSubscriptionQueryHandler(context, _currentUserServiceMock.Object);

        var subscription = await handler.Handle(new GetTenantSubscriptionQuery(), CancellationToken.None);

        subscription.Tier.Should().Be(PlanTier.Libre);
        subscription.MaxProducts.Should().Be(50);
        subscription.MaxCustomers.Should().Be(30);
        subscription.MaxGCashTransactionsPerMonth.Should().Be(30);
        subscription.CanImportCsv.Should().BeFalse();
        subscription.HasWatermarkedReceipts.Should().BeTrue();
        subscription.HasProfitAnalytics.Should().BeFalse();
        subscription.HasAuditLogs.Should().BeFalse();
    }

    [Fact]
    public async Task GetTenantSubscriptionQueryHandler_TindahanPro_ShouldReturnProLimits()
    {
        using var context = CreateInMemoryDbContext();
        var tenant = await context.Tenants.IgnoreQueryFilters().FirstAsync(t => t.Id == _testTenantId);
        tenant.Tier = PlanTier.TindahanPro;
        tenant.SubscriptionEndDate = DateTimeOffset.UtcNow.AddDays(25);
        await context.SaveChangesAsync();

        var handler = new GetTenantSubscriptionQueryHandler(context, _currentUserServiceMock.Object);

        var subscription = await handler.Handle(new GetTenantSubscriptionQuery(), CancellationToken.None);

        subscription.Tier.Should().Be(PlanTier.TindahanPro);
        subscription.MaxProducts.Should().Be(-1); // Unlimited
        subscription.MaxCustomers.Should().Be(-1);
        subscription.MaxGCashTransactionsPerMonth.Should().Be(-1);
        subscription.CanImportCsv.Should().BeTrue();
        subscription.HasWatermarkedReceipts.Should().BeFalse();
        subscription.HasProfitAnalytics.Should().BeTrue();
        subscription.DaysRemaining.Should().BeGreaterThanOrEqualTo(24);
    }

    [Fact]
    public async Task GetTenantSubscriptionQueryHandler_ExpiredSubscription_ShouldFallbackToLibre()
    {
        using var context = CreateInMemoryDbContext();
        var tenant = await context.Tenants.IgnoreQueryFilters().FirstAsync(t => t.Id == _testTenantId);
        tenant.Tier = PlanTier.TindahanPro;
        tenant.SubscriptionEndDate = DateTimeOffset.UtcNow.AddDays(-2); // Expired 2 days ago
        await context.SaveChangesAsync();

        var handler = new GetTenantSubscriptionQueryHandler(context, _currentUserServiceMock.Object);

        var subscription = await handler.Handle(new GetTenantSubscriptionQuery(), CancellationToken.None);

        subscription.Tier.Should().Be(PlanTier.Libre);
        subscription.IsActive.Should().BeFalse();
        subscription.MaxProducts.Should().Be(50);
    }

    [Fact]
    public async Task ProcessBatchSyncCommand_LibreTier_Enforces50ProductLimit()
    {
        using var context = CreateInMemoryDbContext();

        // Seed 50 products for test tenant
        for (int i = 0; i < 50; i++)
        {
            context.Products.Add(new Product
            {
                Id = Guid.NewGuid(),
                TenantId = _testTenantId,
                Name = $"Product {i}",
                Price = 10m,
                Cost = 8m,
                UpdatedAt = DateTimeOffset.UtcNow
            });
        }
        await context.SaveChangesAsync();

        var handler = new ProcessBatchSyncCommandHandler(
            context,
            _currentUserServiceMock.Object,
            NullLogger<ProcessBatchSyncCommandHandler>.Instance);

        var op = new SyncOperationDto
        {
            SyncId = "sync_prod_51",
            Entity = "Product",
            Action = "Insert",
            Timestamp = DateTimeOffset.UtcNow,
            Payload = System.Text.Json.JsonDocument.Parse("""
            {
                "id": "44444444-4444-4444-4444-444444444444",
                "name": "Excess Product 51",
                "price": 20.0,
                "cost": 15.0
            }
            """).RootElement
        };

        var request = new BatchSyncRequestDto
        {
            DeviceId = Guid.NewGuid(),
            Operations = new List<SyncOperationDto> { op }
        };

        var result = await handler.Handle(new ProcessBatchSyncCommand(request), CancellationToken.None);

        result.Results.Should().HaveCount(1);
        result.Results[0].Status.Should().Be("Failed");
        result.Results[0].Error.Should().Contain("Libre plan limit exceeded: Maximum 50 products allowed");
    }

    [Fact]
    public async Task SubscriptionMonitorService_ExpiredTenant_ShouldDowngradeToLibre()
    {
        var expiredTenantId = Guid.NewGuid();
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;

        var context = new AppDbContext(options, _currentUserServiceMock.Object);
        context.Tenants.Add(new Tenant
        {
            Id = expiredTenantId,
            BusinessName = "Expired Store",
            Tier = PlanTier.TindahanPro,
            SubscriptionEndDate = DateTimeOffset.UtcNow.AddHours(-2)
        });
        await context.SaveChangesAsync();

        var serviceProviderMock = new Mock<IServiceProvider>();
        serviceProviderMock.Setup(sp => sp.GetService(typeof(AppDbContext))).Returns(context);

        var scopeMock = new Mock<IServiceScope>();
        scopeMock.Setup(s => s.ServiceProvider).Returns(serviceProviderMock.Object);

        var scopeFactoryMock = new Mock<IServiceScopeFactory>();
        scopeFactoryMock.Setup(sf => sf.CreateScope()).Returns(scopeMock.Object);

        var config = new ConfigurationBuilder().Build();

        var monitor = new FluentTindahan.Infrastructure.Services.SubscriptionMonitorService(
            scopeFactoryMock.Object,
            config,
            NullLogger<FluentTindahan.Infrastructure.Services.SubscriptionMonitorService>.Instance);

        var downgradedCount = await monitor.CheckAndDowngradeExpiredSubscriptionsAsync();

        downgradedCount.Should().Be(1);
        var updatedTenant = await context.Tenants.IgnoreQueryFilters().FirstAsync(t => t.Id == expiredTenantId);
        updatedTenant.Tier.Should().Be(PlanTier.Libre);
    }
}
