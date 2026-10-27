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
    public PaymentGatewayException(string safeMessage, Exception innerException) : base(safeMessage, innerException) { }
}

public record CheckoutSessionDetails(
    string SessionId,
    string Status,
    bool IsPaid,
    Guid TenantId,
    PlanTier Tier,
    BillingCycle Cycle,
    long AmountCentavos,
    string PaymentId,
    string PaymentMethod,
    string? Currency = null,
    DateTimeOffset? PaidAt = null,
    string? Purpose = null
);

public record CustomerBillingDetails(string Name, string? Email = null, string? Phone = null);

public record CreateQrPhPaymentIntentRequest(
    long AmountCentavos,
    string Description,
    string OrderId,
    CustomerBillingDetails Customer,
    Dictionary<string, string>? Metadata = null
);

public record QrPhPaymentIntentResult(
    string PaymentIntentId,
    string PaymentMethodId,
    string? ClientKey,
    string Status,
    long AmountCentavos,
    string QrCodeUrl,
    string OrderId,
    DateTimeOffset CreatedAt
);

public record QrPhPaymentStatusResult(
    string PaymentIntentId,
    string Status,
    bool IsPaid,
    long AmountCentavos,
    string? PaymentId = null,
    IReadOnlyDictionary<string, string>? Metadata = null,
    string? Currency = null,
    DateTimeOffset? PaidAt = null
);

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

    /// <summary>
    /// Retrieves a hosted checkout session directly from the gateway to confirm payment status,
    /// providing a resilient fallback when webhooks are delayed, unreachable, or unregistered.
    /// </summary>
    Task<CheckoutSessionDetails?> RetrieveCheckoutSessionAsync(
        string sessionId,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Executes the 3-step PayMongo dynamic QR Ph payment intent sequence:
    /// 1. Create Payment Intent (qrph method allowed)
    /// 2. Create Payment Method (type qrph)
    /// 3. Attach Payment Method to Intent, returning the generated QR code image URL.
    /// </summary>
    Task<QrPhPaymentIntentResult> CreateQrPhPaymentIntentAsync(
        CreateQrPhPaymentIntentRequest request,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Retrieves payment intent status directly from PayMongo to confirm payment completion.
    /// </summary>
    Task<QrPhPaymentStatusResult> RetrievePaymentIntentStatusAsync(
        string paymentIntentId,
        CancellationToken cancellationToken = default);

    bool VerifyWebhookSignature(string jsonPayload, string signatureHeader);
}
