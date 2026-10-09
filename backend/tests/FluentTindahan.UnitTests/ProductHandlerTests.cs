using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Moq;
using FluentTindahan.Application.Products;
using FluentTindahan.Domain.Entities;
using FluentTindahan.Domain.Interfaces;
using FluentTindahan.Infrastructure.Persistence;
using Xunit;

namespace FluentTindahan.UnitTests;

public class ProductHandlerTests
{
    private readonly Guid _testTenantId = Guid.Parse("11111111-1111-1111-1111-111111111111");

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
    public async Task CreateProduct_ValidCommand_PersistsAndReturnsDto()
    {
        var (context, userMock) = CreateInMemoryContext();
        var handler = new CreateProductCommandHandler(context, userMock.Object);

        var command = new CreateProductCommand(
            Name: "Kopiko Blanca 30g",
            Price: 12.00m,
            Cost: 9.50m,
            Barcode: "4801234567890",
            Category: "Beverages",
            StockQty: 50
        );

        var result = await handler.Handle(command, CancellationToken.None);

        result.Should().NotBeNull();
        result.Id.Should().NotBeEmpty();
        result.TenantId.Should().Be(_testTenantId);
        result.Name.Should().Be("Kopiko Blanca 30g");
        result.Price.Should().Be(12.00m);
        result.Cost.Should().Be(9.50m);
        result.Barcode.Should().Be("4801234567890");
        result.Category.Should().Be("Beverages");
        result.StockQty.Should().Be(50);

        var savedProduct = await context.Products.FirstOrDefaultAsync(p => p.Id == result.Id);
        savedProduct.Should().NotBeNull();
        savedProduct!.Price.Should().Be(12.00m);
    }

    [Fact]
    public async Task GetProducts_ReturnsProductsSortedByName()
    {
        var (context, _) = CreateInMemoryContext();
        context.Products.AddRange(
            new Product
            {
                Id = Guid.NewGuid(),
                TenantId = _testTenantId,
                Name = "Zebra Candy",
                Price = 2.00m,
                Cost = 1.00m,
                StockQty = 100,
                UpdatedAt = DateTimeOffset.UtcNow
            },
            new Product
            {
                Id = Guid.NewGuid(),
                TenantId = _testTenantId,
                Name = "Apple Juice",
                Price = 15.00m,
                Cost = 10.00m,
                StockQty = 20,
                UpdatedAt = DateTimeOffset.UtcNow
            }
        );
        await context.SaveChangesAsync();

        var handler = new GetProductsQueryHandler(context);
        var result = await handler.Handle(new GetProductsQuery(), CancellationToken.None);

        result.Should().HaveCount(2);
        result[0].Name.Should().Be("Apple Juice");
        result[1].Name.Should().Be("Zebra Candy");
    }
}
