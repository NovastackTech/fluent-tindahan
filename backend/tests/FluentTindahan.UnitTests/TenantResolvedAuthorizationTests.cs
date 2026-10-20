using System.Security.Claims;
using FluentAssertions;
using FluentTindahan.Domain.Interfaces;
using FluentTindahan.WebApi.Authorization;
using Microsoft.AspNetCore.Authorization;
using Moq;
using Xunit;

namespace FluentTindahan.UnitTests;

public class TenantResolvedAuthorizationTests
{
    [Fact]
    public async Task SucceedsWhenCurrentUserHasResolvedTenant()
    {
        var currentUser = new Mock<ICurrentUserService>();
        currentUser.Setup(service => service.TenantId).Returns(Guid.NewGuid());
        var requirement = new TenantResolvedRequirement();
        var context = new AuthorizationHandlerContext(
            new[] { requirement },
            new ClaimsPrincipal(),
            resource: null);

        await new TenantResolvedHandler(currentUser.Object).HandleAsync(context);

        context.HasSucceeded.Should().BeTrue();
    }

    [Fact]
    public async Task DoesNotSucceedWhenTenantIsUnresolved()
    {
        var currentUser = new Mock<ICurrentUserService>();
        currentUser.Setup(service => service.TenantId).Returns(Guid.Empty);
        currentUser.Setup(service => service.EmailVerified).Returns(true);
        var requirement = new TenantResolvedRequirement();
        var context = new AuthorizationHandlerContext(
            new[] { requirement },
            new ClaimsPrincipal(),
            resource: null);

        await new TenantResolvedHandler(currentUser.Object).HandleAsync(context);

        context.HasSucceeded.Should().BeFalse();
    }

    [Fact]
    public async Task DoesNotSucceedWhenEmailVerifiedClaimIsFalse()
    {
        var currentUser = new Mock<ICurrentUserService>();
        currentUser.Setup(service => service.TenantId).Returns(Guid.NewGuid());
        currentUser.Setup(service => service.EmailVerified).Returns(true);
        var requirement = new TenantResolvedRequirement();
        var user = new ClaimsPrincipal(new ClaimsIdentity(new[]
        {
            new Claim("email_verified", "false")
        }));
        var context = new AuthorizationHandlerContext(
            new[] { requirement },
            user,
            resource: null);

        await new TenantResolvedHandler(currentUser.Object).HandleAsync(context);

        context.HasSucceeded.Should().BeFalse();
    }
}