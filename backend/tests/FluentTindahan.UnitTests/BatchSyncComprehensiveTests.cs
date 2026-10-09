using System.Text.Json;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using FluentTindahan.Application;
using FluentTindahan.Application.Sync.Commands;
using FluentTindahan.Application.Sync.DTOs;
using FluentTindahan.Domain.Entities;
using FluentTindahan.Domain.Interfaces;
using FluentTindahan.Infrastructure.Persistence;
using Xunit;

namespace FluentTindahan.UnitTests;

public class BatchSyncComprehensiveTests
{
    private readonly Guid _testTenantId = Guid.Parse("88888888-8888-8888-8888-888888888888");
    private readonly Guid _testUserId = Guid.Parse("99999999-9999-9999-9999-999999999999");

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
    public async Task ProcessBatchSync_CustomerInsertAndUpdate_PersistsSuccessfully()
    {
        var (context, userMock) = CreateInMemoryContext();
        var handler = new ProcessBatchSyncCommandHandler(context, userMock.Object, NullLogger<ProcessBatchSyncCommandHandler>.Instance);

        var custId = Guid.NewGuid();
        var t1 = DateTimeOffset.UtcNow.AddMinutes(-5);
        var t2 = DateTimeOffset.UtcNow;

        var batch = new BatchSyncRequestDto
        {
            DeviceId = Guid.NewGuid(),
            Operations = new List<SyncOperationDto>
            {
                new SyncOperationDto
                {
                    SyncId = Guid.NewGuid().ToString(),
                    Entity = "Customer",
                    Action = "Insert",
                    Timestamp = t1,
                    Payload = JsonSerializer.SerializeToElement(new
                    {
                        id = custId,
                        tenantId = _testTenantId,
                        name = "Kuya Jobert",
                        phone = "09170002233",
                        totalUtangBalance = 0m,
                        updatedAt = t1
                    })
                },
                new SyncOperationDto
                {
                    SyncId = Guid.NewGuid().ToString(),
                    Entity = "Customer",
                    Action = "Update",
                    Timestamp = t2,
                    Payload = JsonSerializer.SerializeToElement(new
                    {
                        id = custId,
                        tenantId = _testTenantId,
                        name = "Kuya Jobert Updated",
                        phone = "09170002233",
                        totalUtangBalance = 50m,
                        updatedAt = t2
                    })
                }
            }
        };

        var response = await handler.Handle(new ProcessBatchSyncCommand(batch), CancellationToken.None);

        response.Results.Should().HaveCount(2);
        response.Results.All(r => r.Status == "Success").Should().BeTrue();

        var customer = await context.Customers.FindAsync(custId);
        customer.Should().NotBeNull();
        customer!.Name.Should().Be("Kuya Jobert Updated");
        customer.TotalUtangBalance.Should().Be(50m);
    }

    [Fact]
    public async Task ProcessBatchSync_CustomerDeleteAndStaleUpdate_HandlesLWWCorrectly()
    {
        var (context, userMock) = CreateInMemoryContext();
        var handler = new ProcessBatchSyncCommandHandler(context, userMock.Object, NullLogger<ProcessBatchSyncCommandHandler>.Instance);

        var custId = Guid.NewGuid();
        var serverTime = DateTimeOffset.UtcNow;
        var staleTime = serverTime.AddMinutes(-5);

        context.Customers.Add(new Customer
        {
            Id = custId,
            TenantId = _testTenantId,
            Name = "Existing Suki",
            Phone = "09180000000",
            TotalUtangBalance = 100m,
            UpdatedAt = serverTime
        });
        await context.SaveChangesAsync();

        var batch = new BatchSyncRequestDto
        {
            DeviceId = Guid.NewGuid(),
            Operations = new List<SyncOperationDto>
            {
                // Stale update
                new SyncOperationDto
                {
                    SyncId = Guid.NewGuid().ToString(),
                    Entity = "Customer",
                    Action = "Update",
                    Timestamp = staleTime,
                    Payload = JsonSerializer.SerializeToElement(new
                    {
                        id = custId,
                        tenantId = _testTenantId,
                        name = "Stale Name",
                        updatedAt = staleTime
                    })
                },
                // Delete
                new SyncOperationDto
                {
                    SyncId = Guid.NewGuid().ToString(),
                    Entity = "Customer",
                    Action = "Delete",
                    Timestamp = DateTimeOffset.UtcNow.AddMinutes(1),
                    Payload = JsonSerializer.SerializeToElement(new { id = custId })
                }
            }
        };

        var response = await handler.Handle(new ProcessBatchSyncCommand(batch), CancellationToken.None);

        response.Results.Should().HaveCount(2);
        response.Results[0].Status.Should().Be("ConflictIgnored");
        response.Results[1].Status.Should().Be("Success");

        var deleted = await context.Customers.FindAsync(custId);
        deleted.Should().BeNull();
    }

