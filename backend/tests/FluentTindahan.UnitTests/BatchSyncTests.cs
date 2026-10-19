using System.Text.Json;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using FluentTindahan.Application.Common.Interfaces;
using FluentTindahan.Application.Sync.Commands;
using FluentTindahan.Application.Sync.DTOs;
using FluentTindahan.Domain.Entities;
using FluentTindahan.Domain.Interfaces;
using FluentTindahan.Infrastructure.Persistence;
using Xunit;

namespace FluentTindahan.UnitTests;

public class BatchSyncTests
{
    private readonly Guid _testTenantId = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private readonly Guid _testUserId = Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");

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
    public async Task ProcessBatchSync_AppendOnlyUtang_UpdatesCustomerBalance()
    {
        // Arrange
        var (context, userMock) = CreateInMemoryContext();
        var customerId = Guid.NewGuid();
        context.Customers.Add(new Customer
        {
            Id = customerId,
            TenantId = _testTenantId,
            Name = "Ate Linda",
            Phone = "09171112222",
            TotalUtangBalance = 100m,
            UpdatedAt = DateTimeOffset.UtcNow
        });
        await context.SaveChangesAsync();

        var handler = new ProcessBatchSyncCommandHandler(
            context,
            userMock.Object,
            NullLogger<ProcessBatchSyncCommandHandler>.Instance
        );

        var utangPayload = new
        {
            id = Guid.NewGuid(),
            customerId = customerId,
            amount = 50.00m,
            type = "Credit",
            date = DateTimeOffset.UtcNow,
            notes = "Borrowed 2 noodles"
        };

        var request = new BatchSyncRequestDto
        {
            DeviceId = Guid.NewGuid(),
            Operations = new List<SyncOperationDto>
            {
                new()
                {
                    SyncId = "sync-utang-1",
                    Entity = "UtangLedger",
                    Action = "Insert",
                    Timestamp = DateTimeOffset.UtcNow,
                    Payload = JsonSerializer.SerializeToElement(utangPayload)
                }
            }
        };

        // Act
        var result = await handler.Handle(new ProcessBatchSyncCommand(request), CancellationToken.None);

        // Assert
        result.ProcessedCount.Should().Be(1);
        result.Results.Should().ContainSingle(r => r.SyncId == "sync-utang-1" && r.Status == "Success");

        var updatedCustomer = await context.Customers.FindAsync(customerId);
        updatedCustomer.Should().NotBeNull();
        updatedCustomer!.TotalUtangBalance.Should().Be(150.00m); // 100 + 50
    }

