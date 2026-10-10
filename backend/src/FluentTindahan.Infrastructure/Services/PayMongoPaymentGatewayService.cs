using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using FluentTindahan.Application.Common.Interfaces;
using FluentTindahan.Domain.Enums;

namespace FluentTindahan.Infrastructure.Services;

public class PayMongoPaymentGatewayService : IPaymentGatewayService
{
    private readonly HttpClient _httpClient;
    private readonly IConfiguration _configuration;
    private readonly ILogger<PayMongoPaymentGatewayService> _logger;

    public PayMongoPaymentGatewayService(
        HttpClient httpClient,
        IConfiguration configuration,
        ILogger<PayMongoPaymentGatewayService> logger)
    {
        _httpClient = httpClient;
        _configuration = configuration;
        _logger = logger;
    }

    public static decimal GetTierPrice(PlanTier tier, BillingCycle cycle)
    {
        return (tier, cycle) switch
        {
            (PlanTier.TindahanPro, BillingCycle.Weekly) => 35.00m,
            (PlanTier.TindahanPro, BillingCycle.Monthly) => 129.00m,
            (PlanTier.NegosyoPlus, BillingCycle.Weekly) => 89.00m,
            (PlanTier.NegosyoPlus, BillingCycle.Monthly) => 349.00m,
            _ => throw new InvalidOperationException($"Invalid tier '{tier}' or cannot purchase free tier.")
        };
    }

    public async Task<CheckoutSessionResult> CreateCheckoutSessionAsync(
        Guid tenantId,
        PlanTier tier,
        BillingCycle cycle,
        string successUrl,
        string cancelUrl,
        CancellationToken cancellationToken = default)
    {
        if (tier == PlanTier.Libre)
        {
            throw new InvalidOperationException("Cannot create a checkout session for Libre tier.");
        }

        var amount = GetTierPrice(tier, cycle);
        var amountInCentavos = (long)Math.Round(amount * 100);
        var refNo = $"sub_{tenantId.ToString("N")[..8]}_{DateTimeOffset.UtcNow.ToUnixTimeSeconds()}";
        var tierDisplayName = tier == PlanTier.TindahanPro ? "Tindahan Pro" : "Negosyo Plus";
        var cycleDisplayName = cycle == BillingCycle.Weekly ? "Weekly" : "Monthly";
        var lineItemName = $"Fluent Tindahan - {tierDisplayName} ({cycleDisplayName})";

        var secretKey = _configuration["PayMongo:SecretKey"];

        // If no API key configured or running in development without credentials, use mock session
        if (string.IsNullOrWhiteSpace(secretKey) || secretKey.StartsWith("mock_", StringComparison.OrdinalIgnoreCase))
        {
            _logger.LogInformation("PayMongo SecretKey not configured. Returning simulated checkout session for tenant {TenantId}, tier {Tier}, ref {RefNo}",
                tenantId, tier, refNo);

            var mockSessionId = $"cs_mock_{Guid.NewGuid():N}";
            var fallbackCheckoutUrl = string.IsNullOrWhiteSpace(successUrl)
                ? $"https://checkout.paymongo.com/{mockSessionId}"
                : (successUrl.Contains('?') ? $"{successUrl}&mock_paid=true&ref={refNo}&tier={tier}" : $"{successUrl}?mock_paid=true&ref={refNo}&tier={tier}");

            return new CheckoutSessionResult(
                CheckoutUrl: fallbackCheckoutUrl,
                SessionId: mockSessionId,
                ReferenceNumber: refNo,
                Amount: amount,
                Currency: "PHP",
                Tier: tier,
                Cycle: cycle
            );
        }

        // Real PayMongo API call
        var requestPayload = new
        {
            data = new
            {
                attributes = new
                {
                    billing = new
                    {
                        name = "Fluent Tindahan Subscriber"
                    },
                    send_email_receipt = false,
                    show_description = true,
                    show_line_items = true,
                    line_items = new[]
                    {
                        new
                        {
                            currency = "PHP",
                            amount = amountInCentavos,
                            name = lineItemName,
                            quantity = 1
                        }
                    },
                    payment_method_types = new[] { "gcash", "paymaya", "card", "grab_pay", "dob", "dob_ubp" },
                    description = $"Fluent Tindahan Subscription for {tierDisplayName}",
                    success_url = successUrl,
                    cancel_url = cancelUrl,
                    metadata = new Dictionary<string, string>
                    {
                        { "tenant_id", tenantId.ToString() },
                        { "tier", tier.ToString() },
                        { "cycle", cycle.ToString() },
                        { "reference_number", refNo }
                    },
                    reference_number = refNo
                }
            }
        };

        var requestMessage = new HttpRequestMessage(HttpMethod.Post, "https://api.paymongo.com/v1/checkout_sessions")
        {
            Content = new StringContent(JsonSerializer.Serialize(requestPayload), Encoding.UTF8, "application/json")
        };

        var authBytes = Encoding.UTF8.GetBytes($"{secretKey.Trim()}:");
        requestMessage.Headers.Authorization = new AuthenticationHeaderValue("Basic", Convert.ToBase64String(authBytes));

        var response = await _httpClient.SendAsync(requestMessage, cancellationToken);
        var responseContent = await response.Content.ReadAsStringAsync(cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            _logger.LogError("PayMongo checkout session creation failed. Status: {StatusCode}, Response: {Response}",
                response.StatusCode, responseContent);
            throw new InvalidOperationException($"PayMongo checkout creation failed: {response.StatusCode} - {responseContent}");
        }

        using var doc = JsonDocument.Parse(responseContent);
        var dataElem = doc.RootElement.GetProperty("data");
        var sessionId = dataElem.GetProperty("id").GetString() ?? refNo;
        var attributes = dataElem.GetProperty("attributes");
        var checkoutUrl = attributes.GetProperty("checkout_url").GetString()
            ?? throw new InvalidOperationException("PayMongo response missing checkout_url");

        return new CheckoutSessionResult(
            CheckoutUrl: checkoutUrl,
            SessionId: sessionId,
            ReferenceNumber: refNo,
            Amount: amount,
            Currency: "PHP",
            Tier: tier,
            Cycle: cycle
        );
    }

