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
using FluentTindahan.Domain.Enums;
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
            TotalUtangBalance = 0m,
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

        var deleted = await context.Customers.FirstOrDefaultAsync(c => c.Id == custId);
        deleted.Should().BeNull();

        var softDeleted = await context.Customers.IgnoreQueryFilters().FirstOrDefaultAsync(c => c.Id == custId);
        softDeleted.Should().NotBeNull();
        softDeleted!.IsDeleted.Should().BeTrue();
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

        var deletedProduct = await context.Products.FirstOrDefaultAsync(p => p.Id == prodId);
        deletedProduct.Should().BeNull();

        var softDeleted = await context.Products.IgnoreQueryFilters().FirstOrDefaultAsync(p => p.Id == prodId);
        softDeleted.Should().NotBeNull();
        softDeleted!.IsDeleted.Should().BeTrue();
    }

    [Fact]
    public async Task ProcessBatchSync_StaleProductDelete_IgnoresConflictAndPreservesProduct()
    {
        var (context, userMock) = CreateInMemoryContext();
        var handler = new ProcessBatchSyncCommandHandler(context, userMock.Object, NullLogger<ProcessBatchSyncCommandHandler>.Instance);

        var prodId = Guid.NewGuid();
        var serverTime = DateTimeOffset.UtcNow;
        var staleDeleteTime = serverTime.AddMinutes(-5);

        context.Products.Add(new Product
        {
            Id = prodId,
            TenantId = _testTenantId,
            Name = "Active Fresh Product",
            Price = 20m,
            Cost = 15m,
            StockQty = 10,
            IsDeleted = false,
            UpdatedAt = serverTime
        });
        await context.SaveChangesAsync();

        var batch = new BatchSyncRequestDto
        {
            DeviceId = Guid.NewGuid(),
            Operations = new List<SyncOperationDto>
            {
                new SyncOperationDto
                {
                    SyncId = Guid.NewGuid().ToString(),
                    Entity = "Product",
                    Action = "Delete",
                    Timestamp = staleDeleteTime,
                    Payload = JsonSerializer.SerializeToElement(new { id = prodId })
                }
            }
        };

        var response = await handler.Handle(new ProcessBatchSyncCommand(batch), CancellationToken.None);

        response.Results.Should().HaveCount(1);
        response.Results[0].Status.Should().Be("ConflictIgnored");

        var product = await context.Products.IgnoreQueryFilters().FirstOrDefaultAsync(p => p.Id == prodId);
        product.Should().NotBeNull();
        product!.IsDeleted.Should().BeFalse();
        product.UpdatedAt.Should().Be(serverTime);
    }

    [Fact]
    public async Task ProcessBatchSync_StaleCustomerDelete_IgnoresConflictAndPreservesCustomer()
    {
        var (context, userMock) = CreateInMemoryContext();
        var handler = new ProcessBatchSyncCommandHandler(context, userMock.Object, NullLogger<ProcessBatchSyncCommandHandler>.Instance);

        var custId = Guid.NewGuid();
        var serverTime = DateTimeOffset.UtcNow;
        var staleDeleteTime = serverTime.AddMinutes(-5);

        context.Customers.Add(new Customer
        {
            Id = custId,
            TenantId = _testTenantId,
            Name = "Active Customer",
            Phone = "09123456789",
            TotalUtangBalance = 100m,
            UpdatedAt = serverTime
        });
        await context.SaveChangesAsync();

        var batch = new BatchSyncRequestDto
        {
            DeviceId = Guid.NewGuid(),
            Operations = new List<SyncOperationDto>
            {
                new SyncOperationDto
                {
                    SyncId = Guid.NewGuid().ToString(),
                    Entity = "Customer",
                    Action = "Delete",
                    Timestamp = staleDeleteTime,
                    Payload = JsonSerializer.SerializeToElement(new { id = custId })
                }
            }
        };

        var response = await handler.Handle(new ProcessBatchSyncCommand(batch), CancellationToken.None);

        response.Results.Should().HaveCount(1);
        response.Results[0].Status.Should().Be("ConflictIgnored");

        var customer = await context.Customers.IgnoreQueryFilters().FirstOrDefaultAsync(c => c.Id == custId);
        customer.Should().NotBeNull();
        customer!.UpdatedAt.Should().Be(serverTime);
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

        var prodId = Guid.NewGuid();
        context.Products.Add(new Product
        {
            Id = prodId,
            TenantId = _testTenantId,
            Name = "Pancit Canton",
            Price = 70m,
            Cost = 50m,
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
                                productId = prodId,
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
    public async Task ProcessBatchSync_DeleteProductWithSales_SoftDeletesAndPreservesSaleHistory()
    {
        var (context, userMock) = CreateInMemoryContext();
        var handler = new ProcessBatchSyncCommandHandler(context, userMock.Object, NullLogger<ProcessBatchSyncCommandHandler>.Instance);

        var prodId = Guid.NewGuid();
        var saleId = Guid.NewGuid();

        context.Products.Add(new Product
        {
            Id = prodId,
            TenantId = _testTenantId,
            Name = "Product With Sales",
            Price = 50m,
            Cost = 30m,
            StockQty = 10,
            UpdatedAt = DateTimeOffset.UtcNow.AddMinutes(-10),
            IsDeleted = false
        });

        context.Sales.Add(new Sale
        {
            Id = saleId,
            TenantId = _testTenantId,
            TotalAmount = 50m,
            PaymentMethod = "Cash",
            Date = DateTimeOffset.UtcNow.AddMinutes(-5),
            Items = new List<SaleItem>
            {
                new SaleItem
                {
                    Id = Guid.NewGuid(),
                    TenantId = _testTenantId,
                    SaleId = saleId,
                    ProductId = prodId,
                    Qty = 1,
                    UnitPrice = 50m,
                    Subtotal = 50m
                }
            }
        });
        await context.SaveChangesAsync();

        var batch = new BatchSyncRequestDto
        {
            DeviceId = Guid.NewGuid(),
            Operations = new List<SyncOperationDto>
            {
                new SyncOperationDto
                {
                    SyncId = "del_prod_with_sales",
                    Entity = "Product",
                    Action = "Delete",
                    Timestamp = DateTimeOffset.UtcNow,
                    Payload = JsonSerializer.SerializeToElement(new { id = prodId })
                }
            }
        };

        var response = await handler.Handle(new ProcessBatchSyncCommand(batch), CancellationToken.None);

        response.Results.Should().HaveCount(1);
        response.Results[0].Status.Should().Be("Success");

        // Standard query excludes the soft-deleted product
        var activeProduct = await context.Products.FirstOrDefaultAsync(p => p.Id == prodId);
        activeProduct.Should().BeNull();

        // Product is preserved in DB with IsDeleted = true
        var rawProduct = await context.Products.IgnoreQueryFilters().FirstOrDefaultAsync(p => p.Id == prodId);
        rawProduct.Should().NotBeNull();
        rawProduct!.IsDeleted.Should().BeTrue();

        // Historical Sale and SaleItem records remain completely intact and reference the product
        var preservedSale = await context.Sales.Include(s => s.Items).FirstOrDefaultAsync(s => s.Id == saleId);
        preservedSale.Should().NotBeNull();
        preservedSale!.Items.Should().HaveCount(1);
        preservedSale.Items.First().ProductId.Should().Be(prodId);
    }

    [Fact]
    public async Task ProcessBatchSync_PlaceholderRestore_AtLibreCap_RejectsWithPlanLimitError()
    {
        var (context, userMock) = CreateInMemoryContext();
        var handler = new ProcessBatchSyncCommandHandler(context, userMock.Object, NullLogger<ProcessBatchSyncCommandHandler>.Instance);

        // Explicitly set tenant on Libre tier
        context.Tenants.Add(new Tenant
        {
            Id = _testTenantId,
            BusinessName = "Sari-Sari Store At Cap",
            Tier = PlanTier.Libre,
            CreatedAt = DateTimeOffset.UtcNow
        });

        // Seed 50 active products (Libre capacity limit)
        for (int i = 0; i < 50; i++)
        {
            context.Products.Add(new Product
            {
                Id = Guid.NewGuid(),
                TenantId = _testTenantId,
                Name = $"Active Product {i}",
                Price = 10m,
                IsDeleted = false,
                UpdatedAt = DateTimeOffset.UtcNow.AddMinutes(-10)
            });
        }

        // Seed 1 placeholder product (soft-deleted)
        var placeholderId = Guid.NewGuid();
        context.Products.Add(new Product
        {
            Id = placeholderId,
            TenantId = _testTenantId,
            Name = "Missing Placeholder Product",
            Price = 25m,
            IsDeleted = true,
            UpdatedAt = DateTimeOffset.UtcNow.AddMinutes(-10)
        });
        await context.SaveChangesAsync();

        // Incoming update/insert attempting to restore the placeholder when already at cap
        var batch = new BatchSyncRequestDto
        {
            DeviceId = Guid.NewGuid(),
            Operations = new List<SyncOperationDto>
            {
                new SyncOperationDto
                {
                    SyncId = "restore_placeholder_at_cap",
                    Entity = "Product",
                    Action = "Update",
                    Timestamp = DateTimeOffset.UtcNow,
                    Payload = JsonSerializer.SerializeToElement(new
                    {
                        id = placeholderId,
                        name = "Attempt Restoring Placeholder",
                        price = 30m,
                        cost = 20m,
                        stockQty = 15
                    })
                }
            }
        };

        var response = await handler.Handle(new ProcessBatchSyncCommand(batch), CancellationToken.None);

        response.Results.Should().HaveCount(1);
        response.Results[0].Status.Should().Be("Failed");
        response.Results[0].Error.Should().Contain("Libre plan limit exceeded: Maximum 50 products allowed");

        // Placeholder must remain soft-deleted
        var rawPlaceholder = await context.Products.IgnoreQueryFilters().FirstOrDefaultAsync(p => p.Id == placeholderId);
        rawPlaceholder.Should().NotBeNull();
        rawPlaceholder!.IsDeleted.Should().BeTrue();
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