    [Fact]
    public async Task ProcessBatchSync_CustomerCreationWithOpeningUtang_DoesNotDoubleCountBalance()
    {
        // Arrange (Issue #107): Customer created with initial utang of 100, then 50 charge, then 60 payment -> 90 balance
        var (context, userMock) = CreateInMemoryContext();
        var customerId = Guid.NewGuid();
        var handler = new ProcessBatchSyncCommandHandler(
            context,
            userMock.Object,
            NullLogger<ProcessBatchSyncCommandHandler>.Instance
        );

        var now = DateTimeOffset.UtcNow;
        var request = new BatchSyncRequestDto
        {
            DeviceId = Guid.NewGuid(),
            Operations = new List<SyncOperationDto>
            {
                new()
                {
                    SyncId = "sync-cust-1",
                    Entity = "Customer",
                    Action = "Insert",
                    Timestamp = now.AddMinutes(-30),
                    Payload = JsonSerializer.SerializeToElement(new
                    {
                        id = customerId,
                        name = "QA-TEST Juan",
                        phone = "09171234567",
                        totalUtangBalance = 0m,
                        updatedAt = now.AddMinutes(-30)
                    })
                },
                new()
                {
                    SyncId = "sync-utang-initial",
                    Entity = "UtangLedger",
                    Action = "Insert",
                    Timestamp = now.AddMinutes(-30),
                    Payload = JsonSerializer.SerializeToElement(new
                    {
                        id = Guid.NewGuid(),
                        customerId = customerId,
                        amount = 100.00m,
                        type = "Credit",
                        date = now.AddMinutes(-30),
                        notes = "Initial balance"
                    })
                },
                new()
                {
                    SyncId = "sync-utang-charge",
                    Entity = "UtangLedger",
                    Action = "Insert",
                    Timestamp = now.AddMinutes(-20),
                    Payload = JsonSerializer.SerializeToElement(new
                    {
                        id = Guid.NewGuid(),
                        customerId = customerId,
                        amount = 50.00m,
                        type = "Credit",
                        date = now.AddMinutes(-20),
                        notes = "Charge"
                    })
                },
                new()
                {
                    SyncId = "sync-utang-payment",
                    Entity = "UtangLedger",
                    Action = "Insert",
                    Timestamp = now.AddMinutes(-10),
                    Payload = JsonSerializer.SerializeToElement(new
                    {
                        id = Guid.NewGuid(),
                        customerId = customerId,
                        amount = 60.00m,
                        type = "Payment",
                        date = now.AddMinutes(-10),
                        notes = "Payment"
                    })
                }
            }
        };

        // Act
        var result = await handler.Handle(new ProcessBatchSyncCommand(request), CancellationToken.None);

        // Assert
        result.ProcessedCount.Should().Be(4);
        result.Results.Should().AllSatisfy(r => r.Status.Should().Be("Success"));

        var savedCustomer = await context.Customers.FindAsync(customerId);
        savedCustomer.Should().NotBeNull();
        savedCustomer!.TotalUtangBalance.Should().Be(90.00m); // 100 + 50 - 60
    }

    [Fact]
    public async Task ProcessBatchSync_LWW_IgnoresStaleProductUpdate()
    {
        // Arrange
        var (context, userMock) = CreateInMemoryContext();
        var productId = Guid.NewGuid();
        var serverTime = DateTimeOffset.UtcNow;
        var staleClientTime = serverTime.AddMinutes(-10);

        context.Products.Add(new Product
        {
            Id = productId,
            TenantId = _testTenantId,
            Name = "Pancit Canton Hot Chili",
            Price = 20.00m,
            Cost = 15.00m,
            UpdatedAt = serverTime
        });
        await context.SaveChangesAsync();

        var handler = new ProcessBatchSyncCommandHandler(
            context,
            userMock.Object,
            NullLogger<ProcessBatchSyncCommandHandler>.Instance
        );

        var stalePayload = new
        {
            id = productId,
            name = "Pancit Canton Stale Price",
            price = 18.00m,
            cost = 14.00m
        };

        var request = new BatchSyncRequestDto
        {
            DeviceId = Guid.NewGuid(),
            Operations = new List<SyncOperationDto>
            {
                new()
                {
                    SyncId = "sync-product-stale",
                    Entity = "Product",
                    Action = "Update",
                    Timestamp = staleClientTime, // Stale!
                    Payload = JsonSerializer.SerializeToElement(stalePayload)
                }
            }
        };

        // Act
        var result = await handler.Handle(new ProcessBatchSyncCommand(request), CancellationToken.None);

        // Assert
        result.Results.Should().ContainSingle(r => r.SyncId == "sync-product-stale" && r.Status == "ConflictIgnored");

        var product = await context.Products.FindAsync(productId);
        product!.Price.Should().Be(20.00m); // Kept newer server price!
        product.Name.Should().Be("Pancit Canton Hot Chili");
    }

