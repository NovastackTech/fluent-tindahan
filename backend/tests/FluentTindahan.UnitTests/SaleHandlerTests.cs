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

    [Fact]
    public async Task GetSales_RespectsLimitQuery()
    {
        var (context, _) = CreateInMemoryContext();
        var now = DateTimeOffset.UtcNow;
        for (int i = 0; i < 5; i++)
        {
            context.Sales.Add(new Sale
            {
                Id = Guid.NewGuid(),
                TenantId = _testTenantId,
                TotalAmount = 10m * (i + 1),
                PaymentMethod = "Cash",
                Date = now.AddMinutes(i),
                UserId = _testUserId
            });
        }
        await context.SaveChangesAsync();

        var handler = new GetSalesQueryHandler(context);
        var result = await handler.Handle(new GetSalesQuery(2), CancellationToken.None);

        result.Should().HaveCount(2);
        result[0].TotalAmount.Should().Be(50m);
        result[1].TotalAmount.Should().Be(40m);
    }

    [Fact]
    public async Task GetSales_RespectsBeforeQuery()
    {
        var (context, _) = CreateInMemoryContext();
        var now = DateTimeOffset.UtcNow;
        for (int i = 0; i < 5; i++)
        {
            context.Sales.Add(new Sale
            {
                Id = Guid.NewGuid(),
                TenantId = _testTenantId,
                TotalAmount = 10m * (i + 1),
                PaymentMethod = "Cash",
                Date = now.AddMinutes(i),
                UserId = _testUserId
            });
        }
        await context.SaveChangesAsync();

        var handler = new GetSalesQueryHandler(context);
        // Before 3 minutes after now => selects minutes 2, 1, 0 (descending)
        var result = await handler.Handle(new GetSalesQuery(10, now.AddMinutes(3)), CancellationToken.None);

        result.Should().HaveCount(3);
        result[0].TotalAmount.Should().Be(30m);
        result[1].TotalAmount.Should().Be(20m);
        result[2].TotalAmount.Should().Be(10m);
    }

    [Fact]
    public async Task GetSales_RespectsCompoundBeforeAndBeforeIdQuery()
    {
        var (context, _) = CreateInMemoryContext();
        var now = DateTimeOffset.UtcNow;
        var id1 = Guid.Parse("00000000-0000-0000-0000-000000000001");
        var id2 = Guid.Parse("00000000-0000-0000-0000-000000000002");
        var id3 = Guid.Parse("00000000-0000-0000-0000-000000000003");

        context.Sales.AddRange(
            new Sale { Id = id1, TenantId = _testTenantId, TotalAmount = 10m, PaymentMethod = "Cash", Date = now, UserId = _testUserId },
            new Sale { Id = id2, TenantId = _testTenantId, TotalAmount = 20m, PaymentMethod = "Cash", Date = now, UserId = _testUserId },
            new Sale { Id = id3, TenantId = _testTenantId, TotalAmount = 30m, PaymentMethod = "Cash", Date = now, UserId = _testUserId }
        );
        await context.SaveChangesAsync();

        var handler = new GetSalesQueryHandler(context);
        var result = await handler.Handle(new GetSalesQuery(10, now, id3), CancellationToken.None);

        result.Should().HaveCount(2);
        result[0].Id.Should().Be(id2);
        result[1].Id.Should().Be(id1);
    }

    [Fact]
    public async Task CreateSale_NegativeTotalAmountOrInvalidItems_ThrowsArgumentException()
    {
        var (context, userMock) = CreateInMemoryContext();
        var handler = new CreateSaleCommandHandler(context, userMock.Object);

        // Negative total
        var negTotalCommand = new CreateSaleCommand(-10m, "Cash", new List<CreateSaleItemInput>
        {
            new CreateSaleItemInput(Guid.NewGuid(), 1, 10m)
        });
        var act1 = () => handler.Handle(negTotalCommand, CancellationToken.None);
        await act1.Should().ThrowAsync<ArgumentException>()
            .WithMessage("*Total amount cannot be negative*");

        // Negative or zero quantity
        var zeroQtyCommand = new CreateSaleCommand(10m, "Cash", new List<CreateSaleItemInput>
        {
            new CreateSaleItemInput(Guid.NewGuid(), 0, 10m)
        });
        var act2 = () => handler.Handle(zeroQtyCommand, CancellationToken.None);
        await act2.Should().ThrowAsync<ArgumentException>()
            .WithMessage("*Item quantity must be greater than zero*");

        // Negative unit price
        var negPriceCommand = new CreateSaleCommand(10m, "Cash", new List<CreateSaleItemInput>
        {
            new CreateSaleItemInput(Guid.NewGuid(), 1, -5m)
        });
        var act3 = () => handler.Handle(negPriceCommand, CancellationToken.None);
        await act3.Should().ThrowAsync<ArgumentException>()
            .WithMessage("*Item unit price cannot be negative*");

        // Null items list
        var nullItemsCommand = new CreateSaleCommand(10m, "Cash", null!);
        var act4 = () => handler.Handle(nullItemsCommand, CancellationToken.None);
        await act4.Should().ThrowAsync<ArgumentException>()
            .WithMessage("*Items list cannot be null*");

        // Null sale item in list
        var nullItemInListCommand = new CreateSaleCommand(10m, "Cash", new List<CreateSaleItemInput> { null! });
        var act5 = () => handler.Handle(nullItemInListCommand, CancellationToken.None);
        await act5.Should().ThrowAsync<ArgumentException>()
            .WithMessage("*Sale item cannot be null*");

        // Null or whitespace payment method
        var emptyPaymentMethodCommand = new CreateSaleCommand(10m, "   ", new List<CreateSaleItemInput>
        {
            new CreateSaleItemInput(Guid.NewGuid(), 1, 10m)
        });
        var act6 = () => handler.Handle(emptyPaymentMethodCommand, CancellationToken.None);
        await act6.Should().ThrowAsync<ArgumentException>()
            .WithMessage("*Payment method is required*");

        // Negative explicit item subtotal
        var negSubtotalCommand = new CreateSaleCommand(10m, "Cash", new List<CreateSaleItemInput>
        {
            new CreateSaleItemInput(Guid.NewGuid(), 1, 10m, -50m)
        });
        var act7 = () => handler.Handle(negSubtotalCommand, CancellationToken.None);
        await act7.Should().ThrowAsync<ArgumentException>()
            .WithMessage("*Item subtotal cannot be negative*");
    }
}
