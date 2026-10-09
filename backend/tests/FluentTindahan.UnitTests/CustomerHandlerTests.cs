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
}
