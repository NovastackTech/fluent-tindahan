using System.Security.Cryptography;
using System.Text;
using FluentAssertions;
using MediatR;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using FluentTindahan.Application.Billing;
using FluentTindahan.Application.Common;
using FluentTindahan.Application.Common.Interfaces;
using FluentTindahan.Application.Sync.Commands;
using FluentTindahan.Application.Sync.DTOs;
using FluentTindahan.Domain.Billing;
using FluentTindahan.Domain.Entities;
using FluentTindahan.Domain.Enums;
using FluentTindahan.Domain.Interfaces;
using FluentTindahan.Infrastructure.Persistence;
using FluentTindahan.Infrastructure.Services;
using FluentTindahan.WebApi.Controllers;
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
    public async Task ApplySubscriptionPaymentCommandHandler_ValidPayment_ShouldUpgradeTenantAndRecordPayment()
    {
        using var context = CreateInMemoryDbContext();
        var handler = new ApplySubscriptionPaymentCommandHandler(
            context,
            NullLogger<ApplySubscriptionPaymentCommandHandler>.Instance);

        var command = new ApplySubscriptionPaymentCommand(
            TenantId: _testTenantId,
            Tier: PlanTier.TindahanPro,
            Cycle: BillingCycle.Monthly,
            AmountCentavos: 12900L,
            PaymentId: "pay_test_001",
            PaymentMethod: "gcash");

        var result = await handler.Handle(command, CancellationToken.None);

        result.Outcome.Should().Be(PaymentWebhookOutcome.Processed);
        result.Tier.Should().Be(PlanTier.TindahanPro);
        result.NewEndDate.Should().BeAfter(DateTimeOffset.UtcNow.AddDays(29));

        var tenant = await context.Tenants.IgnoreQueryFilters().FirstAsync(t => t.Id == _testTenantId);
        tenant.Tier.Should().Be(PlanTier.TindahanPro);
        tenant.SubscriptionEndDate.Should().Be(result.NewEndDate);

        var payments = await context.PaymentHistories.IgnoreQueryFilters().Where(p => p.TenantId == _testTenantId).ToListAsync();
        payments.Should().HaveCount(1);
        payments[0].AmountCentavos.Should().Be(12900L);
        payments[0].TierPurchased.Should().Be(PlanTier.TindahanPro);
        payments[0].GatewayReferenceId.Should().Be("pay_test_001");
    }

    [Fact]
    public async Task ApplySubscriptionPaymentCommandHandler_ActiveSubscription_ShouldExtendExistingEndDate()
    {
        using var context = CreateInMemoryDbContext();
        var tenant = await context.Tenants.IgnoreQueryFilters().FirstAsync(t => t.Id == _testTenantId);
        var existingEnd = DateTimeOffset.UtcNow.AddDays(10);
        tenant.Tier = PlanTier.TindahanPro;
        tenant.SubscriptionEndDate = existingEnd;
        await context.SaveChangesAsync();

        var handler = new ApplySubscriptionPaymentCommandHandler(
            context,
            NullLogger<ApplySubscriptionPaymentCommandHandler>.Instance);

        var command = new ApplySubscriptionPaymentCommand(
            TenantId: _testTenantId,
            Tier: PlanTier.TindahanPro,
            Cycle: BillingCycle.Weekly,
            AmountCentavos: 3500L,
            PaymentId: "pay_test_weekly",
            PaymentMethod: "gcash");

        var result = await handler.Handle(command, CancellationToken.None);

        result.Outcome.Should().Be(PaymentWebhookOutcome.Processed);
        result.NewEndDate.Should().BeCloseTo(existingEnd.AddDays(7), precision: TimeSpan.FromSeconds(5));
    }

    [Fact]
    public async Task ApplySubscriptionPaymentCommandHandler_DuplicatePayment_ShouldReturnDuplicateOutcome()
    {
        using var context = CreateInMemoryDbContext();
        var handler = new ApplySubscriptionPaymentCommandHandler(
            context,
            NullLogger<ApplySubscriptionPaymentCommandHandler>.Instance);

        var command = new ApplySubscriptionPaymentCommand(
            TenantId: _testTenantId,
            Tier: PlanTier.TindahanPro,
            Cycle: BillingCycle.Monthly,
            AmountCentavos: 12900L,
            PaymentId: "pay_duplicate_001",
            PaymentMethod: "gcash");

        // First application
        var firstResult = await handler.Handle(command, CancellationToken.None);
        firstResult.Outcome.Should().Be(PaymentWebhookOutcome.Processed);

        // Second application (retry)
        var secondResult = await handler.Handle(command, CancellationToken.None);
        secondResult.Outcome.Should().Be(PaymentWebhookOutcome.Duplicate);

        var payments = await context.PaymentHistories.IgnoreQueryFilters().Where(p => p.GatewayReferenceId == "pay_duplicate_001").ToListAsync();
        payments.Should().HaveCount(1);
    }

    [Fact]
    public async Task ApplySubscriptionPaymentCommandHandler_AmountMismatch_ShouldReject()
    {
        using var context = CreateInMemoryDbContext();
        var handler = new ApplySubscriptionPaymentCommandHandler(
            context,
            NullLogger<ApplySubscriptionPaymentCommandHandler>.Instance);

        var command = new ApplySubscriptionPaymentCommand(
            TenantId: _testTenantId,
            Tier: PlanTier.TindahanPro,
            Cycle: BillingCycle.Monthly,
            AmountCentavos: 10000L, // Mismatch: 100 pesos instead of 129
            PaymentId: "pay_bad_amount",
            PaymentMethod: "gcash");

        var result = await handler.Handle(command, CancellationToken.None);
        result.Outcome.Should().Be(PaymentWebhookOutcome.Rejected);

        var tenant = await context.Tenants.IgnoreQueryFilters().FirstAsync(t => t.Id == _testTenantId);
        tenant.Tier.Should().Be(PlanTier.Libre);
    }

    [Fact]
    public async Task ProcessPaymentWebhookCommandHandler_InvalidSignature_ShouldReturnInvalidSignature()
    {
        var gatewayMock = new Mock<IPaymentGatewayService>();
        gatewayMock.Setup(g => g.VerifyWebhookSignature(It.IsAny<string>(), It.IsAny<string>()))
            .Returns(false);

        var senderMock = new Mock<MediatR.ISender>();
        var handler = new ProcessPaymentWebhookCommandHandler(
            gatewayMock.Object,
            senderMock.Object,
            NullLogger<ProcessPaymentWebhookCommandHandler>.Instance);

        var result = await handler.Handle(new ProcessPaymentWebhookCommand("{}", "bad_sig"), CancellationToken.None);
        result.Outcome.Should().Be(PaymentWebhookOutcome.InvalidSignature);
    }

    [Fact]
    public async Task ProcessPaymentWebhookCommandHandler_IgnoredEventType_ShouldReturnIgnored()
    {
        var gatewayMock = new Mock<IPaymentGatewayService>();
        gatewayMock.Setup(g => g.VerifyWebhookSignature(It.IsAny<string>(), It.IsAny<string>()))
            .Returns(true);

        var senderMock = new Mock<MediatR.ISender>();
        var handler = new ProcessPaymentWebhookCommandHandler(
            gatewayMock.Object,
            senderMock.Object,
            NullLogger<ProcessPaymentWebhookCommandHandler>.Instance);

        var payload = """
        {
            "data": {
                "attributes": {
                    "type": "payment.failed",
                    "data": {}
                }
            }
        }
        """;

        var result = await handler.Handle(new ProcessPaymentWebhookCommand(payload, "good_sig"), CancellationToken.None);
        result.Outcome.Should().Be(PaymentWebhookOutcome.Ignored);
    }

    [Fact]
    public async Task ProcessPaymentWebhookCommandHandler_ValidPayMongoEvent_ShouldDispatchApplyPaymentCommand()
    {
        var gatewayMock = new Mock<IPaymentGatewayService>();
        gatewayMock.Setup(g => g.VerifyWebhookSignature(It.IsAny<string>(), It.IsAny<string>()))
            .Returns(true);

        var senderMock = new Mock<MediatR.ISender>();
        senderMock.Setup(s => s.Send(It.IsAny<ApplySubscriptionPaymentCommand>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new WebhookProcessResultDto(PaymentWebhookOutcome.Processed, "Success", _testTenantId, PlanTier.TindahanPro, DateTimeOffset.UtcNow.AddDays(30)));

        var handler = new ProcessPaymentWebhookCommandHandler(
            gatewayMock.Object,
            senderMock.Object,
            NullLogger<ProcessPaymentWebhookCommandHandler>.Instance);

        var payload = $$"""
        {
            "data": {
                "attributes": {
                    "type": "checkout_session.payment.paid",
                    "data": {
                        "id": "cs_test_123",
                        "attributes": {
                            "metadata": {
                                "tenant_id": "{{_testTenantId}}",
                                "tier": "TindahanPro",
                                "cycle": "Monthly"
                            },
                            "payments": [
                                {
                                    "id": "pay_test_xyz",
                                    "attributes": {
                                        "amount": 12900,
                                        "status": "paid",
                                        "source": { "type": "gcash" }
                                    }
                                }
                            ]
                        }
                    }
                }
            }
        }
        """;

        var result = await handler.Handle(new ProcessPaymentWebhookCommand(payload, "good_sig"), CancellationToken.None);
        result.Outcome.Should().Be(PaymentWebhookOutcome.Processed);
        senderMock.Verify(s => s.Send(It.Is<ApplySubscriptionPaymentCommand>(c =>
            c.TenantId == _testTenantId &&
            c.Tier == PlanTier.TindahanPro &&
            c.Cycle == BillingCycle.Monthly &&
            c.AmountCentavos == 12900L &&
            c.PaymentId == "pay_test_xyz"), It.IsAny<CancellationToken>()), Times.Once);
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

    [Fact]
    public async Task MockPay_InProduction_ReturnsNotFound()
    {
        var mediatorMock = new Mock<IMediator>();
        var envMock = new Mock<IHostEnvironment>();
        envMock.Setup(e => e.EnvironmentName).Returns("Production");

        var controller = new BillingController(
            mediatorMock.Object,
            _currentUserServiceMock.Object,
            envMock.Object,
            NullLogger<BillingController>.Instance);

        var response = await controller.MockPay(
            new BillingController.MockPayRequest(PlanTier.TindahanPro, BillingCycle.Monthly),
            CancellationToken.None);

        response.Result.Should().BeOfType<NotFoundResult>();
    }

    [Fact]
    public async Task MockPay_InDevelopment_ExecutesPayment()
    {
        var mediatorMock = new Mock<IMediator>();
        mediatorMock.Setup(m => m.Send(It.IsAny<ApplySubscriptionPaymentCommand>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new WebhookProcessResultDto(PaymentWebhookOutcome.Processed, "Success", _testTenantId, PlanTier.TindahanPro, DateTimeOffset.UtcNow.AddDays(30)));

        var envMock = new Mock<IHostEnvironment>();
        envMock.Setup(e => e.EnvironmentName).Returns("Development");

        var controller = new BillingController(
            mediatorMock.Object,
            _currentUserServiceMock.Object,
            envMock.Object,
            NullLogger<BillingController>.Instance);

        var response = await controller.MockPay(
            new BillingController.MockPayRequest(PlanTier.TindahanPro, BillingCycle.Monthly),
            CancellationToken.None);

        response.Result.Should().BeOfType<OkObjectResult>();
    }

    [Fact]
    public async Task ProcessBatchSyncCommand_LibreTier_GCashUpdateAllowedAtMonthlyLimit()
    {
        using var context = CreateInMemoryDbContext();
        var existingTxnId = Guid.NewGuid();
        var startOfMonth = ManilaTime.StartOfCurrentMonthUtc();

        // Seed 30 GCash transactions for the current month (max limit for Libre)
        context.GCashTransactions.Add(new GCashTxn
        {
            Id = existingTxnId,
            TenantId = _testTenantId,
            Type = "CashIn",
            Amount = 500m,
            Fee = 10m,
            RefNo = "GC-001",
            Date = startOfMonth.AddDays(1)
        });

        for (int i = 2; i <= 30; i++)
        {
            context.GCashTransactions.Add(new GCashTxn
            {
                Id = Guid.NewGuid(),
                TenantId = _testTenantId,
                Type = "CashIn",
                Amount = 100m,
                Fee = 5m,
                RefNo = $"GC-{i:D3}",
                Date = startOfMonth.AddDays(1)
            });
        }
        await context.SaveChangesAsync();

        var handler = new ProcessBatchSyncCommandHandler(
            context,
            _currentUserServiceMock.Object,
            NullLogger<ProcessBatchSyncCommandHandler>.Instance);

        // Update/replay existing transaction
        var updateOp = new SyncOperationDto
        {
            SyncId = "sync_gcash_existing",
            Entity = "GCash",
            Action = "Update",
            Timestamp = DateTimeOffset.UtcNow,
            Payload = System.Text.Json.JsonDocument.Parse($$"""
            {
                "id": "{{existingTxnId}}",
                "type": "CashIn",
                "amount": 500.0,
                "fee": 15.0,
                "refNo": "GC-001-UPDATED"
            }
            """).RootElement
        };

        var result = await handler.Handle(
            new ProcessBatchSyncCommand(new BatchSyncRequestDto
            {
                DeviceId = Guid.NewGuid(),
                Operations = new List<SyncOperationDto> { updateOp }
            }),
            CancellationToken.None);

        result.Results.Should().HaveCount(1);
        result.Results[0].Status.Should().Be("Success");
    }

    [Fact]
    public async Task ProcessBatchSyncCommand_UtangLedger_CustomerNotFound_FailsCleanly()
    {
        using var context = CreateInMemoryDbContext();
        var missingCustomerId = Guid.NewGuid();

        var handler = new ProcessBatchSyncCommandHandler(
            context,
            _currentUserServiceMock.Object,
            NullLogger<ProcessBatchSyncCommandHandler>.Instance);

        var op = new SyncOperationDto
        {
            SyncId = "sync_utang_missing_cust",
            Entity = "UtangLedger",
            Action = "Insert",
            Timestamp = DateTimeOffset.UtcNow,
            Payload = System.Text.Json.JsonDocument.Parse($$"""
            {
                "id": "{{Guid.NewGuid()}}",
                "customerId": "{{missingCustomerId}}",
                "amount": 100.0,
                "type": "Credit",
                "notes": "Rejected customer utang"
            }
            """).RootElement
        };

        var result = await handler.Handle(
            new ProcessBatchSyncCommand(new BatchSyncRequestDto
            {
                DeviceId = Guid.NewGuid(),
                Operations = new List<SyncOperationDto> { op }
            }),
            CancellationToken.None);

        result.Results.Should().HaveCount(1);
        result.Results[0].Status.Should().Be("Failed");
        result.Results[0].Error.Should().Contain("Customer");
        result.Results[0].Error.Should().Contain("not found");
    }

    [Fact]
    public async Task ProcessBatchSyncCommand_Sale_ProductNotFound_FailsCleanly()
    {
        using var context = CreateInMemoryDbContext();
        var missingProductId = Guid.NewGuid();

        var handler = new ProcessBatchSyncCommandHandler(
            context,
            _currentUserServiceMock.Object,
            NullLogger<ProcessBatchSyncCommandHandler>.Instance);

        var op = new SyncOperationDto
        {
            SyncId = "sync_sale_missing_prod",
            Entity = "Sale",
            Action = "Insert",
            Timestamp = DateTimeOffset.UtcNow,
            Payload = System.Text.Json.JsonDocument.Parse($$"""
            {
                "id": "{{Guid.NewGuid()}}",
                "totalAmount": 50.0,
                "paymentMethod": "Cash",
                "items": [
                    {
                        "id": "{{Guid.NewGuid()}}",
                        "productId": "{{missingProductId}}",
                        "qty": 1,
                        "unitPrice": 50.0,
                        "subtotal": 50.0
                    }
                ]
            }
            """).RootElement
        };

        var result = await handler.Handle(
            new ProcessBatchSyncCommand(new BatchSyncRequestDto
            {
                DeviceId = Guid.NewGuid(),
                Operations = new List<SyncOperationDto> { op }
            }),
            CancellationToken.None);

        result.Results.Should().HaveCount(1);
        result.Results[0].Status.Should().Be("Failed");
        result.Results[0].Error.Should().Contain("Product(s)");
        result.Results[0].Error.Should().Contain("not found");
    }

    [Fact]
    public void VerifyWebhookSignature_ValidSignatureInDevelopment_ReturnsTrue()
    {
        var fixedTime = DateTimeOffset.UtcNow;
        var timeProvider = new MutableTimeProvider(fixedTime);
        var secret = "whsec_test_secret_key_12345";
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["PayMongo:WebhookSecret"] = secret
            })
            .Build();

        var envMock = new Mock<IHostEnvironment>();
        envMock.Setup(e => e.EnvironmentName).Returns("Development");

        var service = new PayMongoPaymentGatewayService(
            new HttpClient(),
            config,
            envMock.Object,
            timeProvider,
            NullLogger<PayMongoPaymentGatewayService>.Instance);

        var payload = "{\"data\":{\"id\":\"evt_123\"}}";
        var timestamp = fixedTime.ToUnixTimeSeconds();
        var hash = ComputeHmacSha256Hex(secret, $"{timestamp}.{payload}");
        var signatureHeader = $"t={timestamp},te={hash}";

        var verified = service.VerifyWebhookSignature(payload, signatureHeader);
        verified.Should().BeTrue();
    }

    [Fact]
    public void VerifyWebhookSignature_StaleTimestamp_ReturnsFalse()
    {
        var fixedTime = DateTimeOffset.UtcNow;
        var timeProvider = new MutableTimeProvider(fixedTime);
        var secret = "whsec_test_secret_key_12345";
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["PayMongo:WebhookSecret"] = secret
            })
            .Build();

        var envMock = new Mock<IHostEnvironment>();
        envMock.Setup(e => e.EnvironmentName).Returns("Development");

        var service = new PayMongoPaymentGatewayService(
            new HttpClient(),
            config,
            envMock.Object,
            timeProvider,
            NullLogger<PayMongoPaymentGatewayService>.Instance);

        var payload = "{\"data\":{\"id\":\"evt_123\"}}";
        // 6 minutes old (> 5 minute tolerance)
        var staleTimestamp = fixedTime.AddMinutes(-6).ToUnixTimeSeconds();
        var hash = ComputeHmacSha256Hex(secret, $"{staleTimestamp}.{payload}");
        var signatureHeader = $"t={staleTimestamp},te={hash}";

        var verified = service.VerifyWebhookSignature(payload, signatureHeader);
        verified.Should().BeFalse();
    }

    [Fact]
    public void VerifyWebhookSignature_FutureTimestamp_ReturnsFalse()
    {
        var fixedTime = DateTimeOffset.UtcNow;
        var timeProvider = new MutableTimeProvider(fixedTime);
        var secret = "whsec_test_secret_key_12345";
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["PayMongo:WebhookSecret"] = secret
            })
            .Build();

        var envMock = new Mock<IHostEnvironment>();
        envMock.Setup(e => e.EnvironmentName).Returns("Development");

        var service = new PayMongoPaymentGatewayService(
            new HttpClient(),
            config,
            envMock.Object,
            timeProvider,
            NullLogger<PayMongoPaymentGatewayService>.Instance);

        var payload = "{\"data\":{\"id\":\"evt_123\"}}";
        // 6 minutes in future
        var futureTimestamp = fixedTime.AddMinutes(6).ToUnixTimeSeconds();
        var hash = ComputeHmacSha256Hex(secret, $"{futureTimestamp}.{payload}");
        var signatureHeader = $"t={futureTimestamp},te={hash}";

        var verified = service.VerifyWebhookSignature(payload, signatureHeader);
        verified.Should().BeFalse();
    }

    [Fact]
    public void VerifyWebhookSignature_InvalidHash_ReturnsFalse()
    {
        var fixedTime = DateTimeOffset.UtcNow;
        var timeProvider = new MutableTimeProvider(fixedTime);
        var secret = "whsec_test_secret_key_12345";
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["PayMongo:WebhookSecret"] = secret
            })
            .Build();

        var envMock = new Mock<IHostEnvironment>();
        envMock.Setup(e => e.EnvironmentName).Returns("Development");

        var service = new PayMongoPaymentGatewayService(
            new HttpClient(),
            config,
            envMock.Object,
            timeProvider,
            NullLogger<PayMongoPaymentGatewayService>.Instance);

        var payload = "{\"data\":{\"id\":\"evt_123\"}}";
        var timestamp = fixedTime.ToUnixTimeSeconds();
        var wrongHash = ComputeHmacSha256Hex("wrong_secret_key", $"{timestamp}.{payload}");
        var signatureHeader = $"t={timestamp},te={wrongHash}";

        var verified = service.VerifyWebhookSignature(payload, signatureHeader);
        verified.Should().BeFalse();
    }

    [Fact]
    public void VerifyWebhookSignature_InProduction_RejectsTeSignature()
    {
        var fixedTime = DateTimeOffset.UtcNow;
        var timeProvider = new MutableTimeProvider(fixedTime);
        var secret = "whsec_prod_secret_key_12345";
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["PayMongo:WebhookSecret"] = secret
            })
            .Build();

        var envMock = new Mock<IHostEnvironment>();
        envMock.Setup(e => e.EnvironmentName).Returns("Production");

        var service = new PayMongoPaymentGatewayService(
            new HttpClient(),
            config,
            envMock.Object,
            timeProvider,
            NullLogger<PayMongoPaymentGatewayService>.Instance);

        var payload = "{\"data\":{\"id\":\"evt_prod_123\"}}";
        var timestamp = fixedTime.ToUnixTimeSeconds();
        var hash = ComputeHmacSha256Hex(secret, $"{timestamp}.{payload}");
        // In Production, only 'li' signature is accepted; 'te' must be rejected
        var signatureHeader = $"t={timestamp},te={hash}";

        var verified = service.VerifyWebhookSignature(payload, signatureHeader);
        verified.Should().BeFalse();
    }

    [Fact]
    public void VerifyWebhookSignature_InProduction_AcceptsLiSignature()
    {
        var fixedTime = DateTimeOffset.UtcNow;
        var timeProvider = new MutableTimeProvider(fixedTime);
        var secret = "whsec_prod_secret_key_12345";
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["PayMongo:WebhookSecret"] = secret
            })
            .Build();

        var envMock = new Mock<IHostEnvironment>();
        envMock.Setup(e => e.EnvironmentName).Returns("Production");

        var service = new PayMongoPaymentGatewayService(
            new HttpClient(),
            config,
            envMock.Object,
            timeProvider,
            NullLogger<PayMongoPaymentGatewayService>.Instance);

        var payload = "{\"data\":{\"id\":\"evt_prod_123\"}}";
        var timestamp = fixedTime.ToUnixTimeSeconds();
        var hash = ComputeHmacSha256Hex(secret, $"{timestamp}.{payload}");
        var signatureHeader = $"t={timestamp},li={hash}";

        var verified = service.VerifyWebhookSignature(payload, signatureHeader);
        verified.Should().BeTrue();
    }

    [Fact]
    public void TierPricing_TryGetPriceCentavos_ReturnsFalseOnInvalidInputsWithoutThrowing()
    {
        var libreWeekly = TierPricing.TryGetPriceCentavos(PlanTier.Libre, BillingCycle.Weekly, out var p1);
        libreWeekly.Should().BeFalse();
        p1.Should().Be(0);

        var libreMonthly = TierPricing.TryGetPriceCentavos(PlanTier.Libre, BillingCycle.Monthly, out var p2);
        libreMonthly.Should().BeFalse();
        p2.Should().Be(0);

        var proWeekly = TierPricing.TryGetPriceCentavos(PlanTier.TindahanPro, BillingCycle.Weekly, out var p3);
        proWeekly.Should().BeTrue();
        p3.Should().Be(3_500);
    }

    private sealed class MutableTimeProvider : TimeProvider
    {
        private DateTimeOffset _utcNow;
        public MutableTimeProvider(DateTimeOffset utcNow) => _utcNow = utcNow;
        public override DateTimeOffset GetUtcNow() => _utcNow;
        public void SetUtcNow(DateTimeOffset utcNow) => _utcNow = utcNow;
    }

    private static string ComputeHmacSha256Hex(string secret, string message)
    {
        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(secret));
        return Convert.ToHexString(hmac.ComputeHash(Encoding.UTF8.GetBytes(message))).ToLowerInvariant();
    }
}
