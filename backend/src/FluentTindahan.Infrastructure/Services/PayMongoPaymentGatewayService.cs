using System.Globalization;
using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using FluentTindahan.Application.Common.Interfaces;
using FluentTindahan.Domain.Billing;
using FluentTindahan.Domain.Enums;

namespace FluentTindahan.Infrastructure.Services;

public class PayMongoPaymentGatewayService : IPaymentGatewayService
{
    /// <summary>Maximum age (and future clock skew) accepted for a signed webhook's <c>t=</c> timestamp.</summary>
    public static readonly TimeSpan WebhookTimestampTolerance = TimeSpan.FromMinutes(5);

    public const string DevelopmentFrontendOrigin = "http://localhost:5173";

    private readonly HttpClient _httpClient;
    private readonly IConfiguration _configuration;
    private readonly IHostEnvironment _environment;
    private readonly TimeProvider _timeProvider;
    private readonly ILogger<PayMongoPaymentGatewayService> _logger;

    public PayMongoPaymentGatewayService(
        HttpClient httpClient,
        IConfiguration configuration,
        IHostEnvironment environment,
        TimeProvider timeProvider,
        ILogger<PayMongoPaymentGatewayService> logger)
    {
        _httpClient = httpClient;
        _configuration = configuration;
        _environment = environment;
        _timeProvider = timeProvider;
        _logger = logger;
    }

    /// <summary>Peso price for a tier/cycle. Derived from the canonical centavo price list.</summary>
    public static decimal GetTierPrice(PlanTier tier, BillingCycle cycle)
        => TierPricing.ToPesos(TierPricing.GetPriceCentavos(tier, cycle));

    /// <summary>
    /// Fails fast at startup when PayMongo secrets or the frontend origin are missing outside Development.
    /// A missing webhook secret must never silently downgrade signature verification.
    /// </summary>
    public static void ValidateConfiguration(IConfiguration configuration, IHostEnvironment environment)
    {
        if (environment.IsDevelopment()) return;

        var missing = new List<string>();
        if (IsMissingOrMock(configuration["PayMongo:WebhookSecret"])) missing.Add("PayMongo:WebhookSecret");
        if (IsMissingOrMock(configuration["PayMongo:SecretKey"])) missing.Add("PayMongo:SecretKey");
        if (!TryGetHttpOrigin(configuration["PayMongo:FrontendOrigin"], out _)) missing.Add("PayMongo:FrontendOrigin");

        if (missing.Count > 0)
        {
            throw new InvalidOperationException(
                $"Billing is misconfigured for environment '{environment.EnvironmentName}'. " +
                $"Missing or invalid settings: {string.Join(", ", missing)}.");
        }
    }

