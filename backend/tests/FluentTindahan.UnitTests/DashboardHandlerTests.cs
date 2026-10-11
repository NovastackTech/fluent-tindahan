using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Moq;
using FluentTindahan.Application.Dashboard;
using FluentTindahan.Domain.Entities;
using FluentTindahan.Domain.Interfaces;
using FluentTindahan.Infrastructure.Persistence;
using Xunit;

namespace FluentTindahan.UnitTests;

public class DashboardHandlerTests
{
    private readonly Guid _testTenantId = Guid.Parse("77777777-7777-7777-7777-777777777777");

    private (AppDbContext Context, Mock<ICurrentUserService> UserMock) CreateInMemoryContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;

        var userMock = new Mock<ICurrentUserService>();
        userMock.Setup(u => u.TenantId).Returns(_testTenantId);
        userMock.Setup(u => u.UserId).Returns(Guid.NewGuid());

        var context = new AppDbContext(options, userMock.Object);
        return (context, userMock);
    }

    [Fact]
    public async Task GetDashboardSummary_CalculatesAccurateAggregations()
    {
        var (context, _) = CreateInMemoryContext();
        var now = DateTimeOffset.UtcNow;
        var yesterday = now.AddDays(-1);

        // Sales: 2 today, 1 yesterday
        context.Sales.AddRange(
            new Sale { Id = Guid.NewGuid(), TenantId = _testTenantId, TotalAmount = 120m, PaymentMethod = "Cash", Date = now },
            new Sale { Id = Guid.NewGuid(), TenantId = _testTenantId, TotalAmount = 80m, PaymentMethod = "GCash", Date = now },
            new Sale { Id = Guid.NewGuid(), TenantId = _testTenantId, TotalAmount = 500m, PaymentMethod = "Cash", Date = yesterday }
        );

        // Debtors: 1 with debt, 1 with zero debt
        context.Customers.AddRange(
            new Customer { Id = Guid.NewGuid(), TenantId = _testTenantId, Name = "Debtor 1", Phone = "091", TotalUtangBalance = 350m, UpdatedAt = now },
            new Customer { Id = Guid.NewGuid(), TenantId = _testTenantId, Name = "Good Payer", Phone = "092", TotalUtangBalance = 0m, UpdatedAt = now }
        );

        // GCash: 1 today
        context.GCashTransactions.Add(
            new GCashTxn { Id = Guid.NewGuid(), TenantId = _testTenantId, Type = "CashIn", Amount = 1000m, Fee = 15m, RefNo = "R1", Date = now }
        );

        // Products: 1 in-stock, 1 low-stock (<= 5)
        context.Products.AddRange(
            new Product { Id = Guid.NewGuid(), TenantId = _testTenantId, Name = "Coke 1.5L", Price = 75m, Cost = 60m, StockQty = 20, UpdatedAt = now },
            new Product { Id = Guid.NewGuid(), TenantId = _testTenantId, Name = "Lucky Me Beef", Price = 15m, Cost = 12m, StockQty = 3, UpdatedAt = now }
        );

        await context.SaveChangesAsync();

        var handler = new GetDashboardSummaryQueryHandler(context);
        var summary = await handler.Handle(new GetDashboardSummaryQuery(), CancellationToken.None);

        summary.Should().NotBeNull();
        summary.TodaySales.Should().Be(200m); // 120 + 80
        summary.TodaySalesCount.Should().Be(2);
        summary.TotalUtangOutstanding.Should().Be(350m);
        summary.DebtorsCount.Should().Be(1);
        summary.TodayGCashVolume.Should().Be(1000m);
        summary.TodayGCashFees.Should().Be(15m);
        summary.TotalProductsCount.Should().Be(2);
        summary.LowStockProductsCount.Should().Be(1);
    }

    [Fact]
    public async Task GetDashboardSummary_SoftDeletedCustomerWithUtang_IncludesInTotalUtangOutstanding()
    {
        var (context, userMock) = CreateInMemoryContext();
        var now = DateTimeOffset.UtcNow;

        // Active debtor
        context.Customers.Add(new Customer
        {
            Id = Guid.NewGuid(),
            TenantId = _testTenantId,
            Name = "Active Debtor",
            Phone = "09181112222",
            TotalUtangBalance = 150m,
            IsDeleted = false,
            UpdatedAt = now
        });

        // Soft-deleted debtor with remaining balance
        context.Customers.Add(new Customer
        {
            Id = Guid.NewGuid(),
            TenantId = _testTenantId,
            Name = "Soft-Deleted Debtor",
            Phone = "09183334444",
            TotalUtangBalance = 200m,
            IsDeleted = true,
            UpdatedAt = now
        });

        await context.SaveChangesAsync();

        var handler = new GetDashboardSummaryQueryHandler(context, userMock.Object);
        var summary = await handler.Handle(new GetDashboardSummaryQuery(), CancellationToken.None);

        summary.Should().NotBeNull();
        // Total utang outstanding must include both active and soft-deleted debtors (150 + 200 = 350)
        summary.TotalUtangOutstanding.Should().Be(350m);
        summary.DebtorsCount.Should().Be(2);
    }
}
