using FluentAssertions;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
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
using Npgsql;
using Xunit;

namespace FluentTindahan.UnitTests;

public class SyncControllerTests
{
    [Fact]
    public void Provision_RateLimitsAnonymousDemoRequests()
    {
        var rateLimitAttribute = typeof(TenantController)
            .GetMethod(nameof(TenantController.Provision))!
            .GetCustomAttribute<EnableRateLimitingAttribute>();

        rateLimitAttribute.Should().NotBeNull();
        rateLimitAttribute!.PolicyName.Should().Be("AnonymousDemoProvision");
    }

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

    [Fact]
    public async Task Provision_RejectsAuthenticatedOwnerIdThatDiffersFromCaller()
    {
        var tenantId = Guid.NewGuid();
        var authenticatedUserId = Guid.NewGuid();
        var contextOptions = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        var currentUser = new Mock<ICurrentUserService>();
        currentUser.Setup(service => service.TenantId).Returns(tenantId);
        currentUser.Setup(service => service.UserId).Returns(authenticatedUserId);
        currentUser.Setup(service => service.IsAuthenticated).Returns(true);
        await using var context = new AppDbContext(contextOptions, currentUser.Object);
        var controller = new TenantController(context, currentUser.Object);

        var result = await controller.Provision(new TenantController.ProvisionTenantRequest
        {
            UserId = Guid.NewGuid(),
            BusinessName = "Caller Tindahan"
        }, CancellationToken.None);

        result.Result.Should().BeOfType<BadRequestObjectResult>();
        (await context.Tenants.IgnoreQueryFilters().CountAsync()).Should().Be(0);
        (await context.Users.IgnoreQueryFilters().CountAsync()).Should().Be(0);
    }

    [Fact]
    public async Task Provision_DoesNotAddAnOwnerToAnExistingTenantThatAlreadyHasUsers()
    {
        var tenantId = Guid.NewGuid();
        var authenticatedUserId = Guid.NewGuid();
        var contextOptions = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        var currentUser = new Mock<ICurrentUserService>();
        currentUser.Setup(service => service.TenantId).Returns(tenantId);
        currentUser.Setup(service => service.UserId).Returns(authenticatedUserId);
        currentUser.Setup(service => service.IsAuthenticated).Returns(true);
        await using var context = new AppDbContext(contextOptions, currentUser.Object);
        context.Tenants.Add(new FluentTindahan.Domain.Entities.Tenant
        {
            Id = tenantId,
            BusinessName = "Existing Tindahan",
            Tier = PlanTier.Libre
        });
        context.Users.Add(new FluentTindahan.Domain.Entities.User
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Phone = "09171234567",
            Role = "Owner"
        });
        await context.SaveChangesAsync();
        var controller = new TenantController(context, currentUser.Object);

        var result = await controller.Provision(new TenantController.ProvisionTenantRequest
        {
            UserId = authenticatedUserId,
            BusinessName = "Existing Tindahan"
        }, CancellationToken.None);

        result.Result.Should().BeOfType<ForbidResult>();
        (await context.Users.IgnoreQueryFilters().CountAsync()).Should().Be(1);
    }

    [Fact]
    public async Task Provision_CanCreateAnOwnerForAnExistingTenantWithNoUsers()
    {
        var tenantId = Guid.NewGuid();
        var authenticatedUserId = Guid.NewGuid();
        var contextOptions = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        var currentUser = new Mock<ICurrentUserService>();
        currentUser.Setup(service => service.TenantId).Returns(tenantId);
        currentUser.Setup(service => service.UserId).Returns(authenticatedUserId);
        currentUser.Setup(service => service.IsAuthenticated).Returns(true);
        await using var context = new AppDbContext(contextOptions, currentUser.Object);
        context.Tenants.Add(new FluentTindahan.Domain.Entities.Tenant
        {
            Id = tenantId,
            BusinessName = "Unclaimed Tindahan",
            Tier = PlanTier.Libre
        });
        await context.SaveChangesAsync();
        var controller = new TenantController(context, currentUser.Object);

        var result = await controller.Provision(new TenantController.ProvisionTenantRequest
        {
            UserId = authenticatedUserId,
            BusinessName = "Unclaimed Tindahan"
        }, CancellationToken.None);

        result.Result.Should().BeOfType<OkObjectResult>();
        var owner = await context.Users.IgnoreQueryFilters().SingleAsync();
        owner.Id.Should().Be(authenticatedUserId);
        owner.TenantId.Should().Be(tenantId);
        owner.Role.Should().Be("Owner");
    }

    [Fact]
    public async Task Provision_WhenConcurrentCreateWins_ReturnsTheExistingTenant()
    {
        var tenantId = Guid.NewGuid();
        var userId = Guid.NewGuid();
        var contextOptions = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        var currentUser = new Mock<ICurrentUserService>();
        currentUser.Setup(service => service.TenantId).Returns(tenantId);
        currentUser.Setup(service => service.UserId).Returns(userId);
        await using var context = new ProvisionRaceDbContext(contextOptions, currentUser.Object, tenantId, userId);
        var controller = new TenantController(context, currentUser.Object);

        var result = await controller.Provision(new TenantController.ProvisionTenantRequest
        {
            UserId = userId,
            BusinessName = "Stale Local Name"
        }, CancellationToken.None);

        var response = result.Result.Should().BeOfType<OkObjectResult>().Subject.Value
            .Should().BeOfType<TenantController.ProvisionTenantResponse>().Subject;
        response.TenantId.Should().Be(tenantId);
        response.UserId.Should().Be(userId);
        response.Tier.Should().Be(PlanTier.TindahanPro);
        (await context.Tenants.IgnoreQueryFilters().SingleAsync(candidate => candidate.Id == tenantId))
            .BusinessName.Should().Be("Committed Store");
    }

    private sealed class ProvisionRaceDbContext : AppDbContext
    {
        private readonly DbContextOptions<AppDbContext> _options;
        private readonly ICurrentUserService _currentUser;
        private readonly Guid _tenantId;
        private readonly Guid _userId;
        private bool _simulateConcurrentInsert = true;

        public ProvisionRaceDbContext(
            DbContextOptions<AppDbContext> options,
            ICurrentUserService currentUser,
            Guid tenantId,
            Guid userId) : base(options, currentUser)
        {
            _options = options;
            _currentUser = currentUser;
            _tenantId = tenantId;
            _userId = userId;
        }

        public override async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
        {
            if (!_simulateConcurrentInsert)
            {
                return await base.SaveChangesAsync(cancellationToken);
            }

            _simulateConcurrentInsert = false;
            await using (var competingContext = new AppDbContext(_options, _currentUser))
            {
                competingContext.Tenants.Add(new FluentTindahan.Domain.Entities.Tenant
                {
                    Id = _tenantId,
                    BusinessName = "Committed Store",
                    Tier = PlanTier.TindahanPro
                });
                competingContext.Users.Add(new FluentTindahan.Domain.Entities.User
                {
                    Id = _userId,
                    TenantId = _tenantId,
                    Phone = "09171234567",
                    Role = "Owner"
                });
                await competingContext.SaveChangesAsync(cancellationToken);
            }

            var uniqueViolation = new PostgresException(
                "duplicate key",
                "ERROR",
                "ERROR",
                PostgresErrorCodes.UniqueViolation,
                constraintName: "PK_Tenants");
            throw new DbUpdateException("A concurrent provision already created this tenant.", uniqueViolation);
        }
    }
}