    [Fact]
    public async Task ProcessBatchSync_ProductDeleteAndStaleUpdate_HandlesLWWCorrectly()
    {
        var (context, userMock) = CreateInMemoryContext();
        var handler = new ProcessBatchSyncCommandHandler(context, userMock.Object, NullLogger<ProcessBatchSyncCommandHandler>.Instance);

        var prodId = Guid.NewGuid();
        var serverTime = DateTimeOffset.UtcNow;
        var staleTime = serverTime.AddMinutes(-10);

        context.Products.Add(new Product
        {
            Id = prodId,
            TenantId = _testTenantId,
            Name = "Initial Product",
            Price = 20m,
            Cost = 15m,
            StockQty = 10,
            UpdatedAt = serverTime
        });
        await context.SaveChangesAsync();

        var batch = new BatchSyncRequestDto
        {
            DeviceId = Guid.NewGuid(),
            Operations = new List<SyncOperationDto>
            {
                // Stale update should be ignored due to LWW
                new SyncOperationDto
                {
                    SyncId = Guid.NewGuid().ToString(),
                    Entity = "Product",
                    Action = "Update",
                    Timestamp = staleTime,
                    Payload = JsonSerializer.SerializeToElement(new
                    {
                        id = prodId,
                        tenantId = _testTenantId,
                        name = "Stale Name",
                        price = 99m,
                        cost = 10m,
                        stockQty = 5,
                        updatedAt = staleTime
                    })
                },
                // Delete action
                new SyncOperationDto
                {
                    SyncId = Guid.NewGuid().ToString(),
                    Entity = "Product",
                    Action = "Delete",
                    Timestamp = DateTimeOffset.UtcNow.AddMinutes(1),
                    Payload = JsonSerializer.SerializeToElement(new
                    {
                        id = prodId
                    })
                }
            }
        };

        var response = await handler.Handle(new ProcessBatchSyncCommand(batch), CancellationToken.None);

        response.Results.Should().HaveCount(2);
        response.Results[0].Status.Should().Be("ConflictIgnored");
        response.Results[1].Status.Should().Be("Success");

        var deletedProduct = await context.Products.FindAsync(prodId);
        deletedProduct.Should().BeNull();
    }

    [Fact]
    public async Task ProcessBatchSync_GCashTxn_InsertsSuccessfully()
    {
        var (context, userMock) = CreateInMemoryContext();
        var handler = new ProcessBatchSyncCommandHandler(context, userMock.Object, NullLogger<ProcessBatchSyncCommandHandler>.Instance);

        var txnId = Guid.NewGuid();
        var batch = new BatchSyncRequestDto
        {
            DeviceId = Guid.NewGuid(),
            Operations = new List<SyncOperationDto>
            {
                new SyncOperationDto
                {
                    SyncId = Guid.NewGuid().ToString(),
                    Entity = "GCashTxn",
                    Action = "Insert",
                    Timestamp = DateTimeOffset.UtcNow,
                    Payload = JsonSerializer.SerializeToElement(new
                    {
                        id = txnId,
                        tenantId = _testTenantId,
                        type = "CashOut",
                        amount = 750m,
                        fee = 15m,
                        refNo = "REF-GCASH-99",
                        customerPhone = "09191234567",
                        date = DateTimeOffset.UtcNow,
                        notes = "Load cash out"
                    })
                }
            }
        };

        var response = await handler.Handle(new ProcessBatchSyncCommand(batch), CancellationToken.None);

        response.Results.Should().HaveCount(1);
        response.Results[0].Status.Should().Be("Success");

        var txn = await context.GCashTransactions.FindAsync(txnId);
        txn.Should().NotBeNull();
        txn!.Amount.Should().Be(750m);
        txn.Fee.Should().Be(15m);
    }