    public async Task<CheckoutSessionResult> CreateCheckoutSessionAsync(
        Guid tenantId,
        PlanTier tier,
        BillingCycle cycle,
        CancellationToken cancellationToken = default)
    {
        if (tier == PlanTier.Libre)
        {
            throw new InvalidOperationException("Cannot create a checkout session for Libre tier.");
        }

        var amountInCentavos = TierPricing.GetPriceCentavos(tier, cycle);
        var amount = TierPricing.ToPesos(amountInCentavos);
        var refNo = $"sub_{tenantId.ToString("N")[..8]}_{_timeProvider.GetUtcNow().ToUnixTimeMilliseconds()}_{Guid.NewGuid().ToString("N")[..8]}";
        var tierDisplayName = tier == PlanTier.TindahanPro ? "Tindahan Pro" : "Negosyo Plus";
        var cycleDisplayName = cycle == BillingCycle.Weekly ? "Weekly" : "Monthly";
        var lineItemName = $"Fluent Tindahan - {tierDisplayName} ({cycleDisplayName})";

        // Redirect targets are built server-side from configuration only (never from client input)
        // to prevent open-redirect / phishing via PayMongo's hosted checkout.
        var origin = GetFrontendOrigin();
        var successUrl = $"{origin}/?billing=success";
        var cancelUrl = $"{origin}/?billing=cancel";

        var secretKey = _configuration["PayMongo:SecretKey"];

        if (IsMissingOrMock(secretKey))
        {
            if (!_environment.IsDevelopment())
            {
                throw new PaymentGatewayException("Payment gateway is not configured.");
            }

            _logger.LogInformation("PayMongo SecretKey not configured (Development). Returning simulated checkout session for tenant {TenantId}, tier {Tier}, ref {RefNo}",
                tenantId, tier, refNo);

            var mockSessionId = $"cs_mock_{Guid.NewGuid():N}";
            return new CheckoutSessionResult(
                CheckoutUrl: $"{successUrl}&mock_paid=true&ref={refNo}&tier={tier}",
                SessionId: mockSessionId,
                ReferenceNumber: refNo,
                Amount: amount,
                Currency: "PHP",
                Tier: tier,
                Cycle: cycle
            );
        }

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

        var authBytes = Encoding.UTF8.GetBytes($"{secretKey!.Trim()}:");
        requestMessage.Headers.Authorization = new AuthenticationHeaderValue("Basic", Convert.ToBase64String(authBytes));

        var response = await _httpClient.SendAsync(requestMessage, cancellationToken);
        var responseContent = await response.Content.ReadAsStringAsync(cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            // Full gateway response is logged server-side only; never echoed to the client.
            _logger.LogError("PayMongo checkout session creation failed. Status: {StatusCode}, Response: {Response}",
                response.StatusCode, responseContent);
            throw new PaymentGatewayException("Unable to create checkout session with the payment gateway.");
        }

        using var doc = JsonDocument.Parse(responseContent);
        var dataElem = doc.RootElement.GetProperty("data");
        var sessionId = dataElem.GetProperty("id").GetString() ?? refNo;
        var attributes = dataElem.GetProperty("attributes");
        var checkoutUrl = attributes.GetProperty("checkout_url").GetString()
            ?? throw new PaymentGatewayException("Payment gateway returned an invalid checkout session.");

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

    /// <summary>
    /// Verifies a <c>Paymongo-Signature</c> header (<c>t=&lt;unix&gt;,te=&lt;hmac&gt;,li=&lt;hmac&gt;</c>).
    /// Fails closed: a missing secret is only tolerated in Development, timestamps older than
    /// <see cref="WebhookTimestampTolerance"/> are rejected, and Production only accepts the live-mode <c>li</c> signature.
    /// </summary>
    public bool VerifyWebhookSignature(string jsonPayload, string signatureHeader)
    {
        var webhookSecret = _configuration["PayMongo:WebhookSecret"];
        if (IsMissingOrMock(webhookSecret))
        {
            if (_environment.IsDevelopment())
            {
                _logger.LogWarning("PayMongo:WebhookSecret not configured; accepting unsigned webhook (Development only).");
                return true;
            }

            _logger.LogError("PayMongo:WebhookSecret is not configured; rejecting webhook.");
            return false;
        }

        if (string.IsNullOrWhiteSpace(signatureHeader))
        {
            return false;
        }

        try
        {
            var signatureKey = _environment.IsProduction() ? "li" : "te";
            string? timestamp = null;
            string? expectedHash = null;

            foreach (var part in signatureHeader.Split(','))
            {
                var kv = part.Trim().Split('=', 2);
                if (kv.Length != 2) continue;

                if (kv[0].Equals("t", StringComparison.Ordinal))
                {
                    timestamp = kv[1];
                }
                else if (kv[0].Equals(signatureKey, StringComparison.Ordinal))
                {
                    expectedHash = kv[1];
                }
            }

            if (string.IsNullOrEmpty(timestamp) || string.IsNullOrEmpty(expectedHash))
            {
                return false;
            }

            if (!long.TryParse(timestamp, NumberStyles.None, CultureInfo.InvariantCulture, out var unixSeconds))
            {
                return false;
            }

            var signedAt = DateTimeOffset.FromUnixTimeSeconds(unixSeconds);
            var age = _timeProvider.GetUtcNow() - signedAt;
            if (age > WebhookTimestampTolerance || age < -WebhookTimestampTolerance)
            {
                _logger.LogWarning("Rejecting PayMongo webhook with stale/future timestamp {SignedAt} (age {Age}).", signedAt, age);
                return false;
            }

            var signaturePayload = $"{timestamp}.{jsonPayload}";
            using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(webhookSecret!));
            var computedHash = Convert.ToHexString(hmac.ComputeHash(Encoding.UTF8.GetBytes(signaturePayload))).ToLowerInvariant();

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

    private string GetFrontendOrigin()
    {
        if (TryGetHttpOrigin(_configuration["PayMongo:FrontendOrigin"], out var origin))
        {
            return origin;
        }

        if (_environment.IsDevelopment())
        {
            return DevelopmentFrontendOrigin;
        }

        throw new PaymentGatewayException("Payment gateway is not configured.");
    }

    private static bool TryGetHttpOrigin(string? value, out string origin)
    {
        origin = string.Empty;
        if (string.IsNullOrWhiteSpace(value) ||
            !Uri.TryCreate(value.Trim(), UriKind.Absolute, out var uri) ||
            (uri.Scheme != Uri.UriSchemeHttps && uri.Scheme != Uri.UriSchemeHttp))
        {
            return false;
        }

        origin = uri.GetLeftPart(UriPartial.Authority);
        return true;
    }

    private static bool IsMissingOrMock(string? value) =>
        string.IsNullOrWhiteSpace(value) ||
        value.Equals("mock-secret", StringComparison.OrdinalIgnoreCase) ||
        value.StartsWith("mock_", StringComparison.OrdinalIgnoreCase);
}
