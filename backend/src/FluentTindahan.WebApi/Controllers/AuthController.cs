using System.Collections.Concurrent;
using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using System.Threading;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using FluentTindahan.Application.Common.Interfaces;
using FluentTindahan.Domain.Entities;
using FluentTindahan.Domain.Enums;
using FluentTindahan.Domain.Interfaces;

namespace FluentTindahan.WebApi.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private sealed class IpPinThrottleInfo
    {
        public int FailedAttempts;
        public DateTimeOffset? LockoutEnd;
    }

    private static readonly ConcurrentDictionary<string, IpPinThrottleInfo> _ipPinThrottles = new();
    private static readonly ConcurrentDictionary<Guid, SemaphoreSlim> _userPinLocks = new();

    public static void ResetAllIpPinThrottles()
    {
        _ipPinThrottles.Clear();
    }

    public static void ResetIpPinThrottle(string clientIp)
    {
        if (!string.IsNullOrWhiteSpace(clientIp))
        {
            _ipPinThrottles.TryRemove(clientIp, out _);
        }
    }

    private string GetClientIpAddress()
    {
        var clientIp = HttpContext?.Connection?.RemoteIpAddress?.ToString();
        if (string.IsNullOrWhiteSpace(clientIp))
        {
            if (HttpContext?.Request.Headers.TryGetValue("X-Forwarded-For", out var forwardedFor) == true &&
                !string.IsNullOrWhiteSpace(forwardedFor))
            {
                clientIp = forwardedFor.ToString().Split(',')[0].Trim();
            }
            else
            {
                clientIp = "127.0.0.1";
            }
        }
        return clientIp;
    }

    private static bool IsIpPinThrottled(string clientIp, out int remainingMinutes)
    {
        remainingMinutes = 0;
        if (_ipPinThrottles.TryGetValue(clientIp, out var info))
        {
            lock (info)
            {
                if (info.LockoutEnd.HasValue)
                {
                    if (info.LockoutEnd.Value > DateTimeOffset.UtcNow)
                    {
                        remainingMinutes = Math.Max(1, (int)Math.Ceiling((info.LockoutEnd.Value - DateTimeOffset.UtcNow).TotalMinutes));
                        return true;
                    }

                    info.FailedAttempts = 0;
                    info.LockoutEnd = null;
                }
            }
        }
        return false;
    }

    private static int RecordIpPinFailure(string clientIp, out bool isNowLockedOut, out int lockoutMinutes)
    {
        var info = _ipPinThrottles.GetOrAdd(clientIp, _ => new IpPinThrottleInfo());
        lock (info)
        {
            info.FailedAttempts++;
            if (info.FailedAttempts >= 5)
            {
                info.LockoutEnd = DateTimeOffset.UtcNow.AddMinutes(15);
                isNowLockedOut = true;
                lockoutMinutes = 15;
                return info.FailedAttempts;
            }

            isNowLockedOut = false;
            lockoutMinutes = 0;
            return info.FailedAttempts;
        }
    }

    private readonly IApplicationDbContext _context;
    private readonly IJwtTokenService _jwtTokenService;
    private readonly ICurrentUserService _currentUserService;
    private readonly PasswordHasher<User> _passwordHasher;

    public AuthController(
        IApplicationDbContext context,
        IJwtTokenService jwtTokenService,
        ICurrentUserService? currentUserService = null)
    {
        _context = context;
        _jwtTokenService = jwtTokenService;
        _currentUserService = currentUserService!;
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
        [EmailAddress]
        public string? Email { get; init; }

        [Required]
        public string Password { get; init; } = string.Empty;

        [RegularExpression(@"^\d{4,6}$", ErrorMessage = "PIN must be between 4 and 6 digits.")]
        public string? Pin { get; init; }
    }

    public sealed record RefreshTokenRequest
    {
        [Required]
        public string RefreshToken { get; init; } = string.Empty;
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
        DateTimeOffset ExpiresAt,
        string? RefreshToken = null
    );

    /// <summary>
    /// Registers a new store and owner identity using email and password.
    /// Preserves client-supplied TenantId and UserId when provided to align local Dexie records.
    /// 
    /// Note on Account Enumeration:
    /// Returning HTTP 409 Conflict when an email is already registered is an intentional architectural
    /// decision for self-service retail onboarding in this offline-first environment without SMTP/email delivery.
    /// Store owners registering must be directed to log in rather than receive silent failures or generic errors.
    /// Account enumeration is mitigated at the network layer via rate limiting (AnonymousDemoProvision policy).
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
        if (request == null || !ModelState.IsValid || string.IsNullOrWhiteSpace(request.Password))
        {
            return BadRequest(ModelState.IsValid ? (object)new { message = "Kailangan ng password (minimum 6 letra). / Password is required (minimum 6 chars)." } : ModelState);
        }

        var displayEmail = CleanDisplayEmail(request.Email);
        var normalizedEmail = NormalizeEmail(request.Email);
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

        Tenant tenant;
        User user;

        if (request.TenantId.HasValue && request.TenantId.Value != Guid.Empty)
        {
            var existingTenant = await _context.Tenants.IgnoreQueryFilters()
                .FirstOrDefaultAsync(t => t.Id == tenantId, cancellationToken);

            if (existingTenant != null)
            {
                // If the tenant already exists, only accept client TenantId if tied to earlier anonymous provisioning:
                // namely, the tenant has exactly one unauthenticated placeholder user whose ID matches request.UserId
                // and has neither an email nor a password configured yet.
                var existingUsers = await _context.Users.IgnoreQueryFilters()
                    .Where(u => u.TenantId == tenantId)
                    .ToListAsync(cancellationToken);

                var isAnonymousProvisionedOwner = request.UserId.HasValue &&
                    existingUsers.Count == 1 &&
                    existingUsers[0].Id == request.UserId.Value &&
                    string.IsNullOrEmpty(existingUsers[0].PasswordHash) &&
                    string.IsNullOrEmpty(existingUsers[0].Email);

                if (!isAnonymousProvisionedOwner)
                {
                    return Conflict(new { message = "May tindahan nang nakarehistro gamit ang ID na ito. / This store is already registered." });
                }

                tenant = existingTenant;
                if (string.IsNullOrWhiteSpace(tenant.BusinessName))
                {
                    tenant.BusinessName = businessName;
                }

                // Upgrade the anonymous placeholder owner
                user = existingUsers[0];
                user.Email = displayEmail;
                user.NormalizedEmail = normalizedEmail;
                user.Phone = request.Phone?.Trim() ?? user.Phone;
                user.Role = "Owner";
                user.FailedPinAttempts = 0;
                user.PinLockoutEnd = null;
                user.FailedPasswordAttempts = 0;
                user.PasswordLockoutEnd = null;
                user.LastLoginAt = DateTimeOffset.UtcNow;
            }
            else
            {
                // Tenant does not exist yet; ensure requested UserId is not already in use
                if (request.UserId.HasValue && request.UserId.Value != Guid.Empty)
                {
                    var userIdInUse = await _context.Users.IgnoreQueryFilters()
                        .AnyAsync(u => u.Id == userId, cancellationToken);
                    if (userIdInUse)
                    {
                        return Conflict(new { message = "Ginagamit na ang user ID na ito. / The user ID is already in use." });
                    }
                }

                tenant = new Tenant
                {
                    Id = tenantId,
                    BusinessName = businessName,
                    Tier = PlanTier.Libre,
                    CreatedAt = DateTimeOffset.UtcNow
                };
                _context.Tenants.Add(tenant);

                user = new User
                {
                    Id = userId,
                    TenantId = tenantId,
                    Email = displayEmail,
                    NormalizedEmail = normalizedEmail,
                    Phone = request.Phone?.Trim() ?? string.Empty,
                    Role = "Owner",
                    FailedPinAttempts = 0,
                    PinLockoutEnd = null,
                    FailedPasswordAttempts = 0,
                    PasswordLockoutEnd = null,
                    CreatedAt = DateTimeOffset.UtcNow,
                    LastLoginAt = DateTimeOffset.UtcNow
                };
                _context.Users.Add(user);
            }
        }
        else
        {
            if (request.UserId.HasValue && request.UserId.Value != Guid.Empty)
            {
                var userIdInUse = await _context.Users.IgnoreQueryFilters()
                    .AnyAsync(u => u.Id == userId, cancellationToken);
                if (userIdInUse)
                {
                    return Conflict(new { message = "Ginagamit na ang user ID na ito. / The user ID is already in use." });
                }
            }

            tenant = new Tenant
            {
                Id = tenantId,
                BusinessName = businessName,
                Tier = PlanTier.Libre,
                CreatedAt = DateTimeOffset.UtcNow
            };
            _context.Tenants.Add(tenant);

            user = new User
            {
                Id = userId,
                TenantId = tenantId,
                Email = displayEmail,
                NormalizedEmail = normalizedEmail,
                Phone = request.Phone?.Trim() ?? string.Empty,
                Role = "Owner",
                FailedPinAttempts = 0,
                PinLockoutEnd = null,
                FailedPasswordAttempts = 0,
                PasswordLockoutEnd = null,
                CreatedAt = DateTimeOffset.UtcNow,
                LastLoginAt = DateTimeOffset.UtcNow
            };
            _context.Users.Add(user);
        }

        user.PasswordHash = _passwordHasher.HashPassword(user, request.Password);
        if (!string.IsNullOrWhiteSpace(request.Pin))
        {
            user.PinHash = _passwordHasher.HashPassword(user, request.Pin.Trim());
        }
        else
        {
            user.PinHash = null;
        }

        try
        {
            await _context.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException ex) when (IsUniqueEmailViolation(ex))
        {
            _context.ChangeTracker.Clear();
            return Conflict(new { message = "May tindahan nang nakarehistro gamit ang email na ito. Pakipili ang Mag-login. / A store is already registered with this email." });
        }
        catch (DbUpdateException ex) when (IsUniqueConstraintViolation(ex))
        {
            _context.ChangeTracker.Clear();
            return Conflict(new { message = "May tindahan o user nang nakarehistro gamit ang ID na ito. / A store or user is already registered with this ID." });
        }

        var (token, expiresAt) = _jwtTokenService.GenerateAccessToken(user.Id, tenant.Id);
        var (refreshToken, _) = _jwtTokenService.GenerateRefreshToken(user.Id, tenant.Id);

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
            expiresAt,
            refreshToken
        ));
    }

    /// <summary>
    /// Logs in an existing store owner using email and password.
    /// Bypasses multi-tenant filters via .IgnoreQueryFilters() to locate the store across tenants.
    /// Protects against brute-force attacks via rate limiting and password lockout after 5 failures for 15 minutes.
    /// </summary>
    [HttpPost("login")]
    [EnableRateLimiting("AuthSensitive")]
    [ProducesResponseType(typeof(AuthResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<ActionResult<AuthResponseDto>> Login(
        [FromBody] LoginRequest request,
        CancellationToken cancellationToken)
    {
        if (request == null || !ModelState.IsValid || string.IsNullOrWhiteSpace(request.Password))
        {
            return BadRequest(ModelState.IsValid ? (object)new { message = "Kailangan ng password. / Password is required." } : ModelState);
        }

        var normalizedEmail = NormalizeEmail(request.Email);
        if (string.IsNullOrWhiteSpace(normalizedEmail))
        {
            return Unauthorized(new { message = "Maling email o password. / Invalid email or password." });
        }

        var user = await _context.Users.IgnoreQueryFilters()
            .Include(u => u.Tenant)
            .FirstOrDefaultAsync(u => u.NormalizedEmail == normalizedEmail, cancellationToken);

        if (user == null || string.IsNullOrEmpty(user.PasswordHash) || user.Tenant == null)
        {
            return Unauthorized(new { message = "Maling email o password. / Invalid email or password." });
        }

        if (user.PasswordLockoutEnd.HasValue && user.PasswordLockoutEnd.Value > DateTimeOffset.UtcNow)
        {
            var remaining = Math.Max(1, (int)Math.Ceiling((user.PasswordLockoutEnd.Value - DateTimeOffset.UtcNow).TotalMinutes));
            return StatusCode(StatusCodes.Status429TooManyRequests, new
            {
                message = $"Naka-lockout ang account dahil sa sunod-sunod na maling pagsubok sa password. Maghintay nang {remaining} minuto. / Account locked due to repeated failed password attempts. Wait {remaining} minutes.",
                lockoutMinutes = remaining,
                accountLocked = true
            });
        }

        var verifyResult = _passwordHasher.VerifyHashedPassword(user, user.PasswordHash, request.Password);
        if (verifyResult == PasswordVerificationResult.Failed)
        {
            user.FailedPasswordAttempts++;
            if (user.FailedPasswordAttempts >= 5)
            {
                user.PasswordLockoutEnd = DateTimeOffset.UtcNow.AddMinutes(15);
            }
            await _context.SaveChangesAsync(cancellationToken);

            if (user.FailedPasswordAttempts >= 5)
            {
                return StatusCode(StatusCodes.Status429TooManyRequests, new
                {
                    message = "Naka-lockout ang account dahil sa 5 sunod-sunod na maling pagsubok sa password. Maghintay nang 15 minuto. / Account locked for 15 minutes due to 5 failed password attempts.",
                    lockoutMinutes = 15,
                    accountLocked = true
                });
            }

            var remainingAttempts = 5 - user.FailedPasswordAttempts;
            return Unauthorized(new
            {
                message = $"Maling email o password. May natitira ka pang {remainingAttempts} pagsubok bago mag-lockout. / Invalid email or password. {remainingAttempts} attempts remaining.",
                remainingAttempts
            });
        }

        if (verifyResult == PasswordVerificationResult.SuccessRehashNeeded)
        {
            user.PasswordHash = _passwordHasher.HashPassword(user, request.Password);
        }

        user.FailedPasswordAttempts = 0;
        user.PasswordLockoutEnd = null;
        user.FailedPinAttempts = 0;
        user.PinLockoutEnd = null;
        user.LastLoginAt = DateTimeOffset.UtcNow;
        await _context.SaveChangesAsync(cancellationToken);
        ResetIpPinThrottle(GetClientIpAddress());

        var (token, expiresAt) = _jwtTokenService.GenerateAccessToken(user.Id, user.TenantId);
        var (refreshToken, _) = _jwtTokenService.GenerateRefreshToken(user.Id, user.TenantId);

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
            expiresAt,
            refreshToken
        ));
    }

    /// <summary>
    /// Fast till login/unlock using email and 4-6 digit numeric PIN.
    /// Protects against brute-force attacks via per-IP throttling alongside per-account lockout (5 failures = 15 minutes lockout),
    /// and atomic/concurrency-protected failure counter updates to prevent parallel bypass.
    /// 
    /// Note on Account Enumeration:
    /// Returns a unified generic response ("Maling email o PIN code. / Invalid email or PIN code.") for non-existent emails,
    /// accounts with no PIN configured, and invalid PIN entries to prevent account enumeration.
    /// </summary>
    [HttpPost("login-pin")]
    [EnableRateLimiting("PinLogin")]
    [ProducesResponseType(typeof(AuthResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<ActionResult<AuthResponseDto>> LoginPin(
        [FromBody] LoginPinRequest request,
        CancellationToken cancellationToken)
    {
        if (request == null || !ModelState.IsValid || string.IsNullOrWhiteSpace(request.Pin))
        {
            return BadRequest(ModelState.IsValid ? (object)new { message = "Kailangan ng 4-6 digit numeric PIN. / 4-6 digit numeric PIN is required." } : ModelState);
        }

        var clientIp = GetClientIpAddress();

        if (IsIpPinThrottled(clientIp, out var ipRemainingMinutes))
        {
            return StatusCode(StatusCodes.Status429TooManyRequests, new
            {
                message = $"Naka-lockout ang iyong IP address dahil sa sunod-sunod na maling pagsubok sa PIN. Maghintay nang {ipRemainingMinutes} minuto. / IP address throttled due to repeated failed PIN attempts. Wait {ipRemainingMinutes} minutes.",
                lockoutMinutes = ipRemainingMinutes,
                ipThrottled = true
            });
        }

        var normalizedEmail = NormalizeEmail(request.Email);
        if (string.IsNullOrWhiteSpace(normalizedEmail))
        {
            RecordIpPinFailure(clientIp, out var ipLockedOut, out var ipLockMinutes);
            if (ipLockedOut)
            {
                return StatusCode(StatusCodes.Status429TooManyRequests, new
                {
                    message = $"Naka-lockout ang iyong IP address dahil sa 5 sunod-sunod na maling pagsubok sa PIN. Maghintay nang {ipLockMinutes} minuto. / IP address throttled for 15 minutes due to 5 failed PIN attempts.",
                    lockoutMinutes = ipLockMinutes,
                    ipThrottled = true
                });
            }
            return Unauthorized(new { message = "Maling email o PIN. / Invalid email or PIN." });
        }

        var user = await _context.Users.IgnoreQueryFilters()
            .Include(u => u.Tenant)
            .FirstOrDefaultAsync(u => u.NormalizedEmail == normalizedEmail, cancellationToken);

        if (user == null || string.IsNullOrEmpty(user.PinHash) || user.Tenant == null)
        {
            RecordIpPinFailure(clientIp, out var ipLockedOut, out var ipLockMinutes);
            if (ipLockedOut)
            {
                return StatusCode(StatusCodes.Status429TooManyRequests, new
                {
                    message = $"Naka-lockout ang iyong IP address dahil sa 5 sunod-sunod na maling pagsubok sa PIN. Maghintay nang {ipLockMinutes} minuto. / IP address throttled for 15 minutes due to 5 failed PIN attempts.",
                    lockoutMinutes = ipLockMinutes,
                    ipThrottled = true
                });
            }

            return Unauthorized(new { message = "Maling email o PIN code. / Invalid email or PIN code." });
        }

        var userLock = _userPinLocks.GetOrAdd(user.Id, _ => new SemaphoreSlim(1, 1));
        await userLock.WaitAsync(cancellationToken);
        try
        {
            var freshUser = await _context.Users.IgnoreQueryFilters()
                .Include(u => u.Tenant)
                .FirstOrDefaultAsync(u => u.Id == user.Id, cancellationToken);

            if (freshUser == null || freshUser.Tenant == null || string.IsNullOrEmpty(freshUser.PinHash))
            {
                return Unauthorized(new { message = "Maling email o PIN code. / Invalid email or PIN code." });
            }

            if (freshUser.PasswordLockoutEnd.HasValue && freshUser.PasswordLockoutEnd.Value > DateTimeOffset.UtcNow)
            {
                var remaining = Math.Max(1, (int)Math.Ceiling((freshUser.PasswordLockoutEnd.Value - DateTimeOffset.UtcNow).TotalMinutes));
                return StatusCode(StatusCodes.Status429TooManyRequests, new
                {
                    message = $"Naka-lockout ang account dahil sa sunod-sunod na maling pagsubok sa password. Maghintay nang {remaining} minuto. / Account locked due to repeated failed password attempts. Wait {remaining} minutes.",
                    lockoutMinutes = remaining,
                    accountLocked = true
                });
            }

            if (freshUser.PinLockoutEnd.HasValue && freshUser.PinLockoutEnd.Value > DateTimeOffset.UtcNow)
            {
                var remaining = Math.Max(1, (int)Math.Ceiling((freshUser.PinLockoutEnd.Value - DateTimeOffset.UtcNow).TotalMinutes));
                return StatusCode(StatusCodes.Status429TooManyRequests, new
                {
                    message = $"Naka-lockout ang PIN dahil sa sunod-sunod na maling pagsubok. Mag-login gamit ang Password o maghintay nang {remaining} minuto. / PIN locked. Use password or wait {remaining} minutes.",
                    lockoutMinutes = remaining,
                    pinLocked = true
                });
            }

            var pin = (request.Pin ?? string.Empty).Trim();
            var verifyResult = _passwordHasher.VerifyHashedPassword(freshUser, freshUser.PinHash, pin);
            if (verifyResult == PasswordVerificationResult.Failed)
            {
                RecordIpPinFailure(clientIp, out var ipLockedOut, out var ipLockMinutes);

                if (_context.Database.IsNpgsql())
                {
                    var lockoutTime = DateTimeOffset.UtcNow.AddMinutes(15);
                    await _context.Users.IgnoreQueryFilters()
                        .Where(u => u.Id == freshUser.Id)
                        .ExecuteUpdateAsync(s => s
                            .SetProperty(u => u.FailedPinAttempts, u => u.FailedPinAttempts + 1)
                            .SetProperty(u => u.PinLockoutEnd, u => u.FailedPinAttempts + 1 >= 5 ? lockoutTime : u.PinLockoutEnd),
                            cancellationToken);

                    var updated = await _context.Users.IgnoreQueryFilters()
                        .AsNoTracking()
                        .Where(u => u.Id == freshUser.Id)
                        .Select(u => new { u.FailedPinAttempts, u.PinLockoutEnd })
                        .FirstAsync(cancellationToken);

                    freshUser.FailedPinAttempts = updated.FailedPinAttempts;
                    freshUser.PinLockoutEnd = updated.PinLockoutEnd;
                }
                else
                {
                    freshUser.FailedPinAttempts++;
                    if (freshUser.FailedPinAttempts >= 5)
                    {
                        freshUser.PinLockoutEnd = DateTimeOffset.UtcNow.AddMinutes(15);
                    }
                    await _context.SaveChangesAsync(cancellationToken);
                }

                if (ipLockedOut)
                {
                    return StatusCode(StatusCodes.Status429TooManyRequests, new
                    {
                        message = $"Naka-lockout ang iyong IP address dahil sa 5 sunod-sunod na maling pagsubok sa PIN. Maghintay nang {ipLockMinutes} minuto. / IP address throttled for 15 minutes due to 5 failed PIN attempts.",
                        lockoutMinutes = ipLockMinutes,
                        ipThrottled = true
                    });
                }

                if (freshUser.FailedPinAttempts >= 5)
                {
                    return StatusCode(StatusCodes.Status429TooManyRequests, new
                    {
                        message = "Naka-lockout ang PIN dahil sa 5 sunod-sunod na maling pagsubok. Mag-login gamit ang Password o maghintay nang 15 minuto. / PIN locked for 15 minutes due to 5 failed attempts.",
                        lockoutMinutes = 15,
                        pinLocked = true
                    });
                }

                var remainingAttempts = 5 - freshUser.FailedPinAttempts;
                return Unauthorized(new
                {
                    message = $"Maling email o PIN code. May natitira ka pang {remainingAttempts} pagsubok bago mag-lockout. / Invalid email or PIN code. {remainingAttempts} attempts remaining.",
                    remainingAttempts
                });
            }

            ResetIpPinThrottle(clientIp);

            if (_context.Database.IsNpgsql())
            {
                var now = DateTimeOffset.UtcNow;
                await _context.Users.IgnoreQueryFilters()
                    .Where(u => u.Id == freshUser.Id)
                    .ExecuteUpdateAsync(s => s
                        .SetProperty(u => u.FailedPinAttempts, 0)
                        .SetProperty(u => u.PinLockoutEnd, (DateTimeOffset?)null)
                        .SetProperty(u => u.LastLoginAt, now),
                        cancellationToken);
            }
            else
            {
                freshUser.FailedPinAttempts = 0;
                freshUser.PinLockoutEnd = null;
                freshUser.LastLoginAt = DateTimeOffset.UtcNow;
                await _context.SaveChangesAsync(cancellationToken);
            }

            var (token, expiresAt) = _jwtTokenService.GenerateAccessToken(freshUser.Id, freshUser.TenantId);
            var (refreshToken, _) = _jwtTokenService.GenerateRefreshToken(freshUser.Id, freshUser.TenantId);

            return Ok(new AuthResponseDto(
                freshUser.TenantId,
                freshUser.Id,
                freshUser.Email,
                freshUser.Tenant.BusinessName,
                null,
                freshUser.Phone,
                freshUser.Role,
                freshUser.Tenant.Tier,
                freshUser.Tenant.Tier.ToString(),
                freshUser.Tenant.SubscriptionEndDate,
                !string.IsNullOrEmpty(freshUser.PinHash),
                token,
                expiresAt,
                refreshToken
            ));
        }
        finally
        {
            userLock.Release();
        }
    }

    /// <summary>
    /// Updates or clears the owner's fast POS unlock PIN after password verification.
    /// Requires an authenticated session; user is resolved from JWT claims.
    /// Protects against brute-force attacks via rate limiting and password lockout after 5 failures for 15 minutes.
    /// </summary>
    [Authorize]
    [EnableRateLimiting("AuthSensitive")]
    [HttpPut("pin")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> UpdatePin(
        [FromBody] UpdatePinRequest request,
        CancellationToken cancellationToken)
    {
        if (request == null || !ModelState.IsValid || string.IsNullOrWhiteSpace(request.Password))
        {
            return BadRequest(ModelState.IsValid ? (object)new { message = "Kailangan ng password. / Password is required." } : ModelState);
        }

        var userId = _currentUserService?.UserId;
        if (!userId.HasValue || userId == Guid.Empty)
        {
            var userPrincipal = HttpContext?.User;
            var sub = userPrincipal?.FindFirst(ClaimTypes.NameIdentifier)?.Value
                ?? userPrincipal?.FindFirst("sub")?.Value
                ?? userPrincipal?.FindFirst("user_id")?.Value;
            if (Guid.TryParse(sub, out var parsedSub) && parsedSub != Guid.Empty)
            {
                userId = parsedSub;
            }
        }

        if (!userId.HasValue || userId == Guid.Empty)
        {
            return Unauthorized(new { message = "User is not authenticated." });
        }

        var user = await _context.Users.IgnoreQueryFilters()
            .FirstOrDefaultAsync(u => u.Id == userId.Value, cancellationToken);

        if (user == null || string.IsNullOrEmpty(user.PasswordHash))
        {
            return Unauthorized(new { message = "Hindi natagpuan ang account o walang password. / User not found or password not configured." });
        }

        if (user.PasswordLockoutEnd.HasValue && user.PasswordLockoutEnd.Value > DateTimeOffset.UtcNow)
        {
            var remaining = Math.Max(1, (int)Math.Ceiling((user.PasswordLockoutEnd.Value - DateTimeOffset.UtcNow).TotalMinutes));
            return StatusCode(StatusCodes.Status429TooManyRequests, new
            {
                message = $"Naka-lockout ang account dahil sa sunod-sunod na maling pagsubok sa password. Maghintay nang {remaining} minuto. / Account locked due to repeated failed password attempts. Wait {remaining} minutes.",
                lockoutMinutes = remaining,
                accountLocked = true
            });
        }

        var verifyResult = _passwordHasher.VerifyHashedPassword(user, user.PasswordHash, request.Password);
        if (verifyResult == PasswordVerificationResult.Failed)
        {
            user.FailedPasswordAttempts++;
            if (user.FailedPasswordAttempts >= 5)
            {
                user.PasswordLockoutEnd = DateTimeOffset.UtcNow.AddMinutes(15);
            }
            await _context.SaveChangesAsync(cancellationToken);

            if (user.FailedPasswordAttempts >= 5)
            {
                return StatusCode(StatusCodes.Status429TooManyRequests, new
                {
                    message = "Naka-lockout ang account dahil sa 5 sunod-sunod na maling pagsubok sa password. Maghintay nang 15 minuto. / Account locked for 15 minutes due to 5 failed password attempts.",
                    lockoutMinutes = 15,
                    accountLocked = true
                });
            }

            var remainingAttempts = 5 - user.FailedPasswordAttempts;
            return Unauthorized(new
            {
                message = $"Maling password. May natitira ka pang {remainingAttempts} pagsubok bago mag-lockout. / Invalid password. {remainingAttempts} attempts remaining.",
                remainingAttempts
            });
        }

        if (verifyResult == PasswordVerificationResult.SuccessRehashNeeded)
        {
            user.PasswordHash = _passwordHasher.HashPassword(user, request.Password);
        }

        user.FailedPasswordAttempts = 0;
        user.PasswordLockoutEnd = null;

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
        ResetIpPinThrottle(GetClientIpAddress());

        return Ok(new
        {
            message = string.IsNullOrWhiteSpace(request.Pin)
                ? "Naalis ang PIN sa tindahan. / PIN cleared successfully."
                : "Matagumpay na na-update ang PIN ng tindahan. / PIN updated successfully.",
            hasPin = !string.IsNullOrEmpty(user.PinHash)
        });
    }

    /// <summary>
    /// Renews an expired or expiring access token using a valid signed refresh token.
    /// Validates HMAC-SHA256 signature, expiry, and user existence in database.
    /// </summary>
    [HttpPost("refresh")]
    [EnableRateLimiting("AuthSensitive")]
    [ProducesResponseType(typeof(AuthResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<AuthResponseDto>> Refresh(
        [FromBody] RefreshTokenRequest request,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.RefreshToken) ||
            !_jwtTokenService.ValidateRefreshToken(request.RefreshToken, out var userId, out var tenantId))
        {
            return Unauthorized(new { message = "Di-wasto o paso na ang session. Pakiusap mag-login muli. / Invalid or expired refresh token." });
        }

        var user = await _context.Users.IgnoreQueryFilters()
            .Include(u => u.Tenant)
            .FirstOrDefaultAsync(u => u.Id == userId && u.TenantId == tenantId, cancellationToken);

        if (user == null || user.Tenant == null)
        {
            return Unauthorized(new { message = "Hindi natagpuan ang account. / Account not found." });
        }

        var (token, expiresAt) = _jwtTokenService.GenerateAccessToken(user.Id, user.TenantId);
        var (newRefreshToken, _) = _jwtTokenService.GenerateRefreshToken(user.Id, user.TenantId);

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
            expiresAt,
            newRefreshToken
        ));
    }

    /// <summary>
    /// Cleans an email for display: applies Unicode NFKC normalization, removes invisible
    /// control/zero-width formatting characters, and trims Unicode whitespace. Preserves original letter case.
    /// </summary>
    public static string CleanDisplayEmail(string? email)
    {
        if (string.IsNullOrWhiteSpace(email))
        {
            return string.Empty;
        }

        var normalized = email.Normalize(NormalizationForm.FormKC);
        var sb = new StringBuilder(normalized.Length);
        foreach (var ch in normalized)
        {
            // Strip zero-width, bidirectional formatting, and invisible control characters:
            // \u200B: zero-width space
            // \u200C: zero-width non-joiner
            // \u200D: zero-width joiner
            // \uFEFF: zero-width no-break space (BOM)
            // \u200E / \u200F: left-to-right / right-to-left marks
            if (ch == '\u200B' ||
                ch == '\u200C' ||
                ch == '\u200D' ||
                ch == '\uFEFF' ||
                ch == '\u200E' ||
                ch == '\u200F' ||
                char.IsControl(ch))
            {
                continue;
            }

            sb.Append(ch);
        }

        return sb.ToString().Trim();
    }

    /// <summary>
    /// Normalizes an email address using Unicode NFKC normalization, stripping invisible
    /// control/zero-width formatting characters, trimming Unicode whitespace, and converting to invariant lowercase.
    /// Used for unique indexing and collision-free identity lookup.
    /// </summary>
    public static string NormalizeEmail(string? email)
    {
        return CleanDisplayEmail(email).ToLowerInvariant();
    }

    /// <summary>
    /// Checks if a DbUpdateException represents a unique index violation on NormalizedEmail.
    /// </summary>
    public static bool IsUniqueEmailViolation(DbUpdateException exception)
    {
        for (Exception? current = exception; current != null; current = current.InnerException)
        {
            if (current is PostgresException postgresException
                && postgresException.SqlState == PostgresErrorCodes.UniqueViolation)
            {
                if (string.IsNullOrEmpty(postgresException.ConstraintName) ||
                    postgresException.ConstraintName.Equals(FluentTindahan.Domain.Entities.User.NormalizedEmailUniqueIndexName, StringComparison.OrdinalIgnoreCase) ||
                    postgresException.ConstraintName.Contains("NormalizedEmail", StringComparison.OrdinalIgnoreCase))
                {
                    return true;
                }
            }

            var message = current.Message;
            if (message.Contains(FluentTindahan.Domain.Entities.User.NormalizedEmailUniqueIndexName, StringComparison.OrdinalIgnoreCase) ||
                (message.Contains("23505", StringComparison.OrdinalIgnoreCase) && message.Contains("NormalizedEmail", StringComparison.OrdinalIgnoreCase)) ||
                (message.Contains("duplicate key", StringComparison.OrdinalIgnoreCase) && message.Contains("NormalizedEmail", StringComparison.OrdinalIgnoreCase)))
            {
                return true;
            }
        }

        return false;
    }

    /// <summary>
    /// Checks if a DbUpdateException represents any general unique constraint violation.
    /// </summary>
    public static bool IsUniqueConstraintViolation(DbUpdateException exception)
    {
        for (Exception? current = exception; current != null; current = current.InnerException)
        {
            if (current is PostgresException postgresException
                && postgresException.SqlState == PostgresErrorCodes.UniqueViolation)
            {
                return true;
            }

            var message = current.Message;
            if (message.Contains("23505", StringComparison.OrdinalIgnoreCase) ||
                message.Contains("duplicate key", StringComparison.OrdinalIgnoreCase) ||
                message.Contains("unique constraint", StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }
        }

        return false;
    }
}
