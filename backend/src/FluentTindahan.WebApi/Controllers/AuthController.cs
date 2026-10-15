using System.ComponentModel.DataAnnotations;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using FluentTindahan.Application.Common.Interfaces;
using FluentTindahan.Domain.Entities;
using FluentTindahan.Domain.Enums;

namespace FluentTindahan.WebApi.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly IApplicationDbContext _context;
    private readonly PasswordHasher<User> _passwordHasher;

    public AuthController(IApplicationDbContext context)
    {
        _context = context;
        _passwordHasher = new PasswordHasher<User>();
    }

    public sealed record RegisterRequest
    {
        [Required, EmailAddress, StringLength(256)]
        public string Email { get; init; } = string.Empty;

        [Required, StringLength(100, MinimumLength = 6)]
        public string Password { get; init; } = string.Empty;

        [RegularExpression(@"^\d{4,6}$", ErrorMessage = "PIN must be between 4 and 6 digits.")]
        public string? Pin { get; init; }

        [Required, StringLength(200, MinimumLength = 2)]
        public string BusinessName { get; init; } = string.Empty;

        [StringLength(100)]
        public string? OwnerName { get; init; }

        [StringLength(30)]
        public string? Phone { get; init; }

        public Guid? TenantId { get; init; }
        public Guid? UserId { get; init; }
    }

    public sealed record LoginRequest
    {
        [Required, EmailAddress]
        public string Email { get; init; } = string.Empty;

        [Required]
        public string Password { get; init; } = string.Empty;
    }

    public sealed record LoginPinRequest
    {
        [Required, EmailAddress]
        public string Email { get; init; } = string.Empty;

        [Required, RegularExpression(@"^\d{4,6}$", ErrorMessage = "PIN must be between 4 and 6 digits.")]
        public string Pin { get; init; } = string.Empty;
    }

    public sealed record UpdatePinRequest
    {
        [Required, EmailAddress]
        public string Email { get; init; } = string.Empty;

        [Required]
        public string Password { get; init; } = string.Empty;

        [RegularExpression(@"^\d{4,6}$", ErrorMessage = "PIN must be between 4 and 6 digits.")]
        public string? Pin { get; init; }
    }

    public sealed record AuthResponseDto(
        Guid TenantId,
        Guid UserId,
        string Email,
        string BusinessName,
        string? OwnerName,
        string? Phone,
        string Role,
        PlanTier Tier,
        string PlanTier,
        DateTimeOffset? SubscriptionEndDate,
        bool HasPin,
        string Token,
        DateTimeOffset ExpiresAt
    );

    /// <summary>
    /// Registers a new store and owner identity using email and password.
    /// Preserves client-supplied TenantId and UserId when provided to align local Dexie records.
    /// </summary>
    [HttpPost("register")]
    [EnableRateLimiting("AnonymousDemoProvision")]
    [ProducesResponseType(typeof(AuthResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<AuthResponseDto>> Register(
        [FromBody] RegisterRequest request,
        CancellationToken cancellationToken)
    {
        var rawEmail = (request.Email ?? string.Empty).Trim();
        var normalizedEmail = rawEmail.ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(normalizedEmail) || !new EmailAddressAttribute().IsValid(normalizedEmail))
        {
            return BadRequest(new { message = "Kailangan ng wastong email address. / Valid email address is required." });
        }

        var emailExists = await _context.Users.IgnoreQueryFilters()
            .AnyAsync(u => u.NormalizedEmail == normalizedEmail, cancellationToken);
        if (emailExists)
        {
            return Conflict(new { message = "May tindahan nang nakarehistro gamit ang email na ito. Pakipili ang Mag-login. / A store is already registered with this email." });
        }

        var tenantId = request.TenantId.HasValue && request.TenantId.Value != Guid.Empty
            ? request.TenantId.Value
            : Guid.NewGuid();

        var userId = request.UserId.HasValue && request.UserId.Value != Guid.Empty
            ? request.UserId.Value
            : Guid.NewGuid();

        var businessName = request.BusinessName.Trim();
        if (businessName.Length < 2)
        {
            return BadRequest(new { message = "Kailangan ng pangalan ng tindahan (minimum 2 letra). / Store name is required (minimum 2 chars)." });
        }

        var tenant = await _context.Tenants.IgnoreQueryFilters()
            .FirstOrDefaultAsync(t => t.Id == tenantId, cancellationToken);

        if (tenant == null)
        {
            tenant = new Tenant
            {
                Id = tenantId,
                BusinessName = businessName,
                Tier = PlanTier.Libre,
                CreatedAt = DateTimeOffset.UtcNow
            };
            _context.Tenants.Add(tenant);
        }
        else if (string.IsNullOrWhiteSpace(tenant.BusinessName))
        {
            tenant.BusinessName = businessName;
        }

        var user = new User
        {
            Id = userId,
            TenantId = tenantId,
            Email = rawEmail,
            NormalizedEmail = normalizedEmail,
            Phone = request.Phone?.Trim() ?? string.Empty,
            Role = "Owner",
            FailedPinAttempts = 0,
            PinLockoutEnd = null,
            CreatedAt = DateTimeOffset.UtcNow,
            LastLoginAt = DateTimeOffset.UtcNow
        };

        user.PasswordHash = _passwordHasher.HashPassword(user, request.Password);
        if (!string.IsNullOrWhiteSpace(request.Pin))
        {
            user.PinHash = _passwordHasher.HashPassword(user, request.Pin.Trim());
        }

        _context.Users.Add(user);
        await _context.SaveChangesAsync(cancellationToken);

        var expiresAt = DateTimeOffset.UtcNow.AddYears(1);
        var token = GenerateAuthToken(user.Id, tenant.Id, user.Email, user.Role, expiresAt);

        return Ok(new AuthResponseDto(
            tenant.Id,
            user.Id,
            user.Email,
            tenant.BusinessName,
            request.OwnerName?.Trim() ?? string.Empty,
            user.Phone,
            user.Role,
            tenant.Tier,
            tenant.Tier.ToString(),
            tenant.SubscriptionEndDate,
            !string.IsNullOrEmpty(user.PinHash),
            token,
            expiresAt
        ));
    }

    /// <summary>
    /// Logs in an existing store owner using email and password.
    /// Bypasses multi-tenant filters via .IgnoreQueryFilters() to locate the store across tenants.
    /// </summary>
    [HttpPost("login")]
    [EnableRateLimiting("AnonymousDemoProvision")]
    [ProducesResponseType(typeof(AuthResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<AuthResponseDto>> Login(
        [FromBody] LoginRequest request,
        CancellationToken cancellationToken)
    {
        var rawEmail = (request.Email ?? string.Empty).Trim();
        var normalizedEmail = rawEmail.ToLowerInvariant();

        var user = await _context.Users.IgnoreQueryFilters()
            .Include(u => u.Tenant)
            .FirstOrDefaultAsync(u => u.NormalizedEmail == normalizedEmail, cancellationToken);

        if (user == null || string.IsNullOrEmpty(user.PasswordHash) || user.Tenant == null)
        {
            return Unauthorized(new { message = "Maling email o password. / Invalid email or password." });
        }

        var verifyResult = _passwordHasher.VerifyHashedPassword(user, user.PasswordHash, request.Password);
        if (verifyResult == PasswordVerificationResult.Failed)
        {
            return Unauthorized(new { message = "Maling email o password. / Invalid email or password." });
        }

        if (verifyResult == PasswordVerificationResult.SuccessRehashNeeded)
        {
            user.PasswordHash = _passwordHasher.HashPassword(user, request.Password);
        }

        user.FailedPinAttempts = 0;
        user.PinLockoutEnd = null;
        user.LastLoginAt = DateTimeOffset.UtcNow;
        await _context.SaveChangesAsync(cancellationToken);

        var expiresAt = DateTimeOffset.UtcNow.AddYears(1);
        var token = GenerateAuthToken(user.Id, user.TenantId, user.Email, user.Role, expiresAt);

        return Ok(new AuthResponseDto(
            user.TenantId,
            user.Id,
            user.Email,
            user.Tenant.BusinessName,
            null,
            user.Phone,
            user.Role,
            user.Tenant.Tier,
            user.Tenant.Tier.ToString(),
            user.Tenant.SubscriptionEndDate,
            !string.IsNullOrEmpty(user.PinHash),
            token,
            expiresAt
        ));
    }

    /// <summary>
    /// Fast till login/unlock using email and 4-6 digit numeric PIN.
    /// Protects against brute-force attacks by locking out after 5 consecutive failures for 15 minutes.
    /// </summary>
    [HttpPost("login-pin")]
    [EnableRateLimiting("AnonymousDemoProvision")]
    [ProducesResponseType(typeof(AuthResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<ActionResult<AuthResponseDto>> LoginPin(
        [FromBody] LoginPinRequest request,
        CancellationToken cancellationToken)
    {
        var rawEmail = (request.Email ?? string.Empty).Trim();
        var normalizedEmail = rawEmail.ToLowerInvariant();

        var user = await _context.Users.IgnoreQueryFilters()
            .Include(u => u.Tenant)
            .FirstOrDefaultAsync(u => u.NormalizedEmail == normalizedEmail, cancellationToken);

        if (user == null || string.IsNullOrEmpty(user.PinHash) || user.Tenant == null)
        {
            return Unauthorized(new { message = "Walang naka-set na PIN para sa account na ito. Pakiusap mag-login gamit ang password. / No PIN configured for this account." });
        }

        if (user.PinLockoutEnd.HasValue && user.PinLockoutEnd.Value > DateTimeOffset.UtcNow)
        {
            var remaining = Math.Max(1, (int)Math.Ceiling((user.PinLockoutEnd.Value - DateTimeOffset.UtcNow).TotalMinutes));
            return StatusCode(StatusCodes.Status429TooManyRequests, new
            {
                message = $"Naka-lockout ang PIN dahil sa sunod-sunod na maling pagsubok. Mag-login gamit ang Password o maghintay nang {remaining} minuto. / PIN locked. Use password or wait {remaining} minutes.",
                lockoutMinutes = remaining,
                pinLocked = true
            });
        }

        var verifyResult = _passwordHasher.VerifyHashedPassword(user, user.PinHash, request.Pin.Trim());
        if (verifyResult == PasswordVerificationResult.Failed)
        {
            user.FailedPinAttempts++;
            if (user.FailedPinAttempts >= 5)
            {
                user.PinLockoutEnd = DateTimeOffset.UtcNow.AddMinutes(15);
            }
            await _context.SaveChangesAsync(cancellationToken);

            if (user.FailedPinAttempts >= 5)
            {
                return StatusCode(StatusCodes.Status429TooManyRequests, new
                {
                    message = "Naka-lockout ang PIN dahil sa 5 sunod-sunod na maling pagsubok. Mag-login gamit ang Password o maghintay nang 15 minuto. / PIN locked for 15 minutes due to 5 failed attempts.",
                    lockoutMinutes = 15,
                    pinLocked = true
                });
            }

            var remainingAttempts = 5 - user.FailedPinAttempts;
            return Unauthorized(new
            {
                message = $"Maling PIN code. May natitira ka pang {remainingAttempts} pagsubok bago mag-lockout. / Invalid PIN code. {remainingAttempts} attempts remaining.",
                remainingAttempts
            });
        }

        user.FailedPinAttempts = 0;
        user.PinLockoutEnd = null;
        user.LastLoginAt = DateTimeOffset.UtcNow;
        await _context.SaveChangesAsync(cancellationToken);

        var expiresAt = DateTimeOffset.UtcNow.AddYears(1);
        var token = GenerateAuthToken(user.Id, user.TenantId, user.Email, user.Role, expiresAt);

        return Ok(new AuthResponseDto(
            user.TenantId,
            user.Id,
            user.Email,
            user.Tenant.BusinessName,
            null,
            user.Phone,
            user.Role,
            user.Tenant.Tier,
            user.Tenant.Tier.ToString(),
            user.Tenant.SubscriptionEndDate,
            !string.IsNullOrEmpty(user.PinHash),
            token,
            expiresAt
        ));
    }

    /// <summary>
    /// Updates or clears the owner's fast POS unlock PIN after password verification.
    /// </summary>
    [HttpPut("pin")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> UpdatePin(
        [FromBody] UpdatePinRequest request,
        CancellationToken cancellationToken)
    {
        var rawEmail = (request.Email ?? string.Empty).Trim();
        var normalizedEmail = rawEmail.ToLowerInvariant();

        var user = await _context.Users.IgnoreQueryFilters()
            .FirstOrDefaultAsync(u => u.NormalizedEmail == normalizedEmail, cancellationToken);

        if (user == null || string.IsNullOrEmpty(user.PasswordHash))
        {
            return Unauthorized(new { message = "Maling email o password. / Invalid email or password." });
        }

        var verifyResult = _passwordHasher.VerifyHashedPassword(user, user.PasswordHash, request.Password);
        if (verifyResult == PasswordVerificationResult.Failed)
        {
            return Unauthorized(new { message = "Maling password. / Invalid password." });
        }

        if (string.IsNullOrWhiteSpace(request.Pin))
        {
            user.PinHash = null;
        }
        else
        {
            user.PinHash = _passwordHasher.HashPassword(user, request.Pin.Trim());
        }

        user.FailedPinAttempts = 0;
        user.PinLockoutEnd = null;
        await _context.SaveChangesAsync(cancellationToken);

        return Ok(new
        {
            message = string.IsNullOrWhiteSpace(request.Pin)
                ? "Naalis ang PIN sa tindahan. / PIN cleared successfully."
                : "Matagumpay na na-update ang PIN ng tindahan. / PIN updated successfully.",
            hasPin = !string.IsNullOrEmpty(user.PinHash)
        });
    }

    private static string GenerateAuthToken(Guid userId, Guid tenantId, string email, string role, DateTimeOffset expiresAt)
    {
        var header = Convert.ToBase64String(Encoding.UTF8.GetBytes(JsonSerializer.Serialize(new { alg = "HS256", typ = "JWT" })))
            .TrimEnd('=').Replace('+', '-').Replace('/', '_');

        var payloadObj = new
        {
            sub = userId.ToString(),
            user_id = userId.ToString(),
            tenant_id = tenantId.ToString(),
            TenantId = tenantId.ToString(),
            email = email,
            role = role,
            iat = DateTimeOffset.UtcNow.ToUnixTimeSeconds(),
            exp = expiresAt.ToUnixTimeSeconds()
        };

        var payload = Convert.ToBase64String(Encoding.UTF8.GetBytes(JsonSerializer.Serialize(payloadObj)))
            .TrimEnd('=').Replace('+', '-').Replace('/', '_');

        var signature = Convert.ToBase64String(Encoding.UTF8.GetBytes($"{header}.{payload}"))
            .TrimEnd('=').Replace('+', '-').Replace('/', '_');

        return $"{header}.{payload}.{signature}";
    }
}
