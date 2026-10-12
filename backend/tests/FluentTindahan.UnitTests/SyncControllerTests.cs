using FluentAssertions;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using System.Reflection;
using FluentTindahan.Application.Sync.Commands;
using FluentTindahan.Application.Sync.DTOs;
using FluentTindahan.Domain.Interfaces;
using FluentTindahan.WebApi.Authorization;
using FluentTindahan.WebApi.Controllers;
using Xunit;

namespace FluentTindahan.UnitTests;

public class SyncControllerTests
{
    [Fact]
    public void Controller_RequiresResolvedTenantPolicy()
    {
        var authorizeAttribute = typeof(SyncController).GetCustomAttribute<AuthorizeAttribute>();

        authorizeAttribute.Should().NotBeNull();
        authorizeAttribute!.Policy.Should().Be(AuthorizationPolicies.TenantResolved);
    }

    [Fact]
    public async Task ProcessBatch_WhenMediatorThrows_PropagatesToExceptionHandler()
    {
        var mediator = new Mock<IMediator>();
        mediator
            .Setup(service => service.Send(It.IsAny<ProcessBatchSyncCommand>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("sensitive database detail"));
        var controller = new SyncController(mediator.Object, NullLogger<SyncController>.Instance);
        var request = new BatchSyncRequestDto
        {
            DeviceId = Guid.NewGuid(),
            Operations = new List<SyncOperationDto>()
        };

        var act = () => controller.ProcessBatch(request, CancellationToken.None);

        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("sensitive database detail");
    }
}
