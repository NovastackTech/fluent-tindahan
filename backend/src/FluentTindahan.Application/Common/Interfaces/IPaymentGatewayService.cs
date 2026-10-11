using FluentTindahan.Domain.Enums;

namespace FluentTindahan.Application.Common.Interfaces;

public record CheckoutSessionResult(
    string CheckoutUrl,
    string SessionId,
    string ReferenceNumber,
    decimal Amount,
    string Currency,
    PlanTier Tier,
    BillingCycle Cycle
);

/// <summary>
/// Raised for payment gateway failures. <see cref="Exception.Message"/> is always safe to show to clients;
/// gateway response bodies and other internals are only logged.
/// </summary>
public class PaymentGatewayException : Exception
{
    public PaymentGatewayException(string safeMessage) : base(safeMessage) { }
}

public interface IPaymentGatewayService
{
    /// <summary>
    /// Creates a hosted checkout session. Success/cancel redirect URLs are built server-side
    /// from configuration and are intentionally not accepted from callers.
    /// </summary>
    Task<CheckoutSessionResult> CreateCheckoutSessionAsync(
        Guid tenantId,
        PlanTier tier,
        BillingCycle cycle,
        CancellationToken cancellationToken = default);

    bool VerifyWebhookSignature(string jsonPayload, string signatureHeader);
}