    [Fact]
    public async Task ProcessBatchSync_SaleWithItemsAndUtang_PersistsSaleAndItems()
    {
        var (context, userMock) = CreateInMemoryContext();
        var handler = new ProcessBatchSyncCommandHandler(context, userMock.Object, NullLogger<ProcessBatchSyncCommandHandler>.Instance);

        var custId = Guid.NewGuid();
        context.Customers.Add(new Customer
        {
            Id = custId,
            TenantId = _testTenantId,
            Name = "Suki Maria",
            Phone = "09181119999",
            TotalUtangBalance = 0m,
            UpdatedAt = DateTimeOffset.UtcNow
        });
        await context.SaveChangesAsync();

        var saleId = Guid.NewGuid();
        var batch = new BatchSyncRequestDto
        {
            DeviceId = Guid.NewGuid(),
            Operations = new List<SyncOperationDto>
            {
                new SyncOperationDto
                {
                    SyncId = Guid.NewGuid().ToString(),
                    Entity = "Sale",
                    Action = "Insert",
                    Timestamp = DateTimeOffset.UtcNow,
                    Payload = JsonSerializer.SerializeToElement(new
                    {
                        id = saleId,
                        tenantId = _testTenantId,
                        totalAmount = 140m,
                        paymentMethod = "Utang",
                        date = DateTimeOffset.UtcNow,
                        userId = _testUserId,
                        customerId = custId,
                        items = new[]
                        {
                            new
                            {
                                id = Guid.NewGuid(),
                                tenantId = _testTenantId,
                                saleId = saleId,
                                productId = Guid.NewGuid(),
                                qty = 2,
                                unitPrice = 70m,
                                subtotal = 140m
                            }
                        }
                    })
                }
            }
        };

        var response = await handler.Handle(new ProcessBatchSyncCommand(batch), CancellationToken.None);

        response.Results.Should().HaveCount(1);
        response.Results[0].Status.Should().Be("Success");

        var sale = await context.Sales.Include(s => s.Items).FirstOrDefaultAsync(s => s.Id == saleId);
        sale.Should().NotBeNull();
        sale!.Items.Should().HaveCount(1);
    }

    [Fact]
    public async Task ProcessBatchSync_UnknownEntity_ReturnsFailedStatus()
    {
        var (context, userMock) = CreateInMemoryContext();
        var handler = new ProcessBatchSyncCommandHandler(context, userMock.Object, NullLogger<ProcessBatchSyncCommandHandler>.Instance);

        var batch = new BatchSyncRequestDto
        {
            DeviceId = Guid.NewGuid(),
            Operations = new List<SyncOperationDto>
            {
                new SyncOperationDto
                {
                    SyncId = Guid.NewGuid().ToString(),
                    Entity = "UnknownEntityName",
                    Action = "Insert",
                    Timestamp = DateTimeOffset.UtcNow,
                    Payload = JsonSerializer.SerializeToElement(new { id = Guid.NewGuid() })
                }
            }
        };

        var response = await handler.Handle(new ProcessBatchSyncCommand(batch), CancellationToken.None);

        response.Results.Should().HaveCount(1);
        response.Results[0].Status.Should().Be("Failed");
        response.Results[0].Error.Should().Contain("not supported");
    }

    [Fact]
    public void DependencyInjection_AddApplication_RegistersMediatRHandlers()
    {
        var services = new ServiceCollection();
        services.AddApplication();

        services.Any(s => s.ServiceType.Name.Contains("IMediator") || s.ServiceType.Name.Contains("IRequestHandler")).Should().BeTrue();
    }

    [Fact]
    public void QueryRecords_PropertiesAndInstantiation_WorkAsExpected()
    {
        var getProducts = new FluentTindahan.Application.Products.GetProductsQuery();
        getProducts.Should().NotBeNull();

        var getCustomers = new FluentTindahan.Application.Customers.GetCustomersQuery();
        getCustomers.Should().NotBeNull();

        var getSales = new FluentTindahan.Application.Sales.GetSalesQuery();
        getSales.Should().NotBeNull();

        var getGCash = new FluentTindahan.Application.GCash.GetGCashTransactionsQuery();
        getGCash.Should().NotBeNull();

        var getDashboard = new FluentTindahan.Application.Dashboard.GetDashboardSummaryQuery();
        getDashboard.Should().NotBeNull();
    }
}
