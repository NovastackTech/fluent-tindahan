using System.Security.Cryptography;
using System.Text;
using FluentAssertions;
using MediatR;
using Microsoft.AspNetCore.Authorization;
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
    [InlineData(PlanTier.TindahanPro, BillingCycle.Monthly, 129.00)]
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
            PaymentMethod: "gcash",
            PaidAt: DateTimeOffset.UtcNow);

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
    public async Task ApplySubscriptionPaymentCommandHandler_UnknownTenant_ShouldRejectBeforeRecordingPayment()
    {
        using var context = CreateInMemoryDbContext();
        var handler = new ApplySubscriptionPaymentCommandHandler(
            context,
            NullLogger<ApplySubscriptionPaymentCommandHandler>.Instance);

        var result = await handler.Handle(new ApplySubscriptionPaymentCommand(
            Guid.NewGuid(),
            PlanTier.TindahanPro,
            BillingCycle.Monthly,
            12900L,
            "pay_unknown_tenant",
            "qrph",
            PaidAt: DateTimeOffset.UtcNow), CancellationToken.None);

        result.Outcome.Should().Be(PaymentWebhookOutcome.Rejected);
        result.Message.Should().Be("Unknown tenant.");
        var paymentRecorded = await context.PaymentHistories.IgnoreQueryFilters()
            .AnyAsync(p => p.GatewayReferenceId == "pay_unknown_tenant");
        paymentRecorded.Should().BeFalse();
    }

    [Fact]
    public async Task ApplySubscriptionPaymentCommandHandler_UpgradeFailure_ShouldKeepPendingPaymentRecord()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;
        await using var context = new FailingSaveChangesDbContext(options, _currentUserServiceMock.Object);
        context.Tenants.Add(new Tenant
        {
            Id = _testTenantId,
            BusinessName = "Test Sari-Sari Store",
            Tier = PlanTier.Libre,
            CreatedAt = DateTimeOffset.UtcNow
        });
        await context.SaveChangesAsync();
        context.FailOnSaveNumber = 3; // seed, durable payment row, then subscription update

        var handler = new ApplySubscriptionPaymentCommandHandler(
            context,
            NullLogger<ApplySubscriptionPaymentCommandHandler>.Instance);

        var act = () => handler.Handle(new ApplySubscriptionPaymentCommand(
            _testTenantId, PlanTier.TindahanPro, BillingCycle.Monthly, 12900L, "pay_pending_001", "gcash",
            PaidAt: DateTimeOffset.UtcNow), CancellationToken.None);

        await act.Should().ThrowAsync<DbUpdateException>();

        context.ChangeTracker.Clear();
        var payment = await context.PaymentHistories.IgnoreQueryFilters()
            .SingleAsync(p => p.GatewayReferenceId == "pay_pending_001");
        payment.Status.Should().Be("Pending");
    }

    [Fact]
    public async Task ApplySubscriptionPaymentCommandHandler_WeeklyPayment_ShouldReject()
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
            PaymentMethod: "gcash",
            PaidAt: DateTimeOffset.UtcNow);

        var result = await handler.Handle(command, CancellationToken.None);

        result.Outcome.Should().Be(PaymentWebhookOutcome.Rejected);
    }

    private sealed class FailingSaveChangesDbContext(
        DbContextOptions<AppDbContext> options,
        ICurrentUserService currentUserService) : AppDbContext(options, currentUserService)
    {
        public int SaveCount { get; private set; }
        public int? FailOnSaveNumber { get; set; }

        public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
        {
            SaveCount++;
            if (SaveCount == FailOnSaveNumber)
            {
                throw new DbUpdateException("Simulated subscription update failure.");
            }

            return base.SaveChangesAsync(cancellationToken);
        }
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
            PaymentMethod: "gcash",
            PaidAt: DateTimeOffset.UtcNow);

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
            PaymentMethod: "gcash",
            PaidAt: DateTimeOffset.UtcNow);

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
                                "cycle": "Monthly",
                                "purpose": "subscription"
                            },
                            "payments": [
                                {
                                    "id": "pay_test_xyz",
                                    "attributes": {
                                        "amount": 12900,
                                        "status": "paid",
                                        "currency": "PHP",
                                        "paid_at": 1761523200,
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
        subscription.MaxProducts.Should().Be(30);
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
        subscription.MaxProducts.Should().Be(30);
    }

    [Fact]
    public async Task BillingController_GetSubscriptionWithoutTenant_ReturnsUnauthorized()
    {
        _currentUserServiceMock.Setup(service => service.TenantId).Returns(Guid.Empty);
        var mediator = new Mock<IMediator>();
        var environment = new Mock<IHostEnvironment>();
        var controller = new BillingController(
            mediator.Object,
            _currentUserServiceMock.Object,
            environment.Object,
            NullLogger<BillingController>.Instance);

        var result = await controller.GetSubscription(CancellationToken.None);

        result.Result.Should().BeOfType<UnauthorizedObjectResult>();
        mediator.Verify(
            service => service.Send(It.IsAny<GetTenantSubscriptionQuery>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task ProcessBatchSyncCommand_LibreTier_Enforces30ProductLimit()
    {
        using var context = CreateInMemoryDbContext();

        // Seed 30 products for test tenant
        for (int i = 0; i < 30; i++)
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
            SyncId = "sync_prod_31",
            Entity = "Product",
            Action = "Insert",
            Timestamp = DateTimeOffset.UtcNow,
            Payload = System.Text.Json.JsonDocument.Parse("""
            {
                "id": "44444444-4444-4444-4444-444444444444",
                "name": "Excess Product 31",
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
        result.Results[0].Error.Should().Contain("Libre plan limit exceeded: Maximum 30 products allowed");
    }

    [Fact]
    public async Task ProcessBatchSyncCommand_LibreTier_SoftDeletedCustomersDoNotCountTowardCap()
    {
        using var context = CreateInMemoryDbContext();
        var tenantId = _currentUserServiceMock.Object.TenantId;

        // Seed 25 active customers and 10 soft-deleted customers (total 35 in DB)
        for (int i = 0; i < 25; i++)
        {
            context.Customers.Add(new Customer
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                Name = $"Active Debtor {i}",
                Phone = $"0918000{i:D4}",
                IsDeleted = false,
                UpdatedAt = DateTimeOffset.UtcNow
            });
        }
        for (int i = 0; i < 10; i++)
        {
            context.Customers.Add(new Customer
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                Name = $"Deleted Debtor {i}",
                Phone = $"0919000{i:D4}",
                IsDeleted = true,
                UpdatedAt = DateTimeOffset.UtcNow
            });
        }
        await context.SaveChangesAsync();

        var handler = new ProcessBatchSyncCommandHandler(
            context,
            _currentUserServiceMock.Object,
            NullLogger<ProcessBatchSyncCommandHandler>.Instance);

        // Even though total rows in DB is 35 (which exceeds 30 cap), only 25 are active.
        // Inserting a 26th customer must succeed!
        var op = new SyncOperationDto
        {
            SyncId = "sync_cust_26",
            Entity = "Customer",
            Action = "Insert",
            Timestamp = DateTimeOffset.UtcNow,
            Payload = System.Text.Json.JsonDocument.Parse("""
            {
                "id": "55555555-5555-5555-5555-555555555555",
                "name": "Active Customer 26",
                "phone": "09175555555"
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
        result.Results[0].Status.Should().Be("Success");

        // Active customer count is now 26
        var activeCount = await context.Customers.CountAsync();
        activeCount.Should().Be(26);

        // Total customer rows in DB is 36
        var totalRows = await context.Customers.IgnoreQueryFilters().CountAsync();
        totalRows.Should().Be(36);
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
    public async Task SubscriptionMonitorService_PostgresExecuteUpdateAsync_ShouldDowngradeExpiredTenant()
    {
        var connectionString = Environment.GetEnvironmentVariable("POSTGRES_CONNECTION")
            ?? "Host=localhost;Port=5432;Database=fluent_tindahan;Username=postgres;Password=jGai.KQjFP@5;";

        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql(connectionString)
            .Options;

        using var db = new AppDbContext(options, _currentUserServiceMock.Object);
        try
        {
            if (!await db.Database.CanConnectAsync())
            {
                // Skip if Postgres is not reachable
                return;
            }
        }
        catch
        {
            // Skip if connection fails
            return;
        }

        var expiredTenantId = Guid.NewGuid();
        var expiredTenant = new Tenant
        {
            Id = expiredTenantId,
            BusinessName = "Postgres Expired Store",
            Tier = PlanTier.TindahanPro,
            SubscriptionEndDate = DateTimeOffset.UtcNow.AddHours(-2)
        };
        db.Tenants.Add(expiredTenant);
        await db.SaveChangesAsync();

        try
        {
            var serviceProviderMock = new Mock<IServiceProvider>();
            serviceProviderMock.Setup(sp => sp.GetService(typeof(AppDbContext))).Returns(db);

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

            downgradedCount.Should().BeGreaterThanOrEqualTo(1);
            var updatedTenant = await db.Tenants.IgnoreQueryFilters().AsNoTracking().FirstAsync(t => t.Id == expiredTenantId);
            updatedTenant.Tier.Should().Be(PlanTier.Libre);
        }
        finally
        {
            await db.Tenants.IgnoreQueryFilters().Where(t => t.Id == expiredTenantId).ExecuteDeleteAsync();
        }
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

        var configMock = new Mock<IConfiguration>();
        configMock.Setup(c => c["Billing:AllowLibreUpgrade"]).Returns("true");

        var controller = new BillingController(
            mediatorMock.Object,
            _currentUserServiceMock.Object,
            null!,
            envMock.Object,
            NullLogger<BillingController>.Instance,
            null,
            configMock.Object);

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
    public async Task ProcessBatchSyncCommand_Sale_ProductDeletedOrMissing_KeepsSaleAndCreatesPlaceholder()
    {
        using var context = CreateInMemoryDbContext();
        var missingProductId = Guid.NewGuid();
        var saleId = Guid.NewGuid();

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
                "id": "{{saleId}}",
                "totalAmount": 50.0,
                "paymentMethod": "Cash",
                "items": [
                    {
                        "id": "{{Guid.NewGuid()}}",
                        "productId": "{{missingProductId}}",
                        "productName": "Old Shampoo Sachet",
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
        result.Results[0].Status.Should().Be("Success");

        // Verify sale is persisted
        var savedSale = await context.Sales.Include(s => s.Items).FirstOrDefaultAsync(s => s.Id == saleId);
        savedSale.Should().NotBeNull();
        savedSale!.TotalAmount.Should().Be(50.0m);
        savedSale.Items.Should().HaveCount(1);

        // Verify placeholder product was created with snapshot data and marked IsDeleted
        var placeholderProd = await context.Products.IgnoreQueryFilters().FirstOrDefaultAsync(p => p.Id == missingProductId);
        placeholderProd.Should().NotBeNull();
        placeholderProd!.Name.Should().Be("Old Shampoo Sachet");
        placeholderProd.Price.Should().Be(50.0m);
        placeholderProd.IsDeleted.Should().BeTrue();

        // Normal query filter hides placeholder product from inventory catalog
        var visibleProd = await context.Products.FirstOrDefaultAsync(p => p.Id == missingProductId);
        visibleProd.Should().BeNull();
    }

    [Fact]
    public async Task ProcessBatchSyncCommand_Sale_ProductRejectedByLimitInSameBatch_FailsCleanly()
    {
        using var context = CreateInMemoryDbContext();
        var tenantId = _currentUserServiceMock.Object.TenantId;

        // Seed 30 products so Libre limit is reached
        for (int i = 0; i < 30; i++)
        {
            context.Products.Add(new Product
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                Name = $"Product {i}",
                Price = 10m,
                UpdatedAt = DateTimeOffset.UtcNow
            });
        }
        await context.SaveChangesAsync();

        var handler = new ProcessBatchSyncCommandHandler(
            context,
            _currentUserServiceMock.Object,
            NullLogger<ProcessBatchSyncCommandHandler>.Instance);

        var rejectedProductId = Guid.NewGuid();
        var productOp = new SyncOperationDto
        {
            SyncId = "sync_prod_31",
            Entity = "Product",
            Action = "Insert",
            Timestamp = DateTimeOffset.UtcNow,
            Payload = System.Text.Json.JsonDocument.Parse($$"""
            {
                "id": "{{rejectedProductId}}",
                "name": "Excess Product 31",
                "price": 25.0
            }
            """).RootElement
        };

        var saleOp = new SyncOperationDto
        {
            SyncId = "sync_sale_with_rejected_prod",
            Entity = "Sale",
            Action = "Insert",
            Timestamp = DateTimeOffset.UtcNow,
            Payload = System.Text.Json.JsonDocument.Parse($$"""
            {
                "id": "{{Guid.NewGuid()}}",
                "totalAmount": 25.0,
                "paymentMethod": "Cash",
                "items": [
                    {
                        "id": "{{Guid.NewGuid()}}",
                        "productId": "{{rejectedProductId}}",
                        "qty": 1,
                        "unitPrice": 25.0,
                        "subtotal": 25.0
                    }
                ]
            }
            """).RootElement
        };

        var result = await handler.Handle(
            new ProcessBatchSyncCommand(new BatchSyncRequestDto
            {
                DeviceId = Guid.NewGuid(),
                Operations = new List<SyncOperationDto> { productOp, saleOp }
            }),
            CancellationToken.None);

        result.Results.Should().HaveCount(2);
        // Product failed due to Libre limit
        result.Results[0].Status.Should().Be("Failed");
        result.Results[0].Error.Should().Contain("Libre plan limit exceeded: Maximum 30 products allowed");

        // Sale failed cleanly because the product was rejected in this batch
        result.Results[1].Status.Should().Be("Failed");
        result.Results[1].Error.Should().Contain("rejected in this sync batch");
    }

    [Fact]
    public async Task ProcessBatchSyncCommand_Sale_CustomerDeletedOrMissing_KeepsSaleWithNullCustomer()
    {
        using var context = CreateInMemoryDbContext();
        var deletedCustomerId = Guid.NewGuid();
        var saleId = Guid.NewGuid();

        var handler = new ProcessBatchSyncCommandHandler(
            context,
            _currentUserServiceMock.Object,
            NullLogger<ProcessBatchSyncCommandHandler>.Instance);

        var op = new SyncOperationDto
        {
            SyncId = "sync_sale_missing_cust",
            Entity = "Sale",
            Action = "Insert",
            Timestamp = DateTimeOffset.UtcNow,
            Payload = System.Text.Json.JsonDocument.Parse($$"""
            {
                "id": "{{saleId}}",
                "totalAmount": 100.0,
                "paymentMethod": "Cash",
                "customerId": "{{deletedCustomerId}}"
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
        result.Results[0].Status.Should().Be("Success");

        var savedSale = await context.Sales.FirstOrDefaultAsync(s => s.Id == saleId);
        savedSale.Should().NotBeNull();
        savedSale!.CustomerId.Should().BeNull();
        savedSale.TotalAmount.Should().Be(100.0m);
    }

    [Fact]
    public async Task ProcessBatchSyncCommand_BatchOrdering_CustomerProcessedBeforeUtangLedger()
    {
        using var context = CreateInMemoryDbContext();
        var newCustomerId = Guid.NewGuid();
        var utangLedgerId = Guid.NewGuid();

        var handler = new ProcessBatchSyncCommandHandler(
            context,
            _currentUserServiceMock.Object,
            NullLogger<ProcessBatchSyncCommandHandler>.Instance);

        // Put UtangLedger FIRST and Customer SECOND in the batch operations list to test server-side ordering
        var utangOp = new SyncOperationDto
        {
            SyncId = "sync_utang_first",
            Entity = "UtangLedger",
            Action = "Insert",
            Timestamp = DateTimeOffset.UtcNow,
            Payload = System.Text.Json.JsonDocument.Parse($$"""
            {
                "id": "{{utangLedgerId}}",
                "customerId": "{{newCustomerId}}",
                "amount": 75.0,
                "type": "Credit"
            }
            """).RootElement
        };

        var customerOp = new SyncOperationDto
        {
            SyncId = "sync_customer_second",
            Entity = "Customer",
            Action = "Insert",
            Timestamp = DateTimeOffset.UtcNow,
            Payload = System.Text.Json.JsonDocument.Parse($$"""
            {
                "id": "{{newCustomerId}}",
                "name": "Maria Santos",
                "phone": "09181234567",
                "totalUtangBalance": 0.0
            }
            """).RootElement
        };

        var result = await handler.Handle(
            new ProcessBatchSyncCommand(new BatchSyncRequestDto
            {
                DeviceId = Guid.NewGuid(),
                Operations = new List<SyncOperationDto> { utangOp, customerOp }
            }),
            CancellationToken.None);

        result.Results.Should().HaveCount(2);
        // Both operations must succeed because Customer was ordered before UtangLedger server-side!
        result.Results.First(r => r.SyncId == "sync_customer_second").Status.Should().Be("Success");
        result.Results.First(r => r.SyncId == "sync_utang_first").Status.Should().Be("Success");

        var savedCustomer = await context.Customers.FirstOrDefaultAsync(c => c.Id == newCustomerId);
        savedCustomer.Should().NotBeNull();
        savedCustomer!.TotalUtangBalance.Should().Be(75.0m);
    }

    [Fact]
    public async Task ProcessBatchSyncCommand_GCash_BackDatedInsert_DoesNotCountTowardCurrentMonthLimit()
    {
        using var context = CreateInMemoryDbContext();
        var tenantId = _currentUserServiceMock.Object.TenantId;
        var startOfMonth = ManilaTime.StartOfCurrentMonthUtc();

        // Seed 30 current-month GCash transactions to saturate the Libre monthly limit
        for (int i = 0; i < 30; i++)
        {
            context.GCashTransactions.Add(new GCashTxn
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                Type = "CashIn",
                Amount = 100m,
                Fee = 5m,
                RefNo = $"REF-{i}",
                Date = startOfMonth.AddDays(1)
            });
        }
        await context.SaveChangesAsync();

        var handler = new ProcessBatchSyncCommandHandler(
            context,
            _currentUserServiceMock.Object,
            NullLogger<ProcessBatchSyncCommandHandler>.Instance);

        // A back-dated transaction from the previous month
        var oldDate = startOfMonth.AddDays(-5);
        var oldTxnId = Guid.NewGuid();
        var backDatedOp = new SyncOperationDto
        {
            SyncId = "sync_gcash_backdated",
            Entity = "GCashTxn",
            Action = "Insert",
            Timestamp = DateTimeOffset.UtcNow,
            Payload = System.Text.Json.JsonDocument.Parse($$"""
            {
                "id": "{{oldTxnId}}",
                "type": "CashIn",
                "amount": 200.0,
                "fee": 10.0,
                "refNo": "REF-OLD-1",
                "date": "{{oldDate:O}}"
            }
            """).RootElement
        };

        var result = await handler.Handle(
            new ProcessBatchSyncCommand(new BatchSyncRequestDto
            {
                DeviceId = Guid.NewGuid(),
                Operations = new List<SyncOperationDto> { backDatedOp }
            }),
            CancellationToken.None);

        result.Results.Should().HaveCount(1);
        result.Results[0].Status.Should().Be("Success");

        var savedTxn = await context.GCashTransactions.FirstOrDefaultAsync(g => g.Id == oldTxnId);
        savedTxn.Should().NotBeNull();
        savedTxn!.Amount.Should().Be(200.0m);
    }

    [Fact]
    public async Task ProcessBatchSyncCommand_BlankSyncIdAndDuplicates_ShouldPreserveOriginalIndicesAndReportSuccess()
    {
        using var context = CreateInMemoryDbContext();
        var handler = new ProcessBatchSyncCommandHandler(
            context,
            _currentUserServiceMock.Object,
            NullLogger<ProcessBatchSyncCommandHandler>.Instance);

        var cust1Id = Guid.NewGuid();
        var cust2Id = Guid.NewGuid();
        var cust3Id = Guid.NewGuid();

        var opBlank1 = new SyncOperationDto
        {
            SyncId = "", // Blank
            Entity = "Customer",
            Action = "Insert",
            Timestamp = DateTimeOffset.UtcNow,
            Payload = System.Text.Json.JsonDocument.Parse($$"""
            {
                "id": "{{cust1Id}}",
                "name": "Customer With Blank SyncId 1",
                "phone": "09111111111"
            }
            """).RootElement
        };

        var opDuplicateA = new SyncOperationDto
        {
            SyncId = "duplicate_sync_id",
            Entity = "Customer",
            Action = "Insert",
            Timestamp = DateTimeOffset.UtcNow,
            Payload = System.Text.Json.JsonDocument.Parse($$"""
            {
                "id": "{{cust2Id}}",
                "name": "Customer With Duplicate SyncId A",
                "phone": "09222222222"
            }
            """).RootElement
        };

        var opDuplicateB = new SyncOperationDto
        {
            SyncId = "duplicate_sync_id",
            Entity = "Customer",
            Action = "Insert",
            Timestamp = DateTimeOffset.UtcNow,
            Payload = System.Text.Json.JsonDocument.Parse($$"""
            {
                "id": "{{cust3Id}}",
                "name": "Customer With Duplicate SyncId B",
                "phone": "09333333333"
            }
            """).RootElement
        };

        var result = await handler.Handle(
            new ProcessBatchSyncCommand(new BatchSyncRequestDto
            {
                DeviceId = Guid.NewGuid(),
                Operations = new List<SyncOperationDto> { opBlank1, opDuplicateA, opDuplicateB }
            }),
            CancellationToken.None);

        result.Results.Should().HaveCount(3);
        // Index 0: blank SyncId must succeed and preserve empty SyncId
        result.Results[0].SyncId.Should().Be("");
        result.Results[0].Status.Should().Be("Success");

        // Index 1 and 2: duplicate SyncIds must both succeed in original index order
        result.Results[1].SyncId.Should().Be("duplicate_sync_id");
        result.Results[1].Status.Should().Be("Success");

        result.Results[2].SyncId.Should().Be("duplicate_sync_id");
        result.Results[2].Status.Should().Be("Success");

        (await context.Customers.CountAsync()).Should().Be(3);
    }

    [Fact]
    public async Task ProcessBatchSyncCommand_DeleteThenReinsert_ShouldPreserveOrderAndDeleteBeforeInsert()
    {
        using var context = CreateInMemoryDbContext();
        var tenantId = _currentUserServiceMock.Object.TenantId;
        var productId = Guid.NewGuid();

        // Seed existing product
        context.Products.Add(new Product
        {
            Id = productId,
            TenantId = tenantId,
            Name = "Original Product",
            Price = 50m,
            UpdatedAt = DateTimeOffset.UtcNow.AddMinutes(-10)
        });
        await context.SaveChangesAsync();

        var handler = new ProcessBatchSyncCommandHandler(
            context,
            _currentUserServiceMock.Object,
            NullLogger<ProcessBatchSyncCommandHandler>.Instance);

        var deleteOp = new SyncOperationDto
        {
            SyncId = "sync_delete_first",
            Entity = "Product",
            Action = "Delete",
            Timestamp = DateTimeOffset.UtcNow.AddMinutes(-5),
            Payload = System.Text.Json.JsonDocument.Parse($$"""
            {
                "id": "{{productId}}"
            }
            """).RootElement
        };

        var reinsertOp = new SyncOperationDto
        {
            SyncId = "sync_reinsert_second",
            Entity = "Product",
            Action = "Insert",
            Timestamp = DateTimeOffset.UtcNow,
            Payload = System.Text.Json.JsonDocument.Parse($$"""
            {
                "id": "{{productId}}",
                "name": "Recreated Product",
                "price": 60.0
            }
            """).RootElement
        };

        // Send Delete followed by Insert for the exact same product ID
        var result = await handler.Handle(
            new ProcessBatchSyncCommand(new BatchSyncRequestDto
            {
                DeviceId = Guid.NewGuid(),
                Operations = new List<SyncOperationDto> { deleteOp, reinsertOp }
            }),
            CancellationToken.None);

        result.Results.Should().HaveCount(2);
        result.Results[0].Status.Should().Be("Success");
        result.Results[1].Status.Should().Be("Success");

        // Product must be active and updated (not deleted!) because Delete ran BEFORE Insert
        var finalProduct = await context.Products.FirstOrDefaultAsync(p => p.Id == productId);
        finalProduct.Should().NotBeNull();
        finalProduct!.Name.Should().Be("Recreated Product");
        finalProduct.Price.Should().Be(60.0m);
        finalProduct.IsDeleted.Should().BeFalse();
    }

    [Fact]
    public async Task ProcessBatchSyncCommand_ProductDelete_SoftDeletesAndDoesNotDoubleDecrementCounters()
    {
        using var context = CreateInMemoryDbContext();
        var tenantId = _currentUserServiceMock.Object.TenantId;

        var activeProductId = Guid.NewGuid();
        var placeholderProductId = Guid.NewGuid();
        var saleId = Guid.NewGuid();

        // 1 active product
        var activeProd = new Product
        {
            Id = activeProductId,
            TenantId = tenantId,
            Name = "Active Kopiko",
            Price = 12m,
            IsDeleted = false,
            UpdatedAt = DateTimeOffset.UtcNow.AddMinutes(-10)
        };
        // 1 placeholder product (already soft-deleted)
        var placeholderProd = new Product
        {
            Id = placeholderProductId,
            TenantId = tenantId,
            Name = "Deleted Placeholder",
            Price = 20m,
            IsDeleted = true,
            UpdatedAt = DateTimeOffset.UtcNow.AddMinutes(-10)
        };
        // 28 other active products to reach 29 active products before batch
        context.Products.Add(activeProd);
        context.Products.Add(placeholderProd);
        for (int i = 0; i < 28; i++)
        {
            context.Products.Add(new Product
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                Name = $"Product {i}",
                Price = 10m,
                IsDeleted = false,
                UpdatedAt = DateTimeOffset.UtcNow.AddMinutes(-10)
            });
        }

        // Add a sale referencing activeProd
        var sale = new Sale
        {
            Id = saleId,
            TenantId = tenantId,
            TotalAmount = 12m,
            Date = DateTimeOffset.UtcNow.AddMinutes(-5),
            PaymentMethod = "Cash",
            Items = new List<SaleItem>
            {
                new SaleItem
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    SaleId = saleId,
                    ProductId = activeProductId,
                    Qty = 1,
                    UnitPrice = 12m,
                    Subtotal = 12m
                }
            }
        };
        context.Sales.Add(sale);
        await context.SaveChangesAsync();

        var handler = new ProcessBatchSyncCommandHandler(
            context,
            _currentUserServiceMock.Object,
            NullLogger<ProcessBatchSyncCommandHandler>.Instance);

        var deleteTimestamp = DateTimeOffset.UtcNow;
        var batch = new BatchSyncRequestDto
        {
            DeviceId = Guid.NewGuid(),
            Operations = new List<SyncOperationDto>
            {
                // Delete active product
                new SyncOperationDto
                {
                    SyncId = "del_active",
                    Entity = "Product",
                    Action = "Delete",
                    Timestamp = deleteTimestamp,
                    Payload = System.Text.Json.JsonDocument.Parse($$"""{ "id": "{{activeProductId}}" }""").RootElement
                },
                // Delete already soft-deleted placeholder product
                new SyncOperationDto
                {
                    SyncId = "del_placeholder",
                    Entity = "Product",
                    Action = "Delete",
                    Timestamp = deleteTimestamp,
                    Payload = System.Text.Json.JsonDocument.Parse($$"""{ "id": "{{placeholderProductId}}" }""").RootElement
                },
                // Add a new product (succeeds as 30th product, then del_active decrements to 29, placeholder does not decrement to 28)
                new SyncOperationDto
                {
                    SyncId = "add_new",
                    Entity = "Product",
                    Action = "Insert",
                    Timestamp = deleteTimestamp,
                    Payload = System.Text.Json.JsonDocument.Parse($$"""
                    {
                        "id": "{{Guid.NewGuid()}}",
                        "name": "New Product Under Limit",
                        "price": 15.0
                    }
                    """).RootElement
                }
            }
        };

        var response = await handler.Handle(new ProcessBatchSyncCommand(batch), CancellationToken.None);

        response.Results.Should().HaveCount(3);
        response.Results[0].Status.Should().Be("Success");
        response.Results[1].Status.Should().Be("Success");
        response.Results[2].Status.Should().Be("Success");

        // Verify active product is now soft-deleted
        var standardQuery = await context.Products.FirstOrDefaultAsync(p => p.Id == activeProductId);
        standardQuery.Should().BeNull();

        var rawActive = await context.Products.IgnoreQueryFilters().FirstOrDefaultAsync(p => p.Id == activeProductId);
        rawActive.Should().NotBeNull();
        rawActive!.IsDeleted.Should().BeTrue();
        rawActive.UpdatedAt.Should().Be(deleteTimestamp);

        // Verify sale and sale items still exist and reference activeProductId without error
        var preservedSale = await context.Sales.Include(s => s.Items).FirstOrDefaultAsync(s => s.Id == saleId);
        preservedSale.Should().NotBeNull();
        preservedSale!.Items.Should().HaveCount(1);
        preservedSale.Items.First().ProductId.Should().Be(activeProductId);

        // Active products count in DB is exactly 29 now (28 initial + 1 added - 1 active deleted; placeholder was already deleted)
        var totalActive = await context.Products.CountAsync();
        totalActive.Should().Be(29);
    }

    [Fact]
    public async Task ProcessBatchSyncCommand_RestoringPlaceholder_EnforcesLibreLimitAndIncrementsCounter()
    {
        using var context = CreateInMemoryDbContext();
        var tenantId = _currentUserServiceMock.Object.TenantId;

        var placeholderId = Guid.NewGuid();
        // Seed 30 active products (reaching Libre limit)
        for (int i = 0; i < 30; i++)
        {
            context.Products.Add(new Product
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                Name = $"Active Product {i}",
                Price = 10m,
                IsDeleted = false,
                UpdatedAt = DateTimeOffset.UtcNow.AddMinutes(-10)
            });
        }

        // Seed 1 placeholder product
        context.Products.Add(new Product
        {
            Id = placeholderId,
            TenantId = tenantId,
            Name = "Missing Placeholder",
            Price = 20m,
            IsDeleted = true,
            UpdatedAt = DateTimeOffset.UtcNow.AddMinutes(-10)
        });
        await context.SaveChangesAsync();

        var handler = new ProcessBatchSyncCommandHandler(
            context,
            _currentUserServiceMock.Object,
            NullLogger<ProcessBatchSyncCommandHandler>.Instance);

        // Attempting to restore the placeholder when at 30 products must fail
        var restoreOp = new SyncOperationDto
        {
            SyncId = "sync_restore_placeholder",
            Entity = "Product",
            Action = "Update",
            Timestamp = DateTimeOffset.UtcNow,
            Payload = System.Text.Json.JsonDocument.Parse($$"""
            {
                "id": "{{placeholderId}}",
                "name": "Restored Real Product",
                "price": 25.0
            }
            """).RootElement
        };

        var response1 = await handler.Handle(
            new ProcessBatchSyncCommand(new BatchSyncRequestDto
            {
                DeviceId = Guid.NewGuid(),
                Operations = new List<SyncOperationDto> { restoreOp }
            }),
            CancellationToken.None);

        response1.Results.Should().HaveCount(1);
        response1.Results[0].Status.Should().Be("Failed");
        response1.Results[0].Error.Should().Contain("Libre plan limit exceeded: Maximum 30 products allowed");

        // Placeholder must still be soft-deleted
        var rawPlaceholder1 = await context.Products.IgnoreQueryFilters().FirstOrDefaultAsync(p => p.Id == placeholderId);
        rawPlaceholder1!.IsDeleted.Should().BeTrue();

        // Now delete one active product to drop count to 29
        var activeToDelete = await context.Products.FirstAsync(p => !p.IsDeleted);
        activeToDelete.IsDeleted = true;
        await context.SaveChangesAsync();

        // Restoring the placeholder now should succeed and increment the counter to 30
        var response2 = await handler.Handle(
            new ProcessBatchSyncCommand(new BatchSyncRequestDto
            {
                DeviceId = Guid.NewGuid(),
                Operations = new List<SyncOperationDto> { restoreOp }
            }),
            CancellationToken.None);

        response2.Results.Should().HaveCount(1);
        response2.Results[0].Status.Should().Be("Success");

        var rawPlaceholder2 = await context.Products.IgnoreQueryFilters().FirstOrDefaultAsync(p => p.Id == placeholderId);
        rawPlaceholder2!.IsDeleted.Should().BeFalse();
        rawPlaceholder2.Name.Should().Be("Restored Real Product");

        // Count of active products is back to 30
        var activeCount = await context.Products.CountAsync();
        activeCount.Should().Be(30);
    }

    [Fact]
    public async Task ProcessBatchSyncCommand_CustomerDelete_SoftDeletesAndDoesNotDoubleDecrementCounters()
    {
        using var context = CreateInMemoryDbContext();
        var tenantId = _currentUserServiceMock.Object.TenantId;

        var activeCustomerId = Guid.NewGuid();
        var placeholderCustomerId = Guid.NewGuid();
        var utangId = Guid.NewGuid();
        var saleId = Guid.NewGuid();

        // 1 active customer
        var activeCust = new Customer
        {
            Id = activeCustomerId,
            TenantId = tenantId,
            Name = "Active Aling Tina",
            Phone = "09171112222",
            TotalUtangBalance = 0m,
            IsDeleted = false,
            UpdatedAt = DateTimeOffset.UtcNow.AddMinutes(-10)
        };
        // 1 placeholder customer (already soft-deleted)
        var placeholderCust = new Customer
        {
            Id = placeholderCustomerId,
            TenantId = tenantId,
            Name = "Deleted Customer Placeholder",
            Phone = "09180001111",
            TotalUtangBalance = 0m,
            IsDeleted = true,
            UpdatedAt = DateTimeOffset.UtcNow.AddMinutes(-10)
        };
        context.Customers.Add(activeCust);
        context.Customers.Add(placeholderCust);

        // 28 other active customers to reach 29 active customers before batch
        for (int i = 0; i < 28; i++)
        {
            context.Customers.Add(new Customer
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                Name = $"Customer {i}",
                Phone = $"0917000{i:D4}",
                TotalUtangBalance = 0m,
                IsDeleted = false,
                UpdatedAt = DateTimeOffset.UtcNow.AddMinutes(-10)
            });
        }

        // Add utang ledger and sale referencing active customer
        context.UtangLedgers.Add(new UtangLedger
        {
            Id = utangId,
            TenantId = tenantId,
            CustomerId = activeCustomerId,
            Amount = 150m,
            Type = "Credit",
            Date = DateTimeOffset.UtcNow.AddMinutes(-5),
            Notes = "Sample utang"
        });
        context.Sales.Add(new Sale
        {
            Id = saleId,
            TenantId = tenantId,
            CustomerId = activeCustomerId,
            TotalAmount = 150m,
            Date = DateTimeOffset.UtcNow.AddMinutes(-5),
            PaymentMethod = "Utang"
        });
        await context.SaveChangesAsync();

        var handler = new ProcessBatchSyncCommandHandler(
            context,
            _currentUserServiceMock.Object,
            NullLogger<ProcessBatchSyncCommandHandler>.Instance);

        var deleteTimestamp = DateTimeOffset.UtcNow;
        var batch = new BatchSyncRequestDto
        {
            DeviceId = Guid.NewGuid(),
            Operations = new List<SyncOperationDto>
            {
                // Delete active customer
                new SyncOperationDto
                {
                    SyncId = "del_active_cust",
                    Entity = "Customer",
                    Action = "Delete",
                    Timestamp = deleteTimestamp,
                    Payload = System.Text.Json.JsonDocument.Parse($$"""{ "id": "{{activeCustomerId}}" }""").RootElement
                },
                // Delete already soft-deleted placeholder customer (must NOT double-decrement)
                new SyncOperationDto
                {
                    SyncId = "del_placeholder_cust",
                    Entity = "Customer",
                    Action = "Delete",
                    Timestamp = deleteTimestamp,
                    Payload = System.Text.Json.JsonDocument.Parse($$"""{ "id": "{{placeholderCustomerId}}" }""").RootElement
                },
                // Add a new customer (succeeds as 30th customer, then del_active decrements to 29, placeholder does not decrement to 28)
                new SyncOperationDto
                {
                    SyncId = "add_new_cust",
                    Entity = "Customer",
                    Action = "Insert",
                    Timestamp = deleteTimestamp,
                    Payload = System.Text.Json.JsonDocument.Parse($$"""
                    {
                        "id": "{{Guid.NewGuid()}}",
                        "name": "New Customer Under Limit",
                        "phone": "09179998888"
                    }
                    """).RootElement
                }
            }
        };

        var response = await handler.Handle(new ProcessBatchSyncCommand(batch), CancellationToken.None);

        response.Results.Should().HaveCount(3);
        response.Results[0].Status.Should().Be("Success");
        response.Results[1].Status.Should().Be("Success");
        response.Results[2].Status.Should().Be("Success");

        // Verify active customer is now soft-deleted (filtered out by global query filter)
        var standardQuery = await context.Customers.FirstOrDefaultAsync(c => c.Id == activeCustomerId);
        standardQuery.Should().BeNull();

        // But still exists in database with IsDeleted == true and updated timestamp
        var rawActive = await context.Customers.IgnoreQueryFilters().FirstOrDefaultAsync(c => c.Id == activeCustomerId);
        rawActive.Should().NotBeNull();
        rawActive!.IsDeleted.Should().BeTrue();
        rawActive.UpdatedAt.Should().Be(deleteTimestamp);

        // Verify UtangLedger and Sale still exist and retain foreign key to activeCustomerId without being orphaned or cascaded
        var preservedUtang = await context.UtangLedgers.FirstOrDefaultAsync(u => u.Id == utangId);
        preservedUtang.Should().NotBeNull();
        preservedUtang!.CustomerId.Should().Be(activeCustomerId);

        var preservedSale = await context.Sales.FirstOrDefaultAsync(s => s.Id == saleId);
        preservedSale.Should().NotBeNull();
        preservedSale!.CustomerId.Should().Be(activeCustomerId);

        // Active customer count in DB is exactly 29 (28 initial + 1 added - 1 active deleted; placeholder was already deleted)
        var totalActive = await context.Customers.CountAsync();
        totalActive.Should().Be(29);
    }

    [Fact]
    public async Task ProcessBatchSyncCommand_CustomerDeleteWithNonZeroUtangBalance_RejectsDeleteAndReturnsFailedStatus()
    {
        using var context = CreateInMemoryDbContext();
        var tenantId = _currentUserServiceMock.Object.TenantId;

        var debtorId = Guid.NewGuid();
        var debtor = new Customer
        {
            Id = debtorId,
            TenantId = tenantId,
            Name = "Unsettled Debtor",
            Phone = "09173334444",
            TotalUtangBalance = 250m,
            IsDeleted = false,
            UpdatedAt = DateTimeOffset.UtcNow.AddMinutes(-10)
        };
        context.Customers.Add(debtor);
        await context.SaveChangesAsync();

        var handler = new ProcessBatchSyncCommandHandler(
            context,
            _currentUserServiceMock.Object,
            NullLogger<ProcessBatchSyncCommandHandler>.Instance);

        var batch = new BatchSyncRequestDto
        {
            DeviceId = Guid.NewGuid(),
            Operations = new List<SyncOperationDto>
            {
                new SyncOperationDto
                {
                    SyncId = "del_unsettled_debtor",
                    Entity = "Customer",
                    Action = "Delete",
                    Timestamp = DateTimeOffset.UtcNow,
                    Payload = System.Text.Json.JsonDocument.Parse($$"""{ "id": "{{debtorId}}" }""").RootElement
                }
            }
        };

        var response = await handler.Handle(new ProcessBatchSyncCommand(batch), CancellationToken.None);

        response.Results.Should().HaveCount(1);
        response.Results[0].Status.Should().Be("Failed");
        response.Results[0].Error.Should().Contain("outstanding utang balance");

        // Debtor must NOT be soft-deleted
        var retrieved = await context.Customers.FirstOrDefaultAsync(c => c.Id == debtorId);
        retrieved.Should().NotBeNull();
        retrieved!.IsDeleted.Should().BeFalse();
        retrieved.TotalUtangBalance.Should().Be(250m);
    }

    [Fact]
    public async Task ProcessBatchSyncCommand_RestoringCustomerPlaceholder_EnforcesLibreLimitAndIncrementsCounter()
    {
        using var context = CreateInMemoryDbContext();
        var tenantId = _currentUserServiceMock.Object.TenantId;

        var placeholderId = Guid.NewGuid();
        // Seed 30 active customers (reaching Libre limit)
        for (int i = 0; i < 30; i++)
        {
            context.Customers.Add(new Customer
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                Name = $"Active Customer {i}",
                Phone = $"0918000{i:D4}",
                IsDeleted = false,
                UpdatedAt = DateTimeOffset.UtcNow.AddMinutes(-10)
            });
        }

        // Seed 1 placeholder customer
        context.Customers.Add(new Customer
        {
            Id = placeholderId,
            TenantId = tenantId,
            Name = "Missing Placeholder Debtor",
            Phone = "09180009999",
            IsDeleted = true,
            UpdatedAt = DateTimeOffset.UtcNow.AddMinutes(-10)
        });
        await context.SaveChangesAsync();

        var handler = new ProcessBatchSyncCommandHandler(
            context,
            _currentUserServiceMock.Object,
            NullLogger<ProcessBatchSyncCommandHandler>.Instance);

        // Attempting to restore the placeholder when at 30 customers must fail
        var restoreOp = new SyncOperationDto
        {
            SyncId = "sync_restore_cust_placeholder",
            Entity = "Customer",
            Action = "Update",
            Timestamp = DateTimeOffset.UtcNow,
            Payload = System.Text.Json.JsonDocument.Parse($$"""
            {
                "id": "{{placeholderId}}",
                "name": "Restored Real Debtor",
                "phone": "09181119999"
            }
            """).RootElement
        };

        var response1 = await handler.Handle(
            new ProcessBatchSyncCommand(new BatchSyncRequestDto
            {
                DeviceId = Guid.NewGuid(),
                Operations = new List<SyncOperationDto> { restoreOp }
            }),
            CancellationToken.None);

        response1.Results.Should().HaveCount(1);
        response1.Results[0].Status.Should().Be("Failed");
        response1.Results[0].Error.Should().Contain("Libre plan limit exceeded: Maximum 30 debtors allowed");

        // Placeholder must still be soft-deleted
        var rawPlaceholder1 = await context.Customers.IgnoreQueryFilters().FirstOrDefaultAsync(c => c.Id == placeholderId);
        rawPlaceholder1!.IsDeleted.Should().BeTrue();

        // Now delete one active customer to drop count to 29
        var activeToDelete = await context.Customers.FirstAsync(c => !c.IsDeleted);
        activeToDelete.IsDeleted = true;
        await context.SaveChangesAsync();

        // Restoring the placeholder now should succeed and increment the counter to 30
        var response2 = await handler.Handle(
            new ProcessBatchSyncCommand(new BatchSyncRequestDto
            {
                DeviceId = Guid.NewGuid(),
                Operations = new List<SyncOperationDto> { restoreOp }
            }),
            CancellationToken.None);

        response2.Results.Should().HaveCount(1);
        response2.Results[0].Status.Should().Be("Success");

        var rawPlaceholder2 = await context.Customers.IgnoreQueryFilters().FirstOrDefaultAsync(c => c.Id == placeholderId);
        rawPlaceholder2!.IsDeleted.Should().BeFalse();
        rawPlaceholder2.Name.Should().Be("Restored Real Debtor");

        // Count of active customers is back to 30
        var activeCount = await context.Customers.CountAsync();
        activeCount.Should().Be(30);
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
        proWeekly.Should().BeFalse();
        p3.Should().Be(0);
    }

    [Fact]
    public async Task PayMongoPaymentGatewayService_RapidCalls_GeneratesUniqueRefNos()
    {
        var fixedTime = DateTimeOffset.UtcNow;
        var timeProvider = new MutableTimeProvider(fixedTime);
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["PayMongo:SecretKey"] = "mock_secret_key",
                ["PayMongo:FrontendOrigin"] = "http://localhost:5173"
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

        var refNos = new HashSet<string>();
        for (int i = 0; i < 100; i++)
        {
            var session = await service.CreateCheckoutSessionAsync(_testTenantId, PlanTier.TindahanPro, BillingCycle.Monthly);
            refNos.Add(session.ReferenceNumber).Should().BeTrue("every generated reference number must be unique even within the same millisecond timestamp");
        }

        refNos.Should().HaveCount(100);
    }

    [Fact]
    public async Task PayMongoPaymentGatewayService_DnsFailure_ThrowsSafeGatewayException()
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["PayMongo:SecretKey"] = "sk_test_unit_test",
                ["PayMongo:FrontendOrigin"] = "http://localhost:5173"
            })
            .Build();
        var environment = new Mock<IHostEnvironment>();
        environment.Setup(host => host.EnvironmentName).Returns("Development");
        var service = new PayMongoPaymentGatewayService(
            new HttpClient(new DnsFailureHandler()),
            config,
            environment.Object,
            TimeProvider.System,
            NullLogger<PayMongoPaymentGatewayService>.Instance);

        var act = () => service.CreateCheckoutSessionAsync(
            _testTenantId,
            PlanTier.TindahanPro,
            BillingCycle.Monthly);

        await act.Should().ThrowAsync<PaymentGatewayException>()
            .WithMessage("Payment gateway is temporarily unavailable. Please try again later.");
    }

    private sealed class DnsFailureHandler : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request,
            CancellationToken cancellationToken) =>
            Task.FromException<HttpResponseMessage>(new HttpRequestException("No such host is known."));
    }

    [Fact]
    public async Task ApplySubscriptionPaymentCommandHandler_RemovedTier_IsRejected()
    {
        using var context = CreateInMemoryDbContext();
        var handler = new ApplySubscriptionPaymentCommandHandler(context, NullLogger<ApplySubscriptionPaymentCommandHandler>.Instance);

        var tenant = await context.Tenants.FirstAsync(t => t.Id == _testTenantId);
        var now = DateTimeOffset.UtcNow;
        // Tenant currently has an active TindahanPro subscription expiring in 15 days
        var existingEnd = now.AddDays(15);
        tenant.Tier = PlanTier.TindahanPro;
        tenant.SubscriptionEndDate = existingEnd;
        await context.SaveChangesAsync();

        // Customer upgrades mid-term to NegosyoPlus for 1 month
        var result = await handler.Handle(new ApplySubscriptionPaymentCommand(
            _testTenantId,
            PlanTier.NegosyoPlus,
            BillingCycle.Monthly,
            34_900,
            "pay_upgrade_midterm",
            "gcash",
            PaidAt: now), CancellationToken.None);

        result.Outcome.Should().Be(PaymentWebhookOutcome.Rejected);
    }

    [Fact]
    public async Task ApplySubscriptionPaymentCommandHandler_SameTierRenewal_StacksOntoExistingEndDate()
    {
        using var context = CreateInMemoryDbContext();
        var handler = new ApplySubscriptionPaymentCommandHandler(context, NullLogger<ApplySubscriptionPaymentCommandHandler>.Instance);

        var tenant = await context.Tenants.FirstAsync(t => t.Id == _testTenantId);
        var now = DateTimeOffset.UtcNow;
        var existingEnd = now.AddDays(10);
        tenant.Tier = PlanTier.TindahanPro;
        tenant.SubscriptionEndDate = existingEnd;
        await context.SaveChangesAsync();

        // Tenant renews the SAME tier (TindahanPro) for 1 month
        var result = await handler.Handle(new ApplySubscriptionPaymentCommand(
            _testTenantId,
            PlanTier.TindahanPro,
            BillingCycle.Monthly,
            12_900,
            "pay_same_tier_renewal",
            "gcash",
            PaidAt: now), CancellationToken.None);

        result.Success.Should().BeTrue();

        var updatedTenant = await context.Tenants.FirstAsync(t => t.Id == _testTenantId);
        updatedTenant.Tier.Should().Be(PlanTier.TindahanPro);

        // Same-tier renewal stacks onto existingEnd
        var duration = TierPricing.GetDuration(BillingCycle.Monthly);
        var expectedEnd = existingEnd.Add(duration);
        updatedTenant.SubscriptionEndDate.Should().NotBeNull();
        updatedTenant.SubscriptionEndDate!.Value.Should().BeCloseTo(expectedEnd, TimeSpan.FromSeconds(5));
    }

    [Fact]
    public async Task ApplySubscriptionPaymentCommandHandler_DelayedWebhook_StartsAtVerifiedPaidAt()
    {
        using var context = CreateInMemoryDbContext();
        var paidAt = DateTimeOffset.UtcNow.AddDays(-5);
        var handler = new ApplySubscriptionPaymentCommandHandler(
            context, NullLogger<ApplySubscriptionPaymentCommandHandler>.Instance);

        var result = await handler.Handle(new ApplySubscriptionPaymentCommand(
            _testTenantId,
            PlanTier.TindahanPro,
            BillingCycle.Monthly,
            12_900,
            "pay_delayed_webhook",
            "qrph",
            PaidAt: paidAt), CancellationToken.None);

        result.Outcome.Should().Be(PaymentWebhookOutcome.Processed);
        result.NewEndDate.Should().Be(paidAt.AddDays(30));
    }

    [Fact]
    public async Task ApplySubscriptionPaymentCommandHandler_MissingPaidAt_DoesNotActivate()
    {
        using var context = CreateInMemoryDbContext();
        var handler = new ApplySubscriptionPaymentCommandHandler(
            context, NullLogger<ApplySubscriptionPaymentCommandHandler>.Instance);

        var result = await handler.Handle(new ApplySubscriptionPaymentCommand(
            _testTenantId,
            PlanTier.TindahanPro,
            BillingCycle.Monthly,
            12_900,
            "pay_incomplete",
            "qrph"), CancellationToken.None);

        result.Outcome.Should().Be(PaymentWebhookOutcome.Rejected);
        (await context.Tenants.FirstAsync(t => t.Id == _testTenantId)).Tier.Should().Be(PlanTier.Libre);
    }

    [Fact]
    public void TierLimits_CanonicalValues_MatchPlanRules()
    {
        TierLimits.LibreMaxProducts.Should().Be(30);
        TierLimits.LibreMaxCustomers.Should().Be(30);
        TierLimits.LibreMaxGCashTransactionsPerMonth.Should().Be(30);
        TierLimits.Unlimited.Should().Be(-1);

        TierLimits.GetMaxProducts(PlanTier.Libre).Should().Be(30);
        TierLimits.GetMaxProducts(PlanTier.TindahanPro).Should().Be(TierLimits.Unlimited);
        TierLimits.GetMaxProducts(PlanTier.NegosyoPlus).Should().Be(TierLimits.Unlimited);

        TierLimits.GetMaxCustomers(PlanTier.Libre).Should().Be(30);
        TierLimits.GetMaxCustomers(PlanTier.TindahanPro).Should().Be(TierLimits.Unlimited);
        TierLimits.GetMaxCustomers(PlanTier.NegosyoPlus).Should().Be(TierLimits.Unlimited);

        TierLimits.GetMaxGCashTransactionsPerMonth(PlanTier.Libre).Should().Be(30);
        TierLimits.GetMaxGCashTransactionsPerMonth(PlanTier.TindahanPro).Should().Be(TierLimits.Unlimited);
        TierLimits.GetMaxGCashTransactionsPerMonth(PlanTier.NegosyoPlus).Should().Be(TierLimits.Unlimited);

        TierLimits.GetMaxUsers(PlanTier.Libre).Should().Be(1);
        TierLimits.GetMaxUsers(PlanTier.TindahanPro).Should().Be(1);
        TierLimits.GetMaxUsers(PlanTier.NegosyoPlus).Should().Be(5);

        TierLimits.GetMaxDevices(PlanTier.Libre).Should().Be(1);
        TierLimits.GetMaxDevices(PlanTier.TindahanPro).Should().Be(2);
        TierLimits.GetMaxDevices(PlanTier.NegosyoPlus).Should().Be(4);

        TierLimits.CanImportCsv(PlanTier.Libre).Should().BeFalse();
        TierLimits.CanImportCsv(PlanTier.TindahanPro).Should().BeTrue();
        TierLimits.CanImportCsv(PlanTier.NegosyoPlus).Should().BeTrue();

        TierLimits.HasWatermarkedReceipts(PlanTier.Libre).Should().BeTrue();
        TierLimits.HasWatermarkedReceipts(PlanTier.TindahanPro).Should().BeFalse();
        TierLimits.HasWatermarkedReceipts(PlanTier.NegosyoPlus).Should().BeFalse();

        TierLimits.HasProfitAnalytics(PlanTier.Libre).Should().BeFalse();
        TierLimits.HasProfitAnalytics(PlanTier.TindahanPro).Should().BeTrue();
        TierLimits.HasProfitAnalytics(PlanTier.NegosyoPlus).Should().BeTrue();

        TierLimits.HasAuditLogs(PlanTier.Libre).Should().BeFalse();
        TierLimits.HasAuditLogs(PlanTier.TindahanPro).Should().BeFalse();
        TierLimits.HasAuditLogs(PlanTier.NegosyoPlus).Should().BeTrue();
    }

    [Fact]
    public void VerifyWebhookSignature_InProductionWithTestSecret_AcceptsTeSignature()
    {
        var fixedTime = DateTimeOffset.UtcNow;
        var timeProvider = new MutableTimeProvider(fixedTime);
        var secret = "whsk_test_67890";
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

        var payload = "{\"data\":{\"id\":\"evt_test_123\"}}";
        var timestamp = fixedTime.ToUnixTimeSeconds();
        var hash = ComputeHmacSha256Hex(secret, $"{timestamp}.{payload}");
        var signatureHeader = $"t={timestamp},te={hash}";

        var verified = service.VerifyWebhookSignature(payload, signatureHeader);
        verified.Should().BeTrue("test webhook signatures must be accepted in Production when configured with a test secret");
    }

    [Fact]
    public void TryParsePaidCheckoutEvent_WithMultiplePaymentAttempts_PicksPaidPayment()
    {
        var tenantId = Guid.NewGuid();
        var json = $$"""
        {
            "data": {
                "attributes": {
                    "type": "checkout_session.payment.paid",
                    "data": {
                        "attributes": {
                            "metadata": {
                                "tenant_id": "{{tenantId}}",
                                "tier": "TindahanPro",
                                "cycle": "Monthly",
                                "purpose": "subscription"
                            },
                            "payments": [
                                {
                                    "id": "pay_failed_001",
                                    "attributes": {
                                        "status": "failed",
                                        "amount": 12900,
                                        "currency": "PHP"
                                    }
                                },
                                {
                                    "id": "pay_paid_002",
                                    "attributes": {
                                        "status": "paid",
                                        "amount": 12900,
                                        "currency": "PHP",
                                        "paid_at": 1761523200,
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

        var parsed = ProcessPaymentWebhookCommandHandler.TryParsePaidCheckoutEvent(
            json, out var eventType, out var payment, out var error);

        parsed.Should().BeTrue(error);
        eventType.Should().Be("checkout_session.payment.paid");
        payment.Should().NotBeNull();
        payment!.PaymentId.Should().Be("pay_paid_002");
        payment.TenantId.Should().Be(tenantId);
        payment.Tier.Should().Be(PlanTier.TindahanPro);
        payment.AmountCentavos.Should().Be(12900L);
        payment.PaymentMethod.Should().Be("gcash");
    }

    [Fact]
    public async Task ConfirmCheckoutSessionCommandHandler_WhenSessionIsPaid_UpgradesTenantAndSetsSubscriptionEndDate()
    {
        using var context = CreateInMemoryDbContext();
        var tenant = await context.Tenants.FirstAsync(t => t.Id == _testTenantId);
        tenant.CheckoutSessionId = "cs_live_session_123";
        await context.SaveChangesAsync();

        var gatewayMock = new Mock<IPaymentGatewayService>();
        gatewayMock.Setup(g => g.RetrieveCheckoutSessionAsync("cs_live_session_123", It.IsAny<CancellationToken>()))
            .ReturnsAsync(new CheckoutSessionDetails(
                SessionId: "cs_live_session_123",
                Status: "paid",
                IsPaid: true,
                TenantId: _testTenantId,
                Tier: PlanTier.TindahanPro,
                Cycle: BillingCycle.Monthly,
                AmountCentavos: 12900L,
                PaymentId: "pay_confirmed_001",
                PaymentMethod: "gcash",
                Currency: "PHP",
                PaidAt: DateTimeOffset.UtcNow,
                Purpose: "subscription"
            ));

        var senderMock = new Mock<ISender>();
        var applyHandler = new ApplySubscriptionPaymentCommandHandler(context, NullLogger<ApplySubscriptionPaymentCommandHandler>.Instance);
        var getSubHandler = new GetTenantSubscriptionQueryHandler(context, _currentUserServiceMock.Object);

        senderMock.Setup(s => s.Send(It.IsAny<ApplySubscriptionPaymentCommand>(), It.IsAny<CancellationToken>()))
            .Returns((IRequest<WebhookProcessResultDto> cmd, CancellationToken ct) => applyHandler.Handle((ApplySubscriptionPaymentCommand)cmd, ct));

        senderMock.Setup(s => s.Send(It.IsAny<GetTenantSubscriptionQuery>(), It.IsAny<CancellationToken>()))
            .Returns((IRequest<TenantSubscriptionDto> query, CancellationToken ct) => getSubHandler.Handle((GetTenantSubscriptionQuery)query, ct));

        var handler = new ConfirmCheckoutSessionCommandHandler(
            context,
            gatewayMock.Object,
            senderMock.Object,
            NullLogger<ConfirmCheckoutSessionCommandHandler>.Instance);

        var result = await handler.Handle(new ConfirmCheckoutSessionCommand(_testTenantId), CancellationToken.None);

        result.Tier.Should().Be(PlanTier.TindahanPro);
        result.IsActive.Should().BeTrue();
        result.SubscriptionEndDate.Should().NotBeNull();
        result.SubscriptionEndDate.Should().BeAfter(DateTimeOffset.UtcNow.AddDays(25));

        // Verify in DB
        var updatedTenant = await context.Tenants.FirstAsync(t => t.Id == _testTenantId);
        updatedTenant.Tier.Should().Be(PlanTier.TindahanPro);
        updatedTenant.SubscriptionEndDate.Should().NotBeNull();
    }

    [Fact]
    public async Task ConfirmCheckoutSessionCommandHandler_IgnoresClientSuppliedSessionId_UsesOnlyOneSavedOnTenant()
    {
        using var context = CreateInMemoryDbContext();
        var tenant = await context.Tenants.FirstAsync(t => t.Id == _testTenantId);
        tenant.CheckoutSessionId = "cs_saved_on_tenant";
        await context.SaveChangesAsync();

        var gatewayMock = new Mock<IPaymentGatewayService>();
        gatewayMock.Setup(g => g.RetrieveCheckoutSessionAsync("cs_saved_on_tenant", It.IsAny<CancellationToken>()))
            .ReturnsAsync(new CheckoutSessionDetails(
                SessionId: "cs_saved_on_tenant",
                Status: "paid",
                IsPaid: true,
                TenantId: _testTenantId,
                Tier: PlanTier.TindahanPro,
                Cycle: BillingCycle.Monthly,
                AmountCentavos: 12900L,
                PaymentId: "pay_saved_001",
                PaymentMethod: "gcash",
                Currency: "PHP",
                PaidAt: DateTimeOffset.UtcNow,
                Purpose: "subscription"
            ));

        var senderMock = new Mock<ISender>();
        var applyHandler = new ApplySubscriptionPaymentCommandHandler(context, NullLogger<ApplySubscriptionPaymentCommandHandler>.Instance);
        var getSubHandler = new GetTenantSubscriptionQueryHandler(context, _currentUserServiceMock.Object);

        senderMock.Setup(s => s.Send(It.IsAny<ApplySubscriptionPaymentCommand>(), It.IsAny<CancellationToken>()))
            .Returns((IRequest<WebhookProcessResultDto> cmd, CancellationToken ct) => applyHandler.Handle((ApplySubscriptionPaymentCommand)cmd, ct));

        senderMock.Setup(s => s.Send(It.IsAny<GetTenantSubscriptionQuery>(), It.IsAny<CancellationToken>()))
            .Returns((IRequest<TenantSubscriptionDto> query, CancellationToken ct) => getSubHandler.Handle((GetTenantSubscriptionQuery)query, ct));

        var handler = new ConfirmCheckoutSessionCommandHandler(
            context,
            gatewayMock.Object,
            senderMock.Object,
            NullLogger<ConfirmCheckoutSessionCommandHandler>.Instance);

        // Client supplies an arbitrary/attacker session ID
        var result = await handler.Handle(
            new ConfirmCheckoutSessionCommand(_testTenantId, SessionId: "cs_attacker_fake_session"),
            CancellationToken.None);

        // The gateway should have been called with the tenant's saved session ID, NOT the client's
        gatewayMock.Verify(g => g.RetrieveCheckoutSessionAsync("cs_saved_on_tenant", It.IsAny<CancellationToken>()), Times.Once);
        gatewayMock.Verify(g => g.RetrieveCheckoutSessionAsync("cs_attacker_fake_session", It.IsAny<CancellationToken>()), Times.Never);

        result.Tier.Should().Be(PlanTier.TindahanPro);
    }

    [Fact]
    public async Task ConfirmCheckoutSessionCommandHandler_WhenTenantCheckoutSessionIdIsNull_IgnoresClientSessionIdAndDoesNotUpgrade()
    {
        using var context = CreateInMemoryDbContext();
        var tenant = await context.Tenants.FirstAsync(t => t.Id == _testTenantId);
        tenant.CheckoutSessionId = null;
        await context.SaveChangesAsync();

        var gatewayMock = new Mock<IPaymentGatewayService>();
        var senderMock = new Mock<ISender>();
        var getSubHandler = new GetTenantSubscriptionQueryHandler(context, _currentUserServiceMock.Object);
        senderMock.Setup(s => s.Send(It.IsAny<GetTenantSubscriptionQuery>(), It.IsAny<CancellationToken>()))
            .Returns((IRequest<TenantSubscriptionDto> query, CancellationToken ct) => getSubHandler.Handle((GetTenantSubscriptionQuery)query, ct));

        var handler = new ConfirmCheckoutSessionCommandHandler(
            context,
            gatewayMock.Object,
            senderMock.Object,
            NullLogger<ConfirmCheckoutSessionCommandHandler>.Instance);

        var result = await handler.Handle(
            new ConfirmCheckoutSessionCommand(_testTenantId, SessionId: "cs_client_supplied_but_tenant_has_none"),
            CancellationToken.None);

        gatewayMock.Verify(g => g.RetrieveCheckoutSessionAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
        senderMock.Verify(s => s.Send(It.IsAny<ApplySubscriptionPaymentCommand>(), It.IsAny<CancellationToken>()), Times.Never);
        result.Tier.Should().Be(PlanTier.Libre);
    }

    [Fact]
    public async Task ConfirmCheckoutSessionCommandHandler_WhenSessionTenantMetadataIsMissing_DoesNotUpgrade()
    {
        using var context = CreateInMemoryDbContext();
        var tenant = await context.Tenants.FirstAsync(t => t.Id == _testTenantId);
        tenant.CheckoutSessionId = "cs_missing_tenant_meta";
        await context.SaveChangesAsync();

        var gatewayMock = new Mock<IPaymentGatewayService>();
        gatewayMock.Setup(g => g.RetrieveCheckoutSessionAsync("cs_missing_tenant_meta", It.IsAny<CancellationToken>()))
            .ReturnsAsync(new CheckoutSessionDetails(
                SessionId: "cs_missing_tenant_meta",
                Status: "paid",
                IsPaid: true,
                TenantId: Guid.Empty, // Missing tenant metadata
                Tier: PlanTier.TindahanPro,
                Cycle: BillingCycle.Monthly,
                AmountCentavos: 12900L,
                PaymentId: "pay_missing_meta",
                PaymentMethod: "gcash"
            ));

        var senderMock = new Mock<ISender>();
        var getSubHandler = new GetTenantSubscriptionQueryHandler(context, _currentUserServiceMock.Object);
        senderMock.Setup(s => s.Send(It.IsAny<GetTenantSubscriptionQuery>(), It.IsAny<CancellationToken>()))
            .Returns((IRequest<TenantSubscriptionDto> query, CancellationToken ct) => getSubHandler.Handle((GetTenantSubscriptionQuery)query, ct));

        var handler = new ConfirmCheckoutSessionCommandHandler(
            context,
            gatewayMock.Object,
            senderMock.Object,
            NullLogger<ConfirmCheckoutSessionCommandHandler>.Instance);

        var result = await handler.Handle(new ConfirmCheckoutSessionCommand(_testTenantId), CancellationToken.None);

        senderMock.Verify(s => s.Send(It.IsAny<ApplySubscriptionPaymentCommand>(), It.IsAny<CancellationToken>()), Times.Never);
        result.Tier.Should().Be(PlanTier.Libre);

        var dbTenant = await context.Tenants.FirstAsync(t => t.Id == _testTenantId);
        dbTenant.Tier.Should().Be(PlanTier.Libre);
    }

    [Fact]
    public async Task ConfirmCheckoutSessionCommandHandler_WhenSessionTenantMetadataMismatchesCaller_DoesNotUpgrade()
    {
        using var context = CreateInMemoryDbContext();
        var tenant = await context.Tenants.FirstAsync(t => t.Id == _testTenantId);
        tenant.CheckoutSessionId = "cs_mismatched_tenant";
        await context.SaveChangesAsync();

        var differentTenantId = Guid.NewGuid();
        var gatewayMock = new Mock<IPaymentGatewayService>();
        gatewayMock.Setup(g => g.RetrieveCheckoutSessionAsync("cs_mismatched_tenant", It.IsAny<CancellationToken>()))
            .ReturnsAsync(new CheckoutSessionDetails(
                SessionId: "cs_mismatched_tenant",
                Status: "paid",
                IsPaid: true,
                TenantId: differentTenantId, // Mismatched tenant metadata
                Tier: PlanTier.TindahanPro,
                Cycle: BillingCycle.Monthly,
                AmountCentavos: 12900L,
                PaymentId: "pay_mismatched_meta",
                PaymentMethod: "gcash"
            ));

        var senderMock = new Mock<ISender>();
        var getSubHandler = new GetTenantSubscriptionQueryHandler(context, _currentUserServiceMock.Object);
        senderMock.Setup(s => s.Send(It.IsAny<GetTenantSubscriptionQuery>(), It.IsAny<CancellationToken>()))
            .Returns((IRequest<TenantSubscriptionDto> query, CancellationToken ct) => getSubHandler.Handle((GetTenantSubscriptionQuery)query, ct));

        var handler = new ConfirmCheckoutSessionCommandHandler(
            context,
            gatewayMock.Object,
            senderMock.Object,
            NullLogger<ConfirmCheckoutSessionCommandHandler>.Instance);

        var result = await handler.Handle(new ConfirmCheckoutSessionCommand(_testTenantId), CancellationToken.None);

        senderMock.Verify(s => s.Send(It.IsAny<ApplySubscriptionPaymentCommand>(), It.IsAny<CancellationToken>()), Times.Never);
        result.Tier.Should().Be(PlanTier.Libre);

        var dbTenant = await context.Tenants.FirstAsync(t => t.Id == _testTenantId);
        dbTenant.Tier.Should().Be(PlanTier.Libre);
    }

    [Fact]
    public async Task ConfirmCheckoutSessionCommandHandler_WhenPaidAmountDoesNotMatchPlanPrice_DoesNotUpgrade()
    {
        using var context = CreateInMemoryDbContext();
        var tenant = await context.Tenants.FirstAsync(t => t.Id == _testTenantId);
        tenant.CheckoutSessionId = "cs_underpaid";
        await context.SaveChangesAsync();

        var gatewayMock = new Mock<IPaymentGatewayService>();
        gatewayMock.Setup(g => g.RetrieveCheckoutSessionAsync("cs_underpaid", It.IsAny<CancellationToken>()))
            .ReturnsAsync(new CheckoutSessionDetails(
                SessionId: "cs_underpaid",
                Status: "paid",
                IsPaid: true,
                TenantId: _testTenantId,
                Tier: PlanTier.TindahanPro,
                Cycle: BillingCycle.Monthly,
                AmountCentavos: 1000L, // Expected 12900L for TindahanPro Monthly
                PaymentId: "pay_underpaid_001",
                PaymentMethod: "gcash"
            ));

        var senderMock = new Mock<ISender>();
        var getSubHandler = new GetTenantSubscriptionQueryHandler(context, _currentUserServiceMock.Object);
        senderMock.Setup(s => s.Send(It.IsAny<GetTenantSubscriptionQuery>(), It.IsAny<CancellationToken>()))
            .Returns((IRequest<TenantSubscriptionDto> query, CancellationToken ct) => getSubHandler.Handle((GetTenantSubscriptionQuery)query, ct));

        var handler = new ConfirmCheckoutSessionCommandHandler(
            context,
            gatewayMock.Object,
            senderMock.Object,
            NullLogger<ConfirmCheckoutSessionCommandHandler>.Instance);

        var result = await handler.Handle(new ConfirmCheckoutSessionCommand(_testTenantId), CancellationToken.None);

        senderMock.Verify(s => s.Send(It.IsAny<ApplySubscriptionPaymentCommand>(), It.IsAny<CancellationToken>()), Times.Never);
        result.Tier.Should().Be(PlanTier.Libre);

        var dbTenant = await context.Tenants.FirstAsync(t => t.Id == _testTenantId);
        dbTenant.Tier.Should().Be(PlanTier.Libre);
    }

    [Fact]
    public async Task CreateCheckoutSessionCommandHandler_WithContext_PersistsSessionIdOnTenant()
    {
        using var context = CreateInMemoryDbContext();
        var gatewayMock = new Mock<IPaymentGatewayService>();
        gatewayMock.Setup(g => g.CreateCheckoutSessionAsync(
            _testTenantId,
            PlanTier.TindahanPro,
            BillingCycle.Monthly,
            It.IsAny<CancellationToken>()))
            .ReturnsAsync(new CheckoutSessionResult(
                CheckoutUrl: "https://checkout.paymongo.com/cs_session_456",
                SessionId: "cs_session_456",
                ReferenceNumber: "ref_123",
                Amount: 129m,
                Currency: "PHP",
                Tier: PlanTier.TindahanPro,
                Cycle: BillingCycle.Monthly
            ));

        var handler = new CreateCheckoutSessionCommandHandler(
            gatewayMock.Object,
            _currentUserServiceMock.Object,
            context);

        var result = await handler.Handle(new CreateCheckoutSessionCommand(PlanTier.TindahanPro, BillingCycle.Monthly), CancellationToken.None);

        result.SessionId.Should().Be("cs_session_456");

        var tenant = await context.Tenants.FirstAsync(t => t.Id == _testTenantId);
        tenant.CheckoutSessionId.Should().Be("cs_session_456");
    }

    [Fact]
    public void TryParsePaidCheckoutEvent_WithPaymentPaidEvent_ParsesQrPhSubscriptionPayment()
    {
        var tenantId = Guid.NewGuid();
        var json = $$"""
        {
            "data": {
                "attributes": {
                    "type": "payment.paid",
                    "data": {
                        "id": "pay_qrph_789",
                        "attributes": {
                            "status": "paid",
                            "amount": 12900,
                            "currency": "PHP",
                            "paid_at": 1761523200,
                            "source": { "type": "qrph" },
                            "metadata": {
                                "tenant_id": "{{tenantId}}",
                                "target_tier": "TindahanPro",
                                "cycle": "Monthly",
                                "purpose": "subscription"
                            }
                        }
                    }
                }
            }
        }
        """;

        var parsed = ProcessPaymentWebhookCommandHandler.TryParsePaidCheckoutEvent(
            json, out var eventType, out var payment, out var error);

        parsed.Should().BeTrue(error);
        eventType.Should().Be("payment.paid");
        payment.Should().NotBeNull();
        payment!.PaymentId.Should().Be("pay_qrph_789");
        payment.TenantId.Should().Be(tenantId);
        payment.Tier.Should().Be(PlanTier.TindahanPro);
        payment.Cycle.Should().Be(BillingCycle.Monthly);
        payment.AmountCentavos.Should().Be(12900L);
        payment.PaymentMethod.Should().Be("qrph");
    }

    [Fact]
    public async Task ConfirmCheckoutSessionCommandHandler_WhenSavedIdIsQrPhPaymentIntent_VerifiesAndUpgradesTenant()
    {
        using var context = CreateInMemoryDbContext();
        var tenant = await context.Tenants.FirstAsync(t => t.Id == _testTenantId);
        tenant.CheckoutSessionId = "pi_live_qrph_123";
        await context.SaveChangesAsync();

        var gatewayMock = new Mock<IPaymentGatewayService>();
        gatewayMock.Setup(g => g.RetrievePaymentIntentStatusAsync("pi_live_qrph_123", It.IsAny<CancellationToken>()))
            .ReturnsAsync(new QrPhPaymentStatusResult(
                PaymentIntentId: "pi_live_qrph_123",
                Status: "succeeded",
                IsPaid: true,
                AmountCentavos: 12900L,
                PaymentId: "pay_qrph_confirmed_001",
                Metadata: new Dictionary<string, string>
                {
                    { "tenant_id", _testTenantId.ToString() },
                    { "target_tier", "TindahanPro" },
                    { "cycle", "Monthly" },
                    { "purpose", "subscription" }
                },
                Currency: "PHP",
                PaidAt: DateTimeOffset.UtcNow
            ));

        var senderMock = new Mock<ISender>();
        var applyHandler = new ApplySubscriptionPaymentCommandHandler(context, NullLogger<ApplySubscriptionPaymentCommandHandler>.Instance);
        var getSubHandler = new GetTenantSubscriptionQueryHandler(context, _currentUserServiceMock.Object);

        senderMock.Setup(s => s.Send(It.IsAny<ApplySubscriptionPaymentCommand>(), It.IsAny<CancellationToken>()))
            .Returns((IRequest<WebhookProcessResultDto> cmd, CancellationToken ct) => applyHandler.Handle((ApplySubscriptionPaymentCommand)cmd, ct));

        senderMock.Setup(s => s.Send(It.IsAny<GetTenantSubscriptionQuery>(), It.IsAny<CancellationToken>()))
            .Returns((IRequest<TenantSubscriptionDto> query, CancellationToken ct) => getSubHandler.Handle((GetTenantSubscriptionQuery)query, ct));

        var handler = new ConfirmCheckoutSessionCommandHandler(
            context,
            gatewayMock.Object,
            senderMock.Object,
            NullLogger<ConfirmCheckoutSessionCommandHandler>.Instance);

        var result = await handler.Handle(new ConfirmCheckoutSessionCommand(_testTenantId), CancellationToken.None);

        result.Tier.Should().Be(PlanTier.TindahanPro);
        result.IsActive.Should().BeTrue();
        var updatedTenant = await context.Tenants.FirstAsync(t => t.Id == _testTenantId);
        updatedTenant.Tier.Should().Be(PlanTier.TindahanPro);
    }

    [Fact]
    public async Task ApplySubscriptionPaymentCommandHandler_ExpiredRenewal_ExtendsFromVerifiedPaidAtBy30Days()
    {
        using var context = CreateInMemoryDbContext();
        var paidAt = new DateTimeOffset(2026, 10, 27, 12, 0, 0, TimeSpan.Zero);
        var tenant = await context.Tenants.IgnoreQueryFilters().FirstAsync(t => t.Id == _testTenantId);
        tenant.Tier = PlanTier.TindahanPro;
        tenant.SubscriptionEndDate = paidAt.AddDays(-5);
        await context.SaveChangesAsync();

        var handler = new ApplySubscriptionPaymentCommandHandler(
            context,
            NullLogger<ApplySubscriptionPaymentCommandHandler>.Instance);

        var result = await handler.Handle(new ApplySubscriptionPaymentCommand(
            _testTenantId, PlanTier.TindahanPro, BillingCycle.Monthly, 12900L, "pay_expired_renew_001", "QRPh",
            "PHP", paidAt, "subscription"), CancellationToken.None);

        result.Outcome.Should().Be(PaymentWebhookOutcome.Processed);
        result.NewEndDate.Should().Be(paidAt.AddDays(30));
    }

    [Fact]
    public async Task ApplySubscriptionPaymentCommandHandler_TwoDistinctPayments_ExtendsBy60DaysTotal()
    {
        using var context = CreateInMemoryDbContext();
        var paidAt1 = new DateTimeOffset(2026, 10, 1, 8, 0, 0, TimeSpan.Zero);
        var paidAt2 = new DateTimeOffset(2026, 10, 15, 8, 0, 0, TimeSpan.Zero);
        var handler = new ApplySubscriptionPaymentCommandHandler(
            context,
            NullLogger<ApplySubscriptionPaymentCommandHandler>.Instance);

        var first = await handler.Handle(new ApplySubscriptionPaymentCommand(
            _testTenantId, PlanTier.TindahanPro, BillingCycle.Monthly, 12900L, "pay_distinct_001", "QRPh",
            "PHP", paidAt1, "subscription"), CancellationToken.None);
        var second = await handler.Handle(new ApplySubscriptionPaymentCommand(
            _testTenantId, PlanTier.TindahanPro, BillingCycle.Monthly, 12900L, "pay_distinct_002", "QRPh",
            "PHP", paidAt2, "subscription"), CancellationToken.None);

        first.Outcome.Should().Be(PaymentWebhookOutcome.Processed);
        second.Outcome.Should().Be(PaymentWebhookOutcome.Processed);
        second.NewEndDate.Should().Be(paidAt1.AddDays(60));
        var payments = await context.PaymentHistories.IgnoreQueryFilters()
            .Where(p => p.TenantId == _testTenantId && p.Status == "Paid")
            .ToListAsync();
        payments.Should().HaveCount(2);
    }

    [Fact]
    public async Task ProcessBatchSync_AfterProExpiresWithOver30Products_AllowsSellingAndEditing_BlocksNewAndRestored_UntilRenewed()
    {
        using var context = CreateInMemoryDbContext();
        var tenant = await context.Tenants.IgnoreQueryFilters().FirstAsync(t => t.Id == _testTenantId);
        tenant.Tier = PlanTier.TindahanPro;
        tenant.SubscriptionEndDate = DateTimeOffset.UtcNow.AddMinutes(-10);

        var existingProducts = Enumerable.Range(1, 35).Select(i => new Product
        {
            Id = Guid.NewGuid(),
            TenantId = _testTenantId,
            Name = $"Existing Product {i}",
            Price = 15m,
            Cost = 10m,
            StockQty = 20,
            Category = "Pantry",
            IsDeleted = false,
            UpdatedAt = DateTimeOffset.UtcNow.AddDays(-2)
        }).ToList();

        var deletedProduct = new Product
        {
            Id = Guid.NewGuid(),
            TenantId = _testTenantId,
            Name = "Archived Product",
            Price = 20m,
            Cost = 12m,
            StockQty = 5,
            Category = "Pantry",
            IsDeleted = true,
            UpdatedAt = DateTimeOffset.UtcNow.AddDays(-2)
        };

        context.Products.AddRange(existingProducts);
        context.Products.Add(deletedProduct);
        await context.SaveChangesAsync();

        var syncHandler = new ProcessBatchSyncCommandHandler(
            context,
            _currentUserServiceMock.Object,
            NullLogger<ProcessBatchSyncCommandHandler>.Instance);

        var targetProduct = existingProducts[0];
        var saleId = Guid.NewGuid();
        var newProductId = Guid.NewGuid();

        var syncResponse = await syncHandler.Handle(new ProcessBatchSyncCommand(new BatchSyncRequestDto
        {
            DeviceId = Guid.NewGuid(),
            Operations = new List<SyncOperationDto>
            {
                new()
                {
                    SyncId = "op_edit_existing",
                    Entity = "Product",
                    Action = "Update",
                    Timestamp = DateTimeOffset.UtcNow,
                    Payload = System.Text.Json.JsonDocument.Parse(System.Text.Json.JsonSerializer.Serialize(new
                    {
                        id = targetProduct.Id,
                        name = "Edited Existing Product 1",
                        price = 18m,
                        cost = 11m,
                        stock = 19,
                        category = "Pantry",
                        isDeleted = false
                    })).RootElement
                },
                new()
                {
                    SyncId = "op_sale_existing",
                    Entity = "Sale",
                    Action = "Insert",
                    Timestamp = DateTimeOffset.UtcNow,
                    Payload = System.Text.Json.JsonDocument.Parse(System.Text.Json.JsonSerializer.Serialize(new
                    {
                        id = saleId,
                        totalAmount = 18m,
                        paymentMethod = "Cash",
                        items = new[]
                        {
                            new
                            {
                                id = Guid.NewGuid(),
                                productId = targetProduct.Id,
                                productName = "Edited Existing Product 1",
                                qty = 1,
                                unitPrice = 18m,
                                subtotal = 18m
                            }
                        }
                    })).RootElement
                },
                new()
                {
                    SyncId = "op_add_new_36",
                    Entity = "Product",
                    Action = "Insert",
                    Timestamp = DateTimeOffset.UtcNow,
                    Payload = System.Text.Json.JsonDocument.Parse(System.Text.Json.JsonSerializer.Serialize(new
                    {
                        id = newProductId,
                        name = "Blocked 36th Product",
                        price = 25m,
                        cost = 15m,
                        stock = 10,
                        category = "Pantry",
                        isDeleted = false
                    })).RootElement
                },
                new()
                {
                    SyncId = "op_restore_deleted",
                    Entity = "Product",
                    Action = "Update",
                    Timestamp = DateTimeOffset.UtcNow,
                    Payload = System.Text.Json.JsonDocument.Parse(System.Text.Json.JsonSerializer.Serialize(new
                    {
                        id = deletedProduct.Id,
                        name = "Archived Product",
                        price = 20m,
                        cost = 12m,
                        stock = 5,
                        category = "Pantry",
                        isDeleted = false
                    })).RootElement
                }
            }
        }), CancellationToken.None);

        syncResponse.Results.Single(r => r.SyncId == "op_edit_existing").Status.Should().Be("Success");
        syncResponse.Results.Single(r => r.SyncId == "op_sale_existing").Status.Should().Be("Success");
        syncResponse.Results.Single(r => r.SyncId == "op_add_new_36").Status.Should().Be("Failed");
        syncResponse.Results.Single(r => r.SyncId == "op_restore_deleted").Status.Should().Be("Failed");

        var applyHandler = new ApplySubscriptionPaymentCommandHandler(
            context,
            NullLogger<ApplySubscriptionPaymentCommandHandler>.Instance);
        await applyHandler.Handle(new ApplySubscriptionPaymentCommand(
            _testTenantId, PlanTier.TindahanPro, BillingCycle.Monthly, 12900L, "pay_renew_after_exp", "QRPh",
            "PHP", DateTimeOffset.UtcNow, "subscription"), CancellationToken.None);

        var postRenewSync = await syncHandler.Handle(new ProcessBatchSyncCommand(new BatchSyncRequestDto
        {
            DeviceId = Guid.NewGuid(),
            Operations = new List<SyncOperationDto>
            {
                new()
                {
                    SyncId = "op_add_after_renew",
                    Entity = "Product",
                    Action = "Insert",
                    Timestamp = DateTimeOffset.UtcNow,
                    Payload = System.Text.Json.JsonDocument.Parse(System.Text.Json.JsonSerializer.Serialize(new
                    {
                        id = newProductId,
                        name = "Allowed 36th Product After Renewal",
                        price = 25m,
                        cost = 15m,
                        stock = 10,
                        category = "Pantry",
                        isDeleted = false
                    })).RootElement
                }
            }
        }), CancellationToken.None);

        postRenewSync.Results.Single(r => r.SyncId == "op_add_after_renew").Status.Should().Be("Success");
    }

    [Fact]
    public async Task ApplySubscriptionPaymentCommandHandler_WithNullPurpose_UpgradesTenant()
    {
        using var context = CreateInMemoryDbContext();
        var handler = new ApplySubscriptionPaymentCommandHandler(
            context,
            NullLogger<ApplySubscriptionPaymentCommandHandler>.Instance);

        var result = await handler.Handle(new ApplySubscriptionPaymentCommand(
            _testTenantId, PlanTier.TindahanPro, BillingCycle.Monthly, 12900L, "pay_legacy_no_purpose_001", "QRPh",
            "PHP", DateTimeOffset.UtcNow, null), CancellationToken.None);

        result.Outcome.Should().Be(PaymentWebhookOutcome.Processed);
        var tenant = await context.Tenants.IgnoreQueryFilters().FirstAsync(t => t.Id == _testTenantId);
        tenant.Tier.Should().Be(PlanTier.TindahanPro);
    }

    [Fact]
    public async Task ApplySubscriptionPaymentCommandHandler_WithNonSubscriptionPurpose_Rejects()
    {
        using var context = CreateInMemoryDbContext();
        var handler = new ApplySubscriptionPaymentCommandHandler(
            context,
            NullLogger<ApplySubscriptionPaymentCommandHandler>.Instance);

        var result = await handler.Handle(new ApplySubscriptionPaymentCommand(
            _testTenantId, PlanTier.TindahanPro, BillingCycle.Monthly, 12900L, "pay_order_purpose_001", "QRPh",
            "PHP", DateTimeOffset.UtcNow, "order"), CancellationToken.None);

        result.Outcome.Should().Be(PaymentWebhookOutcome.Rejected);
        result.Message.Should().Contain("not for a subscription");
    }

    [Fact]
    public void TryParsePaidCheckoutEvent_WithoutPurposeMetadata_AcceptsAsSubscription()
    {
        var tenantId = Guid.NewGuid();
        var json = $$"""
        {
            "data": {
                "attributes": {
                    "type": "payment.paid",
                    "data": {
                        "id": "pay_qrph_no_purpose",
                        "attributes": {
                            "status": "paid",
                            "amount": 12900,
                            "currency": "PHP",
                            "paid_at": 1761523200,
                            "source": { "type": "qrph" },
                            "metadata": {
                                "tenant_id": "{{tenantId}}",
                                "target_tier": "TindahanPro",
                                "cycle": "Monthly"
                            }
                        }
                    }
                }
            }
        }
        """;

        var parsed = ProcessPaymentWebhookCommandHandler.TryParsePaidCheckoutEvent(
            json, out var eventType, out var payment, out var error);

        parsed.Should().BeTrue(error);
        eventType.Should().Be("payment.paid");
        payment.Should().NotBeNull();
        payment!.PaymentId.Should().Be("pay_qrph_no_purpose");
        payment.Purpose.Should().Be("subscription");
    }

    [Fact]
    public void TryParsePaidCheckoutEvent_WithExplicitNonSubscriptionPurpose_Rejects()
    {
        var tenantId = Guid.NewGuid();
        var json = $$"""
        {
            "data": {
                "attributes": {
                    "type": "payment.paid",
                    "data": {
                        "id": "pay_qrph_wrong_purpose",
                        "attributes": {
                            "status": "paid",
                            "amount": 12900,
                            "currency": "PHP",
                            "paid_at": 1761523200,
                            "source": { "type": "qrph" },
                            "metadata": {
                                "tenant_id": "{{tenantId}}",
                                "target_tier": "TindahanPro",
                                "cycle": "Monthly",
                                "purpose": "pos_order"
                            }
                        }
                    }
                }
            }
        }
        """;

        var parsed = ProcessPaymentWebhookCommandHandler.TryParsePaidCheckoutEvent(
            json, out _, out _, out var error);

        parsed.Should().BeFalse();
        error.Should().Be("Payment is not for a subscription.");
    }

    [Fact]
    public async Task MockPay_InDevelopment_WhenLibreUpgradePaused_ReturnsBadRequest()
    {
        using var context = CreateInMemoryDbContext();
        var mediatorMock = new Mock<IMediator>();
        var envMock = new Mock<IHostEnvironment>();
        envMock.Setup(e => e.EnvironmentName).Returns("Development");

        var controller = new BillingController(
            mediatorMock.Object,
            _currentUserServiceMock.Object,
            null!,
            envMock.Object,
            NullLogger<BillingController>.Instance,
            context);

        var response = await controller.MockPay(
            new BillingController.MockPayRequest(PlanTier.TindahanPro, BillingCycle.Monthly),
            CancellationToken.None);

        response.Result.Should().BeOfType<BadRequestObjectResult>()
            .Which.Value.Should().BeEquivalentTo(new { message = "Upgrading from Libre to Tindahan Pro is temporarily paused." });
    }

    [Fact]
    public async Task GenerateQrPhSubscription_WhenTenantIsLibreAndUpgradesPaused_ReturnsBadRequest()
    {
        using var context = CreateInMemoryDbContext();
        var gatewayMock = new Mock<IPaymentGatewayService>();
        var mediatorMock = new Mock<IMediator>();
        var envMock = new Mock<IHostEnvironment>();

        var controller = new BillingController(
            mediatorMock.Object,
            _currentUserServiceMock.Object,
            gatewayMock.Object,
            envMock.Object,
            NullLogger<BillingController>.Instance,
            context);

        var response = await controller.GenerateQrPhSubscription(
            new BillingController.CreateCheckoutRequest(PlanTier.TindahanPro, BillingCycle.Monthly),
            CancellationToken.None);

        response.Result.Should().BeOfType<BadRequestObjectResult>()
            .Which.Value.Should().BeEquivalentTo(new { message = "Upgrading from Libre to Tindahan Pro is temporarily paused." });
    }

    [Fact]
    public async Task GenerateQrPhSubscription_WhenTenantIsActiveTindahanPro_AllowsRenewal()
    {
        using var context = CreateInMemoryDbContext();
        var tenant = await context.Tenants.FirstAsync(t => t.Id == _testTenantId);
        tenant.Tier = PlanTier.TindahanPro;
        tenant.SubscriptionEndDate = DateTimeOffset.UtcNow.AddDays(10);
        await context.SaveChangesAsync();

        var gatewayMock = new Mock<IPaymentGatewayService>();
        gatewayMock.Setup(g => g.CreateQrPhPaymentIntentAsync(It.IsAny<CreateQrPhPaymentIntentRequest>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new QrPhPaymentIntentResult(
                PaymentIntentId: "pi_renew_123",
                PaymentMethodId: "pm_renew_123",
                ClientKey: "client_key",
                Status: "awaiting_next_action",
                AmountCentavos: 12900L,
                QrCodeUrl: "data:image/png;base64,mockqr",
                OrderId: "order_renew_123",
                CreatedAt: DateTimeOffset.UtcNow
            ));

        var mediatorMock = new Mock<IMediator>();
        var envMock = new Mock<IHostEnvironment>();

        var controller = new BillingController(
            mediatorMock.Object,
            _currentUserServiceMock.Object,
            gatewayMock.Object,
            envMock.Object,
            NullLogger<BillingController>.Instance,
            context);

        var response = await controller.GenerateQrPhSubscription(
            new BillingController.CreateCheckoutRequest(PlanTier.TindahanPro, BillingCycle.Monthly),
            CancellationToken.None);

        response.Result.Should().BeOfType<OkObjectResult>();
    }

    [Fact]
    public async Task CreateCheckout_WhenTenantIsLibreAndUpgradesPaused_ReturnsBadRequest()
    {
        using var context = CreateInMemoryDbContext();
        var mediatorMock = new Mock<IMediator>();
        var envMock = new Mock<IHostEnvironment>();

        var controller = new BillingController(
            mediatorMock.Object,
            _currentUserServiceMock.Object,
            null!,
            envMock.Object,
            NullLogger<BillingController>.Instance,
            context);

        var response = await controller.CreateCheckout(
            new BillingController.CreateCheckoutRequest(PlanTier.TindahanPro, BillingCycle.Monthly),
            CancellationToken.None);

        response.Result.Should().BeOfType<BadRequestObjectResult>()
            .Which.Value.Should().BeEquivalentTo(new { message = "Upgrading from Libre to Tindahan Pro is temporarily paused." });
    }

    [Fact]
    public void BillingController_AuthenticationAttributes_AreConfigured()
    {
        var controllerType = typeof(BillingController);

        // Controller must have [Authorize] attribute
        var authorizeAttr = controllerType.GetCustomAttributes(typeof(AuthorizeAttribute), inherit: true);
        authorizeAttr.Should().NotBeEmpty("BillingController must require authorization by default");

        // MockPay action must have [AllowAnonymous] attribute for development simulation
        var mockPayMethod = controllerType.GetMethod(nameof(BillingController.MockPay));
        mockPayMethod.Should().NotBeNull();
        var allowAnonAttr = mockPayMethod!.GetCustomAttributes(typeof(AllowAnonymousAttribute), inherit: false);
        allowAnonAttr.Should().NotBeEmpty("MockPay endpoint must have [AllowAnonymous] for dev simulation");
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
