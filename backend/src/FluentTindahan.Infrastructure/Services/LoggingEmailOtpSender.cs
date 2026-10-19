using Microsoft.Extensions.Logging;
using FluentTindahan.Application.Common.Interfaces;

namespace FluentTindahan.Infrastructure.Services;

public sealed class LoggingEmailOtpSender : IEmailOtpSender
{
    private readonly ILogger<LoggingEmailOtpSender> _logger;

    public LoggingEmailOtpSender(ILogger<LoggingEmailOtpSender> logger)
    {
        _logger = logger;
    }

    public Task SendOtpAsync(
        string email,
        string otpCode,
        string? ownerName = null,
        CancellationToken cancellationToken = default)
    {
        _logger.LogInformation(
            "Email OTP dispatched to {Email} ({OwnerName}): {OtpCode}",
            email,
            string.IsNullOrWhiteSpace(ownerName) ? "Store Owner" : ownerName,
            otpCode);
        return Task.CompletedTask;
    }
}
