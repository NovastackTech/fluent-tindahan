using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Moq;
using FluentTindahan.Application.Common.Interfaces;
using FluentTindahan.Domain.Entities;
using FluentTindahan.Domain.Enums;
using FluentTindahan.Domain.Interfaces;
using FluentTindahan.Infrastructure.Persistence;
using FluentTindahan.WebApi.Controllers;
using Xunit;

namespace FluentTindahan.UnitTests;

public class AuthControllerTests
{
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

    [Fact]
    public async Task Register_ValidRequest_PreservesClientTenantAndUserId()
    {
        var (context, _) = CreateInMemoryContext();
        var controller = new AuthController(context);

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
        var controller = new AuthController(context);

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
    public async Task Register_InvalidEmail_ReturnsBadRequest()
    {
        var (context, _) = CreateInMemoryContext();
        var controller = new AuthController(context);

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
        var controller = new AuthController(context);

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
        var controller = new AuthController(context);

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
        var controller = new AuthController(context);

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
        var controller = new AuthController(context);

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
        var controller = new AuthController(context);

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
        var controller = new AuthController(context);

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
        var (context, _) = CreateInMemoryContext();
        var controller = new AuthController(context);

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
    public async Task UpdatePin_ValidPassword_SetsNewPinSuccessfully()
    {
        var (context, _) = CreateInMemoryContext();
        var controller = new AuthController(context);

        await controller.Register(new AuthController.RegisterRequest
        {
            Email = "updatepin@tindahan.ph",
            Password = "MasterPassword123!",
            Pin = "1111",
            BusinessName = "Update PIN Store"
        }, CancellationToken.None);

        var updateResult = await controller.UpdatePin(new AuthController.UpdatePinRequest
        {
            Email = "updatepin@tindahan.ph",
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
        var controller = new AuthController(context);

        await controller.Register(new AuthController.RegisterRequest
        {
            Email = "clearpin@tindahan.ph",
            Password = "MasterPassword123!",
            Pin = "1234",
            BusinessName = "Clear PIN Store"
        }, CancellationToken.None);

        var clearResult = await controller.UpdatePin(new AuthController.UpdatePinRequest
        {
            Email = "clearpin@tindahan.ph",
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
        var controller = new AuthController(context);

        await controller.Register(new AuthController.RegisterRequest
        {
            Email = "wrongpass@tindahan.ph",
            Password = "CorrectPassword123!",
            BusinessName = "Wrong Pass Store"
        }, CancellationToken.None);

        var result = await controller.UpdatePin(new AuthController.UpdatePinRequest
        {
            Email = "wrongpass@tindahan.ph",
            Password = "IncorrectPassword999!",
            Pin = "1234"
        }, CancellationToken.None);

        result.Should().BeOfType<UnauthorizedObjectResult>();
    }
}
