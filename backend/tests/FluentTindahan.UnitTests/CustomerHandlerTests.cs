using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Moq;
using FluentTindahan.Application.Customers;
using FluentTindahan.Domain.Entities;
using FluentTindahan.Domain.Interfaces;
using FluentTindahan.Infrastructure.Persistence;
using Xunit;

namespace FluentTindahan.UnitTests;

public class CustomerHandlerTests
{
    private readonly Guid _testTenantId = Guid.Parse("22222222-2222-2222-2222-222222222222");

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
    public async Task CreateCustomer_ValidCommand_PersistsCustomerWithZeroInitialBalance()
    {
        var (context, userMock) = CreateInMemoryContext();
        var handler = new CreateCustomerCommandHandler(context, userMock.Object);

        var command = new CreateCustomerCommand("Nanay Belen", "09171239999");
        var result = await handler.Handle(command, CancellationToken.None);

        result.Should().NotBeNull();
        result.Id.Should().NotBeEmpty();
        result.TenantId.Should().Be(_testTenantId);
        result.Name.Should().Be("Nanay Belen");
        result.Phone.Should().Be("09171239999");
        result.TotalUtangBalance.Should().Be(0m);

        var saved = await context.Customers.FirstOrDefaultAsync(c => c.Id == result.Id);
        saved.Should().NotBeNull();
        saved!.Name.Should().Be("Nanay Belen");
    }

    [Theory]
    [InlineData("abc123")]
    [InlineData("12345678901")]
    public async Task CreateCustomer_InvalidPhone_RejectsWithoutPersisting(string phone)
    {
        var (context, userMock) = CreateInMemoryContext();
        var handler = new CreateCustomerCommandHandler(context, userMock.Object);

        var act = () => handler.Handle(new CreateCustomerCommand("QA Customer", phone), CancellationToken.None);

        await act.Should().ThrowAsync<ArgumentException>()
            .WithMessage("*valid Philippine mobile number*");
        (await context.Customers.CountAsync()).Should().Be(0);
    }

    [Theory]
    [InlineData("09171239999", "09171239999")]
    [InlineData("+63 917-123-9999", "09171239999")]
    [InlineData("639171239999", "09171239999")]
    [InlineData("9171239999", "09171239999")]
    public async Task CreateCustomer_ValidPhone_StoresCanonicalLocalFormat(string phone, string expectedPhone)
    {
        var (context, userMock) = CreateInMemoryContext();
        var handler = new CreateCustomerCommandHandler(context, userMock.Object);

        var result = await handler.Handle(new CreateCustomerCommand("QA Customer", phone), CancellationToken.None);

        result.Phone.Should().Be(expectedPhone);
    }

    [Fact]
    public async Task CreateCustomer_BlankPhone_IsAllowed()
    {
        var (context, userMock) = CreateInMemoryContext();
        var handler = new CreateCustomerCommandHandler(context, userMock.Object);

        var result = await handler.Handle(new CreateCustomerCommand("Customer without phone", " "), CancellationToken.None);

        result.Phone.Should().BeEmpty();
    }

    [Fact]
    public async Task GetCustomers_ReturnsCustomersOrderedByName()
    {
        var (context, _) = CreateInMemoryContext();
        context.Customers.AddRange(
            new Customer
            {
                Id = Guid.NewGuid(),
                TenantId = _testTenantId,
                Name = "Tito Boy",
                Phone = "09181112222",
                TotalUtangBalance = 150m,
                UpdatedAt = DateTimeOffset.UtcNow
            },
            new Customer
            {
                Id = Guid.NewGuid(),
                TenantId = _testTenantId,
                Name = "Aling Marites",
                Phone = "09193334444",
                TotalUtangBalance = 0m,
                UpdatedAt = DateTimeOffset.UtcNow
            }
        );
        await context.SaveChangesAsync();

        var handler = new GetCustomersQueryHandler(context);
        var result = await handler.Handle(new GetCustomersQuery(), CancellationToken.None);

        result.Should().HaveCount(2);
        result[0].Name.Should().Be("Aling Marites");
        result[1].Name.Should().Be("Tito Boy");
    }

    [Fact]
    public async Task GetCustomers_CalculatesBalanceFromUtangLedger_PreventsDoubleCountingOnRestore()
    {
        // Issue #107 regression: customer restored from server must reflect Sum(Credit) - Sum(Payment)
        var (context, _) = CreateInMemoryContext();
        var customerId = Guid.NewGuid();
        context.Customers.Add(new Customer
        {
            Id = customerId,
            TenantId = _testTenantId,
            Name = "QA-TEST Juan",
            Phone = "09171234567",
            TotalUtangBalance = 190m, // Intentionally inflated column value
            UpdatedAt = DateTimeOffset.UtcNow
        });

        // True timeline entries: Initial 100, Charge 50, Payment 60 => Balance 90
        context.UtangLedgers.AddRange(
            new UtangLedger
            {
                Id = Guid.NewGuid(),
                TenantId = _testTenantId,
                CustomerId = customerId,
                Amount = 100m,
                Type = "Credit",
                Date = DateTimeOffset.UtcNow.AddMinutes(-30)
            },
            new UtangLedger
            {
                Id = Guid.NewGuid(),
                TenantId = _testTenantId,
                CustomerId = customerId,
                Amount = 50m,
                Type = "Credit",
                Date = DateTimeOffset.UtcNow.AddMinutes(-20)
            },
            new UtangLedger
            {
                Id = Guid.NewGuid(),
                TenantId = _testTenantId,
                CustomerId = customerId,
                Amount = 60m,
                Type = "Payment",
                Date = DateTimeOffset.UtcNow.AddMinutes(-10)
            }
        );
        await context.SaveChangesAsync();

        var handler = new GetCustomersQueryHandler(context);
        var result = await handler.Handle(new GetCustomersQuery(), CancellationToken.None);

        result.Should().ContainSingle(c => c.Id == customerId);
        result.Single(c => c.Id == customerId).TotalUtangBalance.Should().Be(90m);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData(null)]
    public async Task CreateCustomer_EmptyName_ThrowsArgumentException(string? name)
    {
        var (context, userMock) = CreateInMemoryContext();
        var handler = new CreateCustomerCommandHandler(context, userMock.Object);

        var act = () => handler.Handle(new CreateCustomerCommand(name!, "09171234567"), CancellationToken.None);
        await act.Should().ThrowAsync<ArgumentException>()
            .WithMessage("*Customer name must be between 1 and 100 characters*");
    }

    [Fact]
    public async Task CreateCustomer_WhenLibreLimitExceeded_ThrowsInvalidOperationException()
    {
        var (context, userMock) = CreateInMemoryContext();
        for (int i = 0; i < 30; i++)
        {
            context.Customers.Add(new Customer
            {
                Id = Guid.NewGuid(),
                TenantId = _testTenantId,
                Name = $"Customer {i}",
                Phone = $"0917123{i:D4}",
                UpdatedAt = DateTimeOffset.UtcNow
            });
        }
        await context.SaveChangesAsync();

        var handler = new CreateCustomerCommandHandler(context, userMock.Object);
        var command = new CreateCustomerCommand("Extra Customer", "09181234567");

        var act = () => handler.Handle(command, CancellationToken.None);
        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*Libre plan limit exceeded*");
    }
}
