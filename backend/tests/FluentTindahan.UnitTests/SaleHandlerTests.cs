using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Moq;
using FluentTindahan.Application.Sales;
using FluentTindahan.Domain.Entities;
using FluentTindahan.Domain.Interfaces;
using FluentTindahan.Infrastructure.Persistence;
using Xunit;

namespace FluentTindahan.UnitTests;

public class SaleHandlerTests
{
    private readonly Guid _testTenantId = Guid.Parse("33333333-3333-3333-3333-333333333333");
    private readonly Guid _testUserId = Guid.Parse("44444444-4444-4444-4444-444444444444");

    private (AppDbContext Context, Mock<ICurrentUserService> UserMock) CreateInMemoryContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;

        var userMock = new Mock<ICurrentUserService>();
        userMock.Setup(u => u.TenantId).Returns(_testTenantId);
        userMock.Setup(u => u.UserId).Returns(_testUserId);

        var context = new AppDbContext(options, userMock.Object);
        return (context, userMock);
    }

    [Fact]
    public async Task CreateSale_CashSale_PersistsSaleAndItems()
    {
        var (context, userMock) = CreateInMemoryContext();
        var handler = new CreateSaleCommandHandler(context, userMock.Object);

        var prodId = Guid.NewGuid();
        context.Products.Add(new Product
        {
            Id = prodId,
            TenantId = _testTenantId,
            Name = "Safeguard White 60g",
            Price = 25m,
            Cost = 19m,
            StockQty = 10,
            UpdatedAt = DateTimeOffset.UtcNow
        });
        await context.SaveChangesAsync();

        var command = new CreateSaleCommand(
            TotalAmount: 50m,
            PaymentMethod: "Cash",
            Items: new List<CreateSaleItemInput>
            {
                new CreateSaleItemInput(prodId, 2, 25m)
            },
            CashReceived: 100m,
            ChangeGiven: 50m
        );

        var result = await handler.Handle(command, CancellationToken.None);

        result.Should().NotBeNull();
        result.TotalAmount.Should().Be(50m);
        result.PaymentMethod.Should().Be("Cash");
        result.CashReceived.Should().Be(100m);
        result.ChangeGiven.Should().Be(50m);
        result.Items.Should().HaveCount(1);
        result.Items[0].Subtotal.Should().Be(50m);

        var savedSale = await context.Sales.Include(s => s.Items).FirstOrDefaultAsync(s => s.Id == result.Id);
        savedSale.Should().NotBeNull();
        savedSale!.Items.Should().HaveCount(1);
    }

    [Fact]
    public async Task CreateSale_UtangSale_CreatesUtangLedgerAndIncreasesCustomerBalance()
    {
        var (context, userMock) = CreateInMemoryContext();
        var handler = new CreateSaleCommandHandler(context, userMock.Object);

        var custId = Guid.NewGuid();
        context.Customers.Add(new Customer
        {
            Id = custId,
            TenantId = _testTenantId,
            Name = "Aling Tessie",
            Phone = "09170001122",
            TotalUtangBalance = 100m,
            UpdatedAt = DateTimeOffset.UtcNow
        });
        await context.SaveChangesAsync();

        var command = new CreateSaleCommand(
            TotalAmount: 150m,
            PaymentMethod: "Utang",
            Items: new List<CreateSaleItemInput>
            {
                new CreateSaleItemInput(Guid.NewGuid(), 3, 50m, 150m)
            },
            CustomerId: custId
        );

        var result = await handler.Handle(command, CancellationToken.None);

        result.Should().NotBeNull();

        // Customer balance should have increased by 150 -> 250
        var updatedCust = await context.Customers.FindAsync(custId);
        updatedCust!.TotalUtangBalance.Should().Be(250m);

        // UtangLedger entry should exist
        var ledgerEntry = await context.UtangLedgers.FirstOrDefaultAsync(u => u.RefSaleId == result.Id);
        ledgerEntry.Should().NotBeNull();
        ledgerEntry!.Amount.Should().Be(150m);
        ledgerEntry.Type.Should().Be("Credit");
    }

    [Fact]
    public async Task GetSales_ReturnsSalesSortedByDateDescending()
    {
        var (context, _) = CreateInMemoryContext();
        var earlier = DateTimeOffset.UtcNow.AddHours(-2);
        var later = DateTimeOffset.UtcNow;

        context.Sales.AddRange(
            new Sale
            {
                Id = Guid.NewGuid(),
                TenantId = _testTenantId,
                TotalAmount = 30m,
                PaymentMethod = "Cash",
                Date = earlier,
                UserId = _testUserId
            },
            new Sale
            {
                Id = Guid.NewGuid(),
                TenantId = _testTenantId,
                TotalAmount = 80m,
                PaymentMethod = "GCash",
                Date = later,
                UserId = _testUserId
            }
        );
        await context.SaveChangesAsync();

        var handler = new GetSalesQueryHandler(context);
        var result = await handler.Handle(new GetSalesQuery(), CancellationToken.None);

        result.Should().HaveCount(2);
        result[0].TotalAmount.Should().Be(80m); // Most recent first
        result[1].TotalAmount.Should().Be(30m);
    }
}
