using FluentAssertions;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using System.Reflection;
using System.Text.Json;
using FluentTindahan.Domain.Enums;
using FluentTindahan.Infrastructure.Persistence;
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

    [Fact]
    public async Task ProvisionedTenantCanSyncAndProvisionRetryPreservesPaidTier()
    {
        var tenantId = Guid.NewGuid();
        var userId = Guid.NewGuid();
        var contextOptions = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        var currentUser = new Mock<ICurrentUserService>();
        currentUser.Setup(service => service.TenantId).Returns(tenantId);
        currentUser.Setup(service => service.UserId).Returns(userId);
        await using var context = new AppDbContext(contextOptions, currentUser.Object);
        var controller = new TenantController(context, currentUser.Object);
        var profile = new TenantController.ProvisionTenantRequest
        {
            UserId = userId,
            BusinessName = "Test Tindahan",
            Phone = "09171234567"
        };

        var provisionResult = await controller.Provision(profile, CancellationToken.None);
        provisionResult.Result.Should().BeOfType<OkObjectResult>();

        var tenant = await context.Tenants.IgnoreQueryFilters().SingleAsync(candidate => candidate.Id == tenantId);
        var user = await context.Users.IgnoreQueryFilters().SingleAsync(candidate => candidate.Id == userId);
        tenant.Tier = PlanTier.TindahanPro;
        tenant.SubscriptionEndDate = DateTimeOffset.UtcNow.AddDays(30);
        await context.SaveChangesAsync();

        var retryResult = await controller.Provision(profile with { BusinessName = "Stale Local Store Name" }, CancellationToken.None);
        retryResult.Result.Should().BeOfType<OkObjectResult>();
        tenant.Tier.Should().Be(PlanTier.TindahanPro);
        tenant.BusinessName.Should().Be("Test Tindahan");
        user.TenantId.Should().Be(tenantId);

        var productId = Guid.NewGuid();
        var syncHandler = new ProcessBatchSyncCommandHandler(
            context,
            currentUser.Object,
            NullLogger<ProcessBatchSyncCommandHandler>.Instance);
        var batch = new BatchSyncRequestDto
        {
            DeviceId = Guid.NewGuid(),
            Operations = new List<SyncOperationDto>
            {
                new()
                {
                    SyncId = "provisioned-product",
                    Entity = "Product",
                    Action = "Insert",
                    Timestamp = DateTimeOffset.UtcNow,
                    Payload = JsonSerializer.SerializeToElement(new
                    {
                        id = productId,
                        name = "Instant Noodles",
                        price = 15m,
                        cost = 12m,
                        stockQty = 8
                    })
                }
            }
        };

        var syncResult = await syncHandler.Handle(new ProcessBatchSyncCommand(batch), CancellationToken.None);

        syncResult.ProcessedCount.Should().Be(1);
        (await context.Products.IgnoreQueryFilters().SingleAsync(product => product.Id == productId))
            .TenantId.Should().Be(tenantId);
    }
}