    public bool VerifyWebhookSignature(string jsonPayload, string signatureHeader)
    {
        var webhookSecret = _configuration["PayMongo:WebhookSecret"] ?? "mock-secret";
        if (string.IsNullOrWhiteSpace(webhookSecret) || webhookSecret.Equals("mock-secret", StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        if (string.IsNullOrWhiteSpace(signatureHeader))
        {
            return false;
        }

        try
        {
            // Format: t=1614234567,te=signature_hash or li=signature_hash
            var parts = signatureHeader.Split(',');
            string? timestamp = null;
            string? expectedHash = null;

            foreach (var part in parts)
            {
                var kv = part.Trim().Split('=', 2);
                if (kv.Length != 2) continue;

                if (kv[0].Equals("t", StringComparison.OrdinalIgnoreCase))
                {
                    timestamp = kv[1];
                }
                else if (kv[0].Equals("te", StringComparison.OrdinalIgnoreCase) || kv[0].Equals("li", StringComparison.OrdinalIgnoreCase))
                {
                    expectedHash = kv[1];
                }
            }

            if (string.IsNullOrEmpty(timestamp) || string.IsNullOrEmpty(expectedHash))
            {
                return false;
            }

            var signaturePayload = $"{timestamp}.{jsonPayload}";
            using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(webhookSecret));
            var computedHashBytes = hmac.ComputeHash(Encoding.UTF8.GetBytes(signaturePayload));
            var computedHash = Convert.ToHexString(computedHashBytes).ToLowerInvariant();

            return CryptographicOperations.FixedTimeEquals(
                Encoding.UTF8.GetBytes(computedHash),
                Encoding.UTF8.GetBytes(expectedHash.ToLowerInvariant())
            );
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error while verifying PayMongo webhook signature.");
            return false;
        }
    }
}
