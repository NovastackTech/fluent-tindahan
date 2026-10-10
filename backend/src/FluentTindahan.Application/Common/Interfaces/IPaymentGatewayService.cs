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

public interface IPaymentGatewayService
{
    Task<CheckoutSessionResult> CreateCheckoutSessionAsync(
        Guid tenantId,
        PlanTier tier,
        BillingCycle cycle,
        string successUrl,
        string cancelUrl,
        CancellationToken cancellationToken = default);

    bool VerifyWebhookSignature(string jsonPayload, string signatureHeader);
}
