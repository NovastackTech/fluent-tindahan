using System.Net;
using System.Net.Mail;
using FluentTindahan.Application.Common.Interfaces;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace FluentTindahan.Infrastructure.Services;

public sealed class SmtpEmailOtpSender : IEmailOtpSender
{
    private readonly IConfiguration _configuration;
    private readonly ILogger<SmtpEmailOtpSender> _logger;
    private readonly IHostEnvironment? _environment;

    public SmtpEmailOtpSender(
        IConfiguration configuration,
        ILogger<SmtpEmailOtpSender> logger,
        IHostEnvironment? environment = null)
    {
        _configuration = configuration;
        _logger = logger;
        _environment = environment;
    }

    private bool IsDevelopment() =>
        _environment?.IsDevelopment() ??
        string.Equals(_configuration["ASPNETCORE_ENVIRONMENT"], "Development", StringComparison.OrdinalIgnoreCase);

    private bool IsDemoOrDev() =>
        IsDevelopment() ||
        string.Equals(_configuration["DemoMode"], "true", StringComparison.OrdinalIgnoreCase) ||
        string.Equals(_configuration["DEMO_MODE"], "true", StringComparison.OrdinalIgnoreCase);

    public async Task SendOtpAsync(
        string email,
        string otpCode,
        string? ownerName = null,
        CancellationToken cancellationToken = default)
    {
        var host = _configuration["Smtp:Host"] ?? _configuration["SMTP_HOST"];
        var portStr = _configuration["Smtp:Port"] ?? _configuration["SMTP_PORT"];
        var username = _configuration["Smtp:Username"] ?? _configuration["SMTP_USERNAME"] ?? _configuration["SMTP_USER"];
        var password = _configuration["Smtp:Password"] ?? _configuration["SMTP_PASSWORD"] ?? _configuration["SMTP_PASS"];
        var fromEmail = _configuration["Smtp:FromEmail"] ?? _configuration["SMTP_FROM_EMAIL"] ?? _configuration["SMTP_FROM"] ?? "noreply@fluent-tindahan.ph";
        var fromName = _configuration["Smtp:FromName"] ?? _configuration["SMTP_FROM_NAME"] ?? "Fluent Tindahan";
        var enableSslStr = _configuration["Smtp:EnableSsl"] ?? _configuration["SMTP_ENABLE_SSL"];

        int port = int.TryParse(portStr, out var p) ? p : 587;
        bool enableSsl = bool.TryParse(enableSslStr, out var ssl) ? ssl : (port != 25);

        var recipientName = string.IsNullOrWhiteSpace(ownerName) ? "Store Owner" : ownerName.Trim();

        // Fallback to console log if SMTP host is not configured (allowed in Development or DemoMode)
        if (string.IsNullOrWhiteSpace(host))
        {
            if (IsDemoOrDev())
            {
                _logger.LogWarning(
                    "[DEV/OFFLINE] SMTP host is not configured (Smtp:Host / SMTP_HOST). Email OTP dispatched for {Email} ({OwnerName}): {OtpCode}",
                    email,
                    recipientName,
                    otpCode);
                return;
            }

            _logger.LogError(
                "SMTP host is not configured (Smtp:Host / SMTP_HOST). Cannot send email OTP to {Email}",
                email);
            throw new InvalidOperationException("SMTP host is not configured (Smtp:Host / SMTP_HOST).");
        }

        try
        {
            using var client = new SmtpClient(host, port)
            {
                EnableSsl = enableSsl,
                DeliveryMethod = SmtpDeliveryMethod.Network,
                Timeout = 10000 // 10-second timeout
            };

            if (!string.IsNullOrWhiteSpace(username) && !string.IsNullOrWhiteSpace(password))
            {
                client.UseDefaultCredentials = false;
                client.Credentials = new NetworkCredential(username, password);
            }

            var fromAddress = new MailAddress(fromEmail, fromName);
            var toAddress = new MailAddress(email, recipientName);

            using var message = new MailMessage(fromAddress, toAddress)
            {
                Subject = $"Fluent Tindahan - Verification Code: {otpCode}",
                IsBodyHtml = true,
                Body = $@"
<div style=""font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; border: 1px solid #e1dfdd; border-radius: 8px; background-color: #ffffff;"">
  <div style=""text-align: center; margin-bottom: 20px;"">
    <div style=""display: inline-block; width: 44px; height: 44px; line-height: 44px; border-radius: 50%; background-color: #0F6CBD; font-size: 22px; color: #ffffff;"">🛒</div>
    <h2 style=""color: #242424; margin: 8px 0 0 0; font-size: 20px;"">Fluent Tindahan</h2>
  </div>
  <p style=""color: #424242; font-size: 15px; line-height: 1.5; margin-bottom: 16px;"">
    Kamusta <strong>{WebUtility.HtmlEncode(recipientName)}</strong>,
  </p>
  <p style=""color: #424242; font-size: 14px; line-height: 1.5; margin-bottom: 20px;"">
    Ito ang iyong 6-digit verification code para sa iyong Fluent Tindahan account:
  </p>
  <div style=""background-color: #f5f5f5; border: 1px dashed #0F6CBD; border-radius: 6px; padding: 18px; text-align: center; margin: 24px 0;"">
    <span style=""font-family: SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #0F6CBD;"">{otpCode}</span>
  </div>
  <p style=""color: #616161; font-size: 13px; line-height: 1.5; margin-bottom: 24px;"">
    Ang code na ito ay may bisa sa loob ng <strong>10 minuto</strong>. Huwag itong ibahagi kaninuman.</p>
  <hr style=""border: none; border-top: 1px solid #edebe9; margin: 20px 0;"" />
  <p style=""color: #8a8886; font-size: 12px; text-align: center; margin: 0;"">
    Fluent Tindahan &bull; Offline-First Sari-Sari Store Management
  </p>
</div>"
            };

            await client.SendMailAsync(message, cancellationToken);
            _logger.LogInformation("Successfully sent OTP email to {Email} via SMTP {Host}:{Port}", email, host, port);
        }
        catch (Exception ex)
        {
            if (IsDemoOrDev())
            {
                _logger.LogError(
                    ex,
                    "Failed to send OTP email to {Email} via SMTP {Host}:{Port}. Dev/Demo fallback OTP code: {OtpCode}",
                    email,
                    host,
                    port,
                    otpCode);
            }
            else
            {
                _logger.LogError(
                    ex,
                    "Failed to send OTP email to {Email} via SMTP {Host}:{Port}",
                    email,
                    host,
                    port);
            }

            // In development or demo mode, do not fail the request when SMTP host is offline
            if (!IsDemoOrDev())
            {
                throw;
            }
        }
    }
}
