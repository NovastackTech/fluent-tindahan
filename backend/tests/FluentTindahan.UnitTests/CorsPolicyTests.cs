using FluentAssertions;
using FluentTindahan.WebApi;
using Microsoft.AspNetCore.Cors.Infrastructure;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Moq;
using Xunit;

namespace FluentTindahan.UnitTests;

public class CorsPolicyTests
{
    [Fact]
    public void ConfigurePwaCors_InDevelopment_AllowsAnyOriginAndCredentials()
    {
        var envMock = new Mock<IHostEnvironment>();
        envMock.Setup(e => e.EnvironmentName).Returns(Environments.Development);

        var config = new ConfigurationBuilder().Build();
        var builder = new CorsPolicyBuilder();

        CorsPolicies.ConfigurePwaCors(builder, config, envMock.Object);
        var policy = builder.Build();

        policy.SupportsCredentials.Should().BeTrue();
        policy.IsOriginAllowed("http://localhost:5173").Should().BeTrue();
        policy.IsOriginAllowed("http://192.168.1.100:5173").Should().BeTrue();
        policy.IsOriginAllowed("https://any-origin.dev").Should().BeTrue();
    }

    [Fact]
    public void ConfigurePwaCors_OutsideDevelopment_RestrictsToConfiguredOrigins()
    {
        var envMock = new Mock<IHostEnvironment>();
        envMock.Setup(e => e.EnvironmentName).Returns(Environments.Production);

        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["PAYMONGO_FRONTEND_ORIGIN"] = "https://tindahan-dev.novastack-inc.online",
                ["PUBLIC_ORIGIN"] = "https://tindahan.ph"
            })
            .Build();

        var builder = new CorsPolicyBuilder();
        CorsPolicies.ConfigurePwaCors(builder, config, envMock.Object);
        var policy = builder.Build();

        policy.SupportsCredentials.Should().BeTrue();
        policy.IsOriginAllowed("https://tindahan-dev.novastack-inc.online").Should().BeTrue();
        policy.IsOriginAllowed("https://tindahan.ph").Should().BeTrue();

        // Arbitrary origins must be rejected
        policy.IsOriginAllowed("https://attacker-site.com").Should().BeFalse();
        policy.IsOriginAllowed("http://localhost:5173").Should().BeFalse();
    }

    [Fact]
    public void ConfigurePwaCors_OutsideDevelopment_NormalizesOriginsWithPathsAndTrailingSlashes()
    {
        var envMock = new Mock<IHostEnvironment>();
        envMock.Setup(e => e.EnvironmentName).Returns(Environments.Production);

        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["PayMongo:FrontendOrigin"] = "https://store.novastack.com/checkout?ref=123"
            })
            .Build();

        var builder = new CorsPolicyBuilder();
        CorsPolicies.ConfigurePwaCors(builder, config, envMock.Object);
        var policy = builder.Build();

        policy.SupportsCredentials.Should().BeTrue();
        policy.IsOriginAllowed("https://store.novastack.com").Should().BeTrue();
        policy.IsOriginAllowed("https://other.com").Should().BeFalse();
    }

    [Fact]
    public void ConfigurePwaCors_OutsideDevelopment_WithNoConfiguredOrigins_RejectsArbitraryOrigins()
    {
        var envMock = new Mock<IHostEnvironment>();
        envMock.Setup(e => e.EnvironmentName).Returns(Environments.Production);

        var config = new ConfigurationBuilder().Build();
        var builder = new CorsPolicyBuilder();

        CorsPolicies.ConfigurePwaCors(builder, config, envMock.Object);
        var policy = builder.Build();

        policy.IsOriginAllowed("https://attacker.com").Should().BeFalse();
    }
}