    [Fact]
    public async Task ProcessBatchSync_PoisonPillIsolation_OneErrorDoesNotFailBatch()
    {
        // Arrange
        var (context, userMock) = CreateInMemoryContext();
        var handler = new ProcessBatchSyncCommandHandler(
            context,
            userMock.Object,
            NullLogger<ProcessBatchSyncCommandHandler>.Instance
        );

        var validProductPayload = new
        {
            id = Guid.NewGuid(),
            name = "Bear Brand 33g",
            price = 16.00m,
            cost = 13.00m,
            category = "Dairy"
        };

        var request = new BatchSyncRequestDto
        {
            DeviceId = Guid.NewGuid(),
            Operations = new List<SyncOperationDto>
            {
                // Poison pill operation: unknown entity
                new()
                {
                    SyncId = "poison-pill",
                    Entity = "InvalidEntityX",
                    Action = "Insert",
                    Timestamp = DateTimeOffset.UtcNow,
                    Payload = JsonSerializer.SerializeToElement(new { some = "data" })
                },
                // Valid operation: valid product
                new()
                {
                    SyncId = "valid-product",
                    Entity = "Product",
                    Action = "Insert",
                    Timestamp = DateTimeOffset.UtcNow,
                    Payload = JsonSerializer.SerializeToElement(validProductPayload)
                }
            }
        };

        // Act
        var result = await handler.Handle(new ProcessBatchSyncCommand(request), CancellationToken.None);

        // Assert
        result.Results.Should().HaveCount(2);

        var failedOp = result.Results.First(r => r.SyncId == "poison-pill");
        failedOp.Status.Should().Be("Failed");
        failedOp.Error.Should().NotBeNullOrEmpty();

        var successOp = result.Results.First(r => r.SyncId == "valid-product");
        successOp.Status.Should().Be("Success");

        result.ProcessedCount.Should().Be(1);
    }

    [Fact]
    public async Task ProcessBatchSync_GCashTxn_NormalizesValidPhoneAndStoresNullForInvalidPhone()
    {
        // Arrange
        var (context, userMock) = CreateInMemoryContext();
        var handler = new ProcessBatchSyncCommandHandler(
            context,
            userMock.Object,
            NullLogger<ProcessBatchSyncCommandHandler>.Instance
        );

        var validTxnId = Guid.NewGuid();
        var invalidTxnId = Guid.NewGuid();

        var validPayload = new
        {
            id = validTxnId,
            type = "CashIn",
            amount = 100m,
            fee = 10m,
            refNo = "REF-VALID-PHONE-1",
            customerPhone = "+639171234567",
            date = DateTimeOffset.UtcNow
        };

        var invalidPayload = new
        {
            id = invalidTxnId,
            type = "CashIn",
            amount = 50m,
            fee = 5m,
            refNo = "REF-INVALID-PHONE-2",
            customerPhone = "abc123invalid",
            date = DateTimeOffset.UtcNow
        };

        var request = new BatchSyncRequestDto
        {
            DeviceId = Guid.NewGuid(),
            Operations = new List<SyncOperationDto>
            {
                new()
                {
                    SyncId = "sync-gcash-valid-phone",
                    Entity = "GCashTxn",
                    Action = "Insert",
                    Timestamp = DateTimeOffset.UtcNow,
                    Payload = JsonSerializer.SerializeToElement(validPayload)
                },
                new()
                {
                    SyncId = "sync-gcash-invalid-phone",
                    Entity = "GCashTxn",
                    Action = "Insert",
                    Timestamp = DateTimeOffset.UtcNow,
                    Payload = JsonSerializer.SerializeToElement(invalidPayload)
                }
            }
        };

        // Act
        var result = await handler.Handle(new ProcessBatchSyncCommand(request), CancellationToken.None);

        // Assert
        result.Results.Should().HaveCount(2);
        result.Results.Should().OnlyContain(r => r.Status == "Success");
        result.ProcessedCount.Should().Be(2);

        var validTxn = await context.GCashTransactions.FindAsync(validTxnId);
        validTxn.Should().NotBeNull();
        validTxn!.CustomerPhone.Should().Be("09171234567");

        var invalidTxn = await context.GCashTransactions.FindAsync(invalidTxnId);
        invalidTxn.Should().NotBeNull();
        invalidTxn!.CustomerPhone.Should().BeNull();
    }
}
