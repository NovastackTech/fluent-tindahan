using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Moq;
using FluentTindahan.Application.Utang;
using FluentTindahan.Domain.Entities;
using FluentTindahan.Domain.Interfaces;
using FluentTindahan.Infrastructure.Persistence;
using Xunit;

namespace FluentTindahan.UnitTests;

public class UtangHandlerTests
{
    private readonly Guid _testTenantId = Guid.Parse("55555555-5555-5555-5555-555555555555");

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
    public async Task RecordUtang_Credit_IncreasesCustomerBalance()
    {
        var (context, userMock) = CreateInMemoryContext();
        var handler = new RecordUtangCommandHandler(context, userMock.Object);

        var custId = Guid.NewGuid();
        context.Customers.Add(new Customer
        {
            Id = custId,
            TenantId = _testTenantId,
            Name = "Mang Kanor",
            Phone = "09187778899",
            TotalUtangBalance = 100m,
            UpdatedAt = DateTimeOffset.UtcNow
        });
        await context.SaveChangesAsync();

        var command = new RecordUtangCommand(
            CustomerId: custId,
            Amount: 50m,
            Type: "Credit",
            Notes: "Bigas 2kg"
        );

        var result = await handler.Handle(command, CancellationToken.None);

        result.Should().NotBeNull();
        result.Amount.Should().Be(50m);
        result.Type.Should().Be("Credit");

        var customer = await context.Customers.FindAsync(custId);
        customer!.TotalUtangBalance.Should().Be(150m);
    }

    [Fact]
    public async Task RecordUtang_Payment_DecreasesCustomerBalance()
    {
        var (context, userMock) = CreateInMemoryContext();
        var handler = new RecordUtangCommandHandler(context, userMock.Object);

        var custId = Guid.NewGuid();
        context.Customers.Add(new Customer
        {
            Id = custId,
            TenantId = _testTenantId,
            Name = "Mang Kanor",
            Phone = "09187778899",
            TotalUtangBalance = 200m,
            UpdatedAt = DateTimeOffset.UtcNow
        });
        await context.SaveChangesAsync();

        var command = new RecordUtangCommand(
            CustomerId: custId,
            Amount: 80m,
            Type: "Payment",
            Notes: "Bayad sahod"
        );

        var result = await handler.Handle(command, CancellationToken.None);

        result.Amount.Should().Be(80m);
        result.Type.Should().Be("Payment");

        var customer = await context.Customers.FindAsync(custId);
        customer!.TotalUtangBalance.Should().Be(120m);
    }

    [Fact]
    public async Task GetUtangLedger_FilterByCustomerId_ReturnsOnlyTargetCustomerEntries()
    {
        var (context, _) = CreateInMemoryContext();
        var custId1 = Guid.NewGuid();
        var custId2 = Guid.NewGuid();

        var cust1 = new Customer
        {
            Id = custId1,
            TenantId = _testTenantId,
            Name = "Suki Juan",
            Phone = "09181112222",
            TotalUtangBalance = 100m,
            UpdatedAt = DateTimeOffset.UtcNow
        };
        var cust2 = new Customer
        {
            Id = custId2,
            TenantId = _testTenantId,
            Name = "Suki Maria",
            Phone = "09183334444",
            TotalUtangBalance = 200m,
            UpdatedAt = DateTimeOffset.UtcNow
        };
        context.Customers.AddRange(cust1, cust2);

        context.UtangLedgers.AddRange(
            new UtangLedger
            {
                Id = Guid.NewGuid(),
                TenantId = _testTenantId,
                CustomerId = custId1,
                Amount = 100m,
                Type = "Credit",
                Date = DateTimeOffset.UtcNow.AddDays(-1)
            },
            new UtangLedger
            {
                Id = Guid.NewGuid(),
                TenantId = _testTenantId,
                CustomerId = custId2,
                Amount = 200m,
                Type = "Credit",
                Date = DateTimeOffset.UtcNow
            }
        );
        await context.SaveChangesAsync();

        var handler = new GetUtangLedgerQueryHandler(context);
        var resultCust1 = await handler.Handle(new GetUtangLedgerQuery(custId1), CancellationToken.None);
        var resultAll = await handler.Handle(new GetUtangLedgerQuery(null), CancellationToken.None);

        resultCust1.Should().HaveCount(1);
        resultCust1[0].CustomerId.Should().Be(custId1);
        resultAll.Should().HaveCount(2);
    }
}
