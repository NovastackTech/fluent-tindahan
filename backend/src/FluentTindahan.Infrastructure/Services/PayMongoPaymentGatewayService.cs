using System.Collections.Concurrent;
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
    private static readonly ConcurrentDictionary<string, (long AmountCentavos, IReadOnlyDictionary<string, string>? Metadata)> _mockIntents = new();

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
                    payment_method_types = new[] { "qrph", "gcash", "paymaya", "card", "grab_pay", "dob", "dob_ubp" },
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

        HttpResponseMessage response;
        string responseContent;
        try
        {
            response = await _httpClient.SendAsync(requestMessage, cancellationToken);
            responseContent = await response.Content.ReadAsStringAsync(cancellationToken);
        }
        catch (HttpRequestException ex)
        {
            _logger.LogError(ex, "Could not connect to PayMongo while creating a checkout session for tenant {TenantId}.", tenantId);
            throw new PaymentGatewayException("Payment gateway is temporarily unavailable. Please try again later.", ex);
        }
        catch (TaskCanceledException ex) when (!cancellationToken.IsCancellationRequested)
        {
            _logger.LogError(ex, "PayMongo timed out while creating a checkout session for tenant {TenantId}.", tenantId);
            throw new PaymentGatewayException("Payment gateway timed out. Please try again later.", ex);
        }

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
    /// Retrieves a hosted checkout session directly from PayMongo to confirm payment status,
    /// providing a resilient fallback when webhooks are delayed, unreachable, or unregistered.
    /// </summary>
    public async Task<CheckoutSessionDetails?> RetrieveCheckoutSessionAsync(
        string sessionId,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(sessionId))
        {
            return null;
        }

        var secretKey = _configuration["PayMongo:SecretKey"];

        if (IsMissingOrMock(secretKey) || sessionId.StartsWith("cs_mock_"))
        {
            if (!_environment.IsDevelopment())
            {
                throw new PaymentGatewayException("Payment gateway is not configured.");
            }

            _logger.LogInformation("Retrieving mock checkout session {SessionId} (Development).", sessionId);

            return new CheckoutSessionDetails(
                SessionId: sessionId,
                Status: "paid",
                IsPaid: true,
                TenantId: Guid.Empty,
                Tier: PlanTier.TindahanPro,
                Cycle: BillingCycle.Monthly,
                AmountCentavos: TierPricing.GetPriceCentavos(PlanTier.TindahanPro, BillingCycle.Monthly),
                PaymentId: $"pay_mock_{Guid.NewGuid():N}",
                PaymentMethod: "mock"
            );
        }

        var requestMessage = new HttpRequestMessage(HttpMethod.Get, $"https://api.paymongo.com/v1/checkout_sessions/{sessionId}");
        var authBytes = Encoding.UTF8.GetBytes($"{secretKey!.Trim()}:");
        requestMessage.Headers.Authorization = new AuthenticationHeaderValue("Basic", Convert.ToBase64String(authBytes));

        HttpResponseMessage response;
        string responseContent;
        try
        {
            response = await _httpClient.SendAsync(requestMessage, cancellationToken);
            responseContent = await response.Content.ReadAsStringAsync(cancellationToken);
        }
        catch (HttpRequestException ex)
        {
            _logger.LogError(ex, "Could not connect to PayMongo while retrieving checkout session {SessionId}.", sessionId);
            throw new PaymentGatewayException("Payment gateway is temporarily unavailable. Please try again later.", ex);
        }
        catch (TaskCanceledException ex) when (!cancellationToken.IsCancellationRequested)
        {
            _logger.LogError(ex, "PayMongo timed out while retrieving checkout session {SessionId}.", sessionId);
            throw new PaymentGatewayException("Payment gateway timed out. Please try again later.", ex);
        }

        if (!response.IsSuccessStatusCode)
        {
            _logger.LogWarning("PayMongo checkout session retrieval failed for {SessionId}. Status: {StatusCode}, Response: {Response}",
                sessionId, response.StatusCode, responseContent);
            return null;
        }

        try
        {
            using var doc = JsonDocument.Parse(responseContent);
            var root = doc.RootElement;
            if (!root.TryGetProperty("data", out var dataElem) ||
                !dataElem.TryGetProperty("attributes", out var attrElem))
            {
                return null;
            }

            var status = attrElem.TryGetProperty("status", out var statusElem) ? statusElem.GetString() ?? string.Empty : string.Empty;
            var isPaid = string.Equals(status, "paid", StringComparison.OrdinalIgnoreCase);

            Guid tenantId = Guid.Empty;
            PlanTier tier = PlanTier.Libre;
            BillingCycle cycle = BillingCycle.Monthly;

            if (attrElem.TryGetProperty("metadata", out var metaElem) && metaElem.ValueKind == JsonValueKind.Object)
            {
                if (metaElem.TryGetProperty("tenant_id", out var tElem) && Guid.TryParse(tElem.GetString(), out var parsedTenantId))
                {
                    tenantId = parsedTenantId;
                }

                if ((metaElem.TryGetProperty("tier", out var tierElem) || metaElem.TryGetProperty("target_tier", out tierElem)) &&
                    Enum.TryParse<PlanTier>(tierElem.GetString(), ignoreCase: true, out var parsedTier) &&
                    Enum.IsDefined(parsedTier))
                {
                    tier = parsedTier;
                }

                if (metaElem.TryGetProperty("cycle", out var cycleElem) &&
                    Enum.TryParse<BillingCycle>(cycleElem.GetString(), ignoreCase: true, out var parsedCycle) &&
                    Enum.IsDefined(parsedCycle))
                {
                    cycle = parsedCycle;
                }
            }

            // Find paid payment if present
            string paymentId = sessionId;
            string paymentMethod = "paymongo";
            long amountCentavos = tier != PlanTier.Libre ? TierPricing.GetPriceCentavos(tier, cycle) : 0;

            if (attrElem.TryGetProperty("payments", out var paymentsElem) &&
                paymentsElem.ValueKind == JsonValueKind.Array)
            {
                foreach (var p in paymentsElem.EnumerateArray())
                {
                    var pid = p.TryGetProperty("id", out var idElem) ? idElem.GetString() : null;
                    if (string.IsNullOrWhiteSpace(pid) ||
                        !p.TryGetProperty("attributes", out var pAttr) ||
                        pAttr.ValueKind != JsonValueKind.Object)
                    {
                        continue;
                    }

                    var pStatus = pAttr.TryGetProperty("status", out var psElem) ? psElem.GetString() : null;
                    if (string.Equals(pStatus, "paid", StringComparison.OrdinalIgnoreCase))
                    {
                        paymentId = pid;
                        isPaid = true;

                        if (pAttr.TryGetProperty("amount", out var amtElem) && amtElem.TryGetInt64(out var amt))
                        {
                            amountCentavos = amt;
                        }

                        if (pAttr.TryGetProperty("source", out var srcElem) &&
                            srcElem.ValueKind == JsonValueKind.Object &&
                            srcElem.TryGetProperty("type", out var typeElem))
                        {
                            paymentMethod = typeElem.GetString() ?? paymentMethod;
                        }

                        break;
                    }
                }
            }

            if (!isPaid &&
                attrElem.TryGetProperty("payment_intent", out var piElem) &&
                piElem.ValueKind == JsonValueKind.Object &&
                piElem.TryGetProperty("attributes", out var piAttr) &&
                piAttr.ValueKind == JsonValueKind.Object)
            {
                var piStatus = piAttr.TryGetProperty("status", out var pisElem) ? pisElem.GetString() : null;
                if (string.Equals(piStatus, "succeeded", StringComparison.OrdinalIgnoreCase))
                {
                    isPaid = true;
                    if (piElem.TryGetProperty("id", out var piIdElem) && !string.IsNullOrWhiteSpace(piIdElem.GetString()))
                    {
                        paymentId = piIdElem.GetString()!;
                    }
                    if (piAttr.TryGetProperty("amount", out var piAmtElem) && piAmtElem.TryGetInt64(out var piAmt))
                    {
                        amountCentavos = piAmt;
                    }
                }

                if (piAttr.TryGetProperty("payments", out var piPayments) &&
                    piPayments.ValueKind == JsonValueKind.Array)
                {
                    foreach (var p in piPayments.EnumerateArray())
                    {
                        var pid = p.TryGetProperty("id", out var idElem) ? idElem.GetString() : null;
                        if (string.IsNullOrWhiteSpace(pid) ||
                            !p.TryGetProperty("attributes", out var pAttr) ||
                            pAttr.ValueKind != JsonValueKind.Object)
                        {
                            continue;
                        }

                        var pStatus = pAttr.TryGetProperty("status", out var psElem) ? psElem.GetString() : null;
                        if (string.Equals(pStatus, "paid", StringComparison.OrdinalIgnoreCase))
                        {
                            paymentId = pid;
                            isPaid = true;
                            if (pAttr.TryGetProperty("amount", out var amtElem) && amtElem.TryGetInt64(out var amt))
                            {
                                amountCentavos = amt;
                            }
                            if (pAttr.TryGetProperty("source", out var srcElem) &&
                                srcElem.ValueKind == JsonValueKind.Object &&
                                srcElem.TryGetProperty("type", out var typeElem))
                            {
                                paymentMethod = typeElem.GetString() ?? paymentMethod;
                            }
                            break;
                        }
                    }
                }
            }

            return new CheckoutSessionDetails(
                SessionId: sessionId,
                Status: status,
                IsPaid: isPaid,
                TenantId: tenantId,
                Tier: tier,
                Cycle: cycle,
                AmountCentavos: amountCentavos,
                PaymentId: paymentId,
                PaymentMethod: paymentMethod
            );
        }
        catch (JsonException ex)
        {
            _logger.LogError(ex, "Failed to parse PayMongo checkout session response for {SessionId}.", sessionId);
            return null;
        }
    }

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
            var isTestSecret = webhookSecret!.Contains("test", StringComparison.OrdinalIgnoreCase) ||
                (_configuration["PayMongo:SecretKey"]?.Trim().StartsWith("sk_test_", StringComparison.OrdinalIgnoreCase) ?? false);
            var mustRequireLiveSignature = _environment.IsProduction() && !isTestSecret;

            string? timestamp = null;
            string? teHash = null;
            string? liHash = null;

            foreach (var part in signatureHeader.Split(','))
            {
                var kv = part.Trim().Split('=', 2);
                if (kv.Length != 2) continue;

                if (kv[0].Equals("t", StringComparison.OrdinalIgnoreCase))
                {
                    timestamp = kv[1];
                }
                else if (kv[0].Equals("te", StringComparison.OrdinalIgnoreCase))
                {
                    teHash = kv[1];
                }
                else if (kv[0].Equals("li", StringComparison.OrdinalIgnoreCase))
                {
                    liHash = kv[1];
                }
            }

            var expectedHash = mustRequireLiveSignature ? liHash : (teHash ?? liHash);

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

    public async Task<QrPhPaymentIntentResult> CreateQrPhPaymentIntentAsync(
        CreateQrPhPaymentIntentRequest request,
        CancellationToken cancellationToken = default)
    {
        if (request.AmountCentavos < 100)
        {
            throw new PaymentGatewayException("Minimum amount for QR Ph is ₱1.00 (100 centavos).");
        }

        var secretKey = _configuration["PayMongo:SecretKey"];

        if (IsMissingOrMock(secretKey))
        {
            if (!_environment.IsDevelopment())
            {
                throw new PaymentGatewayException("Payment gateway is not configured.");
            }

            _logger.LogInformation("PayMongo SecretKey not configured (Development). Simulating QR Ph payment intent for order {OrderId}, amount {Amount}",
                request.OrderId, request.AmountCentavos);

            var mockIntentId = $"pi_mock_{Guid.NewGuid():N}";
            var mockMethodId = $"pm_mock_{Guid.NewGuid():N}";
            var mockSvg = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><rect width='240' height='240' fill='%23ffffff'/><text x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='16' fill='%230078d4'>QR Ph Simulation</text></svg>";

            _mockIntents[mockIntentId] = (request.AmountCentavos, request.Metadata);

            return new QrPhPaymentIntentResult(
                PaymentIntentId: mockIntentId,
                PaymentMethodId: mockMethodId,
                ClientKey: "mock_client_key",
                Status: "awaiting_next_action",
                AmountCentavos: request.AmountCentavos,
                QrCodeUrl: mockSvg,
                OrderId: request.OrderId,
                CreatedAt: _timeProvider.GetUtcNow()
            );
        }

        var authHeader = new AuthenticationHeaderValue("Basic", Convert.ToBase64String(Encoding.UTF8.GetBytes($"{secretKey!.Trim()}:")));

        // Step 1A: POST /payment_intents
        var intentPayload = new
        {
            data = new
            {
                attributes = new
                {
                    amount = request.AmountCentavos,
                    payment_method_allowed = new[] { "qrph" },
                    payment_method_options = new
                    {
                        card = new { request_three_d_secure = "any" }
                    },
                    currency = "PHP",
                    description = request.Description,
                    statement_descriptor = "Fluent Tindahan",
                    metadata = request.Metadata ?? new Dictionary<string, string>
                    {
                        { "order_id", request.OrderId }
                    }
                }
            }
        };

        try
        {
            var intentResponse = await SendPayMongoJsonAsync(HttpMethod.Post, "payment_intents", intentPayload, authHeader, cancellationToken);
            using var intentDoc = JsonDocument.Parse(intentResponse);
            var intentData = intentDoc.RootElement.GetProperty("data");
            var paymentIntentId = intentData.GetProperty("id").GetString()
                ?? throw new PaymentGatewayException("PayMongo returned empty payment intent id.");
            var clientKey = intentData.GetProperty("attributes").TryGetProperty("client_key", out var ck) ? ck.GetString() : null;

            // Step 1B: POST /payment_methods
            var methodPayload = new
            {
                data = new
                {
                    attributes = new
                    {
                        type = "qrph",
                        billing = new
                        {
                            name = request.Customer.Name,
                            email = request.Customer.Email ?? "suki@fluent-tindahan.ph",
                            phone = request.Customer.Phone ?? "09000000000"
                        }
                    }
                }
            };

            var methodResponse = await SendPayMongoJsonAsync(HttpMethod.Post, "payment_methods", methodPayload, authHeader, cancellationToken);
            using var methodDoc = JsonDocument.Parse(methodResponse);
            var paymentMethodId = methodDoc.RootElement.GetProperty("data").GetProperty("id").GetString()
                ?? throw new PaymentGatewayException("PayMongo returned empty payment method id.");

            // Step 1C: POST /payment_intents/{intentId}/attach
            var attachPayload = new
            {
                data = new
                {
                    attributes = new
                    {
                        payment_method = paymentMethodId,
                        client_key = clientKey
                    }
                }
            };

            var attachResponse = await SendPayMongoJsonAsync(HttpMethod.Post, $"payment_intents/{paymentIntentId}/attach", attachPayload, authHeader, cancellationToken);
            using var attachDoc = JsonDocument.Parse(attachResponse);
            var attachAttr = attachDoc.RootElement.GetProperty("data").GetProperty("attributes");
            var status = attachAttr.GetProperty("status").GetString() ?? "awaiting_next_action";

            string qrCodeUrl = string.Empty;
            if (attachAttr.TryGetProperty("next_action", out var nextAction) &&
                nextAction.ValueKind == JsonValueKind.Object &&
                nextAction.TryGetProperty("code", out var code) &&
                code.ValueKind == JsonValueKind.Object &&
                code.TryGetProperty("image_url", out var imgUrl))
            {
                qrCodeUrl = imgUrl.GetString() ?? string.Empty;
            }

            return new QrPhPaymentIntentResult(
                PaymentIntentId: paymentIntentId,
                PaymentMethodId: paymentMethodId,
                ClientKey: clientKey,
                Status: status,
                AmountCentavos: request.AmountCentavos,
                QrCodeUrl: qrCodeUrl,
                OrderId: request.OrderId,
                CreatedAt: _timeProvider.GetUtcNow()
            );
        }
        catch (PaymentGatewayException)
        {
            throw;
        }
        catch (Exception ex) when (ex is JsonException or KeyNotFoundException or InvalidOperationException)
        {
            _logger.LogError(ex, "Failed to parse PayMongo response while creating QR Ph payment intent.");
            throw new PaymentGatewayException("Payment gateway returned an invalid or malformed response.", ex);
        }
    }

    public async Task<QrPhPaymentStatusResult> RetrievePaymentIntentStatusAsync(
        string paymentIntentId,
        CancellationToken cancellationToken = default)
    {
        var secretKey = _configuration["PayMongo:SecretKey"];
        if (IsMissingOrMock(secretKey))
        {
            if (!_environment.IsDevelopment())
            {
                throw new PaymentGatewayException("Payment gateway is not configured.");
            }

            if (_mockIntents.TryGetValue(paymentIntentId, out var mockData))
            {
                return new QrPhPaymentStatusResult(
                    PaymentIntentId: paymentIntentId,
                    Status: "succeeded",
                    IsPaid: true,
                    AmountCentavos: mockData.AmountCentavos,
                    PaymentId: $"pay_mock_{paymentIntentId}",
                    Metadata: mockData.Metadata
                );
            }

            if (paymentIntentId.StartsWith("pi_mock_", StringComparison.OrdinalIgnoreCase))
            {
                return new QrPhPaymentStatusResult(
                    PaymentIntentId: paymentIntentId,
                    Status: "succeeded",
                    IsPaid: true,
                    AmountCentavos: 0,
                    PaymentId: $"pay_mock_{paymentIntentId}",
                    Metadata: null
                );
            }

            throw new PaymentGatewayException($"Payment intent '{paymentIntentId}' not found.");
        }

        var authHeader = new AuthenticationHeaderValue("Basic", Convert.ToBase64String(Encoding.UTF8.GetBytes($"{secretKey!.Trim()}:")));
        var responseContent = await SendPayMongoJsonAsync(HttpMethod.Get, $"payment_intents/{paymentIntentId}", null, authHeader, cancellationToken);

        try
        {
            using var doc = JsonDocument.Parse(responseContent);
            var dataAttr = doc.RootElement.GetProperty("data").GetProperty("attributes");
            var status = dataAttr.GetProperty("status").GetString() ?? "unknown";
            var amount = dataAttr.GetProperty("amount").GetInt64();
            var isPaid = string.Equals(status, "succeeded", StringComparison.OrdinalIgnoreCase);

            string? paymentId = null;
            if (dataAttr.TryGetProperty("payments", out var payments) &&
                payments.ValueKind == JsonValueKind.Array &&
                payments.GetArrayLength() > 0)
            {
                var firstPayment = payments[0];
                paymentId = firstPayment.TryGetProperty("id", out var pid) ? pid.GetString() : null;
                foreach (var p in payments.EnumerateArray())
                {
                    if (p.TryGetProperty("attributes", out var pAttr) &&
                        pAttr.ValueKind == JsonValueKind.Object &&
                        pAttr.TryGetProperty("status", out var psElem) &&
                        string.Equals(psElem.GetString(), "paid", StringComparison.OrdinalIgnoreCase))
                    {
                        isPaid = true;
                        if (p.TryGetProperty("id", out var paidId) && !string.IsNullOrWhiteSpace(paidId.GetString()))
                        {
                            paymentId = paidId.GetString();
                        }
                        break;
                    }
                }
            }

            Dictionary<string, string>? metadata = null;
            if (dataAttr.TryGetProperty("metadata", out var metaElem) && metaElem.ValueKind == JsonValueKind.Object)
            {
                metadata = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
                foreach (var prop in metaElem.EnumerateObject())
                {
                    metadata[prop.Name] = prop.Value.ValueKind == JsonValueKind.String
                        ? prop.Value.GetString() ?? string.Empty
                        : prop.Value.ToString();
                }
            }

            return new QrPhPaymentStatusResult(
                PaymentIntentId: paymentIntentId,
                Status: status,
                IsPaid: isPaid,
                AmountCentavos: amount,
                PaymentId: paymentId,
                Metadata: metadata
            );
        }
        catch (Exception ex) when (ex is JsonException or KeyNotFoundException or InvalidOperationException)
        {
            _logger.LogError(ex, "Failed to parse PayMongo payment intent status response for {PaymentIntentId}.", paymentIntentId);
            throw new PaymentGatewayException("Payment gateway returned an invalid or malformed response.", ex);
        }
    }

    private async Task<string> SendPayMongoJsonAsync(
        HttpMethod method,
        string endpoint,
        object? payload,
        AuthenticationHeaderValue authHeader,
        CancellationToken cancellationToken)
    {
        var url = endpoint.StartsWith("http", StringComparison.OrdinalIgnoreCase)
            ? endpoint
            : $"https://api.paymongo.com/v1/{endpoint.TrimStart('/')}";

        using var requestMessage = new HttpRequestMessage(method, url);
        requestMessage.Headers.Authorization = authHeader;

        if (payload != null)
        {
            requestMessage.Content = new StringContent(
                JsonSerializer.Serialize(payload),
                Encoding.UTF8,
                "application/json");
        }

        HttpResponseMessage response;
        string content;
        try
        {
            response = await _httpClient.SendAsync(requestMessage, cancellationToken);
            content = await response.Content.ReadAsStringAsync(cancellationToken);
        }
        catch (HttpRequestException ex)
        {
            _logger.LogError(ex, "Could not connect to PayMongo endpoint {Endpoint}.", endpoint);
            throw new PaymentGatewayException("Payment gateway is temporarily unavailable. Please try again later.", ex);
        }
        catch (TaskCanceledException ex) when (!cancellationToken.IsCancellationRequested)
        {
            _logger.LogError(ex, "PayMongo timed out on endpoint {Endpoint}.", endpoint);
            throw new PaymentGatewayException("Payment gateway timed out. Please try again later.", ex);
        }

        if (!response.IsSuccessStatusCode)
        {
            _logger.LogError("PayMongo endpoint {Endpoint} failed with {StatusCode}: {Response}",
                endpoint, response.StatusCode, content);
            throw new PaymentGatewayException("Payment gateway request failed.");
        }

        return content;
    }

    private static bool IsMissingOrMock(string? value) =>
        string.IsNullOrWhiteSpace(value) ||
        value.Equals("mock-secret", StringComparison.OrdinalIgnoreCase) ||
        value.StartsWith("mock_", StringComparison.OrdinalIgnoreCase);
}
