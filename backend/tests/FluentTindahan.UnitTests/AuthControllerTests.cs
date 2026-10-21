using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using FluentAssertions;
using FluentTindahan.Application.Common.Interfaces;
using FluentTindahan.Domain.Entities;
using FluentTindahan.Domain.Enums;
using FluentTindahan.Domain.Interfaces;
using FluentTindahan.Infrastructure.Persistence;
using FluentTindahan.Infrastructure.Services;
using FluentTindahan.WebApi.Controllers;
using FluentTindahan.WebApi.Controllers.Helpers;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.IdentityModel.Tokens;
using Moq;
using Npgsql;
using System.Reflection;
using Xunit;

namespace FluentTindahan.UnitTests;

[Collection("AuthLockout")]
public class AuthControllerTests
{
    public const string TestJwtSecret = "UnitTesting_SuperSecretSigningKey_Minimum32Chars!";
    public const string TestIssuer = "FluentTindahanTest";
    public const string TestAudience = "FluentTindahanClientTest";

    private static readonly IJwtTokenService DefaultJwtService = CreateJwtTokenService();

    public static IJwtTokenService CreateJwtTokenService(
        string? secret = TestJwtSecret,
        string? issuer = TestIssuer,
        string? audience = TestAudience,
        int expiryMinutes = 60,
        int refreshExpiryDays = 30,
        TimeProvider? timeProvider = null)
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Jwt:SecretKey"] = secret,
                ["Jwt:Issuer"] = issuer,
                ["Jwt:Audience"] = audience,
                ["Jwt:ExpiryMinutes"] = expiryMinutes.ToString(),
                ["Jwt:RefreshExpiryDays"] = refreshExpiryDays.ToString()
            })
            .Build();

        var envMock = new Mock<IHostEnvironment>();
        envMock.Setup(e => e.EnvironmentName).Returns(Environments.Development);

        return new JwtTokenService(config, envMock.Object, timeProvider);
    }

    public sealed class MutableTimeProvider : TimeProvider
    {
        private DateTimeOffset _utcNow;
        public MutableTimeProvider(DateTimeOffset utcNow) => _utcNow = utcNow;
        public override DateTimeOffset GetUtcNow() => _utcNow;
        public void SetUtcNow(DateTimeOffset utcNow) => _utcNow = utcNow;
        public void Advance(TimeSpan duration) => _utcNow = _utcNow.Add(duration);
    }

    private (AppDbContext Context, Mock<ICurrentUserService> UserMock) CreateInMemoryContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;

        var userMock = new Mock<ICurrentUserService>();
        userMock.Setup(u => u.TenantId).Returns(Guid.NewGuid());
        userMock.Setup(u => u.UserId).Returns(Guid.NewGuid());

        var context = new AppDbContext(options, userMock.Object);
        return (context, userMock);
    }

    private static AuthController CreateController(
        AppDbContext context,
        IJwtTokenService? jwtService = null,
        ICurrentUserService? currentUserService = null,
        TimeProvider? timeProvider = null,
        IGoogleAuthService? googleAuthService = null,
        IEmailOtpSender? emailOtpSender = null)
    {
        return new AuthController(context, jwtService ?? DefaultJwtService, currentUserService, timeProvider, googleAuthService, emailOtpSender);
    }

    private static void SetAuthenticatedUser(
        AuthController controller,
        Guid userId,
        Guid tenantId,
        string email = "test@example.ph",
        string role = "Owner")
    {
        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, userId.ToString()),
            new Claim("sub", userId.ToString()),
            new Claim("user_id", userId.ToString()),
            new Claim("tenant_id", tenantId.ToString()),
            new Claim("email", email),
            new Claim(ClaimTypes.Role, role)
        };
        var identity = new ClaimsIdentity(claims, "TestAuth");
        var principal = new ClaimsPrincipal(identity);
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = principal }
        };
    }

    private static void SetClientIp(AuthController controller, string ip)
    {
        var httpContext = controller.ControllerContext?.HttpContext ?? new DefaultHttpContext();
        httpContext.Connection.RemoteIpAddress = System.Net.IPAddress.Parse(ip);
        controller.ControllerContext = new ControllerContext { HttpContext = httpContext };
    }

    [Fact]
    public async Task Register_ValidRequest_PreservesClientTenantAndUserId()
    {
        var (context, _) = CreateInMemoryContext();
        var controller = CreateController(context);

        var clientTenantId = Guid.NewGuid();
        var clientUserId = Guid.NewGuid();

        var request = new AuthController.RegisterRequest
        {
            TenantId = clientTenantId,
            UserId = clientUserId,
            Email = "tindahan.suki@example.ph",
            Password = "SecurePassword123!",
            Pin = "1234",
            BusinessName = "Nanay Gloria Sari-Sari Store",
            OwnerName = "Gloria Santos",
            Phone = "09171234567"
        };

        var result = await controller.Register(request, CancellationToken.None);

        result.Result.Should().BeOfType<OkObjectResult>();
        var okResult = (OkObjectResult)result.Result!;
        var dto = okResult.Value.Should().BeOfType<AuthController.AuthResponseDto>().Subject;

        dto.TenantId.Should().Be(clientTenantId);
        dto.UserId.Should().Be(clientUserId);
        dto.Email.Should().Be("tindahan.suki@example.ph");
        dto.BusinessName.Should().Be("Nanay Gloria Sari-Sari Store");
        dto.HasPin.Should().BeTrue();
        dto.Token.Should().NotBeNullOrWhiteSpace();

        var savedUser = await context.Users.IgnoreQueryFilters().FirstOrDefaultAsync(u => u.Id == clientUserId);
        savedUser.Should().NotBeNull();
        savedUser!.NormalizedEmail.Should().Be("tindahan.suki@example.ph");
        savedUser.PasswordHash.Should().NotBeNullOrWhiteSpace();
        savedUser.PinHash.Should().NotBeNullOrWhiteSpace();
    }

    [Fact]
    public async Task Register_DuplicateNormalizedEmail_ReturnsConflict()
    {
        var (context, _) = CreateInMemoryContext();
        var controller = CreateController(context);

        var firstRequest = new AuthController.RegisterRequest
        {
            Email = "sari.sari@tindahan.ph",
            Password = "Password123!",
            BusinessName = "Unang Tindahan"
        };
        await controller.Register(firstRequest, CancellationToken.None);

        var secondRequest = new AuthController.RegisterRequest
        {
            Email = "SARI.SARI@TINDAHAN.PH", // uppercase variation
            Password = "DifferentPassword123!",
            BusinessName = "Pangalawang Tindahan"
        };

        var result = await controller.Register(secondRequest, CancellationToken.None);

        result.Result.Should().BeOfType<ConflictObjectResult>();
        var conflict = (ConflictObjectResult)result.Result!;
        conflict.StatusCode.Should().Be(StatusCodes.Status409Conflict);
    }

    [Fact]
    public async Task Register_TenantAlreadyExists_ReturnsConflict()
    {
        var (context, _) = CreateInMemoryContext();
        var controller = CreateController(context);

        var existingTenantId = Guid.NewGuid();
        var legitimateUserId = Guid.NewGuid();

        // 1. Legitimate owner registers their store
        var firstRequest = new AuthController.RegisterRequest
        {
            TenantId = existingTenantId,
            UserId = legitimateUserId,
            Email = "legitimate.owner@tindahan.ph",
            Password = "StrongOwnerPassword123!",
            BusinessName = "Original Sari-Sari Store"
        };
        var firstResult = await controller.Register(firstRequest, CancellationToken.None);
        firstResult.Result.Should().BeOfType<OkObjectResult>();

        // 2. Attacker attempts to register using the same TenantId to join as Owner
        var attackerRequest = new AuthController.RegisterRequest
        {
            TenantId = existingTenantId,
            UserId = Guid.NewGuid(),
            Email = "attacker@evil.com",
            Password = "AttackerPassword123!",
            BusinessName = "Fake Name"
        };
        var attackerResult = await controller.Register(attackerRequest, CancellationToken.None);

        attackerResult.Result.Should().BeOfType<ConflictObjectResult>();
        var conflict = (ConflictObjectResult)attackerResult.Result!;
        conflict.StatusCode.Should().Be(StatusCodes.Status409Conflict);

        // Verify no second user or attacker was attached to the tenant
        var usersInTenant = await context.Users.IgnoreQueryFilters()
            .Where(u => u.TenantId == existingTenantId)
            .ToListAsync();
        usersInTenant.Should().HaveCount(1);
        usersInTenant[0].Email.Should().Be("legitimate.owner@tindahan.ph");
    }

    [Fact]
    public async Task Register_AnonymouslyProvisionedTenant_AuthenticatedAsPlaceholder_UpgradesPlaceholderUserSuccessfully()
    {
        var (context, _) = CreateInMemoryContext();
        var controller = CreateController(context);

        var provisionedTenantId = Guid.NewGuid();
        var provisionedUserId = Guid.NewGuid();

        // Simulate earlier anonymous provisioning: tenant and unauthenticated placeholder user
        context.Tenants.Add(new Tenant
        {
            Id = provisionedTenantId,
            BusinessName = "Offline First Store",
            Tier = PlanTier.Libre,
            CreatedAt = DateTimeOffset.UtcNow
        });
        context.Users.Add(new User
        {
            Id = provisionedUserId,
            TenantId = provisionedTenantId,
            Email = string.Empty,
            NormalizedEmail = string.Empty,
            PasswordHash = string.Empty,
            Phone = "09171234567",
            Role = "Owner",
            CreatedAt = DateTimeOffset.UtcNow
        });
        await context.SaveChangesAsync();

        // The caller is authenticated as that placeholder user
        SetAuthenticatedUser(controller, provisionedUserId, provisionedTenantId);

        // Now user establishes account credentials via Register with the same TenantId and UserId
        var regRequest = new AuthController.RegisterRequest
        {
            TenantId = provisionedTenantId,
            UserId = provisionedUserId,
            Email = "owner@offlinefirst.ph",
            Password = "MasterPassword123!",
            Pin = "2468",
            BusinessName = "Offline First Store Upgraded"
        };
        var regResult = await controller.Register(regRequest, CancellationToken.None);

        regResult.Result.Should().BeOfType<OkObjectResult>();
        var okResult = (OkObjectResult)regResult.Result!;
        var dto = okResult.Value.Should().BeOfType<AuthController.AuthResponseDto>().Subject;

        dto.TenantId.Should().Be(provisionedTenantId);
        dto.UserId.Should().Be(provisionedUserId);
        dto.Email.Should().Be("owner@offlinefirst.ph");

        // Verify placeholder was upgraded, not duplicated
        var tenantUsers = await context.Users.IgnoreQueryFilters()
            .Where(u => u.TenantId == provisionedTenantId)
            .ToListAsync();
        tenantUsers.Should().HaveCount(1);
        tenantUsers[0].NormalizedEmail.Should().Be("owner@offlinefirst.ph");
        tenantUsers[0].PasswordHash.Should().NotBeNullOrWhiteSpace();
        tenantUsers[0].PinHash.Should().NotBeNullOrWhiteSpace();
    }

    [Fact]
    public async Task Register_AnonymouslyProvisionedTenant_WithValidRefreshToken_UpgradesPlaceholderUserSuccessfully()
    {
        var (context, _) = CreateInMemoryContext();
        var jwtService = DefaultJwtService;
        var controller = CreateController(context, jwtService);

        var provisionedTenantId = Guid.NewGuid();
        var provisionedUserId = Guid.NewGuid();

        // Generate a valid refresh token representing the device session
        var (refreshToken, refExp, tokenId) = jwtService.GenerateRefreshToken(provisionedUserId, provisionedTenantId);

        context.Tenants.Add(new Tenant
        {
            Id = provisionedTenantId,
            BusinessName = "Device Session Store",
            Tier = PlanTier.Libre,
            CreatedAt = DateTimeOffset.UtcNow
        });
        context.Users.Add(new User
        {
            Id = provisionedUserId,
            TenantId = provisionedTenantId,
            Email = string.Empty,
            NormalizedEmail = string.Empty,
            PasswordHash = string.Empty,
            Phone = "09171234567",
            Role = "Owner",
            RefreshTokenIdHash = jwtService.HashTokenId(tokenId),
            RefreshTokenExpiresAt = refExp,
            CreatedAt = DateTimeOffset.UtcNow
        });
        await context.SaveChangesAsync();

        // Caller is NOT authenticated via Bearer token, but supplies the valid device session refresh token
        var regRequest = new AuthController.RegisterRequest
        {
            TenantId = provisionedTenantId,
            UserId = provisionedUserId,
            RefreshToken = refreshToken,
            Email = "session.owner@offlinefirst.ph",
            Password = "MasterPassword123!",
            BusinessName = "Device Session Store Upgraded"
        };
        var regResult = await controller.Register(regRequest, CancellationToken.None);

        regResult.Result.Should().BeOfType<OkObjectResult>();
        var okResult = (OkObjectResult)regResult.Result!;
        var dto = okResult.Value.Should().BeOfType<AuthController.AuthResponseDto>().Subject;

        dto.TenantId.Should().Be(provisionedTenantId);
        dto.UserId.Should().Be(provisionedUserId);
        dto.Email.Should().Be("session.owner@offlinefirst.ph");

        var tenantUsers = await context.Users.IgnoreQueryFilters()
            .Where(u => u.TenantId == provisionedTenantId)
            .ToListAsync();
        tenantUsers.Should().HaveCount(1);
        tenantUsers[0].NormalizedEmail.Should().Be("session.owner@offlinefirst.ph");
    }

    [Fact]
    public async Task Register_AnonymouslyProvisionedTenant_FromIdsAlone_Returns401Unauthorized()
    {
        var (context, _) = CreateInMemoryContext();
        var controller = CreateController(context);

        var provisionedTenantId = Guid.NewGuid();
        var provisionedUserId = Guid.NewGuid();

        context.Tenants.Add(new Tenant
        {
            Id = provisionedTenantId,
            BusinessName = "Offline First Store",
            Tier = PlanTier.Libre,
            CreatedAt = DateTimeOffset.UtcNow
        });
        context.Users.Add(new User
        {
            Id = provisionedUserId,
            TenantId = provisionedTenantId,
            Email = string.Empty,
            NormalizedEmail = string.Empty,
            PasswordHash = string.Empty,
            Phone = "09171234567",
            Role = "Owner",
            CreatedAt = DateTimeOffset.UtcNow
        });
        await context.SaveChangesAsync();

        // Attacker attempts to upgrade using TenantId and UserId alone without auth or device session
        var regRequest = new AuthController.RegisterRequest
        {
            TenantId = provisionedTenantId,
            UserId = provisionedUserId,
            Email = "attacker@hijack.ph",
            Password = "AttackerPassword123!",
            BusinessName = "Hijacked Store"
        };
        var regResult = await controller.Register(regRequest, CancellationToken.None);

        regResult.Result.Should().BeOfType<UnauthorizedObjectResult>();
        var unauthorized = (UnauthorizedObjectResult)regResult.Result!;
        unauthorized.StatusCode.Should().Be(StatusCodes.Status401Unauthorized);
    }

    [Fact]
    public async Task Register_AnonymouslyProvisionedTenant_WithAttackerRefreshToken_Returns401Unauthorized()
    {
        var (context, _) = CreateInMemoryContext();
        var jwtService = DefaultJwtService;
        var controller = CreateController(context, jwtService);

        var provisionedTenantId = Guid.NewGuid();
        var provisionedUserId = Guid.NewGuid();
        var attackerUserId = Guid.NewGuid();

        // Refresh token minted for a different user
        var (attackerRefreshToken, _, _) = jwtService.GenerateRefreshToken(attackerUserId, provisionedTenantId);

        context.Tenants.Add(new Tenant
        {
            Id = provisionedTenantId,
            BusinessName = "Victim Store",
            Tier = PlanTier.Libre,
            CreatedAt = DateTimeOffset.UtcNow
        });
        context.Users.Add(new User
        {
            Id = provisionedUserId,
            TenantId = provisionedTenantId,
            Email = string.Empty,
            NormalizedEmail = string.Empty,
            PasswordHash = string.Empty,
            Role = "Owner",
            CreatedAt = DateTimeOffset.UtcNow
        });
        await context.SaveChangesAsync();

        var regRequest = new AuthController.RegisterRequest
        {
            TenantId = provisionedTenantId,
            UserId = provisionedUserId,
            RefreshToken = attackerRefreshToken,
            Email = "attacker@spoof.ph",
            Password = "AttackerPassword123!",
            BusinessName = "Victim Store Hijack"
        };
        var regResult = await controller.Register(regRequest, CancellationToken.None);

        regResult.Result.Should().BeOfType<UnauthorizedObjectResult>();
        var unauthorized = (UnauthorizedObjectResult)regResult.Result!;
        unauthorized.StatusCode.Should().Be(StatusCodes.Status401Unauthorized);
    }

    [Fact]
    public async Task Register_TenantAlreadyExists_AttackerTriesSameUserId_ReturnsConflict()
    {
        var (context, _) = CreateInMemoryContext();
        var controller = CreateController(context);

        var existingTenantId = Guid.NewGuid();
        var legitimateUserId = Guid.NewGuid();

        // Established store with password
        await controller.Register(new AuthController.RegisterRequest
        {
            TenantId = existingTenantId,
            UserId = legitimateUserId,
            Email = "legit@tindahan.ph",
            Password = "CorrectPassword123!",
            BusinessName = "My Store"
        }, CancellationToken.None);

        // Attacker attempts to overwrite existing user by supplying victim's TenantId and UserId
        var attackerRequest = new AuthController.RegisterRequest
        {
            TenantId = existingTenantId,
            UserId = legitimateUserId,
            Email = "different.email@evil.com",
            Password = "NewAttackerPassword123!",
            BusinessName = "Hacked Store"
        };
        var attackerResult = await controller.Register(attackerRequest, CancellationToken.None);

        attackerResult.Result.Should().BeOfType<ConflictObjectResult>();
        var conflict = (ConflictObjectResult)attackerResult.Result!;
        conflict.StatusCode.Should().Be(StatusCodes.Status409Conflict);
    }

    [Fact]
    public async Task Register_InvalidEmail_ReturnsBadRequest()
    {
        var (context, _) = CreateInMemoryContext();
        var controller = CreateController(context);

        var request = new AuthController.RegisterRequest
        {
            Email = "not-an-email",
            Password = "Password123!",
            BusinessName = "Tindahan"
        };

        var result = await controller.Register(request, CancellationToken.None);

        result.Result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task Register_ShortBusinessName_ReturnsBadRequest()
    {
        var (context, _) = CreateInMemoryContext();
        var controller = CreateController(context);

        var request = new AuthController.RegisterRequest
        {
            Email = "valid@example.com",
            Password = "Password123!",
            BusinessName = "A" // shorter than 2 chars
        };

        var result = await controller.Register(request, CancellationToken.None);

        result.Result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task Login_ValidCredentials_ReturnsOk()
    {
        var (context, _) = CreateInMemoryContext();
        var controller = CreateController(context);

        await controller.Register(new AuthController.RegisterRequest
        {
            Email = "owner@tindahan.ph",
            Password = "MyPassword123!",
            BusinessName = "Kanto Store"
        }, CancellationToken.None);

        var loginResult = await controller.Login(new AuthController.LoginRequest
        {
            Email = "OWNER@tindahan.ph",
            Password = "MyPassword123!"
        }, CancellationToken.None);

        loginResult.Result.Should().BeOfType<OkObjectResult>();
        var okResult = (OkObjectResult)loginResult.Result!;
        var dto = okResult.Value.Should().BeOfType<AuthController.AuthResponseDto>().Subject;

        dto.Email.Should().Be("owner@tindahan.ph");
        dto.BusinessName.Should().Be("Kanto Store");
        dto.Token.Should().NotBeNullOrWhiteSpace();
    }

    [Fact]
    public async Task Login_InvalidPassword_ReturnsUnauthorized()
    {
        var (context, _) = CreateInMemoryContext();
        var controller = CreateController(context);

        await controller.Register(new AuthController.RegisterRequest
        {
            Email = "owner@tindahan.ph",
            Password = "CorrectPassword123!",
            BusinessName = "Kanto Store"
        }, CancellationToken.None);

        var result = await controller.Login(new AuthController.LoginRequest
        {
            Email = "owner@tindahan.ph",
            Password = "WrongPassword999!"
        }, CancellationToken.None);

        result.Result.Should().BeOfType<UnauthorizedObjectResult>();
    }

    [Fact]
    public async Task Login_UnknownEmail_ReturnsUnauthorized()
    {
        var (context, _) = CreateInMemoryContext();
        var controller = CreateController(context);

        var result = await controller.Login(new AuthController.LoginRequest
        {
            Email = "nonexistent@tindahan.ph",
            Password = "Password123!"
        }, CancellationToken.None);

        result.Result.Should().BeOfType<UnauthorizedObjectResult>();
    }

    [Fact]
    public async Task LoginPin_ValidPin_ReturnsOk()
    {
        var (context, _) = CreateInMemoryContext();
        var controller = CreateController(context);

        await controller.Register(new AuthController.RegisterRequest
        {
            Email = "pinowner@tindahan.ph",
            Password = "Password123!",
            Pin = "2468",
            BusinessName = "Fast POS Store"
        }, CancellationToken.None);

        var result = await controller.LoginPin(new AuthController.LoginPinRequest
        {
            Email = "PINOWNER@tindahan.ph",
            Pin = "2468"
        }, CancellationToken.None);

        result.Result.Should().BeOfType<OkObjectResult>();
        var okResult = (OkObjectResult)result.Result!;
        var dto = okResult.Value.Should().BeOfType<AuthController.AuthResponseDto>().Subject;
        dto.Email.Should().Be("pinowner@tindahan.ph");
        dto.HasPin.Should().BeTrue();
    }

    [Fact]
    public async Task LoginPin_NoPinConfigured_ReturnsUnauthorized()
    {
        var (context, _) = CreateInMemoryContext();
        var controller = CreateController(context);

        await controller.Register(new AuthController.RegisterRequest
        {
            Email = "nopin@tindahan.ph",
            Password = "Password123!",
            Pin = null,
            BusinessName = "No PIN Store"
        }, CancellationToken.None);

        var result = await controller.LoginPin(new AuthController.LoginPinRequest
        {
            Email = "nopin@tindahan.ph",
            Pin = "1234"
        }, CancellationToken.None);

        result.Result.Should().BeOfType<UnauthorizedObjectResult>();
    }

    [Fact]
    public async Task LoginPin_FiveConsecutiveFailures_LocksOutFor15Minutes()
    {
        AuthController.ResetAllIpPinThrottles();
        var (context, _) = CreateInMemoryContext();
        var controller = CreateController(context);

        await controller.Register(new AuthController.RegisterRequest
        {
            Email = "lockout@tindahan.ph",
            Password = "Password123!",
            Pin = "5555",
            BusinessName = "Lockout Test Store"
        }, CancellationToken.None);

        // First 4 attempts fail with 401 Unauthorized
        for (int i = 1; i <= 4; i++)
        {
            var failResult = await controller.LoginPin(new AuthController.LoginPinRequest
            {
                Email = "lockout@tindahan.ph",
                Pin = "0000"
            }, CancellationToken.None);

            failResult.Result.Should().BeOfType<UnauthorizedObjectResult>();
        }

        // 5th attempt triggers 429 Too Many Requests
        var fifthResult = await controller.LoginPin(new AuthController.LoginPinRequest
        {
            Email = "lockout@tindahan.ph",
            Pin = "0000"
        }, CancellationToken.None);

        fifthResult.Result.Should().BeOfType<ObjectResult>();
        var fifthObj = (ObjectResult)fifthResult.Result!;
        fifthObj.StatusCode.Should().Be(StatusCodes.Status429TooManyRequests);

        // Subsequent attempt (even with CORRECT PIN) is blocked by lockout
        var lockedOutResult = await controller.LoginPin(new AuthController.LoginPinRequest
        {
            Email = "lockout@tindahan.ph",
            Pin = "5555"
        }, CancellationToken.None);

        lockedOutResult.Result.Should().BeOfType<ObjectResult>();
        var lockedOutObj = (ObjectResult)lockedOutResult.Result!;
        lockedOutObj.StatusCode.Should().Be(StatusCodes.Status429TooManyRequests);

        // But logging in with Password resets the lockout!
        var passwordLogin = await controller.Login(new AuthController.LoginRequest
        {
            Email = "lockout@tindahan.ph",
            Password = "Password123!"
        }, CancellationToken.None);

        passwordLogin.Result.Should().BeOfType<OkObjectResult>();

        // Now PIN login works again
        var resumedPinLogin = await controller.LoginPin(new AuthController.LoginPinRequest
        {
            Email = "lockout@tindahan.ph",
            Pin = "5555"
        }, CancellationToken.None);

        resumedPinLogin.Result.Should().BeOfType<OkObjectResult>();
    }

    [Fact]
    public async Task LoginPin_ParallelRequests_DoNotExceedFiveAttempts()
    {
        AuthController.ResetAllIpPinThrottles();
        var dbName = Guid.NewGuid().ToString();
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(databaseName: dbName)
            .Options;

        var userMock = new Mock<ICurrentUserService>();
        userMock.Setup(u => u.TenantId).Returns(Guid.NewGuid());
        userMock.Setup(u => u.UserId).Returns(Guid.NewGuid());

        // Register user
        using (var setupContext = new AppDbContext(options, userMock.Object))
        {
            var setupController = CreateController(setupContext);
            await setupController.Register(new AuthController.RegisterRequest
            {
                Email = "parallelpin@tindahan.ph",
                Password = "Password123!",
                Pin = "1234",
                BusinessName = "Parallel Pin Store"
            }, CancellationToken.None);
        }

        // Launch 20 concurrent requests with wrong PINs from distinct IPs to test account lockout concurrency
        const int concurrentRequests = 20;
        var tasks = Enumerable.Range(0, concurrentRequests).Select(async i =>
        {
            using var taskContext = new AppDbContext(options, userMock.Object);
            var taskController = CreateController(taskContext);
            SetClientIp(taskController, $"192.168.1.{10 + i}");
            return await taskController.LoginPin(new AuthController.LoginPinRequest
            {
                Email = "parallelpin@tindahan.ph",
                Pin = $"99{i:D2}"
            }, CancellationToken.None);
        });

        var results = await Task.WhenAll(tasks);

        var unauthorizedCount = results.Count(r => r.Result is UnauthorizedObjectResult);
        var lockedOutCount = results.Count(r => r.Result is ObjectResult obj && obj.StatusCode == StatusCodes.Status429TooManyRequests);

        // Exactly 4 attempts get 401, 1 attempt triggers 429 lockout, and all 15 remaining are blocked by lockout
        unauthorizedCount.Should().Be(4);
        lockedOutCount.Should().Be(16);

        // Verify account is locked in the database
        using (var verifyContext = new AppDbContext(options, userMock.Object))
        {
            var user = await verifyContext.Users.IgnoreQueryFilters().FirstAsync(u => u.NormalizedEmail == "parallelpin@tindahan.ph");
            user.FailedPinAttempts.Should().Be(5);
            user.PinLockoutEnd.Should().NotBeNull();
            user.PinLockoutEnd!.Value.Should().BeAfter(DateTimeOffset.UtcNow);
        }
    }

    [Fact]
    public async Task LoginPin_IpThrottling_BlocksAttackerIpAcrossStores()
    {
        AuthController.ResetAllIpPinThrottles();
        var (context, _) = CreateInMemoryContext();
        var controller = CreateController(context);

        // Store A
        await controller.Register(new AuthController.RegisterRequest
        {
            Email = "store.a@tindahan.ph",
            Password = "Password123!",
            Pin = "1111",
            BusinessName = "Store A"
        }, CancellationToken.None);

        // Store B
        await controller.Register(new AuthController.RegisterRequest
        {
            Email = "store.b@tindahan.ph",
            Password = "Password123!",
            Pin = "2222",
            BusinessName = "Store B"
        }, CancellationToken.None);

        var attackerIp = "198.51.100.77";
        SetClientIp(controller, attackerIp);

        // Attacker sends 4 wrong PINs to Store A
        for (int i = 0; i < 4; i++)
        {
            var res = await controller.LoginPin(new AuthController.LoginPinRequest
            {
                Email = "store.a@tindahan.ph",
                Pin = "0000"
            }, CancellationToken.None);
            res.Result.Should().BeOfType<UnauthorizedObjectResult>();
        }

        // 5th attempt triggers IP throttling
        var fifthRes = await controller.LoginPin(new AuthController.LoginPinRequest
        {
            Email = "store.a@tindahan.ph",
            Pin = "0000"
        }, CancellationToken.None);
        fifthRes.Result.Should().BeOfType<ObjectResult>();
        var fifthObj = (ObjectResult)fifthRes.Result!;
        fifthObj.StatusCode.Should().Be(StatusCodes.Status429TooManyRequests);

        // Attacker attempts to hit Store B from the same IP: blocked immediately by IP throttle without touching Store B
        var attackStoreB = await controller.LoginPin(new AuthController.LoginPinRequest
        {
            Email = "store.b@tindahan.ph",
            Pin = "2222"
        }, CancellationToken.None);
        attackStoreB.Result.Should().BeOfType<ObjectResult>();
        var attackStoreBObj = (ObjectResult)attackStoreB.Result!;
        attackStoreBObj.StatusCode.Should().Be(StatusCodes.Status429TooManyRequests);

        // Verify Store B itself was NOT locked out: legitimate owner of Store B from different IP can log in
        SetClientIp(controller, "203.0.113.88");
        var legitimateStoreB = await controller.LoginPin(new AuthController.LoginPinRequest
        {
            Email = "store.b@tindahan.ph",
            Pin = "2222"
        }, CancellationToken.None);
        legitimateStoreB.Result.Should().BeOfType<OkObjectResult>();
    }

    [Fact]
    public async Task LoginPin_PasswordLogin_ClearsIpThrottleForStoreOwner()
    {
        AuthController.ResetAllIpPinThrottles();
        var (context, _) = CreateInMemoryContext();
        var controller = CreateController(context);

        await controller.Register(new AuthController.RegisterRequest
        {
            Email = "owner.reset@tindahan.ph",
            Password = "OwnerPassword123!",
            Pin = "4321",
            BusinessName = "Reset Test Store"
        }, CancellationToken.None);

        var storeIp = "192.168.1.100";
        SetClientIp(controller, storeIp);

        // 5 failed PIN attempts trigger IP lockout and PIN lockout
        for (int i = 0; i < 5; i++)
        {
            await controller.LoginPin(new AuthController.LoginPinRequest
            {
                Email = "owner.reset@tindahan.ph",
                Pin = "0000"
            }, CancellationToken.None);
        }

        // 6th PIN attempt is rejected with 429
        var blockedPin = await controller.LoginPin(new AuthController.LoginPinRequest
        {
            Email = "owner.reset@tindahan.ph",
            Pin = "4321"
        }, CancellationToken.None);
        blockedPin.Result.Should().BeOfType<ObjectResult>();
        ((ObjectResult)blockedPin.Result!).StatusCode.Should().Be(StatusCodes.Status429TooManyRequests);

        // Real owner logs in with password from the same IP
        var passwordLogin = await controller.Login(new AuthController.LoginRequest
        {
            Email = "owner.reset@tindahan.ph",
            Password = "OwnerPassword123!"
        }, CancellationToken.None);
        passwordLogin.Result.Should().BeOfType<OkObjectResult>();

        // Password login cleared the IP throttle AND the account lockout: PIN login succeeds immediately
        var unlockedPin = await controller.LoginPin(new AuthController.LoginPinRequest
        {
            Email = "owner.reset@tindahan.ph",
            Pin = "4321"
        }, CancellationToken.None);
        unlockedPin.Result.Should().BeOfType<OkObjectResult>();
    }

    [Fact]
    public async Task Logout_ClearsIpThrottleForStoreOwner()
    {
        AuthController.ResetAllIpPinThrottles();
        var (context, _) = CreateInMemoryContext();
        var controller = CreateController(context);

        await controller.Register(new AuthController.RegisterRequest
        {
            Email = "logout.reset@tindahan.ph",
            Password = "OwnerPassword123!",
            Pin = "4321",
            BusinessName = "Logout Test Store"
        }, CancellationToken.None);

        var storeIp = "192.168.1.101";
        SetClientIp(controller, storeIp);

        // 5 failed PIN attempts trigger IP lockout
        for (int i = 0; i < 5; i++)
        {
            await controller.LoginPin(new AuthController.LoginPinRequest
            {
                Email = "logout.reset@tindahan.ph",
                Pin = "0000"
            }, CancellationToken.None);
        }

        // 6th attempt is throttled with 429 and includes password guidance
        var blockedPin = await controller.LoginPin(new AuthController.LoginPinRequest
        {
            Email = "logout.reset@tindahan.ph",
            Pin = "4321"
        }, CancellationToken.None);
        blockedPin.Result.Should().BeOfType<ObjectResult>();
        var blockedObj = (ObjectResult)blockedPin.Result!;
        blockedObj.StatusCode.Should().Be(StatusCodes.Status429TooManyRequests);
        var blockedJson = JsonSerializer.Serialize(blockedObj.Value);
        blockedJson.Should().Contain("Password");

        // User logs out from this IP
        var logoutResult = await controller.Logout(null, CancellationToken.None);
        logoutResult.Should().BeOfType<OkObjectResult>();

        // IP throttle is cleared so IP is no longer locked out
        AuthLockoutHelper.IsIpPinThrottled(storeIp, TimeProvider.System, out _).Should().BeFalse();
    }

    [Fact]
    public async Task LoginPin_UnknownEmail_RecordsIpFailureAndThrottlesAfterFive()
    {
        AuthController.ResetAllIpPinThrottles();
        var (context, _) = CreateInMemoryContext();
        var controller = CreateController(context);

        var attackerIp = "198.51.100.99";
        SetClientIp(controller, attackerIp);

        // Attacker guesses 4 non-existent emails
        for (int i = 1; i <= 4; i++)
        {
            var res = await controller.LoginPin(new AuthController.LoginPinRequest
            {
                Email = $"fake{i}@unknown.ph",
                Pin = "1234"
            }, CancellationToken.None);
            res.Result.Should().BeOfType<UnauthorizedObjectResult>();
        }

        // 5th attempt triggers IP throttling
        var fifthRes = await controller.LoginPin(new AuthController.LoginPinRequest
        {
            Email = "fake5@unknown.ph",
            Pin = "1234"
        }, CancellationToken.None);
        fifthRes.Result.Should().BeOfType<ObjectResult>();
        ((ObjectResult)fifthRes.Result!).StatusCode.Should().Be(StatusCodes.Status429TooManyRequests);

        // 6th attempt is blocked by IP throttle
        var sixthRes = await controller.LoginPin(new AuthController.LoginPinRequest
        {
            Email = "fake6@unknown.ph",
            Pin = "1234"
        }, CancellationToken.None);
        sixthRes.Result.Should().BeOfType<ObjectResult>();
        ((ObjectResult)sixthRes.Result!).StatusCode.Should().Be(StatusCodes.Status429TooManyRequests);
    }

    [Fact]
    public async Task LoginPin_UnknownEmailAndNoPin_ReturnIdenticalGenericUnauthorizedResponse()
    {
        AuthController.ResetAllIpPinThrottles();
        var (context, _) = CreateInMemoryContext();
        var controller = CreateController(context);

        // Register user without PIN
        await controller.Register(new AuthController.RegisterRequest
        {
            Email = "userwithoutpin@tindahan.ph",
            Password = "Password123!",
            Pin = null,
            BusinessName = "No PIN Registered Store"
        }, CancellationToken.None);

        // 1. Call with non-existent email
        var unknownResult = await controller.LoginPin(new AuthController.LoginPinRequest
        {
            Email = "nonexistent.user@tindahan.ph",
            Pin = "1234"
        }, CancellationToken.None);

        unknownResult.Result.Should().BeOfType<UnauthorizedObjectResult>();
        var unknownObj = (UnauthorizedObjectResult)unknownResult.Result!;

        // 2. Call with existing user who has no PIN configured
        var noPinResult = await controller.LoginPin(new AuthController.LoginPinRequest
        {
            Email = "userwithoutpin@tindahan.ph",
            Pin = "1234"
        }, CancellationToken.None);

        noPinResult.Result.Should().BeOfType<UnauthorizedObjectResult>();
        var noPinObj = (UnauthorizedObjectResult)noPinResult.Result!;

        // 3. Responses must be identical (no enumeration leakage)
        var unknownJson = JsonSerializer.Serialize(unknownObj.Value);
        var noPinJson = JsonSerializer.Serialize(noPinObj.Value);
        unknownJson.Should().Be(noPinJson);
        unknownJson.Should().Contain("Maling email o PIN code.");
    }

    [Fact]
    public async Task UpdatePin_ValidPassword_SetsNewPinSuccessfully()
    {
        var (context, _) = CreateInMemoryContext();
        var controller = CreateController(context);

        var regResult = await controller.Register(new AuthController.RegisterRequest
        {
            Email = "updatepin@tindahan.ph",
            Password = "MasterPassword123!",
            Pin = "1111",
            BusinessName = "Update PIN Store"
        }, CancellationToken.None);

        var regDto = ((OkObjectResult)regResult.Result!).Value.Should().BeOfType<AuthController.AuthResponseDto>().Subject;
        SetAuthenticatedUser(controller, regDto.UserId, regDto.TenantId, regDto.Email);

        var updateResult = await controller.UpdatePin(new AuthController.UpdatePinRequest
        {
            Password = "MasterPassword123!",
            Pin = "9999"
        }, CancellationToken.None);

        updateResult.Should().BeOfType<OkObjectResult>();

        // Old PIN fails
        var oldPinResult = await controller.LoginPin(new AuthController.LoginPinRequest
        {
            Email = "updatepin@tindahan.ph",
            Pin = "1111"
        }, CancellationToken.None);
        oldPinResult.Result.Should().BeOfType<UnauthorizedObjectResult>();

        // New PIN succeeds
        var newPinResult = await controller.LoginPin(new AuthController.LoginPinRequest
        {
            Email = "updatepin@tindahan.ph",
            Pin = "9999"
        }, CancellationToken.None);
        newPinResult.Result.Should().BeOfType<OkObjectResult>();
    }

    [Fact]
    public async Task UpdatePin_ClearPin_RemovesPin()
    {
        var (context, _) = CreateInMemoryContext();
        var controller = CreateController(context);

        var regResult = await controller.Register(new AuthController.RegisterRequest
        {
            Email = "clearpin@tindahan.ph",
            Password = "MasterPassword123!",
            Pin = "1234",
            BusinessName = "Clear PIN Store"
        }, CancellationToken.None);

        var regDto = ((OkObjectResult)regResult.Result!).Value.Should().BeOfType<AuthController.AuthResponseDto>().Subject;
        SetAuthenticatedUser(controller, regDto.UserId, regDto.TenantId, regDto.Email);

        var clearResult = await controller.UpdatePin(new AuthController.UpdatePinRequest
        {
            Password = "MasterPassword123!",
            Pin = null
        }, CancellationToken.None);

        clearResult.Should().BeOfType<OkObjectResult>();

        var pinLoginResult = await controller.LoginPin(new AuthController.LoginPinRequest
        {
            Email = "clearpin@tindahan.ph",
            Pin = "1234"
        }, CancellationToken.None);
        pinLoginResult.Result.Should().BeOfType<UnauthorizedObjectResult>();
    }

    [Fact]
    public async Task UpdatePin_WrongPassword_ReturnsUnauthorized()
    {
        var (context, _) = CreateInMemoryContext();
        var controller = CreateController(context);

        var regResult = await controller.Register(new AuthController.RegisterRequest
        {
            Email = "wrongpass@tindahan.ph",
            Password = "CorrectPassword123!",
            BusinessName = "Wrong Pass Store"
        }, CancellationToken.None);

        var regDto = ((OkObjectResult)regResult.Result!).Value.Should().BeOfType<AuthController.AuthResponseDto>().Subject;
        SetAuthenticatedUser(controller, regDto.UserId, regDto.TenantId, regDto.Email);

        var result = await controller.UpdatePin(new AuthController.UpdatePinRequest
        {
            Password = "IncorrectPassword999!",
            Pin = "1234"
        }, CancellationToken.None);

        result.Should().BeOfType<UnauthorizedObjectResult>();
    }

    [Fact]
    public async Task UpdatePin_Unauthenticated_ReturnsUnauthorized()
    {
        var (context, _) = CreateInMemoryContext();
        var controller = CreateController(context);

        // No SetAuthenticatedUser and no ICurrentUserService.UserId
        var result = await controller.UpdatePin(new AuthController.UpdatePinRequest
        {
            Email = "anyone@tindahan.ph",
            Password = "Password123!",
            Pin = "1234"
        }, CancellationToken.None);

        result.Should().BeOfType<UnauthorizedObjectResult>();
    }

    [Fact]
    public async Task UpdatePin_IgnoresRequestBodyEmail_UsesAuthenticatedUserFromClaims()
    {
        var (context, _) = CreateInMemoryContext();
        var controller = CreateController(context);

        // Register victim store
        var victimReg = await controller.Register(new AuthController.RegisterRequest
        {
            Email = "victim@tindahan.ph",
            Password = "VictimPassword123!",
            Pin = "1111",
            BusinessName = "Victim Store"
        }, CancellationToken.None);
        var victimDto = ((OkObjectResult)victimReg.Result!).Value.Should().BeOfType<AuthController.AuthResponseDto>().Subject;

        // Register attacker store
        var attackerReg = await controller.Register(new AuthController.RegisterRequest
        {
            Email = "attacker@tindahan.ph",
            Password = "AttackerPassword123!",
            Pin = "2222",
            BusinessName = "Attacker Store"
        }, CancellationToken.None);
        var attackerDto = ((OkObjectResult)attackerReg.Result!).Value.Should().BeOfType<AuthController.AuthResponseDto>().Subject;

        // Attacker is authenticated with attacker's token
        SetAuthenticatedUser(controller, attackerDto.UserId, attackerDto.TenantId, attackerDto.Email);

        // Attacker attempts to update PIN passing victim's email, but attacker's own password
        var updateResult = await controller.UpdatePin(new AuthController.UpdatePinRequest
        {
            Email = "victim@tindahan.ph", // Request body email should be ignored!
            Password = "AttackerPassword123!",
            Pin = "9999"
        }, CancellationToken.None);

        updateResult.Should().BeOfType<OkObjectResult>();

        // Victim's PIN must still be 1111 (unmodified)
        var victimPinLogin = await controller.LoginPin(new AuthController.LoginPinRequest
        {
            Email = "victim@tindahan.ph",
            Pin = "1111"
        }, CancellationToken.None);
        victimPinLogin.Result.Should().BeOfType<OkObjectResult>();

        // Attacker's PIN was updated to 9999
        var attackerPinLogin = await controller.LoginPin(new AuthController.LoginPinRequest
        {
            Email = "attacker@tindahan.ph",
            Pin = "9999"
        }, CancellationToken.None);
        attackerPinLogin.Result.Should().BeOfType<OkObjectResult>();
    }

    [Fact]
    public async Task UpdatePin_FiveConsecutivePasswordFailures_LocksOutAccount()
    {
        var (context, _) = CreateInMemoryContext();
        var controller = CreateController(context);

        var regResult = await controller.Register(new AuthController.RegisterRequest
        {
            Email = "updatepinlock@tindahan.ph",
            Password = "RealPassword123!",
            Pin = "1234",
            BusinessName = "Lockout Test Store"
        }, CancellationToken.None);

        var regDto = ((OkObjectResult)regResult.Result!).Value.Should().BeOfType<AuthController.AuthResponseDto>().Subject;
        SetAuthenticatedUser(controller, regDto.UserId, regDto.TenantId, regDto.Email);

        // 4 failed password attempts return 401
        for (int i = 1; i <= 4; i++)
        {
            var failResult = await controller.UpdatePin(new AuthController.UpdatePinRequest
            {
                Password = "WrongPassword999!",
                Pin = "5678"
            }, CancellationToken.None);

            failResult.Should().BeOfType<UnauthorizedObjectResult>();
        }

        // 5th failed password attempt triggers 429 TooManyRequests
        var fifthResult = await controller.UpdatePin(new AuthController.UpdatePinRequest
        {
            Password = "WrongPassword999!",
            Pin = "5678"
        }, CancellationToken.None);

        fifthResult.Should().BeOfType<ObjectResult>();
        var fifthObj = (ObjectResult)fifthResult;
        fifthObj.StatusCode.Should().Be(StatusCodes.Status429TooManyRequests);

        // Account is locked out for Login as well
        var loginDuringLockout = await controller.Login(new AuthController.LoginRequest
        {
            Email = "updatepinlock@tindahan.ph",
            Password = "RealPassword123!"
        }, CancellationToken.None);

        loginDuringLockout.Result.Should().BeOfType<ObjectResult>();
        var loginLockObj = (ObjectResult)loginDuringLockout.Result!;
        loginLockObj.StatusCode.Should().Be(StatusCodes.Status429TooManyRequests);
    }

    [Fact]
    public async Task Login_FiveConsecutivePasswordFailures_LocksOutAccount()
    {
        var (context, _) = CreateInMemoryContext();
        var controller = CreateController(context);

        await controller.Register(new AuthController.RegisterRequest
        {
            Email = "loginlockout@tindahan.ph",
            Password = "MasterPassword123!",
            BusinessName = "Login Lockout Store"
        }, CancellationToken.None);

        // 4 failed attempts return 401
        for (int i = 1; i <= 4; i++)
        {
            var failResult = await controller.Login(new AuthController.LoginRequest
            {
                Email = "loginlockout@tindahan.ph",
                Password = "WrongPassword123!"
            }, CancellationToken.None);

            failResult.Result.Should().BeOfType<UnauthorizedObjectResult>();
        }

        // 5th failed attempt triggers 429
        var fifthResult = await controller.Login(new AuthController.LoginRequest
        {
            Email = "loginlockout@tindahan.ph",
            Password = "WrongPassword123!"
        }, CancellationToken.None);

        fifthResult.Result.Should().BeOfType<ObjectResult>();
        var fifthObj = (ObjectResult)fifthResult.Result!;
        fifthObj.StatusCode.Should().Be(StatusCodes.Status429TooManyRequests);

        // Subsequent attempt with correct password during lockout window is still blocked
        var lockedResult = await controller.Login(new AuthController.LoginRequest
        {
            Email = "loginlockout@tindahan.ph",
            Password = "MasterPassword123!"
        }, CancellationToken.None);

        lockedResult.Result.Should().BeOfType<ObjectResult>();
        var lockedObj = (ObjectResult)lockedResult.Result!;
        lockedObj.StatusCode.Should().Be(StatusCodes.Status429TooManyRequests);
    }

    [Fact]
    public async Task Login_SuccessfulPassword_ResetsPasswordFailureCounterAndLockout()
    {
        var (context, _) = CreateInMemoryContext();
        var controller = CreateController(context);

        await controller.Register(new AuthController.RegisterRequest
        {
            Email = "resetcounter@tindahan.ph",
            Password = "MasterPassword123!",
            BusinessName = "Reset Counter Store"
        }, CancellationToken.None);

        // Fail 3 times
        for (int i = 0; i < 3; i++)
        {
            await controller.Login(new AuthController.LoginRequest
            {
                Email = "resetcounter@tindahan.ph",
                Password = "WrongPassword!"
            }, CancellationToken.None);
        }

        var userBefore = await context.Users.IgnoreQueryFilters().FirstAsync(u => u.NormalizedEmail == "resetcounter@tindahan.ph");
        userBefore.FailedPasswordAttempts.Should().Be(3);

        // Successful login
        var successLogin = await controller.Login(new AuthController.LoginRequest
        {
            Email = "resetcounter@tindahan.ph",
            Password = "MasterPassword123!"
        }, CancellationToken.None);

        successLogin.Result.Should().BeOfType<OkObjectResult>();

        var userAfter = await context.Users.IgnoreQueryFilters().FirstAsync(u => u.NormalizedEmail == "resetcounter@tindahan.ph");
        userAfter.FailedPasswordAttempts.Should().Be(0);
        userAfter.PasswordLockoutEnd.Should().BeNull();
    }

    [Fact]
    public async Task UpdatePin_SuccessfulPassword_ResetsPasswordFailureCounterAndLockout()
    {
        var (context, _) = CreateInMemoryContext();
        var controller = CreateController(context);

        var regResult = await controller.Register(new AuthController.RegisterRequest
        {
            Email = "updatepinreset@tindahan.ph",
            Password = "MasterPassword123!",
            BusinessName = "Update PIN Reset Store"
        }, CancellationToken.None);

        var regDto = ((OkObjectResult)regResult.Result!).Value.Should().BeOfType<AuthController.AuthResponseDto>().Subject;
        SetAuthenticatedUser(controller, regDto.UserId, regDto.TenantId, regDto.Email);

        // Fail 2 times in UpdatePin
        for (int i = 0; i < 2; i++)
        {
            await controller.UpdatePin(new AuthController.UpdatePinRequest
            {
                Password = "WrongPassword!",
                Pin = "1234"
            }, CancellationToken.None);
        }

        var userBefore = await context.Users.IgnoreQueryFilters().FirstAsync(u => u.Id == regDto.UserId);
        userBefore.FailedPasswordAttempts.Should().Be(2);

        // Successful UpdatePin
        var updateResult = await controller.UpdatePin(new AuthController.UpdatePinRequest
        {
            Password = "MasterPassword123!",
            Pin = "5678"
        }, CancellationToken.None);

        updateResult.Should().BeOfType<OkObjectResult>();

        var userAfter = await context.Users.IgnoreQueryFilters().FirstAsync(u => u.Id == regDto.UserId);
        userAfter.FailedPasswordAttempts.Should().Be(0);
        userAfter.PasswordLockoutEnd.Should().BeNull();
    }

    [Fact]
    public async Task Register_ReturnsSignedJwt_WithValidHmacSignatureAndShortExpiry()
    {
        var (context, _) = CreateInMemoryContext();
        var controller = CreateController(context);

        var clientTenantId = Guid.NewGuid();
        var clientUserId = Guid.NewGuid();

        var result = await controller.Register(new AuthController.RegisterRequest
        {
            TenantId = clientTenantId,
            UserId = clientUserId,
            Email = "crypto.signed@tindahan.ph",
            Password = "Password123!",
            BusinessName = "Crypto Store"
        }, CancellationToken.None);

        result.Result.Should().BeOfType<OkObjectResult>();
        var dto = ((OkObjectResult)result.Result!).Value.Should().BeOfType<AuthController.AuthResponseDto>().Subject;

        dto.Token.Should().NotBeNullOrWhiteSpace();
        dto.RefreshToken.Should().NotBeNullOrWhiteSpace();

        // Must be a short expiry (60 minutes), NOT 1 year!
        dto.ExpiresAt.Should().BeAfter(DateTimeOffset.UtcNow.AddMinutes(50));
        dto.ExpiresAt.Should().BeBefore(DateTimeOffset.UtcNow.AddMinutes(65));

        var tokenHandler = new JwtSecurityTokenHandler();
        var validationParameters = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(TestJwtSecret)),
            ValidateIssuer = true,
            ValidIssuer = TestIssuer,
            ValidateAudience = true,
            ValidAudience = TestAudience,
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromMinutes(1)
        };

        var principal = tokenHandler.ValidateToken(dto.Token, validationParameters, out var validatedToken);
        validatedToken.Should().NotBeNull();
        validatedToken.Should().BeOfType<JwtSecurityToken>();

        var jwt = (JwtSecurityToken)validatedToken;
        jwt.Header.Alg.Should().Be(SecurityAlgorithms.HmacSha256);

        principal.FindFirst("tenant_id")?.Value.Should().Be(clientTenantId.ToString());
        principal.FindFirst("user_id")?.Value.Should().Be(clientUserId.ToString());
        principal.FindFirst("token_type")?.Value.Should().Be("access");

        // Verify role claim is embedded in token payload
        principal.FindFirst(ClaimTypes.Role)?.Value.Should().Be("Owner");
        principal.FindFirst("role")?.Value.Should().Be("Owner");
    }

    [Fact]
    public async Task Token_TamperedPayloadOrSignature_FailsCryptographicVerification()
    {
        var (context, _) = CreateInMemoryContext();
        var controller = CreateController(context);

        var result = await controller.Register(new AuthController.RegisterRequest
        {
            Email = "tamper.test@tindahan.ph",
            Password = "Password123!",
            BusinessName = "Tamper Test Store"
        }, CancellationToken.None);

        var dto = ((OkObjectResult)result.Result!).Value.Should().BeOfType<AuthController.AuthResponseDto>().Subject;
        var tokenParts = dto.Token.Split('.');
        tokenParts.Length.Should().Be(3);

        // Attacker alters payload (e.g. changing tenant_id) keeping original signature
        var forgedPayload = Convert.ToBase64String(Encoding.UTF8.GetBytes("{\"tenant_id\":\"00000000-0000-0000-0000-000000000000\"}"))
            .TrimEnd('=').Replace('+', '-').Replace('/', '_');
        var forgedToken = $"{tokenParts[0]}.{forgedPayload}.{tokenParts[2]}";

        var tokenHandler = new JwtSecurityTokenHandler();
        var validationParameters = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(TestJwtSecret)),
            ValidateIssuer = false,
            ValidateAudience = false,
            ValidateLifetime = false
        };

        var validateAction = () => tokenHandler.ValidateToken(forgedToken, validationParameters, out _);
        validateAction.Should().Throw<SecurityTokenException>();
    }

    [Fact]
    public async Task RefreshToken_ValidToken_ReturnsNewSignedTokenPair()
    {
        var (context, _) = CreateInMemoryContext();
        var controller = CreateController(context);

        var registerResult = await controller.Register(new AuthController.RegisterRequest
        {
            Email = "refreshtest@tindahan.ph",
            Password = "Password123!",
            BusinessName = "Refresh Test Store"
        }, CancellationToken.None);

        var registerDto = ((OkObjectResult)registerResult.Result!).Value.Should().BeOfType<AuthController.AuthResponseDto>().Subject;
        registerDto.RefreshToken.Should().NotBeNullOrWhiteSpace();

        var refreshResult = await controller.Refresh(new AuthController.RefreshTokenRequest
        {
            RefreshToken = registerDto.RefreshToken!
        }, CancellationToken.None);

        refreshResult.Result.Should().BeOfType<OkObjectResult>();
        var refreshDto = ((OkObjectResult)refreshResult.Result!).Value.Should().BeOfType<AuthController.AuthResponseDto>().Subject;

        refreshDto.Token.Should().NotBeNullOrWhiteSpace();
        refreshDto.RefreshToken.Should().NotBeNullOrWhiteSpace();
        refreshDto.Email.Should().Be("refreshtest@tindahan.ph");
        refreshDto.TenantId.Should().Be(registerDto.TenantId);
        refreshDto.UserId.Should().Be(registerDto.UserId);
    }

    [Fact]
    public async Task RefreshToken_ForgedOrInvalidToken_ReturnsUnauthorized()
    {
        var (context, _) = CreateInMemoryContext();
        var controller = CreateController(context);

        var result = await controller.Refresh(new AuthController.RefreshTokenRequest
        {
            RefreshToken = "forged.refresh.token"
        }, CancellationToken.None);

        result.Result.Should().BeOfType<UnauthorizedObjectResult>();
    }

    [Fact]
    public async Task RefreshToken_ExpiredToken_ReturnsUnauthorized()
    {
        var (context, _) = CreateInMemoryContext();
        // Create a JWT service with -1 days expiry so refresh tokens are already expired
        var expiredJwtService = CreateJwtTokenService(refreshExpiryDays: -1);
        var controller = CreateController(context, expiredJwtService);

        var registerResult = await controller.Register(new AuthController.RegisterRequest
        {
            Email = "expiredrefresh@tindahan.ph",
            Password = "Password123!",
            BusinessName = "Expired Refresh Store"
        }, CancellationToken.None);

        var registerDto = ((OkObjectResult)registerResult.Result!).Value.Should().BeOfType<AuthController.AuthResponseDto>().Subject;

        var result = await controller.Refresh(new AuthController.RefreshTokenRequest
        {
            RefreshToken = registerDto.RefreshToken!
        }, CancellationToken.None);

        result.Result.Should().BeOfType<UnauthorizedObjectResult>();
    }

    [Fact]
    public async Task ExpiredAccessToken_IsRejectedByApiValidation_AndRefreshIssuesAValidAccessToken()
    {
        // Access tokens last 60 minutes. Issue one far enough in the past that the API's
        // 1-minute clock skew still treats it as expired, while the 30-day refresh token remains valid.
        var issuedAt = DateTimeOffset.UtcNow.AddMinutes(-70);
        var timeProvider = new MutableTimeProvider(issuedAt);
        var (context, _) = CreateInMemoryContext();
        var jwtService = CreateJwtTokenService(timeProvider: timeProvider);
        var controller = CreateController(context, jwtService, timeProvider: timeProvider);

        var registerResult = await controller.Register(new AuthController.RegisterRequest
        {
            Email = "expired.access@tindahan.ph",
            Password = "Password123!",
            BusinessName = "Expired Access Store"
        }, CancellationToken.None);

        var registerDto = ((OkObjectResult)registerResult.Result!).Value.Should().BeOfType<AuthController.AuthResponseDto>().Subject;
        registerDto.Token.Should().NotBeNullOrWhiteSpace();
        registerDto.RefreshToken.Should().NotBeNullOrWhiteSpace();

        var validationParameters = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(TestJwtSecret)),
            ValidateIssuer = true,
            ValidIssuer = TestIssuer,
            ValidateAudience = true,
            ValidAudience = TestAudience,
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromMinutes(1)
        };

        var tokenHandler = new JwtSecurityTokenHandler();
        var expired = () => tokenHandler.ValidateToken(registerDto.Token, validationParameters, out _);
        expired.Should().Throw<SecurityTokenExpiredException>();

        timeProvider.SetUtcNow(DateTimeOffset.UtcNow);
        var refreshResult = await controller.Refresh(new AuthController.RefreshTokenRequest
        {
            RefreshToken = registerDto.RefreshToken!
        }, CancellationToken.None);

        refreshResult.Result.Should().BeOfType<OkObjectResult>();
        var refreshDto = ((OkObjectResult)refreshResult.Result!).Value.Should().BeOfType<AuthController.AuthResponseDto>().Subject;
        refreshDto.Token.Should().NotBe(registerDto.Token);
        refreshDto.RefreshToken.Should().NotBeNullOrWhiteSpace();

        var principal = tokenHandler.ValidateToken(refreshDto.Token, validationParameters, out var validatedToken);
        validatedToken.Should().BeOfType<JwtSecurityToken>();
        principal.FindFirst("tenant_id")!.Value.Should().Be(registerDto.TenantId.ToString());
    }

    [Fact]
    public async Task RefreshToken_RotatesOnUse_And_ReusedOldTokenIsRejectedAndRevokesSession()
    {
        var startTime = DateTimeOffset.UtcNow;
        var timeProvider = new MutableTimeProvider(startTime);
        var (context, _) = CreateInMemoryContext();
        var jwtService = CreateJwtTokenService(timeProvider: timeProvider);
        var controller = CreateController(context, jwtService, timeProvider: timeProvider);

        // 1. Register a user
        var regResult = await controller.Register(new AuthController.RegisterRequest
        {
            Email = "rotation.test@tindahan.ph",
            Password = "Password123!",
            BusinessName = "Rotation Test Store"
        }, CancellationToken.None);
        var regDto = ((OkObjectResult)regResult.Result!).Value.Should().BeOfType<AuthController.AuthResponseDto>().Subject;
        var token1 = regDto.RefreshToken!;

        var user = await context.Users.IgnoreQueryFilters().FirstAsync(u => u.Id == regDto.UserId);
        user.RefreshTokenIdHash.Should().NotBeNullOrWhiteSpace();

        // 2. First refresh with token1 succeeds and rotates to token2
        timeProvider.Advance(TimeSpan.FromSeconds(5));
        var refreshResult1 = await controller.Refresh(new AuthController.RefreshTokenRequest
        {
            RefreshToken = token1
        }, CancellationToken.None);
        refreshResult1.Result.Should().BeOfType<OkObjectResult>();
        var refreshDto1 = ((OkObjectResult)refreshResult1.Result!).Value.Should().BeOfType<AuthController.AuthResponseDto>().Subject;
        var token2 = refreshDto1.RefreshToken!;
        token2.Should().NotBe(token1);

        // 3. Client re-sends token1 within the 30-second grace window (e.g. 5 seconds after rotation) -> SUCCEEDS!
        timeProvider.Advance(TimeSpan.FromSeconds(5));
        var graceResult = await controller.Refresh(new AuthController.RefreshTokenRequest
        {
            RefreshToken = token1
        }, CancellationToken.None);
        graceResult.Result.Should().BeOfType<OkObjectResult>("Previous token must be accepted within the short grace window");
        var graceDto = ((OkObjectResult)graceResult.Result!).Value.Should().BeOfType<AuthController.AuthResponseDto>().Subject;
        graceDto.Token.Should().NotBeNullOrWhiteSpace();

        // 4. Advance time past the grace window (35 seconds later)
        timeProvider.Advance(TimeSpan.FromSeconds(35));

        // 5. Attacker replays token1 outside the grace window -> REUSE DETECTED!
        var replayResult = await controller.Refresh(new AuthController.RefreshTokenRequest
        {
            RefreshToken = token1
        }, CancellationToken.None);
        replayResult.Result.Should().BeOfType<UnauthorizedObjectResult>();

        // 6. Reuse detection immediately revokes the family in the database
        var familyTokens = await context.UserRefreshTokens.IgnoreQueryFilters()
            .Where(r => r.UserId == regDto.UserId)
            .ToListAsync();
        familyTokens.Should().NotBeEmpty();
        familyTokens.All(r => r.IsRevoked).Should().BeTrue("The entire affected token family must be revoked on reuse");

        // 7. Subsequent refresh with token2 is now ALSO rejected because the compromised family was revoked
        var refreshResult2 = await controller.Refresh(new AuthController.RefreshTokenRequest
        {
            RefreshToken = token2
        }, CancellationToken.None);
        refreshResult2.Result.Should().BeOfType<UnauthorizedObjectResult>();
    }

    [Fact]
    public async Task RefreshToken_MultipleDevices_RevokingOneFamilyOnReuse_DoesNotAffectOtherDevices()
    {
        var startTime = DateTimeOffset.UtcNow;
        var timeProvider = new MutableTimeProvider(startTime);
        var (context, _) = CreateInMemoryContext();
        var jwtService = CreateJwtTokenService(timeProvider: timeProvider);
        var controller = CreateController(context, jwtService, timeProvider: timeProvider);

        // 1. Register user on Device 1 (phone)
        var regResult = await controller.Register(new AuthController.RegisterRequest
        {
            Email = "multidevice@tindahan.ph",
            Password = "Password123!",
            BusinessName = "Multi Device Store"
        }, CancellationToken.None);
        var regDto = ((OkObjectResult)regResult.Result!).Value.Should().BeOfType<AuthController.AuthResponseDto>().Subject;
        var deviceAToken1 = regDto.RefreshToken!;

        // 2. User logs in on Device 2 (tablet) with same credentials
        timeProvider.Advance(TimeSpan.FromSeconds(2));
        var loginResult = await controller.Login(new AuthController.LoginRequest
        {
            Email = "multidevice@tindahan.ph",
            Password = "Password123!"
        }, CancellationToken.None);
        var loginDto = ((OkObjectResult)loginResult.Result!).Value.Should().BeOfType<AuthController.AuthResponseDto>().Subject;
        var deviceBToken1 = loginDto.RefreshToken!;

        deviceAToken1.Should().NotBe(deviceBToken1);

        // Verify two separate token families exist in UserRefreshTokens
        var distinctFamilies = await context.UserRefreshTokens.IgnoreQueryFilters()
            .Where(r => r.UserId == regDto.UserId && !r.IsRevoked)
            .Select(r => r.FamilyId)
            .Distinct()
            .ToListAsync();
        distinctFamilies.Should().HaveCount(2, "Each device session must have its own distinct FamilyId");

        // 3. Device A rotates its token: deviceAToken1 -> deviceAToken2
        timeProvider.Advance(TimeSpan.FromSeconds(5));
        var refreshResultA1 = await controller.Refresh(new AuthController.RefreshTokenRequest
        {
            RefreshToken = deviceAToken1
        }, CancellationToken.None);
        refreshResultA1.Result.Should().BeOfType<OkObjectResult>();

        // 4. Advance time past the grace window (35 seconds)
        timeProvider.Advance(TimeSpan.FromSeconds(35));

        // 5. Attacker replays deviceAToken1 outside grace window -> reuse detected on Device A's family
        var replayResultA = await controller.Refresh(new AuthController.RefreshTokenRequest
        {
            RefreshToken = deviceAToken1
        }, CancellationToken.None);
        replayResultA.Result.Should().BeOfType<UnauthorizedObjectResult>();

        // 6. Device B refreshes its token deviceBToken1 -> MUST SUCCEED because Device B's family is unaffected!
        var refreshResultB = await controller.Refresh(new AuthController.RefreshTokenRequest
        {
            RefreshToken = deviceBToken1
        }, CancellationToken.None);
        refreshResultB.Result.Should().BeOfType<OkObjectResult>("Device B's family must not be revoked when Device A suffers token reuse");
        var refreshDtoB = ((OkObjectResult)refreshResultB.Result!).Value.Should().BeOfType<AuthController.AuthResponseDto>().Subject;
        refreshDtoB.RefreshToken.Should().NotBeNullOrWhiteSpace();
        refreshDtoB.RefreshToken.Should().NotBe(deviceBToken1);
    }

    [Fact]
    public async Task Logout_WithRefreshToken_RevokesOnlyTargetDeviceFamily_LeavingOtherDevicesActive()
    {
        var (context, _) = CreateInMemoryContext();
        var controller = CreateController(context);

        // 1. Device A registers
        var regResult = await controller.Register(new AuthController.RegisterRequest
        {
            Email = "multidevice.logout@tindahan.ph",
            Password = "Password123!",
            BusinessName = "Multi Device Store"
        }, CancellationToken.None);
        var regDto = ((OkObjectResult)regResult.Result!).Value.Should().BeOfType<AuthController.AuthResponseDto>().Subject;
        var deviceAToken = regDto.RefreshToken!;

        // 2. Device B logs in
        var loginResult = await controller.Login(new AuthController.LoginRequest
        {
            Email = "multidevice.logout@tindahan.ph",
            Password = "Password123!"
        }, CancellationToken.None);
        var loginDto = ((OkObjectResult)loginResult.Result!).Value.Should().BeOfType<AuthController.AuthResponseDto>().Subject;
        var deviceBToken = loginDto.RefreshToken!;

        // 3. Logout specifying Device A's refresh token
        var logoutResult = await controller.Logout(new AuthController.LogoutRequest
        {
            RefreshToken = deviceAToken
        }, CancellationToken.None);
        logoutResult.Should().BeOfType<OkObjectResult>();

        // 4. Device A refresh is rejected (family revoked)
        var refreshResultA = await controller.Refresh(new AuthController.RefreshTokenRequest
        {
            RefreshToken = deviceAToken
        }, CancellationToken.None);
        refreshResultA.Result.Should().BeOfType<UnauthorizedObjectResult>();

        // 5. Device B refresh succeeds (family intact)
        var refreshResultB = await controller.Refresh(new AuthController.RefreshTokenRequest
        {
            RefreshToken = deviceBToken
        }, CancellationToken.None);
        refreshResultB.Result.Should().BeOfType<OkObjectResult>();
        var refreshDtoB = ((OkObjectResult)refreshResultB.Result!).Value.Should().BeOfType<AuthController.AuthResponseDto>().Subject;
        refreshDtoB.RefreshToken.Should().NotBeNullOrWhiteSpace();
    }

    [Fact]
    public async Task RefreshToken_PrunesReplacedTokensPastGraceWindow_KeepingTableSmallPerDevice()
    {
        var (context, _) = CreateInMemoryContext();
        var timeProvider = new MutableTimeProvider(DateTimeOffset.UtcNow);
        var controller = CreateController(context, timeProvider: timeProvider);

        // 1. Register -> creates token T1 in new family
        var regResult = await controller.Register(new AuthController.RegisterRequest
        {
            Email = "tablepruning@tindahan.ph",
            Password = "Password123!",
            BusinessName = "Pruning Store"
        }, CancellationToken.None);
        var regDto = ((OkObjectResult)regResult.Result!).Value.Should().BeOfType<AuthController.AuthResponseDto>().Subject;
        var t1 = regDto.RefreshToken!;

        var initialTokens = await context.UserRefreshTokens.IgnoreQueryFilters()
            .Where(r => r.UserId == regDto.UserId)
            .ToListAsync();
        initialTokens.Should().HaveCount(1);
        var familyId = initialTokens[0].FamilyId;

        // 2. Advance 5 seconds and refresh T1 -> T2
        timeProvider.Advance(TimeSpan.FromSeconds(5));
        var refreshResult1 = await controller.Refresh(new AuthController.RefreshTokenRequest { RefreshToken = t1 }, CancellationToken.None);
        refreshResult1.Result.Should().BeOfType<OkObjectResult>();
        var t2 = ((OkObjectResult)refreshResult1.Result!).Value.Should().BeOfType<AuthController.AuthResponseDto>().Subject.RefreshToken!;

        var tokensAfterFirstRefresh = await context.UserRefreshTokens.IgnoreQueryFilters()
            .Where(r => r.UserId == regDto.UserId && r.FamilyId == familyId)
            .ToListAsync();
        tokensAfterFirstRefresh.Should().HaveCount(2); // T1 (replaced, in grace window) and T2 (active)

        // 3. Advance 35 seconds (past T1's 30-second grace window) and refresh T2 -> T3
        timeProvider.Advance(TimeSpan.FromSeconds(35));
        var refreshResult2 = await controller.Refresh(new AuthController.RefreshTokenRequest { RefreshToken = t2 }, CancellationToken.None);
        refreshResult2.Result.Should().BeOfType<OkObjectResult>();
        var t3 = ((OkObjectResult)refreshResult2.Result!).Value.Should().BeOfType<AuthController.AuthResponseDto>().Subject.RefreshToken!;

        var tokensAfterSecondRefresh = await context.UserRefreshTokens.IgnoreQueryFilters()
            .Where(r => r.UserId == regDto.UserId && r.FamilyId == familyId)
            .ToListAsync();
        DefaultJwtService.ValidateRefreshToken(t1, out _, out _, out var t1Jti, out _);
        var t1Hash = DefaultJwtService.HashTokenId(t1Jti);
        // T1 must have been pruned because it is replaced and its grace window expired!
        tokensAfterSecondRefresh.Should().HaveCount(2); // T2 (replaced, in grace window) and T3 (active)
        tokensAfterSecondRefresh.Should().NotContain(r => r.TokenHash == t1Hash);

        // 4. Advance 35 seconds again and refresh T3 -> T4
        timeProvider.Advance(TimeSpan.FromSeconds(35));
        var refreshResult3 = await controller.Refresh(new AuthController.RefreshTokenRequest { RefreshToken = t3 }, CancellationToken.None);
        refreshResult3.Result.Should().BeOfType<OkObjectResult>();

        var tokensAfterThirdRefresh = await context.UserRefreshTokens.IgnoreQueryFilters()
            .Where(r => r.UserId == regDto.UserId && r.FamilyId == familyId)
            .ToListAsync();
        // T2 pruned, only T3 and T4 remain
        tokensAfterThirdRefresh.Should().HaveCount(2);
    }

    [Fact]
    public async Task RefreshToken_RevokedAfterLogout_ReturnsUnauthorized()
    {
        var (context, _) = CreateInMemoryContext();
        var controller = CreateController(context);

        var regResult = await controller.Register(new AuthController.RegisterRequest
        {
            Email = "logout.revocation@tindahan.ph",
            Password = "Password123!",
            BusinessName = "Logout Test Store"
        }, CancellationToken.None);
        var regDto = ((OkObjectResult)regResult.Result!).Value.Should().BeOfType<AuthController.AuthResponseDto>().Subject;
        var refreshToken = regDto.RefreshToken!;

        SetAuthenticatedUser(controller, regDto.UserId, regDto.TenantId, regDto.Email);

        // Call Logout endpoint
        var logoutResult = await controller.Logout(new AuthController.LogoutRequest(), CancellationToken.None);
        logoutResult.Should().BeOfType<OkObjectResult>();

        // Database record has no active refresh token
        var user = await context.Users.IgnoreQueryFilters().FirstAsync(u => u.Id == regDto.UserId);
        user.RefreshTokenIdHash.Should().BeNull();

        // Refresh with old token fails
        var refreshResult = await controller.Refresh(new AuthController.RefreshTokenRequest
        {
            RefreshToken = refreshToken
        }, CancellationToken.None);
        refreshResult.Result.Should().BeOfType<UnauthorizedObjectResult>();
    }

    [Fact]
    public async Task Logout_WithRefreshTokenInBody_RevokesSessionWithoutBearerAuth()
    {
        var (context, _) = CreateInMemoryContext();
        var controller = CreateController(context);

        var regResult = await controller.Register(new AuthController.RegisterRequest
        {
            Email = "bodylogout@tindahan.ph",
            Password = "Password123!",
            BusinessName = "Body Logout Store"
        }, CancellationToken.None);
        var regDto = ((OkObjectResult)regResult.Result!).Value.Should().BeOfType<AuthController.AuthResponseDto>().Subject;

        // Unauthenticated controller (no bearer token)
        var unauthController = CreateController(context);

        var logoutResult = await unauthController.Logout(new AuthController.LogoutRequest
        {
            RefreshToken = regDto.RefreshToken
        }, CancellationToken.None);
        logoutResult.Should().BeOfType<OkObjectResult>();

        var user = await context.Users.IgnoreQueryFilters().FirstAsync(u => u.Id == regDto.UserId);
        user.RefreshTokenIdHash.Should().BeNull();

        var refreshResult = await controller.Refresh(new AuthController.RefreshTokenRequest
        {
            RefreshToken = regDto.RefreshToken!
        }, CancellationToken.None);
        refreshResult.Result.Should().BeOfType<UnauthorizedObjectResult>();
    }

    [Fact]
    public async Task RefreshToken_RevokedAfterPasswordChange_ReturnsUnauthorized()
    {
        var (context, _) = CreateInMemoryContext();
        var controller = CreateController(context);

        var regResult = await controller.Register(new AuthController.RegisterRequest
        {
            Email = "pwdchange.revoke@tindahan.ph",
            Password = "OldPassword123!",
            BusinessName = "Password Change Store"
        }, CancellationToken.None);
        var regDto = ((OkObjectResult)regResult.Result!).Value.Should().BeOfType<AuthController.AuthResponseDto>().Subject;
        var oldRefreshToken = regDto.RefreshToken!;

        SetAuthenticatedUser(controller, regDto.UserId, regDto.TenantId, regDto.Email);

        // Change password
        var changeResult = await controller.ChangePassword(new AuthController.ChangePasswordRequest
        {
            CurrentPassword = "OldPassword123!",
            NewPassword = "NewPassword999!"
        }, CancellationToken.None);
        changeResult.Should().BeOfType<OkObjectResult>();

        // Old refresh token must be rejected
        var refreshResult = await controller.Refresh(new AuthController.RefreshTokenRequest
        {
            RefreshToken = oldRefreshToken
        }, CancellationToken.None);
        refreshResult.Result.Should().BeOfType<UnauthorizedObjectResult>();

        // Login with new password succeeds and issues fresh tokens
        var newLoginResult = await controller.Login(new AuthController.LoginRequest
        {
            Email = "pwdchange.revoke@tindahan.ph",
            Password = "NewPassword999!"
        }, CancellationToken.None);
        newLoginResult.Result.Should().BeOfType<OkObjectResult>();
    }

    [Fact]
    public async Task RefreshToken_RevokedAfterPinChange_ReturnsUnauthorized()
    {
        var (context, _) = CreateInMemoryContext();
        var controller = CreateController(context);

        var regResult = await controller.Register(new AuthController.RegisterRequest
        {
            Email = "pinchange.revoke@tindahan.ph",
            Password = "Password123!",
            Pin = "1111",
            BusinessName = "Pin Change Store"
        }, CancellationToken.None);
        var regDto = ((OkObjectResult)regResult.Result!).Value.Should().BeOfType<AuthController.AuthResponseDto>().Subject;
        var oldRefreshToken = regDto.RefreshToken!;

        SetAuthenticatedUser(controller, regDto.UserId, regDto.TenantId, regDto.Email);

        // Update PIN
        var updatePinResult = await controller.UpdatePin(new AuthController.UpdatePinRequest
        {
            Password = "Password123!",
            Pin = "9999"
        }, CancellationToken.None);
        updatePinResult.Should().BeOfType<OkObjectResult>();

        // Old refresh token must be rejected
        var refreshResult = await controller.Refresh(new AuthController.RefreshTokenRequest
        {
            RefreshToken = oldRefreshToken
        }, CancellationToken.None);
        refreshResult.Result.Should().BeOfType<UnauthorizedObjectResult>();
    }

    private sealed class EmailRaceAppDbContext : AppDbContext
    {
        public bool ThrowExceptionOnSave { get; set; } = true;
        public string SqlState { get; set; } = PostgresErrorCodes.UniqueViolation;
        public string ConstraintName { get; set; } = FluentTindahan.Domain.Entities.User.NormalizedEmailUniqueIndexName;

        public EmailRaceAppDbContext(
            DbContextOptions<AppDbContext> options,
            ICurrentUserService currentUser) : base(options, currentUser)
        {
        }

        public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
        {
            if (ThrowExceptionOnSave)
            {
                var uniqueViolation = new PostgresException(
                    "duplicate key value violates unique constraint",
                    "ERROR",
                    "ERROR",
                    SqlState,
                    constraintName: ConstraintName);
                throw new DbUpdateException("A concurrent registration already inserted this row.", uniqueViolation);
            }

            return base.SaveChangesAsync(cancellationToken);
        }
    }

    [Fact]
    public async Task Register_ConcurrentRaceDbUpdateException_Returns409Conflict()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;
        var userMock = new Mock<ICurrentUserService>();
        userMock.Setup(u => u.TenantId).Returns(Guid.NewGuid());
        userMock.Setup(u => u.UserId).Returns(Guid.NewGuid());

        var raceContext = new EmailRaceAppDbContext(options, userMock.Object)
        {
            ThrowExceptionOnSave = true,
            ConstraintName = FluentTindahan.Domain.Entities.User.NormalizedEmailUniqueIndexName
        };

        var controller = CreateController(raceContext);
        var request = new AuthController.RegisterRequest
        {
            Email = "concurrent.owner@tindahan.ph",
            Password = "SecurePassword123!",
            BusinessName = "Concurrent Race Tindahan"
        };

        var result = await controller.Register(request, CancellationToken.None);

        result.Result.Should().BeOfType<ConflictObjectResult>();
        var conflict = (ConflictObjectResult)result.Result!;
        conflict.StatusCode.Should().Be(StatusCodes.Status409Conflict);
        var json = JsonSerializer.Serialize(conflict.Value);
        json.Should().Contain("May tindahan nang nakarehistro gamit ang email na ito");
    }

    [Fact]
    public async Task Register_ConcurrentRaceTenantOrUserConflict_Returns409Conflict()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;
        var userMock = new Mock<ICurrentUserService>();
        userMock.Setup(u => u.TenantId).Returns(Guid.NewGuid());
        userMock.Setup(u => u.UserId).Returns(Guid.NewGuid());

        var raceContext = new EmailRaceAppDbContext(options, userMock.Object)
        {
            ThrowExceptionOnSave = true,
            ConstraintName = "PK_Tenants"
        };

        var controller = CreateController(raceContext);
        var request = new AuthController.RegisterRequest
        {
            Email = "concurrent.pk@tindahan.ph",
            Password = "SecurePassword123!",
            BusinessName = "Concurrent PK Tindahan"
        };

        var result = await controller.Register(request, CancellationToken.None);

        result.Result.Should().BeOfType<ConflictObjectResult>();
        var conflict = (ConflictObjectResult)result.Result!;
        conflict.StatusCode.Should().Be(StatusCodes.Status409Conflict);
        var json = JsonSerializer.Serialize(conflict.Value);
        json.Should().Contain("nakarehistro gamit ang ID na ito");
    }

    [Fact]
    public async Task Register_UnicodeAndWhitespaceNormalizedEmail_RejectsDuplicateWithConflict()
    {
        var (context, _) = CreateInMemoryContext();
        var controller = CreateController(context);

        // 1. Initial registration with standard email
        var first = await controller.Register(new AuthController.RegisterRequest
        {
            Email = "aling.nena@tindahan.ph",
            Password = "Password123!",
            BusinessName = "Aling Nena Tindahan"
        }, CancellationToken.None);
        first.Result.Should().BeOfType<OkObjectResult>();

        // 2. Duplicate registration with zero-width space
        var withZeroWidth = await controller.Register(new AuthController.RegisterRequest
        {
            Email = "aling\u200B.nena@tindahan.ph",
            Password = "Password123!",
            BusinessName = "Zero Width Store"
        }, CancellationToken.None);
        withZeroWidth.Result.Should().BeOfType<ConflictObjectResult>();

        // 3. Duplicate registration with Unicode whitespace (non-breaking space and full-width space)
        var withUnicodeWhitespace = await controller.Register(new AuthController.RegisterRequest
        {
            Email = "\u00A0aling.nena@tindahan.ph\u3000",
            Password = "Password123!",
            BusinessName = "Unicode Space Store"
        }, CancellationToken.None);
        withUnicodeWhitespace.Result.Should().BeOfType<ConflictObjectResult>();

        // 4. Duplicate registration with uppercase and extra spaces
        var withUppercase = await controller.Register(new AuthController.RegisterRequest
        {
            Email = "  ALING.NENA@TINDAHAN.PH  ",
            Password = "Password123!",
            BusinessName = "Uppercase Store"
        }, CancellationToken.None);
        withUppercase.Result.Should().BeOfType<ConflictObjectResult>();
    }

    [Fact]
    public async Task Login_And_LoginPin_UnicodeAndWhitespaceNormalizedEmail_AuthenticatesSuccessfully()
    {
        var (context, _) = CreateInMemoryContext();
        var controller = CreateController(context);

        // Register user
        var regResult = await controller.Register(new AuthController.RegisterRequest
        {
            Email = "suki.unicode@tindahan.ph",
            Password = "Password123!",
            Pin = "5555",
            BusinessName = "Unicode Suki Store"
        }, CancellationToken.None);
        regResult.Result.Should().BeOfType<OkObjectResult>();

        // Login with uppercase, zero-width space, and non-breaking space
        var loginResult = await controller.Login(new AuthController.LoginRequest
        {
            Email = "\u00A0SUKI.UNICODE\u200B@TINDAHAN.PH  ",
            Password = "Password123!"
        }, CancellationToken.None);
        loginResult.Result.Should().BeOfType<OkObjectResult>();

        // LoginPin with zero-width non-joiner and BOM
        var pinResult = await controller.LoginPin(new AuthController.LoginPinRequest
        {
            Email = "\uFEFFsuki.unicode\u200C@tindahan.ph",
            Pin = "5555"
        }, CancellationToken.None);
        pinResult.Result.Should().BeOfType<OkObjectResult>();
    }

    [Fact]
    public void NormalizeEmail_And_CleanDisplayEmail_NormalizesCorrectly()
    {
        AuthController.NormalizeEmail(null).Should().Be(string.Empty);
        AuthController.NormalizeEmail("").Should().Be(string.Empty);
        AuthController.NormalizeEmail("   ").Should().Be(string.Empty);

        // Trimming Unicode whitespaces
        AuthController.NormalizeEmail("\u00A0user@example.ph\u3000").Should().Be("user@example.ph");

        // Zero-width characters
        AuthController.NormalizeEmail("u\u200Bs\u200Ce\u200Dr\uFEFF@example.ph").Should().Be("user@example.ph");

        // Decomposed vs precomposed Unicode accents
        var decomposed = "e\u0301xample@tindahan.ph";
        var precomposed = "\u00E9xample@tindahan.ph";
        AuthController.NormalizeEmail(decomposed).Should().Be(AuthController.NormalizeEmail(precomposed));

        // CleanDisplayEmail preserves case but cleans invisible chars & trims
        AuthController.CleanDisplayEmail("  \u00A0User.Name\u200B@Domain.PH\u3000 ").Should().Be("User.Name@Domain.PH");
        AuthController.NormalizeEmail("  \u00A0User.Name\u200B@Domain.PH\u3000 ").Should().Be("user.name@domain.ph");
    }

    [Fact]
    public void IsUniqueEmailViolation_EvaluatesConstraintsAccurately()
    {
        // 1. Matches IX_Users_NormalizedEmail PostgresException
        var pgEx = new PostgresException(
            "duplicate key", "ERROR", "ERROR", PostgresErrorCodes.UniqueViolation,
            constraintName: FluentTindahan.Domain.Entities.User.NormalizedEmailUniqueIndexName);
        var dbEx = new DbUpdateException("error", pgEx);
        AuthController.IsUniqueEmailViolation(dbEx).Should().BeTrue();

        // 2. Matches when constraint name contains NormalizedEmail
        var pgExCase = new PostgresException(
            "duplicate key", "ERROR", "ERROR", PostgresErrorCodes.UniqueViolation,
            constraintName: "ix_users_normalizedemail");
        AuthController.IsUniqueEmailViolation(new DbUpdateException("error", pgExCase)).Should().BeTrue();

        // 3. Matches when constraint name is empty
        var pgExEmpty = new PostgresException(
            "duplicate key", "ERROR", "ERROR", PostgresErrorCodes.UniqueViolation,
            constraintName: "");
        AuthController.IsUniqueEmailViolation(new DbUpdateException("error", pgExEmpty)).Should().BeTrue();

        // 4. Returns false when constraint is for a different table/column
        var pgExOther = new PostgresException(
            "duplicate key", "ERROR", "ERROR", PostgresErrorCodes.UniqueViolation,
            constraintName: "IX_Tenants_BusinessName");
        AuthController.IsUniqueEmailViolation(new DbUpdateException("error", pgExOther)).Should().BeFalse();

        // 5. Matches message with IX_Users_NormalizedEmail
        var genericDbEx = new DbUpdateException("Violation of unique constraint IX_Users_NormalizedEmail");
        AuthController.IsUniqueEmailViolation(genericDbEx).Should().BeTrue();

        // 6. Returns false for non-unique or unrelated exception
        var unrelatedDbEx = new DbUpdateException("Connection timed out");
        AuthController.IsUniqueEmailViolation(unrelatedDbEx).Should().BeFalse();
    }

    [Fact]
    public async Task Register_ExistingTenantWithExistingOwner_RejectsJoinWithConflict()
    {
        var (context, _) = CreateInMemoryContext();
        var controller = CreateController(context);

        var existingTenantId = Guid.NewGuid();
        var legitimateUserId = Guid.NewGuid();

        // 1. Legitimate owner registers
        var first = await controller.Register(new AuthController.RegisterRequest
        {
            TenantId = existingTenantId,
            UserId = legitimateUserId,
            Email = "real.owner@tindahan.ph",
            Password = "StrongPassword123!",
            BusinessName = "Original Store"
        }, CancellationToken.None);
        first.Result.Should().BeOfType<OkObjectResult>();

        // 2. Attacker supplies same TenantId with same or different UserId
        var attacker = await controller.Register(new AuthController.RegisterRequest
        {
            TenantId = existingTenantId,
            UserId = legitimateUserId,
            Email = "attacker.join@tindahan.ph",
            Password = "AttackerPassword123!",
            BusinessName = "Hijack Store"
        }, CancellationToken.None);

        attacker.Result.Should().BeOfType<ConflictObjectResult>();
        var conflict = (ConflictObjectResult)attacker.Result!;
        conflict.StatusCode.Should().Be(StatusCodes.Status409Conflict);
    }

    [Fact]
    public async Task UpdatePin_WithoutAuth_Returns401Unauthorized()
    {
        var (context, _) = CreateInMemoryContext();
        // Create an unauthenticated controller (no User in HttpContext and null currentUserService)
        var controller = CreateController(context, currentUserService: null);
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext() // Unauthenticated, no User claims
        };

        var request = new AuthController.UpdatePinRequest
        {
            Password = "Password123!",
            Pin = "4321"
        };

        var result = await controller.UpdatePin(request, CancellationToken.None);

        result.Should().BeOfType<UnauthorizedObjectResult>();
        var unauthorized = (UnauthorizedObjectResult)result;
        unauthorized.StatusCode.Should().Be(StatusCodes.Status401Unauthorized);
    }

    [Fact]
    public async Task UpdatePin_WithInvalidModelStateOrEmptyPassword_Returns400BadRequest()
    {
        var (context, _) = CreateInMemoryContext();
        var controller = CreateController(context);
        SetAuthenticatedUser(controller, Guid.NewGuid(), Guid.NewGuid());

        var request = new AuthController.UpdatePinRequest
        {
            Password = "", // Empty password
            Pin = "1234"
        };
        controller.ModelState.AddModelError("Password", "Password is required");

        var result = await controller.UpdatePin(request, CancellationToken.None);

        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task UpdatePin_WithAuthenticatedSession_UpdatesPinSuccessfully()
    {
        var (context, _) = CreateInMemoryContext();
        var controller = CreateController(context);

        // 1. Register user
        var regResult = await controller.Register(new AuthController.RegisterRequest
        {
            Email = "pin.update@tindahan.ph",
            Password = "Password123!",
            Pin = "1111",
            BusinessName = "Pin Update Store"
        }, CancellationToken.None);
        var regDto = ((OkObjectResult)regResult.Result!).Value.Should().BeOfType<AuthController.AuthResponseDto>().Subject;

        // 2. Set authenticated context for this user
        SetAuthenticatedUser(controller, regDto.UserId, regDto.TenantId, regDto.Email);

        // 3. Call UpdatePin with correct password and new PIN
        var updateResult = await controller.UpdatePin(new AuthController.UpdatePinRequest
        {
            Password = "Password123!",
            Pin = "9876"
        }, CancellationToken.None);

        updateResult.Should().BeOfType<OkObjectResult>();

        // 4. Verify in database that PIN was updated and old PIN fails
        var user = await context.Users.IgnoreQueryFilters().FirstAsync(u => u.Id == regDto.UserId);
        var hasher = new PasswordHasher<User>();
        hasher.VerifyHashedPassword(user, user.PinHash!, "9876").Should().Be(PasswordVerificationResult.Success);
        hasher.VerifyHashedPassword(user, user.PinHash!, "1111").Should().Be(PasswordVerificationResult.Failed);
    }

    [Fact]
    public async Task UpdatePin_WithWrongPassword_Returns401Unauthorized()
    {
        var (context, _) = CreateInMemoryContext();
        var controller = CreateController(context);

        var regResult = await controller.Register(new AuthController.RegisterRequest
        {
            Email = "wrongpwd.pin@tindahan.ph",
            Password = "CorrectPassword123!",
            BusinessName = "Wrong Password Store"
        }, CancellationToken.None);
        var regDto = ((OkObjectResult)regResult.Result!).Value.Should().BeOfType<AuthController.AuthResponseDto>().Subject;

        SetAuthenticatedUser(controller, regDto.UserId, regDto.TenantId, regDto.Email);

        var updateResult = await controller.UpdatePin(new AuthController.UpdatePinRequest
        {
            Password = "WrongPassword!",
            Pin = "1234"
        }, CancellationToken.None);

        updateResult.Should().BeOfType<UnauthorizedObjectResult>();
    }

    [Fact]
    public async Task LoginPin_NullOrEmptyPin_Returns400BadRequest()
    {
        var (context, _) = CreateInMemoryContext();
        var controller = CreateController(context);

        controller.ModelState.AddModelError("Pin", "PIN is required");
        var request = new AuthController.LoginPinRequest
        {
            Email = "user@tindahan.ph",
            Pin = ""
        };

        var result = await controller.LoginPin(request, CancellationToken.None);

        result.Result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task Login_NullOrEmptyPassword_Returns400BadRequest()
    {
        var (context, _) = CreateInMemoryContext();
        var controller = CreateController(context);

        controller.ModelState.AddModelError("Password", "Password is required");
        var request = new AuthController.LoginRequest
        {
            Email = "user@tindahan.ph",
            Password = ""
        };

        var result = await controller.Login(request, CancellationToken.None);

        result.Result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task LoginPin_ConcurrentPinAttempts_LocksOutAccountWithoutBypass()
    {
        AuthController.ResetAllIpPinThrottles();
        var dbName = Guid.NewGuid().ToString();
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(databaseName: dbName)
            .Options;

        var userMock = new Mock<ICurrentUserService>();
        userMock.Setup(u => u.TenantId).Returns(Guid.NewGuid());
        userMock.Setup(u => u.UserId).Returns(Guid.NewGuid());

        Guid userId;
        using (var setupContext = new AppDbContext(options, userMock.Object))
        {
            var setupController = CreateController(setupContext);
            var regResult = await setupController.Register(new AuthController.RegisterRequest
            {
                Email = "concurrent.pin.attempts@tindahan.ph",
                Password = "Password123!",
                Pin = "1234",
                BusinessName = "Concurrent PIN Store"
            }, CancellationToken.None);
            var regDto = ((OkObjectResult)regResult.Result!).Value.Should().BeOfType<AuthController.AuthResponseDto>().Subject;
            userId = regDto.UserId;
        }

        // Launch 15 concurrent requests with wrong PINs from distinct IP addresses to test account lockout concurrency
        const int concurrentAttempts = 15;
        var tasks = Enumerable.Range(0, concurrentAttempts).Select(async i =>
        {
            using var requestContext = new AppDbContext(options, userMock.Object);
            var controller = CreateController(requestContext);
            var httpContext = new DefaultHttpContext();
            httpContext.Connection.RemoteIpAddress = System.Net.IPAddress.Parse($"10.0.1.{20 + i}");
            controller.ControllerContext = new ControllerContext { HttpContext = httpContext };

            return await controller.LoginPin(new AuthController.LoginPinRequest
            {
                Email = "concurrent.pin.attempts@tindahan.ph",
                Pin = $"88{i:D2}" // Wrong PIN
            }, CancellationToken.None);
        }).ToArray();

        var results = await Task.WhenAll(tasks);

        var unauthorizedCount = results.Count(r => r.Result is UnauthorizedObjectResult);
        var lockedCount = results.Count(r => r.Result is ObjectResult obj && obj.StatusCode == StatusCodes.Status429TooManyRequests);

        // Exactly 4 attempts return 401, the 5th attempt locks the account and returns 429, and subsequent 10 attempts are blocked by 429
        unauthorizedCount.Should().Be(4);
        lockedCount.Should().Be(11);

        // Verify database state: FailedPinAttempts is exactly 5 and lockout timestamp is active
        using (var verifyContext = new AppDbContext(options, userMock.Object))
        {
            var user = await verifyContext.Users.IgnoreQueryFilters().FirstAsync(u => u.Id == userId);
            user.FailedPinAttempts.Should().Be(5);
            user.PinLockoutEnd.Should().NotBeNull();
            user.PinLockoutEnd!.Value.Should().BeAfter(DateTimeOffset.UtcNow);
        }

        AuthController.ResetAllIpPinThrottles();
    }

    [Fact]
    public async Task Login_WhenPasswordLockoutEndIsInPast_ResetsCounterToZeroBeforeCountingNewFailure()
    {
        var (context, _) = CreateInMemoryContext();
        var controller = CreateController(context);

        var regResult = await controller.Register(new AuthController.RegisterRequest
        {
            Email = "pastpasswordlock@tindahan.ph",
            Password = "RealPassword123!",
            BusinessName = "Past Lockout Store"
        }, CancellationToken.None);

        var user = await context.Users.IgnoreQueryFilters().FirstAsync(u => u.NormalizedEmail == "pastpasswordlock@tindahan.ph");
        user.FailedPasswordAttempts = 5;
        user.PasswordLockoutEnd = DateTimeOffset.UtcNow.AddMinutes(-10);
        await context.SaveChangesAsync(CancellationToken.None);

        // First attempt with wrong password after lockout expired
        var failResult = await controller.Login(new AuthController.LoginRequest
        {
            Email = "pastpasswordlock@tindahan.ph",
            Password = "WrongPassword123!"
        }, CancellationToken.None);

        failResult.Result.Should().BeOfType<UnauthorizedObjectResult>();
        var userAfter = await context.Users.IgnoreQueryFilters().FirstAsync(u => u.NormalizedEmail == "pastpasswordlock@tindahan.ph");
        userAfter.FailedPasswordAttempts.Should().Be(1);
        userAfter.PasswordLockoutEnd.Should().BeNull();
    }

    [Fact]
    public async Task LoginWithPin_WhenPinLockoutEndIsInPast_ResetsCounterToZeroBeforeCountingNewFailure()
    {
        var (context, _) = CreateInMemoryContext();
        var controller = CreateController(context);

        var regResult = await controller.Register(new AuthController.RegisterRequest
        {
            Email = "pastpinlock@tindahan.ph",
            Password = "RealPassword123!",
            BusinessName = "Past PIN Lockout Store"
        }, CancellationToken.None);

        var user = await context.Users.IgnoreQueryFilters().FirstAsync(u => u.NormalizedEmail == "pastpinlock@tindahan.ph");
        var hasher = new PasswordHasher<User>();
        user.PinHash = hasher.HashPassword(user, "1234");
        user.FailedPinAttempts = 5;
        user.PinLockoutEnd = DateTimeOffset.UtcNow.AddMinutes(-5);
        await context.SaveChangesAsync(CancellationToken.None);

        // First attempt with wrong PIN after lockout expired
        var failResult = await controller.LoginPin(new AuthController.LoginPinRequest
        {
            Email = "pastpinlock@tindahan.ph",
            Pin = "9999"
        }, CancellationToken.None);

        failResult.Result.Should().BeOfType<UnauthorizedObjectResult>();
        var userAfter = await context.Users.IgnoreQueryFilters().FirstAsync(u => u.NormalizedEmail == "pastpinlock@tindahan.ph");
        userAfter.FailedPinAttempts.Should().Be(1);
        userAfter.PinLockoutEnd.Should().BeNull();

        AuthController.ResetAllIpPinThrottles();
    }

    [Fact]
    public async Task UpdatePin_WhenPasswordLockoutEndIsInPast_ResetsCounterToZeroBeforeCountingNewFailure()
    {
        var (context, userMock) = CreateInMemoryContext();
        var controller = CreateController(context);

        var regResult = await controller.Register(new AuthController.RegisterRequest
        {
            Email = "pastupdatepinlock@tindahan.ph",
            Password = "RealPassword123!",
            BusinessName = "Past UpdatePin Lock Store"
        }, CancellationToken.None);

        var user = await context.Users.IgnoreQueryFilters().FirstAsync(u => u.NormalizedEmail == "pastupdatepinlock@tindahan.ph");
        user.FailedPasswordAttempts = 5;
        user.PasswordLockoutEnd = DateTimeOffset.UtcNow.AddMinutes(-10);
        await context.SaveChangesAsync(CancellationToken.None);

        SetAuthenticatedUser(controller, user.Id, user.TenantId, user.Email);

        // Attempt UpdatePin with wrong password after lockout expired
        var failResult = await controller.UpdatePin(new AuthController.UpdatePinRequest
        {
            Password = "WrongPassword123!",
            Pin = "5678"
        }, CancellationToken.None);

        failResult.Should().BeOfType<UnauthorizedObjectResult>();
        var userAfter = await context.Users.IgnoreQueryFilters().FirstAsync(u => u.NormalizedEmail == "pastupdatepinlock@tindahan.ph");
        userAfter.FailedPasswordAttempts.Should().Be(1);
        userAfter.PasswordLockoutEnd.Should().BeNull();
    }

    [Fact]
    public void JwtTokenService_InProduction_WhenSecretIsBurnedKey_ThrowsInvalidOperationException()
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Jwt:SecretKey"] = JwtTokenService.BurnedSecretKey
            })
            .Build();

        var prodEnv = new Mock<IHostEnvironment>();
        prodEnv.Setup(e => e.EnvironmentName).Returns(Environments.Production);

        var act = () => new JwtTokenService(config, prodEnv.Object);
        act.Should().Throw<InvalidOperationException>()
            .WithMessage("*burned*");
    }

    [Fact]
    public void JwtTokenService_InProduction_WhenSecretIsDefaultDevKey_ThrowsInvalidOperationException()
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["JWT_SECRET_KEY"] = JwtTokenService.DefaultDevSecretKey
            })
            .Build();

        var prodEnv = new Mock<IHostEnvironment>();
        prodEnv.Setup(e => e.EnvironmentName).Returns(Environments.Production);

        var act = () => new JwtTokenService(config, prodEnv.Object);
        act.Should().Throw<InvalidOperationException>()
            .WithMessage("*burned*");
    }

    [Fact]
    public void JwtTokenService_InProduction_WhenSecretMissingOrShort_ThrowsInvalidOperationException()
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>())
            .Build();

        var prodEnv = new Mock<IHostEnvironment>();
        prodEnv.Setup(e => e.EnvironmentName).Returns(Environments.Production);

        var act = () => new JwtTokenService(config, prodEnv.Object);
        act.Should().Throw<InvalidOperationException>()
            .WithMessage("*32 characters*");
    }

    [Fact]
    public void JwtTokenService_InProduction_WhenSecretIsUniqueAndValid_InitializesSuccessfully()
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["JWT_SECRET_KEY"] = "Production_UniqueRandomSecretKey_LongerThan32Chars!"
            })
            .Build();

        var prodEnv = new Mock<IHostEnvironment>();
        prodEnv.Setup(e => e.EnvironmentName).Returns(Environments.Production);

        var service = new JwtTokenService(config, prodEnv.Object);
        var (token, _) = service.GenerateAccessToken(Guid.NewGuid(), Guid.NewGuid());
        token.Should().NotBeNullOrWhiteSpace();
    }

    [Fact]
    public void JwtTokenService_InDevelopment_WhenSecretMissing_UsesDefaultDevKey()
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>())
            .Build();

        var devEnv = new Mock<IHostEnvironment>();
        devEnv.Setup(e => e.EnvironmentName).Returns(Environments.Development);

        var service = new JwtTokenService(config, devEnv.Object);
        var (token, _) = service.GenerateAccessToken(Guid.NewGuid(), Guid.NewGuid());
        token.Should().NotBeNullOrWhiteSpace();
    }

    [Fact]
    public async Task Register_And_Login_PreservesAndReturnsOwnerName()
    {
        var (context, _) = CreateInMemoryContext();
        var controller = CreateController(context);

        var regResult = await controller.Register(new AuthController.RegisterRequest
        {
            Email = "maria@sarisari.ph",
            Password = "Password123!",
            BusinessName = "Maria Tindahan",
            OwnerName = "Maria Santos",
            Phone = "09171234567",
            Pin = "1234"
        }, CancellationToken.None);

        var regOk = regResult.Result.Should().BeOfType<OkObjectResult>().Subject;
        var regDto = regOk.Value.Should().BeOfType<AuthController.AuthResponseDto>().Subject;
        regDto.OwnerName.Should().Be("Maria Santos");

        var dbUser = await context.Users.IgnoreQueryFilters().FirstAsync(u => u.Email == "maria@sarisari.ph");
        dbUser.OwnerName.Should().Be("Maria Santos");

        // Login with password should return OwnerName
        var loginResult = await controller.Login(new AuthController.LoginRequest
        {
            Email = "maria@sarisari.ph",
            Password = "Password123!"
        }, CancellationToken.None);

        var loginOk = loginResult.Result.Should().BeOfType<OkObjectResult>().Subject;
        var loginDto = loginOk.Value.Should().BeOfType<AuthController.AuthResponseDto>().Subject;
        loginDto.OwnerName.Should().Be("Maria Santos");

        // Login with PIN should return OwnerName
        var pinResult = await controller.LoginPin(new AuthController.LoginPinRequest
        {
            Email = "maria@sarisari.ph",
            Pin = "1234"
        }, CancellationToken.None);

        var pinOk = pinResult.Result.Should().BeOfType<OkObjectResult>().Subject;
        var pinDto = pinOk.Value.Should().BeOfType<AuthController.AuthResponseDto>().Subject;
        pinDto.OwnerName.Should().Be("Maria Santos");
    }

    private static async Task<(AuthController controller, Guid userId, Guid tenantId)> SetupAuthenticatedTestStoreAsync(
        AppDbContext context,
        string email = "owner@tindahan.ph",
        string role = "Owner",
        string businessName = "Initial Store Name",
        string? ownerName = "Initial Owner",
        string? phone = "09181112233",
        string password = "Password123!",
        string? pin = null)
    {
        var registrationController = CreateController(context);
        var regResult = await registrationController.Register(new AuthController.RegisterRequest
        {
            Email = email,
            Password = password,
            BusinessName = businessName,
            OwnerName = ownerName,
            Phone = phone,
            Pin = pin
        }, CancellationToken.None);

        var regDto = ((OkObjectResult)regResult.Result!).Value.Should().BeOfType<AuthController.AuthResponseDto>().Subject;
        var userId = regDto.UserId;
        var tenantId = regDto.TenantId;

        if (role != "Owner")
        {
            var user = await context.Users.IgnoreQueryFilters().FirstAsync(u => u.Id == userId);
            user.Role = role;
            await context.SaveChangesAsync();
        }

        var mockCurrentUserService = new Mock<ICurrentUserService>();
        mockCurrentUserService.Setup(s => s.UserId).Returns(userId);
        mockCurrentUserService.Setup(s => s.TenantId).Returns(tenantId);
        mockCurrentUserService.Setup(s => s.IsAuthenticated).Returns(true);

        var authController = CreateController(context, currentUserService: mockCurrentUserService.Object);
        SetAuthenticatedUser(authController, userId, tenantId, email: email, role: role);

        return (authController, userId, tenantId);
    }

    [Fact]
    public async Task UpdateProfile_WhenAuthenticated_UpdatesDatabaseAndReturnsUpdatedDto()
    {
        var (context, _) = CreateInMemoryContext();
        var (authController, userId, tenantId) = await SetupAuthenticatedTestStoreAsync(
            context,
            email: "owner@tindahan.ph",
            businessName: "Initial Store Name",
            ownerName: "Initial Owner",
            phone: "09181112233");

        var updateResult = await authController.UpdateProfile(new AuthController.UpdateProfileRequest
        {
            BusinessName = "Updated Tindahan Store",
            OwnerName = "Updated Owner",
            Phone = "09171234567",
            Email = "updated-owner@example.ph",
            CurrentPassword = "Password123!"
        }, CancellationToken.None);

        var ok = updateResult.Result.Should().BeOfType<OkObjectResult>().Subject;
        var dto = ok.Value.Should().BeOfType<AuthController.AuthResponseDto>().Subject;

        dto.BusinessName.Should().Be("Updated Tindahan Store");
        dto.OwnerName.Should().Be("Updated Owner");
        dto.Phone.Should().Be("09171234567");
        dto.Email.Should().Be("updated-owner@example.ph");

        // Verify database persistence across logout/re-login
        var dbTenant = await context.Tenants.IgnoreQueryFilters().FirstAsync(t => t.Id == tenantId);
        dbTenant.BusinessName.Should().Be("Updated Tindahan Store");

        var dbUser = await context.Users.IgnoreQueryFilters().FirstAsync(u => u.Id == userId);
        dbUser.OwnerName.Should().Be("Updated Owner");
        dbUser.Phone.Should().Be("09171234567");
        dbUser.Email.Should().Be("updated-owner@example.ph");
        dbUser.NormalizedEmail.Should().Be("updated-owner@example.ph");

        // Re-login after "logout" retrieves the updated persisted data
        var controller = CreateController(context);
        var reloginResult = await controller.Login(new AuthController.LoginRequest
        {
            Email = "updated-owner@example.ph",
            Password = "Password123!"
        }, CancellationToken.None);

        var reloginDto = ((OkObjectResult)reloginResult.Result!).Value.Should().BeOfType<AuthController.AuthResponseDto>().Subject;
        reloginDto.BusinessName.Should().Be("Updated Tindahan Store");
        reloginDto.OwnerName.Should().Be("Updated Owner");
        reloginDto.Phone.Should().Be("09171234567");
        reloginDto.Email.Should().Be("updated-owner@example.ph");
    }

    [Fact]
    public async Task UpdateProfile_WhenEmailTakenByAnotherUser_ReturnsConflict()
    {
        var (context, _) = CreateInMemoryContext();
        var controller = CreateController(context);

        // Register store 1
        await controller.Register(new AuthController.RegisterRequest
        {
            Email = "store1@example.ph",
            Password = "Password123!",
            BusinessName = "Store One"
        }, CancellationToken.None);

        // Register store 2
        var (authController, _, _) = await SetupAuthenticatedTestStoreAsync(
            context,
            email: "store2@example.ph",
            businessName: "Store Two");

        // Store 2 tries to update its email to store 1's email
        var conflictResult = await authController.UpdateProfile(new AuthController.UpdateProfileRequest
        {
            BusinessName = "Store Two Updated",
            Email = "store1@example.ph",
            CurrentPassword = "Password123!"
        }, CancellationToken.None);

        conflictResult.Result.Should().BeOfType<ConflictObjectResult>();
    }

    [Fact]
    public async Task UpdateProfile_WhenStoreNameTooShort_ReturnsBadRequest()
    {
        var (context, _) = CreateInMemoryContext();
        var (authController, _, _) = await SetupAuthenticatedTestStoreAsync(context, email: "short@example.ph", businessName: "Valid Store");

        var badResult = await authController.UpdateProfile(new AuthController.UpdateProfileRequest
        {
            BusinessName = "A" // too short (< 2)
        }, CancellationToken.None);

        badResult.Result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task UpdateProfile_WhenChangingBusinessName_AsNonOwner_ReturnsForbidden()
    {
        var (context, _) = CreateInMemoryContext();
        var (authController, _, tenantId) = await SetupAuthenticatedTestStoreAsync(
            context,
            email: "staffuser@tindahan.ph",
            role: "Staff",
            businessName: "Original Store Name");

        var result = await authController.UpdateProfile(new AuthController.UpdateProfileRequest
        {
            BusinessName = "Staff Changed Name",
            OwnerName = "Staff Member"
        }, CancellationToken.None);

        var objResult = result.Result.Should().BeOfType<ObjectResult>().Subject;
        objResult.StatusCode.Should().Be(StatusCodes.Status403Forbidden);

        // Verify DB was NOT updated
        var tenant = await context.Tenants.IgnoreQueryFilters().FirstAsync(t => t.Id == tenantId);
        tenant.BusinessName.Should().Be("Original Store Name");
    }

    [Fact]
    public async Task UpdateProfile_WhenKeepingSameBusinessName_AsNonOwner_Succeeds()
    {
        var (context, _) = CreateInMemoryContext();
        var (authController, _, _) = await SetupAuthenticatedTestStoreAsync(
            context,
            email: "staffmember@tindahan.ph",
            role: "Staff",
            businessName: "Keep My Store Name",
            ownerName: "Old Staff Name");

        var result = await authController.UpdateProfile(new AuthController.UpdateProfileRequest
        {
            BusinessName = "Keep My Store Name",
            OwnerName = "New Staff Name",
            Phone = "09998887766"
        }, CancellationToken.None);

        var ok = result.Result.Should().BeOfType<OkObjectResult>().Subject;
        var dto = ok.Value.Should().BeOfType<AuthController.AuthResponseDto>().Subject;
        dto.BusinessName.Should().Be("Keep My Store Name");
        dto.OwnerName.Should().Be("New Staff Name");
        dto.Phone.Should().Be("09998887766");
    }

    [Fact]
    public async Task UpdateProfile_WhenChangingEmail_WithoutPasswordOrPin_ReturnsBadRequest()
    {
        var (context, _) = CreateInMemoryContext();
        var (authController, _, _) = await SetupAuthenticatedTestStoreAsync(context, email: "oldemail@tindahan.ph", businessName: "My Store");

        var result = await authController.UpdateProfile(new AuthController.UpdateProfileRequest
        {
            BusinessName = "My Store",
            Email = "newemail@tindahan.ph"
            // No password or PIN
        }, CancellationToken.None);

        result.Result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task UpdateProfile_WhenChangingEmail_WithWrongPassword_ReturnsBadRequest()
    {
        var (context, _) = CreateInMemoryContext();
        var (authController, userId, _) = await SetupAuthenticatedTestStoreAsync(
            context,
            email: "oldpwd@tindahan.ph",
            password: "CorrectPassword123!",
            businessName: "My Store");

        var result = await authController.UpdateProfile(new AuthController.UpdateProfileRequest
        {
            BusinessName = "My Store",
            Email = "newpwd@tindahan.ph",
            CurrentPassword = "WrongPassword999!"
        }, CancellationToken.None);

        result.Result.Should().BeOfType<BadRequestObjectResult>();

        var dbUser = await context.Users.IgnoreQueryFilters().FirstAsync(u => u.Id == userId);
        dbUser.FailedPasswordAttempts.Should().Be(1);
    }

    [Fact]
    public async Task UpdateProfile_WhenChangingEmail_WithWrongPin_ReturnsBadRequest()
    {
        var (context, _) = CreateInMemoryContext();
        var (authController, userId, _) = await SetupAuthenticatedTestStoreAsync(
            context,
            email: "oldpin@tindahan.ph",
            pin: "1357",
            businessName: "Pin Store");

        var result = await authController.UpdateProfile(new AuthController.UpdateProfileRequest
        {
            BusinessName = "Pin Store",
            Email = "newpin@tindahan.ph",
            Pin = "9999"
        }, CancellationToken.None);

        result.Result.Should().BeOfType<BadRequestObjectResult>();

        var dbUser = await context.Users.IgnoreQueryFilters().FirstAsync(u => u.Id == userId);
        dbUser.FailedPinAttempts.Should().Be(1);
    }

    [Fact]
    public async Task UpdateProfile_WhenChangingEmail_WithCorrectPin_Succeeds()
    {
        var (context, _) = CreateInMemoryContext();
        var (authController, _, _) = await SetupAuthenticatedTestStoreAsync(
            context,
            email: "oldpin@tindahan.ph",
            pin: "1357",
            businessName: "Pin Store");

        var result = await authController.UpdateProfile(new AuthController.UpdateProfileRequest
        {
            BusinessName = "Pin Store",
            Email = "newpin@tindahan.ph",
            Pin = "1357"
        }, CancellationToken.None);

        var ok = result.Result.Should().BeOfType<OkObjectResult>().Subject;
        var dto = ok.Value.Should().BeOfType<AuthController.AuthResponseDto>().Subject;
        dto.Email.Should().Be("newpin@tindahan.ph");
    }

    [Fact]
    public async Task UpdateProfile_WhenChangingEmail_RevokesOtherRefreshTokensAndRetiresOldToken()
    {
        var (context, _) = CreateInMemoryContext();
        var (authController, userId, tenantId) = await SetupAuthenticatedTestStoreAsync(
            context,
            email: "multidevice@tindahan.ph",
            businessName: "Multi Device Store");

        var user = await context.Users.IgnoreQueryFilters().FirstAsync(u => u.Id == userId);

        // Device A (current)
        var (tokenA, _, tokenAHash, _) = AuthRefreshTokenHelper.IssueRefreshToken(
            context, DefaultJwtService, user, tenantId, TimeProvider.System, "family-device-a");

        // Device B (other)
        var (_, _, _, _) = AuthRefreshTokenHelper.IssueRefreshToken(
            context, DefaultJwtService, user, tenantId, TimeProvider.System, "family-device-b");

        await context.SaveChangesAsync();

        var updateResult = await authController.UpdateProfile(new AuthController.UpdateProfileRequest
        {
            BusinessName = "Multi Device Store",
            Email = "newmultidevice@tindahan.ph",
            CurrentPassword = "Password123!",
            RefreshToken = tokenA
        }, CancellationToken.None);

        var ok = updateResult.Result.Should().BeOfType<OkObjectResult>().Subject;
        var dto = ok.Value.Should().BeOfType<AuthController.AuthResponseDto>().Subject;
        dto.RefreshToken.Should().NotBeNullOrWhiteSpace();

        // Check tokens in DB
        var tokensInDb = await context.UserRefreshTokens.IgnoreQueryFilters().Where(t => t.UserId == user.Id).ToListAsync();
        var deviceBTokens = tokensInDb.Where(t => t.FamilyId == "family-device-b").ToList();
        deviceBTokens.Should().NotBeEmpty();
        deviceBTokens.Should().OnlyContain(t => t.IsRevoked);

        // Check presented token on Device A was retired (marked replaced and grace expires set) without forking
        var deviceATokens = tokensInDb.Where(t => t.FamilyId == "family-device-a").ToList();
        deviceATokens.Should().HaveCount(2);
        var oldTokenRecord = deviceATokens.First(t => t.TokenHash == tokenAHash);
        oldTokenRecord.ReplacedByTokenHash.Should().NotBeNullOrWhiteSpace();
        oldTokenRecord.GraceExpiresAt.Should().NotBeNull();
    }

    [Fact]
    public async Task UpdateProfile_WhenRefreshTokenMissingInDatabase_DoesNotIssueNewRefreshToken()
    {
        var (context, _) = CreateInMemoryContext();
        var (authController, userId, tenantId) = await SetupAuthenticatedTestStoreAsync(
            context,
            email: "missingtoken@tindahan.ph",
            businessName: "Missing Token Store");

        var user = await context.Users.IgnoreQueryFilters().FirstAsync(u => u.Id == userId);

        // Generate a valid JWT refresh token but DO NOT insert into UserRefreshTokens table
        var (orphanedToken, _, _, _) = DefaultJwtService.GenerateRefreshToken(
            user.Id, tenantId, tokenId: null, familyId: "orphaned-family");

        var updateResult = await authController.UpdateProfile(new AuthController.UpdateProfileRequest
        {
            BusinessName = "Updated Missing Token Store",
            RefreshToken = orphanedToken
        }, CancellationToken.None);

        var ok = updateResult.Result.Should().BeOfType<OkObjectResult>().Subject;
        var dto = ok.Value.Should().BeOfType<AuthController.AuthResponseDto>().Subject;
        dto.RefreshToken.Should().BeNull();
    }

    [Fact]
    public async Task UpdateProfile_WhenRefreshTokenIsRevoked_DoesNotIssueNewRefreshToken()
    {
        var (context, _) = CreateInMemoryContext();
        var (authController, userId, tenantId) = await SetupAuthenticatedTestStoreAsync(
            context,
            email: "revokedtoken@tindahan.ph",
            businessName: "Revoked Token Store");

        var user = await context.Users.IgnoreQueryFilters().FirstAsync(u => u.Id == userId);

        var (token, _, tokenHash, famId) = AuthRefreshTokenHelper.IssueRefreshToken(
            context, DefaultJwtService, user, tenantId, TimeProvider.System, "revoked-family");
        await context.SaveChangesAsync();
        var tokenRow = await context.UserRefreshTokens.IgnoreQueryFilters().FirstAsync(t => t.TokenHash == tokenHash);
        tokenRow.IsRevoked = true;
        tokenRow.RevokedAt = DateTimeOffset.UtcNow;
        await context.SaveChangesAsync();

        var updateResult = await authController.UpdateProfile(new AuthController.UpdateProfileRequest
        {
            BusinessName = "Updated Revoked Store",
            RefreshToken = token
        }, CancellationToken.None);

        var ok = updateResult.Result.Should().BeOfType<OkObjectResult>().Subject;
        var dto = ok.Value.Should().BeOfType<AuthController.AuthResponseDto>().Subject;
        dto.RefreshToken.Should().BeNull();
    }

    [Fact]
    public async Task UpdateProfile_WhenRefreshTokenIsAlreadyReplaced_DoesNotIssueNewRefreshToken()
    {
        var (context, _) = CreateInMemoryContext();
        var (authController, userId, tenantId) = await SetupAuthenticatedTestStoreAsync(
            context,
            email: "replacedtoken@tindahan.ph",
            businessName: "Replaced Token Store");

        var user = await context.Users.IgnoreQueryFilters().FirstAsync(u => u.Id == userId);

        var (token, _, tokenHash, famId) = AuthRefreshTokenHelper.IssueRefreshToken(
            context, DefaultJwtService, user, tenantId, TimeProvider.System, "replaced-family");
        await context.SaveChangesAsync();
        var tokenRow = await context.UserRefreshTokens.IgnoreQueryFilters().FirstAsync(t => t.TokenHash == tokenHash);
        tokenRow.ReplacedByTokenHash = "some-replacement-hash";
        tokenRow.GraceExpiresAt = DateTimeOffset.UtcNow.AddMinutes(-5); // expired grace
        await context.SaveChangesAsync();

        var updateResult = await authController.UpdateProfile(new AuthController.UpdateProfileRequest
        {
            BusinessName = "Updated Replaced Store",
            RefreshToken = token
        }, CancellationToken.None);

        var ok = updateResult.Result.Should().BeOfType<OkObjectResult>().Subject;
        var dto = ok.Value.Should().BeOfType<AuthController.AuthResponseDto>().Subject;
        dto.RefreshToken.Should().BeNull();
    }

    [Fact]
    public async Task UpdateProfile_WhenFieldsAreNull_KeepsExistingValuesUnchanged()
    {
        var (context, _) = CreateInMemoryContext();
        var (authController, userId, tenantId) = await SetupAuthenticatedTestStoreAsync(
            context,
            email: "nulltest@example.ph",
            businessName: "Original Store Name",
            ownerName: "Original Owner",
            phone: "09181112233");

        // Send all null fields
        var result = await authController.UpdateProfile(new AuthController.UpdateProfileRequest
        {
            BusinessName = null,
            OwnerName = null,
            Phone = null,
            Email = null
        }, CancellationToken.None);

        var ok = result.Result.Should().BeOfType<OkObjectResult>().Subject;
        var dto = ok.Value.Should().BeOfType<AuthController.AuthResponseDto>().Subject;

        // Existing values must remain completely unchanged
        dto.BusinessName.Should().Be("Original Store Name");
        dto.OwnerName.Should().Be("Original Owner");
        dto.Phone.Should().Be("09181112233");
        dto.Email.Should().Be("nulltest@example.ph");

        var dbTenant = await context.Tenants.IgnoreQueryFilters().FirstAsync(t => t.Id == tenantId);
        dbTenant.BusinessName.Should().Be("Original Store Name");

        var dbUser = await context.Users.IgnoreQueryFilters().FirstAsync(u => u.Id == userId);
        dbUser.OwnerName.Should().Be("Original Owner");
        dbUser.Phone.Should().Be("09181112233");
        dbUser.Email.Should().Be("nulltest@example.ph");
    }

    [Fact]
    public async Task UpdateProfile_WhenOwnerNameAndPhoneAreEmptyStrings_ClearsValues()
    {
        var (context, _) = CreateInMemoryContext();
        var (authController, userId, _) = await SetupAuthenticatedTestStoreAsync(
            context,
            email: "cleartest@example.ph",
            businessName: "Original Store Name",
            ownerName: "Original Owner",
            phone: "09181112233");

        // Explicit empty strings should clear OwnerName (to null) and Phone (to empty string)
        var result = await authController.UpdateProfile(new AuthController.UpdateProfileRequest
        {
            BusinessName = null,
            OwnerName = "",
            Phone = ""
        }, CancellationToken.None);

        var ok = result.Result.Should().BeOfType<OkObjectResult>().Subject;
        var dto = ok.Value.Should().BeOfType<AuthController.AuthResponseDto>().Subject;

        dto.BusinessName.Should().Be("Original Store Name");
        dto.OwnerName.Should().BeNull();
        dto.Phone.Should().BeEmpty();

        var dbUser = await context.Users.IgnoreQueryFilters().FirstAsync(u => u.Id == userId);
        dbUser.OwnerName.Should().BeNull();
        dbUser.Phone.Should().BeEmpty();
    }

    [Fact]
    public async Task UpdateProfile_WhenStaffSendsNullBusinessName_SucceedsWithoutForbidden()
    {
        var (context, _) = CreateInMemoryContext();
        var (authController, userId, tenantId) = await SetupAuthenticatedTestStoreAsync(
            context,
            email: "staffnull@example.ph",
            role: "Staff",
            businessName: "Store Under Owner",
            ownerName: "Owner Person",
            phone: "09110001111");

        // Staff does not send BusinessName (null), only updates their own name/phone
        var result = await authController.UpdateProfile(new AuthController.UpdateProfileRequest
        {
            BusinessName = null,
            OwnerName = "Staff Juan",
            Phone = "09995554433"
        }, CancellationToken.None);

        var ok = result.Result.Should().BeOfType<OkObjectResult>().Subject;
        var dto = ok.Value.Should().BeOfType<AuthController.AuthResponseDto>().Subject;

        dto.BusinessName.Should().Be("Store Under Owner");
        dto.OwnerName.Should().Be("Staff Juan");
        dto.Phone.Should().Be("09995554433");

        var dbTenant = await context.Tenants.IgnoreQueryFilters().FirstAsync(t => t.Id == tenantId);
        dbTenant.BusinessName.Should().Be("Store Under Owner");

        var dbUser = await context.Users.IgnoreQueryFilters().FirstAsync(u => u.Id == userId);
        dbUser.OwnerName.Should().Be("Staff Juan");
        dbUser.Phone.Should().Be("09995554433");
    }

    [Fact]
    public async Task UpdateProfile_WhenExplicitEmptyBusinessNameOrEmail_ReturnsBadRequest()
    {
        var (context, _) = CreateInMemoryContext();
        var (authController, _, _) = await SetupAuthenticatedTestStoreAsync(context, email: "emptytest@example.ph", businessName: "Original Store");

        // Empty BusinessName
        var badBusinessNameResult = await authController.UpdateProfile(new AuthController.UpdateProfileRequest
        {
            BusinessName = ""
        }, CancellationToken.None);
        badBusinessNameResult.Result.Should().BeOfType<BadRequestObjectResult>();

        // Whitespace BusinessName
        var whitespaceBusinessNameResult = await authController.UpdateProfile(new AuthController.UpdateProfileRequest
        {
            BusinessName = "   "
        }, CancellationToken.None);
        whitespaceBusinessNameResult.Result.Should().BeOfType<BadRequestObjectResult>();

        // Empty Email
        var badEmailResult = await authController.UpdateProfile(new AuthController.UpdateProfileRequest
        {
            BusinessName = "Valid Name",
            Email = ""
        }, CancellationToken.None);
        badEmailResult.Result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task GoogleAuth_MissingToken_ReturnsBadRequest()
    {
        var (context, _) = CreateInMemoryContext();
        var controller = CreateController(context);

        var result = await controller.GoogleAuth(new AuthController.GoogleAuthRequest(), CancellationToken.None);

        result.Result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task GoogleAuth_InvalidOrUnverifiedToken_ReturnsUnauthorized()
    {
        var (context, _) = CreateInMemoryContext();
        var googleServiceMock = new Mock<IGoogleAuthService>();
        googleServiceMock
            .Setup(g => g.VerifyGoogleTokenAsync("invalid-token", null, It.IsAny<CancellationToken>()))
            .ReturnsAsync((GoogleUserInfo?)null);

        var controller = CreateController(context, googleAuthService: googleServiceMock.Object);

        var result = await controller.GoogleAuth(new AuthController.GoogleAuthRequest
        {
            AccessToken = "invalid-token"
        }, CancellationToken.None);

        result.Result.Should().BeOfType<UnauthorizedObjectResult>();
    }

    [Fact]
    public async Task GoogleAuth_NewUser_ProvisionsTenantAndUserWithClientUuids()
    {
        var (context, _) = CreateInMemoryContext();
        var clientTenantId = Guid.NewGuid();
        var clientUserId = Guid.NewGuid();

        var googleServiceMock = new Mock<IGoogleAuthService>();
        googleServiceMock
            .Setup(g => g.VerifyGoogleTokenAsync("valid-token", null, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new GoogleUserInfo("11223344", "maria.santos@gmail.com", true, "Maria Santos", "Maria"));

        var controller = CreateController(context, googleAuthService: googleServiceMock.Object);

        var result = await controller.GoogleAuth(new AuthController.GoogleAuthRequest
        {
            AccessToken = "valid-token",
            TenantId = clientTenantId,
            UserId = clientUserId,
            BusinessName = "Maria's Sari-Sari Store",
            Pin = "1234"
        }, CancellationToken.None);

        var okResult = result.Result.Should().BeOfType<OkObjectResult>().Subject;
        var dto = okResult.Value.Should().BeOfType<AuthController.AuthResponseDto>().Subject;

        dto.TenantId.Should().Be(clientTenantId);
        dto.UserId.Should().Be(clientUserId);
        dto.Email.Should().Be("maria.santos@gmail.com");
        dto.BusinessName.Should().Be("Maria's Sari-Sari Store");
        dto.OwnerName.Should().Be("Maria Santos");
        dto.HasPin.Should().BeTrue();
        dto.IsNewUser.Should().BeTrue();
        dto.Token.Should().NotBeNullOrWhiteSpace();

        var savedUser = await context.Users.IgnoreQueryFilters().FirstAsync(u => u.Id == clientUserId);
        savedUser.FirebaseUid.Should().Be("google:11223344");
        savedUser.PasswordHash.Should().BeEmpty();
    }

    [Fact]
    public async Task GoogleAuth_NewUserWithoutBusinessName_DefaultsToOwnerNameTindahan()
    {
        var (context, _) = CreateInMemoryContext();
        var googleServiceMock = new Mock<IGoogleAuthService>();
        googleServiceMock
            .Setup(g => g.VerifyGoogleTokenAsync("valid-token", null, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new GoogleUserInfo("55667788", "juan.delacruz@gmail.com", true, "Juan Dela Cruz", "Juan"));

        var controller = CreateController(context, googleAuthService: googleServiceMock.Object);

        var result = await controller.GoogleAuth(new AuthController.GoogleAuthRequest
        {
            AccessToken = "valid-token"
        }, CancellationToken.None);

        var okResult = result.Result.Should().BeOfType<OkObjectResult>().Subject;
        var dto = okResult.Value.Should().BeOfType<AuthController.AuthResponseDto>().Subject;

        dto.BusinessName.Should().Be("Juan's Tindahan");
        dto.IsNewUser.Should().BeTrue();
    }

    [Fact]
    public async Task GoogleAuth_ExistingPasswordUser_LinksFirebaseUidAndLogsIn()
    {
        var (context, _) = CreateInMemoryContext();
        var existingTenantId = Guid.NewGuid();
        var existingUserId = Guid.NewGuid();

        var tenant = new Tenant
        {
            Id = existingTenantId,
            BusinessName = "Pre-existing Negosyo",
            Tier = PlanTier.Libre,
            CreatedAt = DateTimeOffset.UtcNow
        };
        var hasher = new PasswordHasher<User>();
        var user = new User
        {
            Id = existingUserId,
            TenantId = existingTenantId,
            Email = "suki@gmail.com",
            NormalizedEmail = "suki@gmail.com",
            EmailVerified = true,
            FirebaseUid = string.Empty,
            Role = "Owner",
            CreatedAt = DateTimeOffset.UtcNow
        };
        user.PasswordHash = hasher.HashPassword(user, "Password123!");
        context.Tenants.Add(tenant);
        context.Users.Add(user);
        await context.SaveChangesAsync();

        var googleServiceMock = new Mock<IGoogleAuthService>();
        googleServiceMock
            .Setup(g => g.VerifyGoogleTokenAsync("valid-token", null, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new GoogleUserInfo("99887766", "suki@gmail.com", true, "Suki Owner", "Suki"));

        var controller = CreateController(context, googleAuthService: googleServiceMock.Object);

        var result = await controller.GoogleAuth(new AuthController.GoogleAuthRequest
        {
            AccessToken = "valid-token"
        }, CancellationToken.None);

        var okResult = result.Result.Should().BeOfType<OkObjectResult>().Subject;
        var dto = okResult.Value.Should().BeOfType<AuthController.AuthResponseDto>().Subject;

        dto.TenantId.Should().Be(existingTenantId);
        dto.UserId.Should().Be(existingUserId);
        dto.IsNewUser.Should().BeFalse();

        var updatedUser = await context.Users.IgnoreQueryFilters().FirstAsync(u => u.Id == existingUserId);
        updatedUser.FirebaseUid.Should().Be("google:99887766");
        updatedUser.PasswordHash.Should().NotBeEmpty();
    }

    [Fact]
    public async Task GoogleAuth_ExistingGoogleUser_LogsInAndIssuesTokens()
    {
        var (context, _) = CreateInMemoryContext();
        var existingTenantId = Guid.NewGuid();
        var existingUserId = Guid.NewGuid();

        var tenant = new Tenant
        {
            Id = existingTenantId,
            BusinessName = "Aling Nena's Tindahan",
            Tier = PlanTier.TindahanPro,
            CreatedAt = DateTimeOffset.UtcNow
        };
        var user = new User
        {
            Id = existingUserId,
            TenantId = existingTenantId,
            Email = "nena@gmail.com",
            NormalizedEmail = "nena@gmail.com",
            FirebaseUid = "google:sub-nena-123",
            PasswordHash = string.Empty,
            Role = "Owner",
            CreatedAt = DateTimeOffset.UtcNow
        };
        context.Tenants.Add(tenant);
        context.Users.Add(user);
        await context.SaveChangesAsync();

        var googleServiceMock = new Mock<IGoogleAuthService>();
        googleServiceMock
            .Setup(g => g.VerifyGoogleTokenAsync("valid-token", null, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new GoogleUserInfo("sub-nena-123", "nena@gmail.com", true, "Aling Nena", "Nena"));

        var controller = CreateController(context, googleAuthService: googleServiceMock.Object);

        var result = await controller.GoogleAuth(new AuthController.GoogleAuthRequest
        {
            AccessToken = "valid-token"
        }, CancellationToken.None);

        var okResult = result.Result.Should().BeOfType<OkObjectResult>().Subject;
        var dto = okResult.Value.Should().BeOfType<AuthController.AuthResponseDto>().Subject;

        dto.TenantId.Should().Be(existingTenantId);
        dto.UserId.Should().Be(existingUserId);
        dto.PlanTier.Should().Be("TindahanPro");
        dto.IsNewUser.Should().BeFalse();
        dto.Token.Should().NotBeNullOrWhiteSpace();
    }

    [Fact]
    public async Task GoogleAuth_LegacyUserLinking_UpdatesFirebaseUidAndBackfillsEmail()
    {
        var (context, _) = CreateInMemoryContext();
        var tenantId = Guid.NewGuid();
        var userId = Guid.NewGuid();

        var tenant = new Tenant
        {
            Id = tenantId,
            BusinessName = "Legacy Tindahan",
            Tier = PlanTier.Libre,
            CreatedAt = DateTimeOffset.UtcNow
        };
        var user = new User
        {
            Id = userId,
            TenantId = tenantId,
            Email = "",
            NormalizedEmail = "legacy@gmail.com",
            FirebaseUid = "demo-firebase-uid",
            OwnerName = "Old Owner Name",
            Role = "Owner",
            CreatedAt = DateTimeOffset.UtcNow
        };
        context.Tenants.Add(tenant);
        context.Users.Add(user);
        await context.SaveChangesAsync();

        var googleServiceMock = new Mock<IGoogleAuthService>();
        googleServiceMock
            .Setup(g => g.VerifyGoogleTokenAsync("valid-token", null, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new GoogleUserInfo("google-sub-777", "legacy@gmail.com", true, "New Google Name", "New"));

        var controller = CreateController(context, googleAuthService: googleServiceMock.Object);

        var result = await controller.GoogleAuth(new AuthController.GoogleAuthRequest
        {
            AccessToken = "valid-token"
        }, CancellationToken.None);

        var okResult = result.Result.Should().BeOfType<OkObjectResult>().Subject;
        var dto = okResult.Value.Should().BeOfType<AuthController.AuthResponseDto>().Subject;

        dto.IsNewUser.Should().BeFalse();
        dto.UserId.Should().Be(userId);
        dto.TenantId.Should().Be(tenantId);
        dto.OwnerName.Should().Be("Old Owner Name");

        var updatedUser = await context.Users.IgnoreQueryFilters().FirstAsync(u => u.Id == userId);
        updatedUser.FirebaseUid.Should().Be("google:google-sub-777");
        updatedUser.Email.Should().Be("legacy@gmail.com");
        updatedUser.NormalizedEmail.Should().Be("legacy@gmail.com");
    }

    [Fact]
    public async Task GoogleAuth_LegacyUserWithoutTenant_ProvisionsMissingTenantAndSucceeds()
    {
        var (context, userMock) = CreateInMemoryContext();
        var tempTenantId = Guid.NewGuid();
        userMock.Setup(u => u.TenantId).Returns(tempTenantId);
        var userId = Guid.NewGuid();

        var user = new User
        {
            Id = userId,
            TenantId = tempTenantId,
            Email = "notenant@gmail.com",
            NormalizedEmail = "notenant@gmail.com",
            FirebaseUid = "demo-firebase-uid",
            Role = "Owner",
            CreatedAt = DateTimeOffset.UtcNow
        };
        context.Users.Add(user);
        await context.SaveChangesAsync();

        // Mutate legacy user to have Guid.Empty TenantId (legacy unlinked state)
        user.TenantId = Guid.Empty;
        await context.SaveChangesAsync();

        // Anonymous unauthenticated caller
        userMock.Setup(u => u.TenantId).Returns(Guid.Empty);

        var googleServiceMock = new Mock<IGoogleAuthService>();
        googleServiceMock
            .Setup(g => g.VerifyGoogleTokenAsync("valid-token", null, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new GoogleUserInfo("google-sub-888", "notenant@gmail.com", true, "Recovered Owner", "Recovered"));

        var controller = CreateController(context, googleAuthService: googleServiceMock.Object);

        var result = await controller.GoogleAuth(new AuthController.GoogleAuthRequest
        {
            AccessToken = "valid-token"
        }, CancellationToken.None);

        var okResult = result.Result.Should().BeOfType<OkObjectResult>().Subject;
        var dto = okResult.Value.Should().BeOfType<AuthController.AuthResponseDto>().Subject;

        dto.IsNewUser.Should().BeFalse();
        dto.UserId.Should().Be(userId);
        dto.TenantId.Should().NotBe(Guid.Empty);

        var updatedUser = await context.Users.IgnoreQueryFilters().Include(u => u.Tenant).FirstAsync(u => u.Id == userId);
        updatedUser.TenantId.Should().NotBe(Guid.Empty);
        updatedUser.Tenant.Should().NotBeNull();
        updatedUser.Tenant!.Id.Should().Be(updatedUser.TenantId);
        updatedUser.FirebaseUid.Should().Be("google:google-sub-888");

        var tokenRecord = await context.UserRefreshTokens.IgnoreQueryFilters().FirstOrDefaultAsync(t => t.UserId == userId);
        tokenRecord.Should().NotBeNull();
        tokenRecord!.TenantId.Should().Be(updatedUser.TenantId);
    }

    [Fact]
    public async Task GoogleAuth_LegacyUserOrphanedTenant_ProvisionsTenantWithExistingTenantId()
    {
        var (context, userMock) = CreateInMemoryContext();
        userMock.Setup(u => u.TenantId).Returns(Guid.Empty);
        var orphanedTenantId = Guid.NewGuid();
        var userId = Guid.NewGuid();

        var user = new User
        {
            Id = userId,
            TenantId = orphanedTenantId,
            Email = "orphaned@gmail.com",
            NormalizedEmail = "orphaned@gmail.com",
            FirebaseUid = "google:orphaned-sub",
            Role = "Owner",
            CreatedAt = DateTimeOffset.UtcNow
        };
        context.Users.Add(user);
        await context.SaveChangesAsync();

        var googleServiceMock = new Mock<IGoogleAuthService>();
        googleServiceMock
            .Setup(g => g.VerifyGoogleTokenAsync("valid-token", null, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new GoogleUserInfo("orphaned-sub", "orphaned@gmail.com", true, "Orphaned Suki", "Orphaned"));

        var controller = CreateController(context, googleAuthService: googleServiceMock.Object);

        var result = await controller.GoogleAuth(new AuthController.GoogleAuthRequest
        {
            AccessToken = "valid-token"
        }, CancellationToken.None);

        var okResult = result.Result.Should().BeOfType<OkObjectResult>().Subject;
        var dto = okResult.Value.Should().BeOfType<AuthController.AuthResponseDto>().Subject;

        dto.IsNewUser.Should().BeFalse();
        dto.TenantId.Should().Be(orphanedTenantId);

        var provisionedTenant = await context.Tenants.IgnoreQueryFilters().FirstOrDefaultAsync(t => t.Id == orphanedTenantId);
        provisionedTenant.Should().NotBeNull();
        provisionedTenant!.BusinessName.Should().Contain("Orphaned Suki");
    }

    [Fact]
    public async Task GoogleAuth_LongOwnerNameAndSubject_TruncatesToMaxLengths()
    {
        var (context, _) = CreateInMemoryContext();
        var tenantId = Guid.NewGuid();
        var userId = Guid.NewGuid();

        var tenant = new Tenant
        {
            Id = tenantId,
            BusinessName = "Tindahan",
            Tier = PlanTier.Libre,
            CreatedAt = DateTimeOffset.UtcNow
        };
        var user = new User
        {
            Id = userId,
            TenantId = tenantId,
            Email = "longfields@gmail.com",
            NormalizedEmail = "longfields@gmail.com",
            FirebaseUid = "",
            OwnerName = null,
            Role = "Owner",
            CreatedAt = DateTimeOffset.UtcNow
        };
        context.Tenants.Add(tenant);
        context.Users.Add(user);
        await context.SaveChangesAsync();

        var longFullName = new string('A', 150);
        var longSubject = new string('9', 150);

        var googleServiceMock = new Mock<IGoogleAuthService>();
        googleServiceMock
            .Setup(g => g.VerifyGoogleTokenAsync("valid-token", null, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new GoogleUserInfo(longSubject, "longfields@gmail.com", true, longFullName, "A"));

        var controller = CreateController(context, googleAuthService: googleServiceMock.Object);

        var result = await controller.GoogleAuth(new AuthController.GoogleAuthRequest
        {
            AccessToken = "valid-token"
        }, CancellationToken.None);

        var okResult = result.Result.Should().BeOfType<OkObjectResult>().Subject;
        var dto = okResult.Value.Should().BeOfType<AuthController.AuthResponseDto>().Subject;

        dto.OwnerName.Should().HaveLength(100).And.Be(new string('A', 100));

        var updatedUser = await context.Users.IgnoreQueryFilters().FirstAsync(u => u.Id == userId);
        updatedUser.OwnerName.Should().HaveLength(100).And.Be(new string('A', 100));
        var expectedSubject = $"google:{longSubject}"[..128];
        updatedUser.FirebaseUid.Should().HaveLength(128).And.Be(expectedSubject);
    }

    [Fact]
    public async Task UpdatePin_GoogleUserWithoutPassword_AllowsInitialPinAndRequiresOldPinForUpdate()
    {
        var (context, userMock) = CreateInMemoryContext();
        var tenantId = Guid.NewGuid();
        var userId = Guid.NewGuid();
        userMock.Setup(u => u.TenantId).Returns(tenantId);
        userMock.Setup(u => u.UserId).Returns(userId);

        var tenant = new Tenant
        {
            Id = tenantId,
            BusinessName = "Google Store",
            Tier = PlanTier.Libre,
            CreatedAt = DateTimeOffset.UtcNow
        };
        var user = new User
        {
            Id = userId,
            TenantId = tenantId,
            Email = "googleuser@gmail.com",
            NormalizedEmail = "googleuser@gmail.com",
            FirebaseUid = "google:user-999",
            PasswordHash = string.Empty,
            Role = "Owner",
            CreatedAt = DateTimeOffset.UtcNow
        };
        context.Tenants.Add(tenant);
        context.Users.Add(user);
        await context.SaveChangesAsync();

        var controller = CreateController(context, currentUserService: userMock.Object);
        SetAuthenticatedUser(controller, userId, tenantId, email: "googleuser@gmail.com");

        // 1. Initial PIN set without password
        var initialPinResult = await controller.UpdatePin(new AuthController.UpdatePinRequest
        {
            Password = "any",
            Pin = "2468"
        }, CancellationToken.None);

        initialPinResult.Should().BeOfType<OkObjectResult>();

        var updatedUser = await context.Users.IgnoreQueryFilters().FirstAsync(u => u.Id == userId);
        updatedUser.PinHash.Should().NotBeNullOrEmpty();

        // 2. Updating PIN with wrong previous PIN fails
        var failResult = await controller.UpdatePin(new AuthController.UpdatePinRequest
        {
            Password = "9999",
            Pin = "1357"
        }, CancellationToken.None);

        failResult.Should().BeOfType<UnauthorizedObjectResult>();

        // 3. Updating PIN with correct current PIN succeeds
        var successResult = await controller.UpdatePin(new AuthController.UpdatePinRequest
        {
            Password = "2468",
            Pin = "1357"
        }, CancellationToken.None);

        successResult.Should().BeOfType<OkObjectResult>();
    }

    [Theory]
    [InlineData("owner@mailinator.com")]
    [InlineData("owner@sub.yopmail.com")]
    [InlineData("owner@10minutemail.com")]
    [InlineData("owner@guerrillamail.com")]
    public async Task Register_DisposableEmail_ReturnsBadRequest(string disposableEmail)
    {
        var (context, _) = CreateInMemoryContext();
        var controller = CreateController(context);

        var result = await controller.Register(new AuthController.RegisterRequest
        {
            TenantId = Guid.NewGuid(),
            UserId = Guid.NewGuid(),
            BusinessName = "Burner Tindahan",
            Email = disposableEmail,
            Password = "Password123!"
        }, CancellationToken.None);

        var badRequest = result.Result.Should().BeOfType<BadRequestObjectResult>().Subject;
        badRequest.Value!.ToString().Should().Contain("Disposable email addresses are not allowed");
    }

    [Fact]
    public async Task Register_PasswordSignup_RequiresEmailOtpVerificationAndVerifyOtpSucceeds()
    {
        var (context, userMock) = CreateInMemoryContext();
        var now = new DateTimeOffset(2026, 10, 20, 0, 0, 0, TimeSpan.Zero);
        var timeProvider = new MutableTimeProvider(now);
        string? capturedOtp = null;

        var otpSenderMock = new Mock<IEmailOtpSender>();
        otpSenderMock
            .Setup(s => s.SendOtpAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .Callback<string, string, string?, CancellationToken>((_, otp, _, _) => capturedOtp = otp)
            .Returns(Task.CompletedTask);

        var tenantId = Guid.NewGuid();
        var userId = Guid.NewGuid();
        userMock.Setup(u => u.TenantId).Returns(tenantId);
        userMock.Setup(u => u.UserId).Returns(userId);

        var controller = CreateController(
            context,
            currentUserService: userMock.Object,
            timeProvider: timeProvider,
            emailOtpSender: otpSenderMock.Object);

        var registerResult = await controller.Register(new AuthController.RegisterRequest
        {
            TenantId = tenantId,
            UserId = userId,
            BusinessName = "Suki Tindahan",
            Email = "suki.otp@example.ph",
            Password = "Password123!"
        }, CancellationToken.None);

        var okRegister = registerResult.Result.Should().BeOfType<OkObjectResult>().Subject;
        var registerDto = okRegister.Value.Should().BeOfType<AuthController.AuthResponseDto>().Subject;

        registerDto.EmailVerified.Should().BeFalse();
        registerDto.RequiresEmailVerification.Should().BeTrue();
        capturedOtp.Should().NotBeNullOrWhiteSpace().And.HaveLength(6);

        SetAuthenticatedUser(controller, userId, tenantId, email: "suki.otp@example.ph");

        // Wrong OTP fails and increments attempts
        var wrongOtpResult = await controller.VerifyEmailOtp(new AuthController.VerifyEmailOtpRequest
        {
            Otp = "000000" == capturedOtp ? "999999" : "000000"
        }, CancellationToken.None);
        wrongOtpResult.Result.Should().BeOfType<BadRequestObjectResult>();

        // Correct OTP verifies the account and clears OTP fields
        var verifyResult = await controller.VerifyEmailOtp(new AuthController.VerifyEmailOtpRequest
        {
            Otp = capturedOtp!
        }, CancellationToken.None);

        var okVerify = verifyResult.Result.Should().BeOfType<OkObjectResult>().Subject;
        var verifyDto = okVerify.Value.Should().BeOfType<AuthController.AuthResponseDto>().Subject;

        verifyDto.EmailVerified.Should().BeTrue();
        verifyDto.RequiresEmailVerification.Should().BeFalse();

        var verifiedUser = await context.Users.IgnoreQueryFilters().FirstAsync(u => u.Id == userId);
        verifiedUser.EmailVerified.Should().BeTrue();
        verifiedUser.EmailOtpHash.Should().BeNull();
        verifiedUser.EmailOtpExpiresAt.Should().BeNull();

        // Subsequent verify call on already-verified account returns 400 BadRequest and mints no tokens
        var alreadyVerifiedResult = await controller.VerifyEmailOtp(new AuthController.VerifyEmailOtpRequest
        {
            Otp = "123456"
        }, CancellationToken.None);
        alreadyVerifiedResult.Result.Should().BeOfType<BadRequestObjectResult>();

        // Unauthenticated caller attempting takeover with already-verified email is rejected
        var takeoverController = CreateController(context);
        var takeoverResult = await takeoverController.VerifyEmailOtp(new AuthController.VerifyEmailOtpRequest
        {
            Email = "suki.otp@example.ph",
            Otp = "000000"
        }, CancellationToken.None);
        takeoverResult.Result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task ResendEmailOtp_EnforcesCooldownAndSendsNewOtpAfterCooldown()
    {
        var (context, userMock) = CreateInMemoryContext();
        var now = new DateTimeOffset(2026, 10, 20, 0, 0, 0, TimeSpan.Zero);
        var timeProvider = new MutableTimeProvider(now);
        string? latestOtp = null;

        var otpSenderMock = new Mock<IEmailOtpSender>();
        otpSenderMock
            .Setup(s => s.SendOtpAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .Callback<string, string, string?, CancellationToken>((_, otp, _, _) => latestOtp = otp)
            .Returns(Task.CompletedTask);

        var tenantId = Guid.NewGuid();
        var userId = Guid.NewGuid();
        userMock.Setup(u => u.TenantId).Returns(tenantId);
        userMock.Setup(u => u.UserId).Returns(userId);

        var controller = CreateController(
            context,
            currentUserService: userMock.Object,
            timeProvider: timeProvider,
            emailOtpSender: otpSenderMock.Object);

        await controller.Register(new AuthController.RegisterRequest
        {
            TenantId = tenantId,
            UserId = userId,
            BusinessName = "Cooldown Store",
            Email = "cooldown@example.ph",
            Password = "Password123!"
        }, CancellationToken.None);

        SetAuthenticatedUser(controller, userId, tenantId, email: "cooldown@example.ph");

        // Immediate resend within 60s fails with 429
        var earlyResend = await controller.ResendEmailOtp(null, CancellationToken.None);
        var tooManyRequests = earlyResend.Should().BeOfType<ObjectResult>().Subject;
        tooManyRequests.StatusCode.Should().Be(StatusCodes.Status429TooManyRequests);

        // Advance past 60s cooldown
        timeProvider.Advance(TimeSpan.FromSeconds(61));
        var validResend = await controller.ResendEmailOtp(null, CancellationToken.None);
        validResend.Should().BeOfType<OkObjectResult>();
        latestOtp.Should().NotBeNullOrWhiteSpace();
    }

    [Fact]
    public async Task UpdateProfile_EmailChange_BlocksDisposableAndRequiresReVerification()
    {
        var (context, userMock) = CreateInMemoryContext();
        var now = new DateTimeOffset(2026, 10, 20, 0, 0, 0, TimeSpan.Zero);
        var timeProvider = new MutableTimeProvider(now);
        string? newEmailOtp = null;

        var otpSenderMock = new Mock<IEmailOtpSender>();
        otpSenderMock
            .Setup(s => s.SendOtpAsync("updated@example.ph", It.IsAny<string>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .Callback<string, string, string?, CancellationToken>((_, otp, _, _) => newEmailOtp = otp)
            .Returns(Task.CompletedTask);

        var tenantId = Guid.NewGuid();
        var userId = Guid.NewGuid();
        userMock.Setup(u => u.TenantId).Returns(tenantId);
        userMock.Setup(u => u.UserId).Returns(userId);

        var tenant = new Tenant
        {
            Id = tenantId,
            BusinessName = "Verified Store",
            Tier = PlanTier.Libre,
            CreatedAt = now
        };
        var user = new User
        {
            Id = userId,
            TenantId = tenantId,
            Email = "original@example.ph",
            NormalizedEmail = "original@example.ph",
            EmailVerified = true,
            FirebaseUid = "google:123",
            Role = "Owner",
            CreatedAt = now
        };
        context.Tenants.Add(tenant);
        context.Users.Add(user);
        await context.SaveChangesAsync();

        var controller = CreateController(
            context,
            currentUserService: userMock.Object,
            timeProvider: timeProvider,
            emailOtpSender: otpSenderMock.Object);
        SetAuthenticatedUser(controller, userId, tenantId, email: "original@example.ph");

        // 1. Changing to a disposable email fails
        var disposableResult = await controller.UpdateProfile(new AuthController.UpdateProfileRequest
        {
            BusinessName = "Verified Store",
            Email = "burner@yopmail.com"
        }, CancellationToken.None);
        disposableResult.Result.Should().BeOfType<BadRequestObjectResult>();

        // 2. Changing to a valid new email sets EmailVerified = false and dispatches OTP
        var updateResult = await controller.UpdateProfile(new AuthController.UpdateProfileRequest
        {
            BusinessName = "Verified Store",
            Email = "updated@example.ph"
        }, CancellationToken.None);

        var okUpdate = updateResult.Result.Should().BeOfType<OkObjectResult>().Subject;
        var dto = okUpdate.Value.Should().BeOfType<AuthController.AuthResponseDto>().Subject;

        dto.Email.Should().Be("updated@example.ph");
        dto.EmailVerified.Should().BeFalse();
        dto.RequiresEmailVerification.Should().BeTrue();
        newEmailOtp.Should().NotBeNullOrWhiteSpace().And.HaveLength(6);
    }

    [Fact]
    public async Task GoogleAuth_ExistingUnverifiedAccount_OverwritesCredentialsAndInvalidatesActiveSessions()
    {
        var (context, _) = CreateInMemoryContext();
        var now = new DateTimeOffset(2026, 10, 20, 0, 0, 0, TimeSpan.Zero);
        var timeProvider = new MutableTimeProvider(now);
        var jwtService = CreateJwtTokenService(timeProvider: timeProvider);

        var controller = CreateController(context, jwtService: jwtService, timeProvider: timeProvider);
        var unverifiedTenantId = Guid.NewGuid();
        var unverifiedUserId = Guid.NewGuid();

        // 1. Attacker registers an unverified account with victim's email and sets password + PIN
        var registerResult = await controller.Register(new AuthController.RegisterRequest
        {
            TenantId = unverifiedTenantId,
            UserId = unverifiedUserId,
            BusinessName = "Squatter Store",
            Email = "victim@gmail.com",
            Password = "AttackerPassword123!",
            Pin = "9999"
        }, CancellationToken.None);

        var registerOk = registerResult.Result.Should().BeOfType<OkObjectResult>().Subject;
        var attackerSession = registerOk.Value.Should().BeOfType<AuthController.AuthResponseDto>().Subject;
        attackerSession.EmailVerified.Should().BeFalse();

        // 2. Advance time by 10 seconds; real owner signs in via Google OAuth (email_verified: true)
        timeProvider.Advance(TimeSpan.FromSeconds(10));
        var googleServiceMock = new Mock<IGoogleAuthService>();
        googleServiceMock
            .Setup(g => g.VerifyGoogleTokenAsync("google-valid-token", null, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new GoogleUserInfo("google-real-owner-sub", "victim@gmail.com", true, "Real Owner", "Real"));

        var googleController = CreateController(
            context,
            jwtService: jwtService,
            timeProvider: timeProvider,
            googleAuthService: googleServiceMock.Object);

        var googleResult = await googleController.GoogleAuth(new AuthController.GoogleAuthRequest
        {
            AccessToken = "google-valid-token"
        }, CancellationToken.None);

        var googleOk = googleResult.Result.Should().BeOfType<OkObjectResult>().Subject;
        var googleDto = googleOk.Value.Should().BeOfType<AuthController.AuthResponseDto>().Subject;

        googleDto.EmailVerified.Should().BeTrue();
        googleDto.RequiresEmailVerification.Should().BeFalse();
        googleDto.HasPin.Should().BeFalse();

        // 3. Verify unverified account's credentials & OTP were wiped and SessionsInvalidatedAt set
        var updatedUser = await context.Users.IgnoreQueryFilters().FirstAsync(u => u.Id == unverifiedUserId);
        updatedUser.EmailVerified.Should().BeTrue();
        updatedUser.PasswordHash.Should().BeEmpty();
        updatedUser.PinHash.Should().BeNull();
        updatedUser.EmailOtpHash.Should().BeNull();
        updatedUser.SessionsInvalidatedAt.Should().Be(timeProvider.GetUtcNow());

        // 4. Attacker's prior refresh token is revoked and rejected
        var refreshResult = await googleController.Refresh(new AuthController.RefreshTokenRequest
        {
            RefreshToken = attackerSession.RefreshToken!
        }, CancellationToken.None);
        refreshResult.Result.Should().BeOfType<UnauthorizedObjectResult>();

        // 5. Attacker's prior password and PIN can no longer authenticate
        var loginPasswordResult = await googleController.Login(new AuthController.LoginRequest
        {
            Email = "victim@gmail.com",
            Password = "AttackerPassword123!"
        }, CancellationToken.None);
        loginPasswordResult.Result.Should().BeOfType<UnauthorizedObjectResult>();

        var loginPinResult = await googleController.LoginPin(new AuthController.LoginPinRequest
        {
            Email = "victim@gmail.com",
            Pin = "9999"
        }, CancellationToken.None);
        loginPinResult.Result.Should().BeOfType<UnauthorizedObjectResult>();
    }

    [Fact]
    public async Task DeleteAccount_30DayDeactivation_BlocksLoginUntilRestored()
    {
        var (context, _) = CreateInMemoryContext();
        var (authController, userId, tenantId) = await SetupAuthenticatedTestStoreAsync(
            context,
            email: "deactivate@tindahan.ph",
            businessName: "Deactivate Store",
            password: "Password123!",
            pin: "1234");

        // 1. Wrong password fails re-authentication
        var wrongPwdResult = await authController.DeleteAccount(new AuthController.DeleteAccountRequest
        {
            Password = "WrongPassword!",
            Immediate = false
        }, CancellationToken.None);
        wrongPwdResult.Result.Should().BeOfType<UnauthorizedObjectResult>();

        // 2. Valid password schedules 30-day deletion and revokes sessions
        var deleteResult = await authController.DeleteAccount(new AuthController.DeleteAccountRequest
        {
            Password = "Password123!",
            Immediate = false
        }, CancellationToken.None);

        var okDelete = deleteResult.Result.Should().BeOfType<OkObjectResult>().Subject;
        var dto = okDelete.Value.Should().BeOfType<AuthController.DeleteAccountResponseDto>().Subject;
        dto.Status.Should().Be(User.StatusPendingDeletion);
        dto.DeletionScheduledAt.Should().NotBeNull();

        var dbUser = await context.Users.IgnoreQueryFilters().FirstAsync(u => u.Id == userId);
        dbUser.AccountStatus.Should().Be(User.StatusPendingDeletion);
        dbUser.DeletionScheduledAt.Should().NotBeNull();

        // 3. Login without RestoreAccount returns 409 Conflict with pendingDeletion = true
        var publicController = CreateController(context);
        var loginBlocked = await publicController.Login(new AuthController.LoginRequest
        {
            Email = "deactivate@tindahan.ph",
            Password = "Password123!"
        }, CancellationToken.None);

        var conflict = loginBlocked.Result.Should().BeOfType<ConflictObjectResult>().Subject;
        var conflictJson = JsonSerializer.Serialize(conflict.Value);
        conflictJson.Should().Contain("pendingDeletion");

        // 4. Login with RestoreAccount = true restores account to ACTIVE and returns tokens
        var loginRestore = await publicController.Login(new AuthController.LoginRequest
        {
            Email = "deactivate@tindahan.ph",
            Password = "Password123!",
            RestoreAccount = true
        }, CancellationToken.None);

        loginRestore.Result.Should().BeOfType<OkObjectResult>();
        var restoredUser = await context.Users.IgnoreQueryFilters().FirstAsync(u => u.Id == userId);
        restoredUser.AccountStatus.Should().Be(User.StatusActive);
        restoredUser.DeletionScheduledAt.Should().BeNull();
    }

    [Fact]
    public async Task DeleteAccount_ImmediateAnonymization_ScrubsPiiAndRetainsFinancialLedgers()
    {
        var (context, _) = CreateInMemoryContext();
        var (authController, userId, tenantId) = await SetupAuthenticatedTestStoreAsync(
            context,
            email: "immediate@tindahan.ph",
            businessName: "Immediate Delete Store",
            ownerName: "Juan Dela Cruz",
            phone: "09171234567",
            password: "Password123!",
            pin: "4321");

        var customerId = Guid.NewGuid();
        context.Customers.Add(new Customer
        {
            Id = customerId,
            TenantId = tenantId,
            Name = "Suki Pedro",
            Phone = "09189998877",
            UpdatedAt = DateTimeOffset.UtcNow
        });

        var productId = Guid.NewGuid();
        context.Products.Add(new Product
        {
            Id = productId,
            TenantId = tenantId,
            Name = "Lucky Me Pancit Canton",
            Price = 15m,
            UpdatedAt = DateTimeOffset.UtcNow
        });

        var saleId = Guid.NewGuid();
        context.Sales.Add(new Sale
        {
            Id = saleId,
            TenantId = tenantId,
            TotalAmount = 30m,
            PaymentMethod = "Cash"
        });

        var utangId = Guid.NewGuid();
        context.UtangLedgers.Add(new UtangLedger
        {
            Id = utangId,
            TenantId = tenantId,
            CustomerId = customerId,
            Amount = 50m,
            Type = "Credit"
        });

        await context.SaveChangesAsync();

        // Immediate deletion using PIN re-authentication
        var deleteResult = await authController.DeleteAccount(new AuthController.DeleteAccountRequest
        {
            Pin = "4321",
            Immediate = true
        }, CancellationToken.None);

        var okDelete = deleteResult.Result.Should().BeOfType<OkObjectResult>().Subject;
        var dto = okDelete.Value.Should().BeOfType<AuthController.DeleteAccountResponseDto>().Subject;
        dto.Status.Should().Be(User.StatusDeleted);
        dto.DeletionScheduledAt.Should().BeNull();

        // Verify PII scrubbed on User, Tenant, Customer and Product soft-deleted
        var dbUser = await context.Users.IgnoreQueryFilters().FirstAsync(u => u.Id == userId);
        dbUser.AccountStatus.Should().Be(User.StatusDeleted);
        dbUser.Email.Should().EndWith("@anonymized.local");
        dbUser.OwnerName.Should().Be("Deleted User");
        dbUser.Phone.Should().BeEmpty();
        dbUser.PasswordHash.Should().BeEmpty();
        dbUser.PinHash.Should().BeNull();

        var dbTenant = await context.Tenants.IgnoreQueryFilters().FirstAsync(t => t.Id == tenantId);
        dbTenant.BusinessName.Should().Be("Deleted Store");
        dbTenant.Tier.Should().Be(FluentTindahan.Domain.Enums.PlanTier.Libre);

        var dbCustomer = await context.Customers.IgnoreQueryFilters().FirstAsync(c => c.Id == customerId);
        dbCustomer.Name.Should().Be("Deleted Customer");
        dbCustomer.Phone.Should().BeEmpty();
        dbCustomer.IsDeleted.Should().BeTrue();

        var dbProduct = await context.Products.IgnoreQueryFilters().FirstAsync(p => p.Id == productId);
        dbProduct.IsDeleted.Should().BeTrue();

        // Verify append-only financial ledgers (Sale, UtangLedger) remain intact per Rule 4
        var dbSale = await context.Sales.IgnoreQueryFilters().FirstOrDefaultAsync(s => s.Id == saleId);
        dbSale.Should().NotBeNull();
        dbSale!.TotalAmount.Should().Be(30m);

        var dbUtang = await context.UtangLedgers.IgnoreQueryFilters().FirstOrDefaultAsync(u => u.Id == utangId);
        dbUtang.Should().NotBeNull();
        dbUtang!.Amount.Should().Be(50m);

        // Verify original email is freed for new registration
        var publicController = CreateController(context);
        var reRegister = await publicController.Register(new AuthController.RegisterRequest
        {
            Email = "immediate@tindahan.ph",
            Password = "NewPassword123!",
            BusinessName = "Fresh Tindahan"
        }, CancellationToken.None);
        reRegister.Result.Should().BeOfType<OkObjectResult>();
    }

    [Fact]
    public async Task SubscriptionMonitorService_ProcessExpiredAccountDeletions_AnonymizesExpiredAccountsOnly()
    {
        var (context, _) = CreateInMemoryContext();
        var now = DateTimeOffset.UtcNow;

        var (_, expiredUserId, expiredTenantId) = await SetupAuthenticatedTestStoreAsync(
            context,
            email: "expired@tindahan.ph",
            businessName: "Expired Grace Store",
            password: "Password123!");

        var (_, activeGraceUserId, _) = await SetupAuthenticatedTestStoreAsync(
            context,
            email: "activegrace@tindahan.ph",
            businessName: "Active Grace Store",
            password: "Password123!");

        var expiredUser = await context.Users.IgnoreQueryFilters().FirstAsync(u => u.Id == expiredUserId);
        expiredUser.AccountStatus = User.StatusPendingDeletion;
        expiredUser.DeletionScheduledAt = now.AddDays(-1);

        var activeGraceUser = await context.Users.IgnoreQueryFilters().FirstAsync(u => u.Id == activeGraceUserId);
        activeGraceUser.AccountStatus = User.StatusPendingDeletion;
        activeGraceUser.DeletionScheduledAt = now.AddDays(15);

        await context.SaveChangesAsync();

        var serviceProviderMock = new Mock<IServiceProvider>();
        serviceProviderMock.Setup(sp => sp.GetService(typeof(AppDbContext))).Returns(context);

        var scopeMock = new Mock<Microsoft.Extensions.DependencyInjection.IServiceScope>();
        scopeMock.Setup(s => s.ServiceProvider).Returns(serviceProviderMock.Object);

        var scopeFactoryMock = new Mock<Microsoft.Extensions.DependencyInjection.IServiceScopeFactory>();
        scopeFactoryMock.Setup(f => f.CreateScope()).Returns(scopeMock.Object);

        var config = new ConfigurationBuilder().Build();
        var monitor = new SubscriptionMonitorService(
            scopeFactoryMock.Object,
            config,
            Microsoft.Extensions.Logging.Abstractions.NullLogger<SubscriptionMonitorService>.Instance);

        await monitor.ProcessExpiredAccountDeletionsAsync(CancellationToken.None);

        var updatedExpired = await context.Users.IgnoreQueryFilters().FirstAsync(u => u.Id == expiredUserId);
        updatedExpired.AccountStatus.Should().Be(User.StatusDeleted);
        updatedExpired.Email.Should().EndWith("@anonymized.local");

        var updatedTenant = await context.Tenants.IgnoreQueryFilters().FirstAsync(t => t.Id == expiredTenantId);
        updatedTenant.BusinessName.Should().Be("Deleted Store");

        var updatedActiveGrace = await context.Users.IgnoreQueryFilters().FirstAsync(u => u.Id == activeGraceUserId);
        updatedActiveGrace.AccountStatus.Should().Be(User.StatusPendingDeletion);
        updatedActiveGrace.Email.Should().Be("activegrace@tindahan.ph");
    }

    [Fact]
    public async Task ChangePassword_WithRefreshToken_RevokesOtherSessionsAndReturnsAuthDto()
    {
        var (context, _) = CreateInMemoryContext();
        var timeProvider = new MutableTimeProvider(DateTimeOffset.UtcNow);
        var controller = CreateController(context, timeProvider: timeProvider);

        var regResult = await controller.Register(new AuthController.RegisterRequest
        {
            Email = "sessionkeep@tindahan.ph",
            Password = "OldPassword123!",
            BusinessName = "Session Keep Store"
        }, CancellationToken.None);
        var regDto = ((OkObjectResult)regResult.Result!).Value.Should().BeOfType<AuthController.AuthResponseDto>().Subject;
        var originalRefreshToken = regDto.RefreshToken!;

        SetAuthenticatedUser(controller, regDto.UserId, regDto.TenantId, regDto.Email);

        var changeResult = await controller.ChangePassword(new AuthController.ChangePasswordRequest
        {
            CurrentPassword = "OldPassword123!",
            NewPassword = "NewPassword999!",
            RefreshToken = originalRefreshToken
        }, CancellationToken.None);

        var okResult = changeResult.Should().BeOfType<OkObjectResult>().Subject;
        var authDto = okResult.Value.Should().BeOfType<AuthController.AuthResponseDto>().Subject;
        authDto.Token.Should().NotBeNullOrWhiteSpace();
        authDto.RefreshToken.Should().NotBeNullOrWhiteSpace().And.NotBe(originalRefreshToken);
    }

    [Fact]
    public async Task ForgotPassword_ExistingUser_IssuesOtpAndDispatchesEmail()
    {
        var (context, _) = CreateInMemoryContext();
        var timeProvider = new MutableTimeProvider(DateTimeOffset.UtcNow);
        var otpSenderMock = new Mock<IEmailOtpSender>();
        string? dispatchedOtp = null;
        otpSenderMock.Setup(s => s.SendOtpAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .Callback<string, string, string?, CancellationToken>((_, otp, _, _) => dispatchedOtp = otp)
            .Returns(Task.CompletedTask);

        var controller = CreateController(context, timeProvider: timeProvider, emailOtpSender: otpSenderMock.Object);

        await controller.Register(new AuthController.RegisterRequest
        {
            Email = "forgotuser@tindahan.ph",
            Password = "Password123!",
            BusinessName = "Forgot Password Store"
        }, CancellationToken.None);

        timeProvider.Advance(TimeSpan.FromSeconds(61));

        var forgotResult = await controller.ForgotPassword(new AuthController.ForgotPasswordRequest
        {
            Email = "forgotuser@tindahan.ph"
        }, CancellationToken.None);

        forgotResult.Should().BeOfType<OkObjectResult>();
        dispatchedOtp.Should().NotBeNullOrWhiteSpace().And.HaveLength(6);

        // Anti-enumeration: cooldown returns generic 200 without dispatching a new email
        dispatchedOtp = null;
        var cooldownResult = await controller.ForgotPassword(new AuthController.ForgotPasswordRequest
        {
            Email = "forgotuser@tindahan.ph"
        }, CancellationToken.None);
        cooldownResult.Should().BeOfType<OkObjectResult>();
        dispatchedOtp.Should().BeNull();
    }

    [Fact]
    public async Task ForgotPassword_NonexistentUser_ReturnsGenericOk_AntiEnumeration()
    {
        var (context, _) = CreateInMemoryContext();
        var controller = CreateController(context);

        var forgotResult = await controller.ForgotPassword(new AuthController.ForgotPasswordRequest
        {
            Email = "ghost@tindahan.ph"
        }, CancellationToken.None);

        forgotResult.Should().BeOfType<OkObjectResult>();
    }

    [Fact]
    public async Task RegisterAndLogin_WhenEmailSenderThrows_DoesNotReturn500()
    {
        var (context, _) = CreateInMemoryContext();
        var failingOtpSender = new Mock<IEmailOtpSender>();
        failingOtpSender
            .Setup(s => s.SendOtpAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new System.Net.Mail.SmtpException("Connection refused"));

        var controller = CreateController(context, emailOtpSender: failingOtpSender.Object);

        // Register succeeds despite SMTP failure
        var regResult = await controller.Register(new AuthController.RegisterRequest
        {
            Email = "smtp.fail@tindahan.ph",
            Password = "Password123!",
            BusinessName = "Offline SMTP Store"
        }, CancellationToken.None);

        var regOk = regResult.Result.Should().BeOfType<OkObjectResult>().Subject;
        var regDto = regOk.Value.Should().BeOfType<AuthController.AuthResponseDto>().Subject;
        regDto.Email.Should().Be("smtp.fail@tindahan.ph");
        regDto.RequiresEmailVerification.Should().BeTrue();

        // Login succeeds despite SMTP failure
        var loginResult = await controller.Login(new AuthController.LoginRequest
        {
            Email = "smtp.fail@tindahan.ph",
            Password = "Password123!"
        }, CancellationToken.None);

        var loginOk = loginResult.Result.Should().BeOfType<OkObjectResult>().Subject;
        var loginDto = loginOk.Value.Should().BeOfType<AuthController.AuthResponseDto>().Subject;
        loginDto.Email.Should().Be("smtp.fail@tindahan.ph");
    }

    [Fact]
    public async Task ResetPassword_ValidOtp_UpdatesPasswordHashAndInvalidatesSessions()
    {
        var (context, _) = CreateInMemoryContext();
        var timeProvider = new MutableTimeProvider(DateTimeOffset.UtcNow);
        var otpSenderMock = new Mock<IEmailOtpSender>();
        string? dispatchedOtp = null;
        otpSenderMock.Setup(s => s.SendOtpAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .Callback<string, string, string?, CancellationToken>((_, otp, _, _) => dispatchedOtp = otp)
            .Returns(Task.CompletedTask);

        var controller = CreateController(context, timeProvider: timeProvider, emailOtpSender: otpSenderMock.Object);

        var regResult = await controller.Register(new AuthController.RegisterRequest
        {
            Email = "resetme@tindahan.ph",
            Password = "OldPassword123!",
            BusinessName = "Reset Password Store"
        }, CancellationToken.None);
        var regDto = ((OkObjectResult)regResult.Result!).Value.Should().BeOfType<AuthController.AuthResponseDto>().Subject;
        var oldRefreshToken = regDto.RefreshToken!;
        timeProvider.Advance(TimeSpan.FromSeconds(61));

        // Request forgot password OTP
        await controller.ForgotPassword(new AuthController.ForgotPasswordRequest
        {
            Email = "resetme@tindahan.ph"
        }, CancellationToken.None);

        dispatchedOtp.Should().NotBeNull();

        // Wrong OTP fails
        var wrongOtpResult = await controller.ResetPassword(new AuthController.ResetPasswordRequest
        {
            Email = "resetme@tindahan.ph",
            Otp = "999999",
            NewPassword = "BrandNewPassword123!"
        }, CancellationToken.None);
        wrongOtpResult.Should().BeOfType<BadRequestObjectResult>();

        // Correct OTP resets password
        var resetResult = await controller.ResetPassword(new AuthController.ResetPasswordRequest
        {
            Email = "resetme@tindahan.ph",
            Otp = dispatchedOtp!,
            NewPassword = "BrandNewPassword123!"
        }, CancellationToken.None);
        resetResult.Should().BeOfType<OkObjectResult>();

        // Old refresh token is revoked
        var refreshResult = await controller.Refresh(new AuthController.RefreshTokenRequest
        {
            RefreshToken = oldRefreshToken
        }, CancellationToken.None);
        refreshResult.Result.Should().BeOfType<UnauthorizedObjectResult>();

        // Login with old password fails
        var oldLogin = await controller.Login(new AuthController.LoginRequest
        {
            Email = "resetme@tindahan.ph",
            Password = "OldPassword123!"
        }, CancellationToken.None);
        var oldLoginResult = oldLogin.Result.Should().BeOfType<UnauthorizedObjectResult>().Subject;
        oldLoginResult.Value?.ToString().Should().Contain("Invalid email or password");

        // Login with new password succeeds
        var newLogin = await controller.Login(new AuthController.LoginRequest
        {
            Email = "resetme@tindahan.ph",
            Password = "BrandNewPassword123!"
        }, CancellationToken.None);
        var newLoginDto = ((OkObjectResult)newLogin.Result!).Value.Should().BeOfType<AuthController.AuthResponseDto>().Subject;
        newLoginDto.EmailVerified.Should().BeTrue();
        newLoginDto.RequiresEmailVerification.Should().BeFalse();
    }

    [Fact]
    public async Task ResetPassword_UnverifiedAccount_MarksEmailVerifiedAndClearsVerificationRequirementOnSubsequentLogin()
    {
        var (context, _) = CreateInMemoryContext();
        var timeProvider = new MutableTimeProvider(DateTimeOffset.UtcNow);
        var otpSenderMock = new Mock<IEmailOtpSender>();
        string? resetOtp = null;
        otpSenderMock.Setup(s => s.SendOtpAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .Callback<string, string, string?, CancellationToken>((_, otp, _, _) => resetOtp = otp)
            .Returns(Task.CompletedTask);

        var controller = CreateController(context, timeProvider: timeProvider, emailOtpSender: otpSenderMock.Object);

        // 1. Sign up a new account (unverified by default) with a PIN
        var regResult = await controller.Register(new AuthController.RegisterRequest
        {
            Email = "unverified@tindahan.ph",
            Password = "InitialPassword123!",
            Pin = "1234",
            BusinessName = "Unverified Tindahan"
        }, CancellationToken.None);
        var regDto = ((OkObjectResult)regResult.Result!).Value.Should().BeOfType<AuthController.AuthResponseDto>().Subject;
        regDto.EmailVerified.Should().BeFalse();
        regDto.RequiresEmailVerification.Should().BeTrue();
        regDto.HasPin.Should().BeTrue();

        timeProvider.Advance(TimeSpan.FromSeconds(65));

        // 2. Logging in before reset returns RequiresEmailVerification = true
        var initialLogin = await controller.Login(new AuthController.LoginRequest
        {
            Email = "unverified@tindahan.ph",
            Password = "InitialPassword123!"
        }, CancellationToken.None);
        var initialLoginDto = ((OkObjectResult)initialLogin.Result!).Value.Should().BeOfType<AuthController.AuthResponseDto>().Subject;
        initialLoginDto.EmailVerified.Should().BeFalse();
        initialLoginDto.RequiresEmailVerification.Should().BeTrue();
        initialLoginDto.HasPin.Should().BeTrue();

        // 3. User requests password reset OTP
        timeProvider.Advance(TimeSpan.FromSeconds(65));
        await controller.ForgotPassword(new AuthController.ForgotPasswordRequest
        {
            Email = "unverified@tindahan.ph"
        }, CancellationToken.None);

        resetOtp.Should().NotBeNullOrWhiteSpace();

        // 4. User completes password reset with the email OTP
        var resetResult = await controller.ResetPassword(new AuthController.ResetPasswordRequest
        {
            Email = "unverified@tindahan.ph",
            Otp = resetOtp!,
            NewPassword = "BrandNewPassword456!"
        }, CancellationToken.None);
        resetResult.Should().BeOfType<OkObjectResult>();

        // 5. Subsequent login with new password has EmailVerified = true, RequiresEmailVerification = false, and HasPin = false (squatter PIN cleared)
        var subsequentLogin = await controller.Login(new AuthController.LoginRequest
        {
            Email = "unverified@tindahan.ph",
            Password = "BrandNewPassword456!"
        }, CancellationToken.None);
        var subsequentLoginDto = ((OkObjectResult)subsequentLogin.Result!).Value.Should().BeOfType<AuthController.AuthResponseDto>().Subject;
        subsequentLoginDto.EmailVerified.Should().BeTrue();
        subsequentLoginDto.RequiresEmailVerification.Should().BeFalse();
        subsequentLoginDto.HasPin.Should().BeFalse();

        // 6. Attempting to log in with the old squatter PIN now fails
        var pinLoginAttempt = await controller.LoginPin(new AuthController.LoginPinRequest
        {
            Email = "unverified@tindahan.ph",
            Pin = "1234"
        }, CancellationToken.None);
        pinLoginAttempt.Result.Should().BeOfType<UnauthorizedObjectResult>();
    }

    [Theory]
    [InlineData("short7!")]
    [InlineData("nouppernumber")]
    [InlineData("12345678")]
    public async Task ChangePassword_InvalidPasswordStrength_ReturnsBadRequest(string invalidPassword)
    {
        var (context, _) = CreateInMemoryContext();
        var controller = CreateController(context);

        var regResult = await controller.Register(new AuthController.RegisterRequest
        {
            Email = "strength.test@tindahan.ph",
            Password = "ValidPassword123!",
            BusinessName = "Strength Test Store"
        }, CancellationToken.None);
        var regDto = ((OkObjectResult)regResult.Result!).Value.Should().BeOfType<AuthController.AuthResponseDto>().Subject;

        SetAuthenticatedUser(controller, regDto.UserId, regDto.TenantId, regDto.Email);

        var changeResult = await controller.ChangePassword(new AuthController.ChangePasswordRequest
        {
            CurrentPassword = "ValidPassword123!",
            NewPassword = invalidPassword
        }, CancellationToken.None);

        changeResult.Should().BeOfType<BadRequestObjectResult>();
    }

    [Theory]
    [InlineData("short7!")]
    [InlineData("12345678")]
    public async Task ResetPassword_InvalidPasswordStrength_ReturnsBadRequest(string invalidPassword)
    {
        var (context, _) = CreateInMemoryContext();
        var timeProvider = new MutableTimeProvider(DateTimeOffset.UtcNow);
        var otpSenderMock = new Mock<IEmailOtpSender>();
        string? dispatchedOtp = null;
        otpSenderMock.Setup(s => s.SendOtpAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .Callback<string, string, string?, CancellationToken>((_, otp, _, _) => dispatchedOtp = otp)
            .Returns(Task.CompletedTask);

        var controller = CreateController(context, timeProvider: timeProvider, emailOtpSender: otpSenderMock.Object);

        await controller.Register(new AuthController.RegisterRequest
        {
            Email = "strength.reset@tindahan.ph",
            Password = "ValidPassword123!",
            BusinessName = "Strength Reset Store"
        }, CancellationToken.None);

        timeProvider.Advance(TimeSpan.FromSeconds(61));

        await controller.ForgotPassword(new AuthController.ForgotPasswordRequest
        {
            Email = "strength.reset@tindahan.ph"
        }, CancellationToken.None);

        dispatchedOtp.Should().NotBeNull();

        var resetResult = await controller.ResetPassword(new AuthController.ResetPasswordRequest
        {
            Email = "strength.reset@tindahan.ph",
            Otp = dispatchedOtp!,
            NewPassword = invalidPassword
        }, CancellationToken.None);

        resetResult.Should().BeOfType<BadRequestObjectResult>();
    }

    [Theory]
    [InlineData(nameof(AuthController.Register))]
    [InlineData(nameof(AuthController.ForgotPassword))]
    [InlineData(nameof(AuthController.ResendEmailOtp))]
    [InlineData(nameof(AuthController.UpdateProfile))]
    public void EmailTriggeringEndpoints_HaveEmailDispatchRateLimitingPolicy(string methodName)
    {
        var method = typeof(AuthController).GetMethod(methodName);
        method.Should().NotBeNull();

        var rateLimitAttribute = method!.GetCustomAttribute<EnableRateLimitingAttribute>();
        rateLimitAttribute.Should().NotBeNull();
        rateLimitAttribute!.PolicyName.Should().Be("EmailDispatch");
    }
}


