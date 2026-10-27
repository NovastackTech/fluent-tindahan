using System.Net;
using System.Net.Http.Headers;
using System.Text.Json;
using FluentAssertions;
using MediatR;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Moq.Protected;
using FluentTindahan.Application.Billing;
using FluentTindahan.Application.Common.Interfaces;
using FluentTindahan.Domain.Billing;
using FluentTindahan.Domain.Enums;
using FluentTindahan.Domain.Interfaces;
using FluentTindahan.Infrastructure.Services;
using FluentTindahan.WebApi.Controllers;
using Xunit;

namespace FluentTindahan.UnitTests;

public class PayMongoSubscriptionQrPhTests
{
    private readonly Guid _testTenantId = Guid.NewGuid();
    private readonly Mock<ICurrentUserService> _currentUserServiceMock = new();
    private readonly Mock<IHostEnvironment> _devEnvMock = new();
    private readonly Mock<IHostEnvironment> _prodEnvMock = new();

    public PayMongoSubscriptionQrPhTests()
    {
        _currentUserServiceMock.Setup(s => s.TenantId).Returns(_testTenantId);
        _devEnvMock.Setup(e => e.EnvironmentName).Returns("Development");
        _prodEnvMock.Setup(e => e.EnvironmentName).Returns("Production");
    }

    [Fact]
    public async Task CreateQrPhPaymentIntentAsync_Executes_3StepSequence_WithBasicAuthAndCentavos()
    {
        var handlerMock = new Mock<HttpMessageHandler>();
        var capturedRequests = new List<HttpRequestMessage>();

        handlerMock.Protected()
            .Setup<Task<HttpResponseMessage>>(
                "SendAsync",
                ItExpr.IsAny<HttpRequestMessage>(),
                ItExpr.IsAny<CancellationToken>())
            .Returns<HttpRequestMessage, CancellationToken>((req, _) =>
            {
                capturedRequests.Add(req);
                var url = req.RequestUri?.ToString() ?? "";

                if (url.Contains("/payment_intents/") && url.EndsWith("/attach"))
                {
                    var attachJson = JsonSerializer.Serialize(new
                    {
                        data = new
                        {
                            id = "pi_test_123",
                            type = "payment_intent",
                            attributes = new
                            {
                                status = "awaiting_next_action",
                                amount = 14900,
                                next_action = new
                                {
                                    type = "consume_qr_code",
                                    code = new
                                    {
                                        image_url = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg=="
                                    }
                                }
                            }
                        }
                    });
                    return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
                    {
                        Content = new StringContent(attachJson)
                    });
                }

                if (url.Contains("/payment_intents"))
                {
                    var intentJson = JsonSerializer.Serialize(new
                    {
                        data = new
                        {
                            id = "pi_test_123",
                            type = "payment_intent",
                            attributes = new
                            {
                                amount = 14900,
                                status = "awaiting_payment_method",
                                client_key = "client_key_secret_123"
                            }
                        }
                    });
                    return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
                    {
                        Content = new StringContent(intentJson)
                    });
                }

                if (url.Contains("/payment_methods"))
                {
                    var methodJson = JsonSerializer.Serialize(new
                    {
                        data = new
                        {
                            id = "pm_test_456",
                            type = "payment_method",
                            attributes = new
                            {
                                type = "qrph"
                            }
                        }
                    });
                    return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
                    {
                        Content = new StringContent(methodJson)
                    });
                }

