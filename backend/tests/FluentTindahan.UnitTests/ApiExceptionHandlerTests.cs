using System.Text.Json;
using FluentAssertions;
using FluentTindahan.WebApi.Middleware;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace FluentTindahan.UnitTests;

public class ApiExceptionHandlerTests
{
    [Fact]
    public async Task MapsArgumentExceptionToSafeBadRequestProblem()
    {
        var (context, body) = await HandleException(new ArgumentException("private validation detail"));

        context.Response.StatusCode.Should().Be(StatusCodes.Status400BadRequest);
        await AssertSafeProblem(body, "The request contains invalid data.", "private validation detail");
    }

    [Fact]
    public async Task MapsUnexpectedExceptionToSafeServerProblem()
    {
        var (context, body) = await HandleException(new InvalidOperationException("database password"));

        context.Response.StatusCode.Should().Be(StatusCodes.Status500InternalServerError);
        await AssertSafeProblem(body, "An unexpected error occurred. Try again later.", "database password");
    }

    private static async Task<(DefaultHttpContext Context, string Body)> HandleException(Exception exception)
    {
        var context = new DefaultHttpContext();
        context.Request.Path = "/api/customers";
        await using var body = new MemoryStream();
        context.Response.Body = body;

        var handler = new ApiExceptionHandler(NullLogger<ApiExceptionHandler>.Instance);
        (await handler.TryHandleAsync(context, exception, CancellationToken.None)).Should().BeTrue();

        body.Position = 0;
        using var reader = new StreamReader(body);
        return (context, await reader.ReadToEndAsync());
    }

    private static async Task AssertSafeProblem(string body, string expectedDetail, string sensitiveDetail)
    {
        using var problem = JsonDocument.Parse(body);
        problem.RootElement.GetProperty("detail").GetString().Should().Be(expectedDetail);
        body.Should().NotContain(sensitiveDetail);
    }
}