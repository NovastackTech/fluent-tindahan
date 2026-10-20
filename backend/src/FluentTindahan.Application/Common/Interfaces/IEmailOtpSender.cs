namespace FluentTindahan.Application.Common.Interfaces;

public interface IEmailOtpSender
{
    Task SendOtpAsync(string email, string otpCode, string? ownerName = null, CancellationToken cancellationToken = default);
}