                return Task.FromResult(new HttpResponseMessage(HttpStatusCode.NotFound));
            });

        var httpClient = new HttpClient(handlerMock.Object);
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                { "PayMongo:SecretKey", "sk_test_actual_valid_key" },
                { "PayMongo:FrontendOrigin", "http://localhost:5173" }
            })
            .Build();

        var service = new PayMongoPaymentGatewayService(
            httpClient,
            config,
            _devEnvMock.Object,
            TimeProvider.System,
            NullLogger<PayMongoPaymentGatewayService>.Instance);

        var request = new CreateQrPhPaymentIntentRequest(
            AmountCentavos: 14900,
            Description: "Fluent Tindahan - Tindahan Pro (Monthly)",
            OrderId: "sub_ord_001",
            Customer: new CustomerBillingDetails("Aling Nena", "nena@tindahan.ph", "09171234567"),
            Metadata: new Dictionary<string, string> { { "tier", "TindahanPro" }, { "cycle", "Monthly" } }
        );

        var result = await service.CreateQrPhPaymentIntentAsync(request);

        result.PaymentIntentId.Should().Be("pi_test_123");
        result.PaymentMethodId.Should().Be("pm_test_456");
        result.AmountCentavos.Should().Be(14900);
        result.QrCodeUrl.Should().Be("data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==");

        capturedRequests.Should().HaveCount(3);
        // Verify Basic Auth uses SecretKey + ":"
        var expectedBasic = Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes("sk_test_actual_valid_key:"));
        foreach (var req in capturedRequests)
        {
            req.Headers.Authorization.Should().NotBeNull();
            req.Headers.Authorization!.Scheme.Should().Be("Basic");
            req.Headers.Authorization.Parameter.Should().Be(expectedBasic);
        }
    }

    [Fact]
    public async Task CreateQrPhPaymentIntentAsync_Rejects_AmountBelow100Centavos()
    {
        var service = new PayMongoPaymentGatewayService(
            new HttpClient(),
            new ConfigurationBuilder().Build(),
            _devEnvMock.Object,
            TimeProvider.System,
            NullLogger<PayMongoPaymentGatewayService>.Instance);

        var request = new CreateQrPhPaymentIntentRequest(
            AmountCentavos: 50,
            Description: "Invalid Low Amount",
            OrderId: "sub_low_001",
            Customer: new CustomerBillingDetails("Low Spender")
        );

        var act = async () => await service.CreateQrPhPaymentIntentAsync(request);
        await act.Should().ThrowAsync<PaymentGatewayException>()
            .WithMessage("*Minimum amount for QR Ph is ₱1.00*");
    }

    [Fact]
    public async Task CreateQrPhPaymentIntentAsync_InDevelopment_FallsBackToMock()
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                { "PayMongo:SecretKey", "mock-secret" }
            })
            .Build();

        var service = new PayMongoPaymentGatewayService(
            new HttpClient(),
            config,
            _devEnvMock.Object,
            TimeProvider.System,
            NullLogger<PayMongoPaymentGatewayService>.Instance);

        var request = new CreateQrPhPaymentIntentRequest(
            AmountCentavos: 12900,
            Description: "Fluent Tindahan - Tindahan Pro (Monthly)",
            OrderId: "sub_mock_001",
            Customer: new CustomerBillingDetails("Suki Store")
        );

        var result = await service.CreateQrPhPaymentIntentAsync(request);

        result.PaymentIntentId.Should().StartWith("pi_mock_");
        result.PaymentMethodId.Should().StartWith("pm_mock_");
        result.QrCodeUrl.Should().Contain("data:image/svg+xml");
        result.AmountCentavos.Should().Be(12900);
    }

    [Fact]
    public async Task RetrievePaymentIntentStatusAsync_ParsesPaidPayment()
    {
        var handlerMock = new Mock<HttpMessageHandler>();
        handlerMock.Protected()
            .Setup<Task<HttpResponseMessage>>(
                "SendAsync",
                ItExpr.IsAny<HttpRequestMessage>(),
                ItExpr.IsAny<CancellationToken>())
            .ReturnsAsync(new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(JsonSerializer.Serialize(new
                {
                    data = new
                    {
                        id = "pi_paid_999",
                        attributes = new
                        {
                            status = "succeeded",
                            amount = 29900,
                            payments = new[]
                            {
                                new { id = "pay_rec_888", attributes = new { status = "paid" } }
                            }
                        }
                    }
                }))
            });

        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                { "PayMongo:SecretKey", "sk_test_actual_key" }
            })
            .Build();

        var service = new PayMongoPaymentGatewayService(
            new HttpClient(handlerMock.Object),
            config,
            _devEnvMock.Object,
            TimeProvider.System,
            NullLogger<PayMongoPaymentGatewayService>.Instance);

        var status = await service.RetrievePaymentIntentStatusAsync("pi_paid_999");

        status.IsPaid.Should().BeTrue();
        status.Status.Should().Be("succeeded");
        status.AmountCentavos.Should().Be(29900);
        status.PaymentId.Should().Be("pay_rec_888");
    }

    [Fact]
    public async Task BillingController_GenerateQrPhSubscription_ValidatesPlan_AndReturnsIntent()
    {
        var gatewayMock = new Mock<IPaymentGatewayService>();
        gatewayMock.Setup(g => g.CreateQrPhPaymentIntentAsync(It.IsAny<CreateQrPhPaymentIntentRequest>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new QrPhPaymentIntentResult(
                "pi_sub_123",
                "pm_sub_123",
                "client_key_123",
                "awaiting_next_action",
                12900,
                "data:image/png;base64,qr_bytes",
                "sub_ref_123",
                DateTimeOffset.UtcNow));

        var mediatorMock = new Mock<IMediator>();

        var controller = new BillingController(
            mediatorMock.Object,
            _currentUserServiceMock.Object,
            gatewayMock.Object,
            _devEnvMock.Object,
            NullLogger<BillingController>.Instance);

        // Act 1: Reject Libre plan
        var badResult = await controller.GenerateQrPhSubscription(
            new BillingController.CreateCheckoutRequest(PlanTier.Libre, BillingCycle.Monthly),
            CancellationToken.None);
        badResult.Result.Should().BeOfType<BadRequestObjectResult>();

        // Act 2: Accept Tindahan Pro
        var okResult = await controller.GenerateQrPhSubscription(
            new BillingController.CreateCheckoutRequest(PlanTier.TindahanPro, BillingCycle.Monthly),
            CancellationToken.None);

        okResult.Result.Should().BeOfType<OkObjectResult>();
        var resultDto = (okResult.Result as OkObjectResult)!.Value as QrPhPaymentIntentResult;
        resultDto.Should().NotBeNull();
        resultDto!.PaymentIntentId.Should().Be("pi_sub_123");
        resultDto.AmountCentavos.Should().Be(12900);
    }

    [Fact]
    public async Task BillingController_ConfirmQrPhSubscription_AppliesPayment_WhenVerifiedPaid()
    {
        var gatewayMock = new Mock<IPaymentGatewayService>();
        gatewayMock.Setup(g => g.RetrievePaymentIntentStatusAsync("pi_paid_123", It.IsAny<CancellationToken>()))
            .ReturnsAsync(new QrPhPaymentStatusResult(
                "pi_paid_123",
                "succeeded",
                true,
                12900,
                "pay_rec_123",
                new Dictionary<string, string>
                {
                    { "tenant_id", _testTenantId.ToString() },
                    { "target_tier", PlanTier.TindahanPro.ToString() },
                    { "cycle", BillingCycle.Monthly.ToString() },
                    { "purpose", "subscription" }
                },
                Currency: "PHP",
                PaidAt: DateTimeOffset.UtcNow));

        var mediatorMock = new Mock<IMediator>();
        mediatorMock.Setup(m => m.Send(It.IsAny<ApplySubscriptionPaymentCommand>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new WebhookProcessResultDto(PaymentWebhookOutcome.Processed, "Success", _testTenantId, PlanTier.TindahanPro, DateTimeOffset.UtcNow.AddDays(30)));

        mediatorMock.Setup(m => m.Send(It.IsAny<GetTenantSubscriptionQuery>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new TenantSubscriptionDto(
                _testTenantId, "Test Tindahan", PlanTier.TindahanPro, "Tindahan Pro", true,
                DateTimeOffset.UtcNow.AddDays(30), 30, 1000, 500, 100, 5, 3, true, false, true, true,
                10, 5, 2));

        var controller = new BillingController(
            mediatorMock.Object,
            _currentUserServiceMock.Object,
            gatewayMock.Object,
            _devEnvMock.Object,
            NullLogger<BillingController>.Instance);

        var request = new BillingController.ConfirmQrPhSubscriptionRequest(
            PaymentIntentId: "pi_paid_123",
            TargetTier: PlanTier.TindahanPro,
            Cycle: BillingCycle.Monthly
        );

        var response = await controller.ConfirmQrPhSubscription(request, CancellationToken.None);

        response.Result.Should().BeOfType<OkObjectResult>();
        var subscription = (response.Result as OkObjectResult)!.Value as TenantSubscriptionDto;
        subscription.Should().NotBeNull();
        subscription!.Tier.Should().Be(PlanTier.TindahanPro);

        mediatorMock.Verify(m => m.Send(It.Is<ApplySubscriptionPaymentCommand>(cmd =>
            cmd.TenantId == _testTenantId &&
            cmd.Tier == PlanTier.TindahanPro &&
            cmd.Cycle == BillingCycle.Monthly &&
            cmd.AmountCentavos == 12900 &&
            cmd.PaymentId == "pay_rec_123" &&
            cmd.PaymentMethod == "QRPh"
        ), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task CreateCheckoutSessionAsync_IncludesQrPh_InPaymentMethodTypes()
    {
        var handlerMock = new Mock<HttpMessageHandler>();
        string? capturedBody = null;

        handlerMock.Protected()
            .Setup<Task<HttpResponseMessage>>(
                "SendAsync",
                ItExpr.IsAny<HttpRequestMessage>(),
                ItExpr.IsAny<CancellationToken>())
            .Returns<HttpRequestMessage, CancellationToken>(async (req, ct) =>
            {
                capturedBody = await req.Content!.ReadAsStringAsync(ct);
                var csJson = JsonSerializer.Serialize(new
                {
                    data = new
                    {
                        id = "cs_test_123",
                        attributes = new
                        {
                            checkout_url = "https://checkout.paymongo.com/cs_test_123"
                        }
                    }
                });
                return new HttpResponseMessage(HttpStatusCode.OK)
                {
                    Content = new StringContent(csJson)
                };
            });

        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                { "PayMongo:SecretKey", "sk_test_valid_key" },
                { "PayMongo:FrontendOrigin", "http://localhost:5173" }
            })
            .Build();

        var service = new PayMongoPaymentGatewayService(
            new HttpClient(handlerMock.Object),
            config,
            _devEnvMock.Object,
            TimeProvider.System,
            NullLogger<PayMongoPaymentGatewayService>.Instance);

        await service.CreateCheckoutSessionAsync(_testTenantId, PlanTier.TindahanPro, BillingCycle.Monthly);

        capturedBody.Should().NotBeNull();
        capturedBody.Should().Contain("\"qrph\"");
    }

    [Fact]
    public async Task BillingController_ConfirmQrPhSubscription_Rejects_WhenTenantMismatch()
    {
        var otherTenantId = Guid.NewGuid();
        var gatewayMock = new Mock<IPaymentGatewayService>();
        gatewayMock.Setup(g => g.RetrievePaymentIntentStatusAsync("pi_paid_other", It.IsAny<CancellationToken>()))
            .ReturnsAsync(new QrPhPaymentStatusResult(
                "pi_paid_other",
                "succeeded",
                true,
                12900,
                "pay_rec_other",
                new Dictionary<string, string>
                {
                    { "tenant_id", otherTenantId.ToString() },
                    { "target_tier", PlanTier.TindahanPro.ToString() },
                    { "cycle", BillingCycle.Monthly.ToString() }
                }));

        var controller = new BillingController(
            new Mock<IMediator>().Object,
            _currentUserServiceMock.Object,
            gatewayMock.Object,
            _devEnvMock.Object,
            NullLogger<BillingController>.Instance);

        var request = new BillingController.ConfirmQrPhSubscriptionRequest("pi_paid_other", PlanTier.TindahanPro, BillingCycle.Monthly);
        var response = await controller.ConfirmQrPhSubscription(request, CancellationToken.None);

        response.Result.Should().BeOfType<ObjectResult>();
        (response.Result as ObjectResult)!.StatusCode.Should().Be((int)HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task BillingController_ConfirmQrPhSubscription_Rejects_WhenTierMismatch()
    {
        var gatewayMock = new Mock<IPaymentGatewayService>();
        gatewayMock.Setup(g => g.RetrievePaymentIntentStatusAsync("pi_paid_tier", It.IsAny<CancellationToken>()))
            .ReturnsAsync(new QrPhPaymentStatusResult(
                "pi_paid_tier",
                "succeeded",
                true,
                34900,
                "pay_rec_tier",
                new Dictionary<string, string>
                {
                    { "tenant_id", _testTenantId.ToString() },
                    { "target_tier", PlanTier.TindahanPro.ToString() },
                    { "cycle", BillingCycle.Monthly.ToString() }
                }));

        var controller = new BillingController(
            new Mock<IMediator>().Object,
            _currentUserServiceMock.Object,
            gatewayMock.Object,
            _devEnvMock.Object,
            NullLogger<BillingController>.Instance);

        var request = new BillingController.ConfirmQrPhSubscriptionRequest("pi_paid_tier", PlanTier.NegosyoPlus, BillingCycle.Monthly);
        var response = await controller.ConfirmQrPhSubscription(request, CancellationToken.None);

        response.Result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task BillingController_ConfirmQrPhSubscription_Rejects_WhenCycleMismatch()
    {
        var gatewayMock = new Mock<IPaymentGatewayService>();
        gatewayMock.Setup(g => g.RetrievePaymentIntentStatusAsync("pi_paid_cycle", It.IsAny<CancellationToken>()))
            .ReturnsAsync(new QrPhPaymentStatusResult(
                "pi_paid_cycle",
                "succeeded",
                true,
                3500,
                "pay_rec_cycle",
                new Dictionary<string, string>
                {
                    { "tenant_id", _testTenantId.ToString() },
                    { "target_tier", PlanTier.TindahanPro.ToString() },
                    { "cycle", BillingCycle.Monthly.ToString() }
                }));

        var controller = new BillingController(
            new Mock<IMediator>().Object,
            _currentUserServiceMock.Object,
            gatewayMock.Object,
            _devEnvMock.Object,
            NullLogger<BillingController>.Instance);

        var request = new BillingController.ConfirmQrPhSubscriptionRequest("pi_paid_cycle", PlanTier.TindahanPro, BillingCycle.Weekly);
        var response = await controller.ConfirmQrPhSubscription(request, CancellationToken.None);

        response.Result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task BillingController_GetQrPhPaymentStatus_Rejects_WhenTenantMismatch()
    {
        var otherTenantId = Guid.NewGuid();
        var gatewayMock = new Mock<IPaymentGatewayService>();
        gatewayMock.Setup(g => g.RetrievePaymentIntentStatusAsync("pi_other_status", It.IsAny<CancellationToken>()))
            .ReturnsAsync(new QrPhPaymentStatusResult(
                "pi_other_status",
                "succeeded",
                true,
                12900,
                "pay_other",
                new Dictionary<string, string>
                {
                    { "tenant_id", otherTenantId.ToString() }
                }));

        var controller = new BillingController(
            new Mock<IMediator>().Object,
            _currentUserServiceMock.Object,
            gatewayMock.Object,
            _devEnvMock.Object,
            NullLogger<BillingController>.Instance);

        var response = await controller.GetQrPhPaymentStatus("pi_other_status", CancellationToken.None);

        response.Result.Should().BeOfType<ObjectResult>();
        (response.Result as ObjectResult)!.StatusCode.Should().Be((int)HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task RetrievePaymentIntentStatusAsync_InDevelopment_ReturnsStoredMockAmountAndMetadata()
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                { "PayMongo:SecretKey", "mock-secret" }
            })
            .Build();

        var service = new PayMongoPaymentGatewayService(
            new HttpClient(),
            config,
            _devEnvMock.Object,
            TimeProvider.System,
            NullLogger<PayMongoPaymentGatewayService>.Instance);

        var request = new CreateQrPhPaymentIntentRequest(
            AmountCentavos: 12900,
            Description: "Fluent Tindahan - Tindahan Pro (Monthly)",
            OrderId: "sub_mock_match_001",
            Customer: new CustomerBillingDetails("Suki Store"),
            Metadata: new Dictionary<string, string>
            {
                { "tenant_id", _testTenantId.ToString() },
                { "target_tier", "TindahanPro" },
                { "cycle", "Monthly" }
            }
        );

        var created = await service.CreateQrPhPaymentIntentAsync(request);
        var status1 = await service.RetrievePaymentIntentStatusAsync(created.PaymentIntentId);
        var status2 = await service.RetrievePaymentIntentStatusAsync(created.PaymentIntentId);

        status1.IsPaid.Should().BeTrue();
        status1.AmountCentavos.Should().Be(12900);
        status1.PaymentId.Should().Be($"pay_mock_{created.PaymentIntentId}");
        status2.PaymentId.Should().Be(status1.PaymentId);
        status1.Metadata.Should().NotBeNull();
        status1.Metadata!["tenant_id"].Should().Be(_testTenantId.ToString());
        status1.Metadata!["target_tier"].Should().Be("TindahanPro");
        status1.Metadata!["cycle"].Should().Be("Monthly");
    }

    [Fact]
    public async Task RetrievePaymentIntentStatusAsync_InDevelopment_RejectsUnknownIntent()
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                { "PayMongo:SecretKey", "mock-secret" }
            })
            .Build();

        var service = new PayMongoPaymentGatewayService(
            new HttpClient(),
            config,
            _devEnvMock.Object,
            TimeProvider.System,
            NullLogger<PayMongoPaymentGatewayService>.Instance);

        var act = async () => await service.RetrievePaymentIntentStatusAsync("pi_real_external_999");
        await act.Should().ThrowAsync<PaymentGatewayException>()
            .WithMessage("*not found*");
    }

    [Fact]
    public async Task CreateQrPhPaymentIntentAsync_RethrowsMalformedJson_AsPaymentGatewayException()
    {
        var handlerMock = new Mock<HttpMessageHandler>();
        handlerMock.Protected()
            .Setup<Task<HttpResponseMessage>>(
                "SendAsync",
                ItExpr.IsAny<HttpRequestMessage>(),
                ItExpr.IsAny<CancellationToken>())
            .ReturnsAsync(new HttpResponseMessage(HttpStatusCode.OK)
            {
                // Returns unexpected JSON lacking "data"
                Content = new StringContent("{\"status\":\"ok\"}")
            });

        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                { "PayMongo:SecretKey", "sk_test_actual_key" }
            })
            .Build();

        var service = new PayMongoPaymentGatewayService(
            new HttpClient(handlerMock.Object),
            config,
            _devEnvMock.Object,
            TimeProvider.System,
            NullLogger<PayMongoPaymentGatewayService>.Instance);

        var request = new CreateQrPhPaymentIntentRequest(
            AmountCentavos: 12900,
            Description: "Fluent Tindahan",
            OrderId: "sub_malformed_001",
            Customer: new CustomerBillingDetails("Suki")
        );

        var act = async () => await service.CreateQrPhPaymentIntentAsync(request);
        await act.Should().ThrowAsync<PaymentGatewayException>()
            .WithMessage("*invalid or malformed response*");
    }

    [Fact]
    public async Task RetrievePaymentIntentStatusAsync_RethrowsMalformedJson_AsPaymentGatewayException()
    {
        var handlerMock = new Mock<HttpMessageHandler>();
        handlerMock.Protected()
            .Setup<Task<HttpResponseMessage>>(
                "SendAsync",
                ItExpr.IsAny<HttpRequestMessage>(),
                ItExpr.IsAny<CancellationToken>())
            .ReturnsAsync(new HttpResponseMessage(HttpStatusCode.OK)
            {
                // Returns corrupted data missing attributes
                Content = new StringContent("{\"data\":{}}")
            });

        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                { "PayMongo:SecretKey", "sk_test_actual_key" }
            })
            .Build();

        var service = new PayMongoPaymentGatewayService(
            new HttpClient(handlerMock.Object),
            config,
            _devEnvMock.Object,
            TimeProvider.System,
            NullLogger<PayMongoPaymentGatewayService>.Instance);

        var act = async () => await service.RetrievePaymentIntentStatusAsync("pi_test_malformed");
        await act.Should().ThrowAsync<PaymentGatewayException>()
            .WithMessage("*invalid or malformed response*");
    }
}
