using FluentAssertions;
using MediatR;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using FluentTindahan.Application.Sync.Commands;
using FluentTindahan.Application.Sync.DTOs;
using FluentTindahan.Domain.Interfaces;
using FluentTindahan.WebApi.Controllers;
using Xunit;

namespace FluentTindahan.UnitTests;

public class SyncControllerTests
{
    [Fact]
    public async Task ProcessBatch_WithoutResolvedTenant_ReturnsUnauthorizedWithoutDispatching()
    {
        var mediator = new Mock<IMediator>();
        var currentUser = new Mock<ICurrentUserService>();
        currentUser.Setup(service => service.TenantId).Returns(Guid.Empty);
        var controller = new SyncController(
            mediator.Object,
            currentUser.Object,
            NullLogger<SyncController>.Instance);
        var request = new BatchSyncRequestDto
        {
            DeviceId = Guid.NewGuid(),
            Operations = new List<SyncOperationDto>()
        };

        var result = await controller.ProcessBatch(request, CancellationToken.None);

        result.Result.Should().BeOfType<UnauthorizedObjectResult>();
        (result.Result as UnauthorizedObjectResult)!.StatusCode.Should().Be(401);
        mediator.Verify(
            service => service.Send(It.IsAny<ProcessBatchSyncCommand>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }
}
