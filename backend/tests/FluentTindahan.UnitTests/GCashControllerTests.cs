using FluentAssertions;
using MediatR;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Moq;
using Xunit;
using FluentTindahan.Application.GCash;
using FluentTindahan.WebApi.Controllers;

namespace FluentTindahan.UnitTests;

public class GCashControllerTests
{
    private readonly Mock<IMediator> _mediatorMock = new();

    [Fact]
    public async Task Record_WhenSuccessful_ReturnsOk()
    {
        var controller = new GCashController(_mediatorMock.Object);
        var command = new RecordGCashTxnCommand("CashIn", 1000m, 15m, "REF-OK-1");
        var expectedDto = new GCashTxnDto(
            Guid.NewGuid(),
            Guid.NewGuid(),
            "CashIn",
            1000m,
            15m,
            "REF-OK-1",
            null,
            DateTimeOffset.UtcNow,
            null);

        _mediatorMock.Setup(m => m.Send(command, It.IsAny<CancellationToken>()))
            .ReturnsAsync(expectedDto);

        var result = await controller.Record(command, CancellationToken.None);

        result.Result.Should().BeOfType<OkObjectResult>();
        var okResult = result.Result as OkObjectResult;
        okResult!.Value.Should().BeEquivalentTo(expectedDto);
    }

    [Fact]
    public async Task Record_WhenDuplicateGCashRefExceptionThrown_Returns409Conflict()
    {
        var controller = new GCashController(_mediatorMock.Object);
        var command = new RecordGCashTxnCommand("CashIn", 1000m, 15m, "REF-DUP-1");

        _mediatorMock.Setup(m => m.Send(command, It.IsAny<CancellationToken>()))
            .ThrowsAsync(new DuplicateGCashRefException("REF-DUP-1"));

        var result = await controller.Record(command, CancellationToken.None);

        result.Result.Should().BeOfType<ConflictObjectResult>();
        var conflictResult = result.Result as ConflictObjectResult;
        conflictResult!.StatusCode.Should().Be(StatusCodes.Status409Conflict);
    }

    [Fact]
    public async Task Record_WhenUniqueConstraintDbUpdateExceptionThrown_Returns409Conflict()
    {
        var controller = new GCashController(_mediatorMock.Object);
        var command = new RecordGCashTxnCommand("CashIn", 1000m, 15m, "REF-DUP-RACE");

        var dbUpdateEx = new DbUpdateException(
            "An error occurred while saving the entity changes.",
            new PostgresException(
                "duplicate key value violates unique constraint",
                "ERROR",
                "ERROR",
                "23505",
                constraintName: "IX_GCashTransactions_TenantId_RefNoNorm"));

        _mediatorMock.Setup(m => m.Send(command, It.IsAny<CancellationToken>()))
            .ThrowsAsync(dbUpdateEx);

        var result = await controller.Record(command, CancellationToken.None);

        result.Result.Should().BeOfType<ConflictObjectResult>();
        var conflictResult = result.Result as ConflictObjectResult;
        conflictResult!.StatusCode.Should().Be(StatusCodes.Status409Conflict);
    }

    [Fact]
    public void IsUniqueIndexViolation_WhenOnlyExceptionTextMatches_ReturnsFalse()
    {
        var dbUpdateEx = new DbUpdateException(
            "An error occurred while saving the entity changes.",
            new Exception("23505: duplicate key value violates unique constraint \"IX_GCashTransactions_TenantId_RefNoNorm\""));

        RecordGCashTxnCommandHandler.IsUniqueIndexViolation(dbUpdateEx).Should().BeFalse();
    }

    [Fact]
    public void IsUniqueIndexViolation_WhenConstraintNameDiffers_ReturnsFalse()
    {
        var dbUpdateEx = new DbUpdateException(
            "An error occurred while saving the entity changes.",
            new PostgresException(
                "duplicate key value violates unique constraint",
                "ERROR",
                "ERROR",
                "23505",
                constraintName: "IX_OtherTable_RefNo"));

        RecordGCashTxnCommandHandler.IsUniqueIndexViolation(dbUpdateEx).Should().BeFalse();
    }
}
