using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Moq;
using FluentTindahan.Application.GCash;
using FluentTindahan.Domain.Entities;
using FluentTindahan.Domain.Interfaces;
using FluentTindahan.Infrastructure.Persistence;
using Xunit;

namespace FluentTindahan.UnitTests;

public class GCashHandlerTests
{
    private readonly Guid _testTenantId = Guid.Parse("66666666-6666-6666-6666-666666666666");

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
    public async Task RecordGCashTxn_ValidCommand_PersistsAndReturnsDto()
    {
        var (context, userMock) = CreateInMemoryContext();
        var handler = new RecordGCashTxnCommandHandler(context, userMock.Object);

        var command = new RecordGCashTxnCommand(
            Type: "CashIn",
            Amount: 1500m,
            Fee: 25m,
            RefNo: "REF-20261009-01",
            CustomerPhone: "09178889900",
            Notes: "Tuition cash-in"
        );

        var result = await handler.Handle(command, CancellationToken.None);

        result.Should().NotBeNull();
        result.Id.Should().NotBeEmpty();
        result.TenantId.Should().Be(_testTenantId);
        result.Type.Should().Be("CashIn");
        result.Amount.Should().Be(1500m);
        result.Fee.Should().Be(25m);
        result.RefNo.Should().Be("REF-20261009-01");
        result.CustomerPhone.Should().Be("09178889900");

        var saved = await context.GCashTransactions.FindAsync(result.Id);
        saved.Should().NotBeNull();
        saved!.Amount.Should().Be(1500m);
    }

    [Fact]
    public async Task GetGCashTransactions_ReturnsTransactionsSortedByDateDescending()
    {
        var (context, _) = CreateInMemoryContext();
        var t1 = DateTimeOffset.UtcNow.AddMinutes(-30);
        var t2 = DateTimeOffset.UtcNow;

        context.GCashTransactions.AddRange(
            new GCashTxn
            {
                Id = Guid.NewGuid(),
                TenantId = _testTenantId,
                Type = "CashOut",
                Amount = 500m,
                Fee = 10m,
                RefNo = "OLD-01",
                Date = t1
            },
            new GCashTxn
            {
                Id = Guid.NewGuid(),
                TenantId = _testTenantId,
                Type = "CashIn",
                Amount = 2000m,
                Fee = 30m,
                RefNo = "NEW-02",
                Date = t2
            }
        );
        await context.SaveChangesAsync();

        var handler = new GetGCashTransactionsQueryHandler(context);
        var result = await handler.Handle(new GetGCashTransactionsQuery(), CancellationToken.None);

        result.Should().HaveCount(2);
        result[0].RefNo.Should().Be("NEW-02");
        result[1].RefNo.Should().Be("OLD-01");
    }

    [Fact]
    public async Task RecordGCashTxn_DuplicateRef_ThrowsInvalidOperationException()
    {
        var (context, userMock) = CreateInMemoryContext();
        var handler = new RecordGCashTxnCommandHandler(context, userMock.Object);

        context.GCashTransactions.Add(new GCashTxn
        {
            Id = Guid.NewGuid(),
            TenantId = _testTenantId,
            Type = "CashIn",
            Amount = 1000m,
            Fee = 15m,
            RefNo = "REF-UNIQUE-01",
            RefNoNorm = GCashTxn.NormalizeRef("REF-UNIQUE-01"),
            Date = DateTimeOffset.UtcNow
        });
        await context.SaveChangesAsync();

        var duplicateCmd = new RecordGCashTxnCommand(
            Type: "CashIn",
            Amount: 500m,
            Fee: 10m,
            RefNo: "  ref-unique-01  "
        );

        var act = () => handler.Handle(duplicateCmd, CancellationToken.None);
        await act.Should().ThrowAsync<DuplicateGCashRefException>()
            .WithMessage("*Duplicate GCash reference number*");
    }

    [Fact]
    public async Task RecordGCashTxn_ValidInternationalPhone_NormalizesAndPersists()
    {
        var (context, userMock) = CreateInMemoryContext();
        var handler = new RecordGCashTxnCommandHandler(context, userMock.Object);

        var command = new RecordGCashTxnCommand(
            Type: "CashIn",
            Amount: 500m,
            Fee: 10m,
            RefNo: "REF-INTL-PHONE-01",
            CustomerPhone: "+639171234567",
            Notes: "International mobile prefix test"
        );

        var result = await handler.Handle(command, CancellationToken.None);

        result.Should().NotBeNull();
        result.CustomerPhone.Should().Be("09171234567");

        var saved = await context.GCashTransactions.FindAsync(result.Id);
        saved.Should().NotBeNull();
        saved!.CustomerPhone.Should().Be("09171234567");
    }

    [Fact]
    public async Task RecordGCashTxn_InvalidPhone_ThrowsArgumentException()
    {
        var (context, userMock) = CreateInMemoryContext();
        var handler = new RecordGCashTxnCommandHandler(context, userMock.Object);

        var command = new RecordGCashTxnCommand(
            Type: "CashIn",
            Amount: 500m,
            Fee: 10m,
            RefNo: "REF-INVALID-PHONE-01",
            CustomerPhone: "abc123invalid"
        );

        var act = () => handler.Handle(command, CancellationToken.None);
        await act.Should().ThrowAsync<ArgumentException>()
            .WithMessage("*Enter a valid Philippine mobile number.*");
    }
}
