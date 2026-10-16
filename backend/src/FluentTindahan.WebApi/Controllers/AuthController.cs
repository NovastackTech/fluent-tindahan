using System.Collections.Concurrent;
using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using System.Security.Cryptography;
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
            if (info.LockoutEnd.HasValue && info.LockoutEnd.Value <= DateTimeOffset.UtcNow)
            {
                info.FailedAttempts = 0;
                info.LockoutEnd = null;
            }

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
    private readonly TimeProvider _timeProvider;

    public const int DefaultGraceWindowSeconds = 30;

    public AuthController(
        IApplicationDbContext context,
        IJwtTokenService jwtTokenService,
        ICurrentUserService? currentUserService = null,
        TimeProvider? timeProvider = null)
    {
        _context = context;
        _jwtTokenService = jwtTokenService;
        _currentUserService = currentUserService!;
        _passwordHasher = new PasswordHasher<User>();
        _timeProvider = timeProvider ?? TimeProvider.System;
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
        public string? RefreshToken { get; init; }
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

    public sealed record LogoutRequest
    {
        public string? RefreshToken { get; init; }
    }

    public sealed record ChangePasswordRequest
    {
        [Required]
        public string CurrentPassword { get; init; } = string.Empty;

        [Required, MinLength(6, ErrorMessage = "Password must be at least 6 characters.")]
        public string NewPassword { get; init; } = string.Empty;
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

                // Security invariant: Only allow the upgrade from a request authenticated as that placeholder user,
                // or from the same device session, not from IDs alone.
                var placeholderUser = existingUsers[0];

                var claimUserId = _currentUserService?.UserId;
                if (!claimUserId.HasValue || claimUserId == Guid.Empty)
                {
                    var userPrincipal = HttpContext?.User;
                    var sub = userPrincipal?.FindFirst(ClaimTypes.NameIdentifier)?.Value
                        ?? userPrincipal?.FindFirst("sub")?.Value
                        ?? userPrincipal?.FindFirst("user_id")?.Value;
                    if (Guid.TryParse(sub, out var parsedSub) && parsedSub != Guid.Empty)
                    {
                        claimUserId = parsedSub;
                    }
                }

                var claimTenantId = _currentUserService?.TenantId;
                if (!claimTenantId.HasValue || claimTenantId == Guid.Empty)
                {
                    var userPrincipal = HttpContext?.User;
                    var tClaim = userPrincipal?.FindFirst("tenant_id")?.Value
                        ?? userPrincipal?.FindFirst("TenantId")?.Value;
                    if (Guid.TryParse(tClaim, out var parsedTenant) && parsedTenant != Guid.Empty)
                    {
                        claimTenantId = parsedTenant;
                    }
                }

                var isAuthenticated = (_currentUserService != null && _currentUserService.IsAuthenticated)
                    || (HttpContext?.User?.Identity?.IsAuthenticated == true);

                var isCallerAuthenticatedAsPlaceholder = isAuthenticated &&
                    claimUserId.HasValue &&
                    claimUserId.Value == placeholderUser.Id &&
                    claimTenantId.HasValue &&
                    claimTenantId.Value == tenantId;

                var isSameDeviceSession = false;

                var candidateSessionToken = request.RefreshToken
                    ?? (Request?.Headers.TryGetValue("X-Refresh-Token", out var rtHeader) == true ? rtHeader.ToString() : null);

                if (!string.IsNullOrWhiteSpace(candidateSessionToken))
                {
                    if (_jwtTokenService.ValidateRefreshToken(candidateSessionToken, out var sessionUserId, out var sessionTenantId, out var sessionTokenId))
                    {
                        if (sessionUserId == placeholderUser.Id && sessionTenantId == tenantId)
                        {
                            var incomingTokenIdHash = _jwtTokenService.HashTokenId(sessionTokenId);
                            var matchesTable = await _context.UserRefreshTokens.IgnoreQueryFilters()
                                .AnyAsync(r => r.UserId == placeholderUser.Id && r.TokenHash == incomingTokenIdHash && !r.IsRevoked, cancellationToken);

                            if (matchesTable)
                            {
                                isSameDeviceSession = true;
                            }
                            else if (!string.IsNullOrEmpty(placeholderUser.RefreshTokenIdHash))
                            {
                                isSameDeviceSession = CryptographicOperations.FixedTimeEquals(
                                    Encoding.UTF8.GetBytes(placeholderUser.RefreshTokenIdHash),
                                    Encoding.UTF8.GetBytes(incomingTokenIdHash));
                            }
                            else
                            {
                                isSameDeviceSession = true;
                            }
                        }
                    }
                }

                if (!isCallerAuthenticatedAsPlaceholder && !isSameDeviceSession)
                {
                    return Unauthorized(new
                    {
                        message = "Hindi pinapayagan ang pag-upgrade ng tindahang ito nang walang authenticated session mula sa parehong device. / Upgrading this store is only allowed from an authenticated session from the same device, not from IDs alone."
                    });
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

        var (token, expiresAt) = _jwtTokenService.GenerateAccessToken(user.Id, tenant.Id, email: user.Email, role: user.Role);
        var (refreshToken, refreshExpiresAt, tokenId, familyId) = _jwtTokenService.GenerateRefreshToken(user.Id, tenant.Id, null, null);
        user.RefreshTokenIdHash = _jwtTokenService.HashTokenId(tokenId);
        user.RefreshTokenExpiresAt = refreshExpiresAt;

        _context.UserRefreshTokens.Add(new UserRefreshToken
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            TenantId = tenant.Id,
            FamilyId = familyId,
            TokenHash = user.RefreshTokenIdHash,
            ExpiresAt = refreshExpiresAt,
            CreatedAt = _timeProvider.GetUtcNow()
        });

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

        if (user.PasswordLockoutEnd.HasValue)
        {
            if (user.PasswordLockoutEnd.Value > DateTimeOffset.UtcNow)
            {
                var remaining = Math.Max(1, (int)Math.Ceiling((user.PasswordLockoutEnd.Value - DateTimeOffset.UtcNow).TotalMinutes));
                return StatusCode(StatusCodes.Status429TooManyRequests, new
                {
                    message = $"Naka-lockout ang account dahil sa sunod-sunod na maling pagsubok sa password. Maghintay nang {remaining} minuto. / Account locked due to repeated failed password attempts. Wait {remaining} minutes.",
                    lockoutMinutes = remaining,
                    accountLocked = true
                });
            }

            user.FailedPasswordAttempts = 0;
            user.PasswordLockoutEnd = null;
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
        user.LastLoginAt = _timeProvider.GetUtcNow();

        var (token, expiresAt) = _jwtTokenService.GenerateAccessToken(user.Id, user.TenantId, email: user.Email, role: user.Role);
        var (refreshToken, refreshExpiresAt, tokenId, familyId) = _jwtTokenService.GenerateRefreshToken(user.Id, user.TenantId, null, null);
        user.RefreshTokenIdHash = _jwtTokenService.HashTokenId(tokenId);
        user.RefreshTokenExpiresAt = refreshExpiresAt;

        _context.UserRefreshTokens.Add(new UserRefreshToken
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            TenantId = user.TenantId,
            FamilyId = familyId,
            TokenHash = user.RefreshTokenIdHash,
            ExpiresAt = refreshExpiresAt,
            CreatedAt = _timeProvider.GetUtcNow()
        });

        await _context.SaveChangesAsync(cancellationToken);
        ResetIpPinThrottle(GetClientIpAddress());

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

            if (freshUser.PasswordLockoutEnd.HasValue)
            {
                if (freshUser.PasswordLockoutEnd.Value > DateTimeOffset.UtcNow)
                {
                    var remaining = Math.Max(1, (int)Math.Ceiling((freshUser.PasswordLockoutEnd.Value - DateTimeOffset.UtcNow).TotalMinutes));
                    return StatusCode(StatusCodes.Status429TooManyRequests, new
                    {
                        message = $"Naka-lockout ang account dahil sa sunod-sunod na maling pagsubok sa password. Maghintay nang {remaining} minuto. / Account locked due to repeated failed password attempts. Wait {remaining} minutes.",
                        lockoutMinutes = remaining,
                        accountLocked = true
                    });
                }

                freshUser.FailedPasswordAttempts = 0;
                freshUser.PasswordLockoutEnd = null;
            }

            if (freshUser.PinLockoutEnd.HasValue)
            {
                if (freshUser.PinLockoutEnd.Value > DateTimeOffset.UtcNow)
                {
                    var remaining = Math.Max(1, (int)Math.Ceiling((freshUser.PinLockoutEnd.Value - DateTimeOffset.UtcNow).TotalMinutes));
                    return StatusCode(StatusCodes.Status429TooManyRequests, new
                    {
                        message = $"Naka-lockout ang PIN dahil sa sunod-sunod na maling pagsubok. Mag-login gamit ang Password o maghintay nang {remaining} minuto. / PIN locked. Use password or wait {remaining} minutes.",
                        lockoutMinutes = remaining,
                        pinLocked = true
                    });
                }

                freshUser.FailedPinAttempts = 0;
                freshUser.PinLockoutEnd = null;
                if (_context.Database.IsNpgsql())
                {
                    await _context.Users.IgnoreQueryFilters()
                        .Where(u => u.Id == freshUser.Id)
                        .ExecuteUpdateAsync(s => s
                            .SetProperty(u => u.FailedPinAttempts, 0)
                            .SetProperty(u => u.PinLockoutEnd, (DateTimeOffset?)null),
                            cancellationToken);
                }
                else
                {
                    await _context.SaveChangesAsync(cancellationToken);
                }
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

            var (token, expiresAt) = _jwtTokenService.GenerateAccessToken(freshUser.Id, freshUser.TenantId, email: freshUser.Email, role: freshUser.Role);
            var (refreshToken, refreshExpiresAt, tokenId, familyId) = _jwtTokenService.GenerateRefreshToken(freshUser.Id, freshUser.TenantId, null, null);
            var tokenHash = _jwtTokenService.HashTokenId(tokenId);
            var now = _timeProvider.GetUtcNow();

            _context.UserRefreshTokens.Add(new UserRefreshToken
            {
                Id = Guid.NewGuid(),
                UserId = freshUser.Id,
                TenantId = freshUser.TenantId,
                FamilyId = familyId,
                TokenHash = tokenHash,
                ExpiresAt = refreshExpiresAt,
                CreatedAt = now
            });

            if (_context.Database.IsNpgsql())
            {
                await _context.Users.IgnoreQueryFilters()
                    .Where(u => u.Id == freshUser.Id)
                    .ExecuteUpdateAsync(s => s
                        .SetProperty(u => u.FailedPinAttempts, 0)
                        .SetProperty(u => u.PinLockoutEnd, (DateTimeOffset?)null)
                        .SetProperty(u => u.LastLoginAt, now)
                        .SetProperty(u => u.RefreshTokenIdHash, tokenHash)
                        .SetProperty(u => u.RefreshTokenExpiresAt, refreshExpiresAt),
                        cancellationToken);
                await _context.SaveChangesAsync(cancellationToken);
            }
            else
            {
                freshUser.FailedPinAttempts = 0;
                freshUser.PinLockoutEnd = null;
                freshUser.LastLoginAt = now;
                freshUser.RefreshTokenIdHash = tokenHash;
                freshUser.RefreshTokenExpiresAt = refreshExpiresAt;
                await _context.SaveChangesAsync(cancellationToken);
            }

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

        if (user.PasswordLockoutEnd.HasValue)
        {
            if (user.PasswordLockoutEnd.Value > DateTimeOffset.UtcNow)
            {
                var remaining = Math.Max(1, (int)Math.Ceiling((user.PasswordLockoutEnd.Value - DateTimeOffset.UtcNow).TotalMinutes));
                return StatusCode(StatusCodes.Status429TooManyRequests, new
                {
                    message = $"Naka-lockout ang account dahil sa sunod-sunod na maling pagsubok sa password. Maghintay nang {remaining} minuto. / Account locked due to repeated failed password attempts. Wait {remaining} minutes.",
                    lockoutMinutes = remaining,
                    accountLocked = true
                });
            }

            user.FailedPasswordAttempts = 0;
            user.PasswordLockoutEnd = null;
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

        // Invalidate existing refresh tokens upon PIN change/removal
        var allTokens = await _context.UserRefreshTokens.IgnoreQueryFilters()
            .Where(r => r.UserId == user.Id)
            .ToListAsync(cancellationToken);
        foreach (var tok in allTokens)
        {
            tok.IsRevoked = true;
            tok.RevokedAt = _timeProvider.GetUtcNow();
        }
        user.RefreshTokenIdHash = null;
        user.RefreshTokenExpiresAt = null;

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
    /// Tracks refresh token families per device in UserRefreshTokens table.
    /// Implements single-use token rotation: rotates refresh token on every successful use,
    /// allows a short grace window for the previous token (transient network glitch), and
    /// revokes only the affected family on reuse.
    /// </summary>
    [HttpPost("refresh")]
    [EnableRateLimiting("AuthSensitive")]
    [ProducesResponseType(typeof(AuthResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<AuthResponseDto>> Refresh(
        [FromBody] RefreshTokenRequest request,
        CancellationToken cancellationToken)
    {
        if (request == null ||
            string.IsNullOrWhiteSpace(request.RefreshToken) ||
            !_jwtTokenService.ValidateRefreshToken(request.RefreshToken, out var userId, out var tenantId, out var tokenId, out var familyId))
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

        var now = _timeProvider.GetUtcNow();
        var incomingTokenHash = _jwtTokenService.HashTokenId(tokenId);

        // Retrieve tokens for this family
        var familyTokens = await _context.UserRefreshTokens.IgnoreQueryFilters()
            .Where(r => r.UserId == user.Id && r.FamilyId == familyId)
            .OrderByDescending(r => r.CreatedAt)
            .ToListAsync(cancellationToken);

        // Fallback for tokens issued before UserRefreshToken table was introduced
        if (familyTokens.Count == 0)
        {
            if (!string.IsNullOrEmpty(user.RefreshTokenIdHash) &&
                CryptographicOperations.FixedTimeEquals(
                    Encoding.UTF8.GetBytes(user.RefreshTokenIdHash),
                    Encoding.UTF8.GetBytes(incomingTokenHash)))
            {
                if (user.RefreshTokenExpiresAt.HasValue && user.RefreshTokenExpiresAt.Value < now)
                {
                    user.RefreshTokenIdHash = null;
                    user.RefreshTokenExpiresAt = null;
                    await _context.SaveChangesAsync(cancellationToken);
                    return Unauthorized(new { message = "Paso na ang session. Pakiusap mag-login muli. / Refresh token expired." });
                }

                var initialToken = new UserRefreshToken
                {
                    Id = Guid.NewGuid(),
                    UserId = user.Id,
                    TenantId = user.TenantId,
                    FamilyId = !string.IsNullOrWhiteSpace(familyId) ? familyId : Guid.NewGuid().ToString("N"),
                    TokenHash = incomingTokenHash,
                    ExpiresAt = user.RefreshTokenExpiresAt ?? now.AddDays(30),
                    CreatedAt = now
                };
                _context.UserRefreshTokens.Add(initialToken);
                familyTokens.Add(initialToken);
            }
            else
            {
                return Unauthorized(new { message = "Paso na o binawi ang session. Pakiusap mag-login muli. / Session revoked. Please log in again." });
            }
        }

        // Check if this family is revoked
        if (familyTokens.Any(r => r.IsRevoked))
        {
            return Unauthorized(new { message = "Paso na o binawi ang session. Pakiusap mag-login muli. / Session revoked. Please log in again." });
        }

        var matchingToken = familyTokens.FirstOrDefault(r =>
            CryptographicOperations.FixedTimeEquals(
                Encoding.UTF8.GetBytes(r.TokenHash),
                Encoding.UTF8.GetBytes(incomingTokenHash)));

        string newRefreshToken;
        DateTimeOffset newRefreshExpiresAt;

        if (matchingToken != null && matchingToken.ReplacedByTokenHash == null)
        {
            // Case 1: Active token in the family being rotated
            if (matchingToken.ExpiresAt < now)
            {
                matchingToken.IsRevoked = true;
                matchingToken.RevokedAt = now;
                await _context.SaveChangesAsync(cancellationToken);
                return Unauthorized(new { message = "Paso na ang session. Pakiusap mag-login muli. / Refresh token expired." });
            }

            var (newRefToken, newExpires, newTokenId, _) = _jwtTokenService.GenerateRefreshToken(
                user.Id,
                user.TenantId,
                tokenId: null,
                familyId: matchingToken.FamilyId);

            var newTokenHash = _jwtTokenService.HashTokenId(newTokenId);

            // Rotate: mark previous token replaced and grant short grace window
            matchingToken.ReplacedByTokenHash = newTokenHash;
            matchingToken.GraceExpiresAt = now.AddSeconds(DefaultGraceWindowSeconds);

            var newRecord = new UserRefreshToken
            {
                Id = Guid.NewGuid(),
                UserId = user.Id,
                TenantId = user.TenantId,
                FamilyId = matchingToken.FamilyId,
                TokenHash = newTokenHash,
                ExpiresAt = newExpires,
                CreatedAt = now
            };
            _context.UserRefreshTokens.Add(newRecord);

            // Prune older tokens in this family that are outside grace window to keep table small
            var prunedTokens = familyTokens.Where(r =>
                r.Id != matchingToken.Id &&
                r.ReplacedByTokenHash != null &&
                r.GraceExpiresAt.HasValue &&
                r.GraceExpiresAt.Value < now).ToList();
            if (prunedTokens.Count > 0)
            {
                _context.UserRefreshTokens.RemoveRange(prunedTokens);
            }

            user.RefreshTokenIdHash = newTokenHash;
            user.RefreshTokenExpiresAt = newExpires;
            user.LastLoginAt = now;
            await _context.SaveChangesAsync(cancellationToken);

            newRefreshToken = newRefToken;
            newRefreshExpiresAt = newExpires;
        }
        else if (matchingToken != null && matchingToken.ReplacedByTokenHash != null)
        {
            // Case 2: Token was previously rotated; check grace window
            var isWithinGrace = matchingToken.GraceExpiresAt.HasValue && now <= matchingToken.GraceExpiresAt.Value;
            if (isWithinGrace)
            {
                // Grace window: allow the previous token to obtain refreshed tokens without revoking the family
                var (graceRefToken, graceExpires, graceTokenId, _) = _jwtTokenService.GenerateRefreshToken(
                    user.Id,
                    user.TenantId,
                    tokenId: null,
                    familyId: matchingToken.FamilyId);

                var graceTokenHash = _jwtTokenService.HashTokenId(graceTokenId);
                var activeToken = familyTokens.FirstOrDefault(r => r.ReplacedByTokenHash == null && !r.IsRevoked);
                if (activeToken != null)
                {
                    activeToken.ReplacedByTokenHash = graceTokenHash;
                    activeToken.GraceExpiresAt = now.AddSeconds(DefaultGraceWindowSeconds);
                }

                var newGraceRecord = new UserRefreshToken
                {
                    Id = Guid.NewGuid(),
                    UserId = user.Id,
                    TenantId = user.TenantId,
                    FamilyId = matchingToken.FamilyId,
                    TokenHash = graceTokenHash,
                    ExpiresAt = graceExpires,
                    CreatedAt = now
                };
                _context.UserRefreshTokens.Add(newGraceRecord);

                user.RefreshTokenIdHash = graceTokenHash;
                user.RefreshTokenExpiresAt = graceExpires;
                user.LastLoginAt = now;
                await _context.SaveChangesAsync(cancellationToken);

                newRefreshToken = graceRefToken;
                newRefreshExpiresAt = graceExpires;
            }
            else
            {
                // Reuse detected outside grace window! Revoke only the affected family
                foreach (var famToken in familyTokens)
                {
                    famToken.IsRevoked = true;
                    famToken.RevokedAt = now;
                }

                if (user.RefreshTokenIdHash != null &&
                    familyTokens.Any(r => r.TokenHash == user.RefreshTokenIdHash))
                {
                    user.RefreshTokenIdHash = null;
                    user.RefreshTokenExpiresAt = null;
                }

                await _context.SaveChangesAsync(cancellationToken);
                return Unauthorized(new { message = "Di-wasto o nagamit na ang refresh token. Pakiusap mag-login muli. / Invalid or already used refresh token." });
            }
        }
        else
        {
            // Case 3: Token not found in active records for this family, but family exists -> reuse outside grace window!
            // Revoke only the affected family
            foreach (var famToken in familyTokens)
            {
                famToken.IsRevoked = true;
                famToken.RevokedAt = now;
            }

            if (user.RefreshTokenIdHash != null &&
                familyTokens.Any(r => r.TokenHash == user.RefreshTokenIdHash))
            {
                user.RefreshTokenIdHash = null;
                user.RefreshTokenExpiresAt = null;
            }

            await _context.SaveChangesAsync(cancellationToken);
            return Unauthorized(new { message = "Di-wasto o nagamit na ang refresh token. Pakiusap mag-login muli. / Invalid or already used refresh token." });
        }

        var (token, expiresAt) = _jwtTokenService.GenerateAccessToken(user.Id, user.TenantId, email: user.Email, role: user.Role);

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
    /// Revokes the session by marking refresh token family (or all user sessions) revoked.
    /// Accepts an authenticated session (Bearer token) or an explicit RefreshToken in the request body.
    /// </summary>
    [HttpPost("logout")]
    [Route("/auth/logout")]
    [Route("/api/auth/logout")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> Logout(
        [FromBody] LogoutRequest? request,
        CancellationToken cancellationToken)
    {
        Guid? userId = _currentUserService?.UserId;
        if (!userId.HasValue || userId == Guid.Empty)
        {
            var userPrincipal = HttpContext?.User;
            var subClaim = userPrincipal?.FindFirst(ClaimTypes.NameIdentifier)?.Value
                ?? userPrincipal?.FindFirst("sub")?.Value
                ?? userPrincipal?.FindFirst("user_id")?.Value;

            if (Guid.TryParse(subClaim, out var parsedSub))
            {
                userId = parsedSub;
            }
        }

        string? targetFamilyId = null;
        if (!string.IsNullOrWhiteSpace(request?.RefreshToken))
        {
            if (_jwtTokenService.ValidateRefreshToken(request.RefreshToken, out var parsedUser, out _, out _, out var parsedFamilyId))
            {
                userId = parsedUser;
                targetFamilyId = parsedFamilyId;
            }
        }

        if (userId.HasValue && userId != Guid.Empty)
        {
            var user = await _context.Users.IgnoreQueryFilters()
                .FirstOrDefaultAsync(u => u.Id == userId.Value, cancellationToken);

            if (user != null)
            {
                var now = _timeProvider.GetUtcNow();
                if (!string.IsNullOrWhiteSpace(targetFamilyId))
                {
                    // Revoke only the affected family for this device session
                    var familyTokens = await _context.UserRefreshTokens.IgnoreQueryFilters()
                        .Where(r => r.UserId == userId.Value && r.FamilyId == targetFamilyId)
                        .ToListAsync(cancellationToken);
                    foreach (var tok in familyTokens)
                    {
                        tok.IsRevoked = true;
                        tok.RevokedAt = now;
                    }
                    if (user.RefreshTokenIdHash != null && familyTokens.Any(r => r.TokenHash == user.RefreshTokenIdHash))
                    {
                        user.RefreshTokenIdHash = null;
                        user.RefreshTokenExpiresAt = null;
                    }
                }
                else
                {
                    // Full user logout: revoke all refresh tokens for this user
                    var allTokens = await _context.UserRefreshTokens.IgnoreQueryFilters()
                        .Where(r => r.UserId == userId.Value)
                        .ToListAsync(cancellationToken);
                    foreach (var tok in allTokens)
                    {
                        tok.IsRevoked = true;
                        tok.RevokedAt = now;
                    }
                    user.RefreshTokenIdHash = null;
                    user.RefreshTokenExpiresAt = null;
                }
                await _context.SaveChangesAsync(cancellationToken);
            }
        }

        return Ok(new { message = "Naka-logout na nang matagumpay. / Logged out successfully." });
    }

    /// <summary>
    /// Updates the owner's master password after verifying current password.
    /// Immediately revokes all existing refresh tokens to protect against stolen tokens.
    /// </summary>
    [Authorize]
    [EnableRateLimiting("AuthSensitive")]
    [HttpPost("change-password")]
    [HttpPut("password")]
    [Route("/auth/change-password")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> ChangePassword(
        [FromBody] ChangePasswordRequest request,
        CancellationToken cancellationToken)
    {
        if (request == null || !ModelState.IsValid || string.IsNullOrWhiteSpace(request.CurrentPassword) || string.IsNullOrWhiteSpace(request.NewPassword))
        {
            return BadRequest(ModelState.IsValid ? (object)new { message = "Kailangan ng kasalukuyan at bagong password. / Current and new password are required." } : ModelState);
        }

        var userId = _currentUserService?.UserId;
        if (!userId.HasValue || userId == Guid.Empty)
        {
            var userPrincipal = HttpContext?.User;
            var subClaim = userPrincipal?.FindFirst(ClaimTypes.NameIdentifier)?.Value
                ?? userPrincipal?.FindFirst("sub")?.Value
                ?? userPrincipal?.FindFirst("user_id")?.Value;

            if (Guid.TryParse(subClaim, out var parsedSub))
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

        if (user.PasswordLockoutEnd.HasValue)
        {
            if (user.PasswordLockoutEnd.Value > DateTimeOffset.UtcNow)
            {
                var remaining = Math.Max(1, (int)Math.Ceiling((user.PasswordLockoutEnd.Value - DateTimeOffset.UtcNow).TotalMinutes));
                return StatusCode(StatusCodes.Status429TooManyRequests, new
                {
                    message = $"Naka-lockout ang account dahil sa sunod-sunod na maling pagsubok sa password. Maghintay nang {remaining} minuto. / Account locked due to repeated failed password attempts. Wait {remaining} minutes.",
                    lockoutMinutes = remaining,
                    accountLocked = true
                });
            }

            user.FailedPasswordAttempts = 0;
            user.PasswordLockoutEnd = null;
        }

        var verifyResult = _passwordHasher.VerifyHashedPassword(user, user.PasswordHash, request.CurrentPassword);
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
                message = $"Maling kasalukuyang password. May natitira ka pang {remainingAttempts} pagsubok bago mag-lockout. / Invalid current password. {remainingAttempts} attempts remaining.",
                remainingAttempts
            });
        }

        user.PasswordHash = _passwordHasher.HashPassword(user, request.NewPassword);
        user.FailedPasswordAttempts = 0;
        user.PasswordLockoutEnd = null;

        // Revoke all existing refresh tokens
        var allTokens = await _context.UserRefreshTokens.IgnoreQueryFilters()
            .Where(r => r.UserId == user.Id)
            .ToListAsync(cancellationToken);
        foreach (var tok in allTokens)
        {
            tok.IsRevoked = true;
            tok.RevokedAt = _timeProvider.GetUtcNow();
        }
        user.RefreshTokenIdHash = null;
        user.RefreshTokenExpiresAt = null;

        await _context.SaveChangesAsync(cancellationToken);

        return Ok(new { message = "Matagumpay na nabago ang password. Na-revoke ang lahat ng lumang sessions. / Password changed successfully. All previous sessions revoked." });
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
