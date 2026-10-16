using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using FluentTindahan.Application.Common.Interfaces;
using FluentTindahan.Domain.Entities;
using FluentTindahan.Domain.Enums;
using FluentTindahan.Domain.Interfaces;
using FluentTindahan.WebApi.Authorization;
using FluentTindahan.WebApi.Controllers.Helpers;

namespace FluentTindahan.WebApi.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly IApplicationDbContext _context;
    private readonly IJwtTokenService _jwtTokenService;
    private readonly ICurrentUserService _currentUserService;
    private readonly PasswordHasher<User> _passwordHasher;
    private readonly TimeProvider _timeProvider;

    public const int DefaultGraceWindowSeconds = AuthRefreshTokenHelper.DefaultGraceWindowSeconds;

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

    #region Static Helper Forwarders

    public static void ResetAllIpPinThrottles() => AuthLockoutHelper.ResetAllIpPinThrottles();
    public static void ResetIpPinThrottle(string clientIp) => AuthLockoutHelper.ResetIpPinThrottle(clientIp);
    public static string CleanDisplayEmail(string? email) => AuthEmailNormalizer.CleanDisplayEmail(email);
    public static string NormalizeEmail(string? email) => AuthEmailNormalizer.NormalizeEmail(email);
    public static bool IsUniqueEmailViolation(DbUpdateException ex) => DbConstraintHelper.IsUniqueEmailViolation(ex);
    public static bool IsUniqueConstraintViolation(DbUpdateException ex) => DbConstraintHelper.IsUniqueConstraintViolation(ex);

    #endregion

    #region Request and Response DTOs

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

    public sealed record UpdateProfileRequest
    {
        [StringLength(200)]
        public string? BusinessName { get; init; }

        [EmailAddress, StringLength(256)]
        public string? Email { get; init; }

        [StringLength(100)]
        public string? OwnerName { get; init; }

        [StringLength(30)]
        public string? Phone { get; init; }

        [StringLength(128)]
        public string? CurrentPassword { get; init; }

        [RegularExpression(@"^\d{4,6}$", ErrorMessage = "PIN must be between 4 and 6 digits.")]
        public string? Pin { get; init; }

        public string? RefreshToken { get; init; }
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

    #endregion

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

                var placeholderUser = existingUsers[0];
                var claimUserId = AuthClaimsHelper.ResolveUserId(_currentUserService, HttpContext?.User);
                var claimTenantId = AuthClaimsHelper.ResolveTenantId(_currentUserService, HttpContext?.User);
                var isAuthenticated = AuthClaimsHelper.IsAuthenticated(_currentUserService, HttpContext?.User);

                var isCallerAuthenticatedAsPlaceholder = isAuthenticated &&
                    claimUserId.HasValue &&
                    claimUserId.Value == placeholderUser.Id &&
                    claimTenantId.HasValue &&
                    claimTenantId.Value == tenantId;

                var candidateSessionToken = request.RefreshToken
                    ?? (Request?.Headers.TryGetValue("X-Refresh-Token", out var rtHeader) == true ? rtHeader.ToString() : null);

                var isSameDeviceSession = await AuthClaimsHelper.ValidatePlaceholderSessionAsync(
                    _jwtTokenService,
                    _context,
                    placeholderUser,
                    tenantId,
                    candidateSessionToken,
                    cancellationToken);

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

                user = existingUsers[0];
                user.Email = displayEmail;
                user.NormalizedEmail = normalizedEmail;
                user.Phone = request.Phone?.Trim() ?? user.Phone;
                if (!string.IsNullOrWhiteSpace(request.OwnerName))
                {
                    user.OwnerName = request.OwnerName.Trim();
                }
                user.Role = "Owner";
                AuthLockoutHelper.ResetPinLockout(user);
                AuthLockoutHelper.ResetPasswordLockout(user);
                user.LastLoginAt = _timeProvider.GetUtcNow();
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
                    CreatedAt = _timeProvider.GetUtcNow()
                };
                _context.Tenants.Add(tenant);

                user = new User
                {
                    Id = userId,
                    TenantId = tenantId,
                    Email = displayEmail,
                    NormalizedEmail = normalizedEmail,
                    Phone = request.Phone?.Trim() ?? string.Empty,
                    OwnerName = string.IsNullOrWhiteSpace(request.OwnerName) ? null : request.OwnerName.Trim(),
                    Role = "Owner",
                    FailedPinAttempts = 0,
                    PinLockoutEnd = null,
                    FailedPasswordAttempts = 0,
                    PasswordLockoutEnd = null,
                    CreatedAt = _timeProvider.GetUtcNow(),
                    LastLoginAt = _timeProvider.GetUtcNow()
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
                CreatedAt = _timeProvider.GetUtcNow()
            };
            _context.Tenants.Add(tenant);

            user = new User
            {
                Id = userId,
                TenantId = tenantId,
                Email = displayEmail,
                NormalizedEmail = normalizedEmail,
                Phone = request.Phone?.Trim() ?? string.Empty,
                OwnerName = string.IsNullOrWhiteSpace(request.OwnerName) ? null : request.OwnerName.Trim(),
                Role = "Owner",
                FailedPinAttempts = 0,
                PinLockoutEnd = null,
                FailedPasswordAttempts = 0,
                PasswordLockoutEnd = null,
                CreatedAt = _timeProvider.GetUtcNow(),
                LastLoginAt = _timeProvider.GetUtcNow()
            };
            _context.Users.Add(user);
        }

        user.PasswordHash = _passwordHasher.HashPassword(user, request.Password);
        user.PinHash = !string.IsNullOrWhiteSpace(request.Pin)
            ? _passwordHasher.HashPassword(user, request.Pin.Trim())
            : null;

        var access = _jwtTokenService.GenerateAccessToken(user.Id, tenant.Id, email: user.Email, role: user.Role);
        var (refreshToken, _, _, _) = AuthRefreshTokenHelper.IssueRefreshToken(
            _context,
            _jwtTokenService,
            user,
            tenant.Id,
            _timeProvider);

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

        return Ok(AuthResponseBuilder.Build(
            user,
            tenant,
            access,
            refreshToken,
            user.OwnerName));
    }

    /// <summary>
    /// Logs in an existing store owner using email and password.
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

        if (AuthLockoutHelper.CheckPasswordLockout(user, _timeProvider, out var lockoutMinutes))
        {
            return AuthLockoutHelper.PasswordLockedOutResult(lockoutMinutes);
        }

        var verifyResult = _passwordHasher.VerifyHashedPassword(user, user.PasswordHash, request.Password);
        if (verifyResult == PasswordVerificationResult.Failed)
        {
            AuthLockoutHelper.RecordPasswordFailure(user, _timeProvider, out var isLockedOut, out var lockMinutes, out var remainingAttempts);
            await _context.SaveChangesAsync(cancellationToken);

            if (isLockedOut)
            {
                return AuthLockoutHelper.PasswordLockedOutResult(lockMinutes, isInitial: true);
            }

            return AuthLockoutHelper.PasswordFailedResult(
                remainingAttempts,
                $"Maling email o password. May natitira ka pang {remainingAttempts} pagsubok bago mag-lockout. / Invalid email or password. {remainingAttempts} attempts remaining.");
        }

        if (verifyResult == PasswordVerificationResult.SuccessRehashNeeded)
        {
            user.PasswordHash = _passwordHasher.HashPassword(user, request.Password);
        }

        AuthLockoutHelper.ResetPasswordLockout(user);
        AuthLockoutHelper.ResetPinLockout(user);
        user.LastLoginAt = _timeProvider.GetUtcNow();

        var access = _jwtTokenService.GenerateAccessToken(user.Id, user.TenantId, email: user.Email, role: user.Role);
        var (refreshToken, _, _, _) = AuthRefreshTokenHelper.IssueRefreshToken(
            _context,
            _jwtTokenService,
            user,
            user.TenantId,
            _timeProvider);

        await _context.SaveChangesAsync(cancellationToken);
        AuthLockoutHelper.ResetIpPinThrottle(AuthClaimsHelper.GetClientIpAddress(HttpContext));

        return Ok(AuthResponseBuilder.Build(user, user.Tenant, access, refreshToken));
    }

    /// <summary>
    /// Fast till login/unlock using email and 4-6 digit numeric PIN.
    /// Protects against brute-force attacks via per-IP throttling alongside per-account lockout (5 failures = 15 minutes lockout),
    /// and atomic/concurrency-protected failure counter updates to prevent parallel bypass.
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

        var clientIp = AuthClaimsHelper.GetClientIpAddress(HttpContext);

        if (AuthLockoutHelper.IsIpPinThrottled(clientIp, _timeProvider, out var ipRemainingMinutes))
        {
            return AuthLockoutHelper.IpPinLockedOutResult(ipRemainingMinutes);
        }

        var normalizedEmail = NormalizeEmail(request.Email);
        if (string.IsNullOrWhiteSpace(normalizedEmail))
        {
            AuthLockoutHelper.RecordIpPinFailure(clientIp, _timeProvider, out var ipLockedOut, out var ipLockMinutes);
            if (ipLockedOut)
            {
                return AuthLockoutHelper.IpPinLockedOutResult(ipLockMinutes, isInitial: true);
            }
            return Unauthorized(new { message = "Maling email o PIN. / Invalid email or PIN." });
        }

        var user = await _context.Users.IgnoreQueryFilters()
            .Include(u => u.Tenant)
            .FirstOrDefaultAsync(u => u.NormalizedEmail == normalizedEmail, cancellationToken);

        if (user == null || string.IsNullOrEmpty(user.PinHash) || user.Tenant == null)
        {
            AuthLockoutHelper.RecordIpPinFailure(clientIp, _timeProvider, out var ipLockedOut, out var ipLockMinutes);
            if (ipLockedOut)
            {
                return AuthLockoutHelper.IpPinLockedOutResult(ipLockMinutes, isInitial: true);
            }
            return Unauthorized(new { message = "Maling email o PIN code. / Invalid email or PIN code." });
        }

        var userLock = AuthLockoutHelper.GetUserPinLock(user.Id);
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

            if (AuthLockoutHelper.CheckPasswordLockout(freshUser, _timeProvider, out var pwLockoutMinutes))
            {
                return AuthLockoutHelper.PasswordLockedOutResult(pwLockoutMinutes);
            }

            if (AuthLockoutHelper.CheckPinLockout(freshUser, _timeProvider, out var pinLockoutMinutes))
            {
                return AuthLockoutHelper.PinLockedOutResult(pinLockoutMinutes);
            }
            else if (freshUser.PinLockoutEnd.HasValue)
            {
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
                AuthLockoutHelper.RecordIpPinFailure(clientIp, _timeProvider, out var ipLockedOut, out var ipLockMinutes);

                if (_context.Database.IsNpgsql())
                {
                    var lockoutTime = _timeProvider.GetUtcNow().AddMinutes(AuthLockoutHelper.LockoutDurationMinutes);
                    await _context.Users.IgnoreQueryFilters()
                        .Where(u => u.Id == freshUser.Id)
                        .ExecuteUpdateAsync(s => s
                            .SetProperty(u => u.FailedPinAttempts, u => u.FailedPinAttempts + 1)
                            .SetProperty(u => u.PinLockoutEnd, u => u.FailedPinAttempts + 1 >= AuthLockoutHelper.MaxFailedAttempts ? lockoutTime : u.PinLockoutEnd),
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
                    AuthLockoutHelper.RecordPinFailureInMemory(freshUser, _timeProvider, out _, out _, out _);
                    await _context.SaveChangesAsync(cancellationToken);
                }

                if (ipLockedOut)
                {
                    return AuthLockoutHelper.IpPinLockedOutResult(ipLockMinutes, isInitial: true);
                }

                if (freshUser.FailedPinAttempts >= AuthLockoutHelper.MaxFailedAttempts)
                {
                    return AuthLockoutHelper.PinLockedOutResult(AuthLockoutHelper.LockoutDurationMinutes, isInitial: true);
                }

                var remainingAttempts = AuthLockoutHelper.MaxFailedAttempts - freshUser.FailedPinAttempts;
                return AuthLockoutHelper.PinFailedResult(remainingAttempts);
            }

            AuthLockoutHelper.ResetIpPinThrottle(clientIp);

            var access = _jwtTokenService.GenerateAccessToken(freshUser.Id, freshUser.TenantId, email: freshUser.Email, role: freshUser.Role);
            var (refreshToken, refreshExpiresAt, tokenHash, _) = AuthRefreshTokenHelper.IssueRefreshToken(
                _context,
                _jwtTokenService,
                freshUser,
                freshUser.TenantId,
                _timeProvider);

            var now = _timeProvider.GetUtcNow();

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
                AuthLockoutHelper.ResetPinLockout(freshUser);
                freshUser.LastLoginAt = now;
                await _context.SaveChangesAsync(cancellationToken);
            }

            return Ok(AuthResponseBuilder.Build(freshUser, freshUser.Tenant, access, refreshToken));
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

        var userId = AuthClaimsHelper.ResolveUserId(_currentUserService, HttpContext?.User);
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

        if (AuthLockoutHelper.CheckPasswordLockout(user, _timeProvider, out var lockoutMinutes))
        {
            return AuthLockoutHelper.PasswordLockedOutResult(lockoutMinutes);
        }

        var verifyResult = _passwordHasher.VerifyHashedPassword(user, user.PasswordHash, request.Password);
        if (verifyResult == PasswordVerificationResult.Failed)
        {
            AuthLockoutHelper.RecordPasswordFailure(user, _timeProvider, out var isLockedOut, out var lockMinutes, out var remainingAttempts);
            await _context.SaveChangesAsync(cancellationToken);

            if (isLockedOut)
            {
                return AuthLockoutHelper.PasswordLockedOutResult(lockMinutes, isInitial: true);
            }

            return AuthLockoutHelper.PasswordFailedResult(
                remainingAttempts,
                $"Maling password. May natitira ka pang {remainingAttempts} pagsubok bago mag-lockout. / Invalid password. {remainingAttempts} attempts remaining.");
        }

        if (verifyResult == PasswordVerificationResult.SuccessRehashNeeded)
        {
            user.PasswordHash = _passwordHasher.HashPassword(user, request.Password);
        }

        AuthLockoutHelper.ResetPasswordLockout(user);
        user.PinHash = !string.IsNullOrWhiteSpace(request.Pin)
            ? _passwordHasher.HashPassword(user, request.Pin.Trim())
            : null;
        AuthLockoutHelper.ResetPinLockout(user);

        await AuthRefreshTokenHelper.RevokeAllForUserAsync(_context, user, user.Id, _timeProvider, cancellationToken);
        await _context.SaveChangesAsync(cancellationToken);
        AuthLockoutHelper.ResetIpPinThrottle(AuthClaimsHelper.GetClientIpAddress(HttpContext));

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
        var result = await AuthRefreshTokenHelper.RotateRefreshTokenAsync(
            _context,
            _jwtTokenService,
            _timeProvider,
            request?.RefreshToken,
            cancellationToken);

        if (!result.IsSuccess)
        {
            return result.ErrorResult!;
        }

        var user = result.User!;
        var access = _jwtTokenService.GenerateAccessToken(user.Id, user.TenantId, email: user.Email, role: user.Role);

        return Ok(AuthResponseBuilder.Build(user, user.Tenant, access, result.NewRefreshToken));
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
        var userId = AuthClaimsHelper.ResolveUserId(_currentUserService, HttpContext?.User);
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
                if (!string.IsNullOrWhiteSpace(targetFamilyId))
                {
                    await AuthRefreshTokenHelper.RevokeFamilyAsync(_context, user, userId.Value, targetFamilyId, _timeProvider, cancellationToken);
                }
                else
                {
                    await AuthRefreshTokenHelper.RevokeAllForUserAsync(_context, user, userId.Value, _timeProvider, cancellationToken);
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

        var userId = AuthClaimsHelper.ResolveUserId(_currentUserService, HttpContext?.User);
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

        if (AuthLockoutHelper.CheckPasswordLockout(user, _timeProvider, out var lockoutMinutes))
        {
            return AuthLockoutHelper.PasswordLockedOutResult(lockoutMinutes);
        }

        var verifyResult = _passwordHasher.VerifyHashedPassword(user, user.PasswordHash, request.CurrentPassword);
        if (verifyResult == PasswordVerificationResult.Failed)
        {
            AuthLockoutHelper.RecordPasswordFailure(user, _timeProvider, out var isLockedOut, out var lockMinutes, out var remainingAttempts);
            await _context.SaveChangesAsync(cancellationToken);

            if (isLockedOut)
            {
                return AuthLockoutHelper.PasswordLockedOutResult(lockMinutes, isInitial: true);
            }

            return AuthLockoutHelper.PasswordFailedResult(
                remainingAttempts,
                $"Maling kasalukuyang password. May natitira ka pang {remainingAttempts} pagsubok bago mag-lockout. / Invalid current password. {remainingAttempts} attempts remaining.");
        }

        user.PasswordHash = _passwordHasher.HashPassword(user, request.NewPassword);
        AuthLockoutHelper.ResetPasswordLockout(user);

        await AuthRefreshTokenHelper.RevokeAllForUserAsync(_context, user, user.Id, _timeProvider, cancellationToken);
        await _context.SaveChangesAsync(cancellationToken);

        return Ok(new { message = "Matagumpay na nabago ang password. Na-revoke ang lahat ng lumang sessions. / Password changed successfully. All previous sessions revoked." });
    }

    /// <summary>
    /// Updates the store and owner profile (BusinessName, OwnerName, Phone, and optionally Email).
    /// Returns the updated AuthResponseDto and issues a refreshed access token.
    /// </summary>
    [Authorize(Policy = AuthorizationPolicies.TenantResolved)]
    [HttpPut("profile")]
    [ProducesResponseType(typeof(AuthResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<AuthResponseDto>> UpdateProfile(
        [FromBody] UpdateProfileRequest request,
        CancellationToken cancellationToken)
    {
        if (request == null || !ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        var userId = AuthClaimsHelper.ResolveUserId(_currentUserService, HttpContext?.User);
        if (!userId.HasValue || userId == Guid.Empty)
        {
            return Unauthorized(new { message = "User is not authenticated." });
        }

        var tenantId = _currentUserService.TenantId;
        var user = await _context.Users.IgnoreQueryFilters()
            .FirstOrDefaultAsync(u => u.Id == userId.Value, cancellationToken);
        if (user == null)
        {
            return Unauthorized(new { message = "Hindi natagpuan ang account. / User account not found." });
        }

        var tenant = await _context.Tenants.IgnoreQueryFilters()
            .FirstOrDefaultAsync(t => t.Id == user.TenantId, cancellationToken);
        if (tenant == null)
        {
            return NotFound(new { message = "Hindi natagpuan ang tindahan. / Store not found." });
        }

        if (tenantId != Guid.Empty && user.TenantId != tenantId)
        {
            return Forbid();
        }

        if (request.BusinessName != null)
        {
            var cleanBusinessName = request.BusinessName.Trim();
            if (cleanBusinessName.Length < 2)
            {
                return BadRequest(new { message = "Kailangan ng pangalan ng tindahan (minimum 2 letra). / Store name is required (minimum 2 chars)." });
            }

            var isChangingBusinessName = !string.Equals(tenant.BusinessName, cleanBusinessName, StringComparison.Ordinal);
            if (isChangingBusinessName && !string.Equals(user.Role, "Owner", StringComparison.OrdinalIgnoreCase))
            {
                return StatusCode(StatusCodes.Status403Forbidden, new { message = "May-ari lamang ang maaaring magpalit ng pangalan ng tindahan. / Only the store owner can change the business name." });
            }

            if (isChangingBusinessName)
            {
                tenant.BusinessName = cleanBusinessName;
            }
        }

        if (request.OwnerName != null)
        {
            user.OwnerName = string.IsNullOrWhiteSpace(request.OwnerName) ? null : request.OwnerName.Trim();
        }

        if (request.Phone != null)
        {
            user.Phone = string.IsNullOrWhiteSpace(request.Phone) ? string.Empty : request.Phone.Trim();
        }

        var isEmailChanging = false;
        string? cleanEmail = null;
        string? normalizedEmail = null;

        if (request.Email != null)
        {
            cleanEmail = CleanDisplayEmail(request.Email);
            normalizedEmail = NormalizeEmail(request.Email);
            if (string.IsNullOrWhiteSpace(normalizedEmail) || !new EmailAddressAttribute().IsValid(normalizedEmail))
            {
                return BadRequest(new { message = "Kailangan ng wastong email address. / Valid email address is required." });
            }

            if (!string.Equals(user.NormalizedEmail, normalizedEmail, StringComparison.OrdinalIgnoreCase))
            {
                isEmailChanging = true;
            }
        }

        string? responseRefreshToken = null;

        if (isEmailChanging)
        {
            // Verify password or PIN if user has credentials configured
            var hasPassword = !string.IsNullOrEmpty(user.PasswordHash);
            var hasPin = !string.IsNullOrEmpty(user.PinHash);

            if (hasPassword || hasPin)
            {
                var passwordProvided = !string.IsNullOrWhiteSpace(request.CurrentPassword);
                var pinProvided = !string.IsNullOrWhiteSpace(request.Pin);

                if (!passwordProvided && !pinProvided)
                {
                    return BadRequest(new { message = "Kailangan ng kasalukuyang password o PIN upang palitan ang email address. / Current password or PIN is required to change email address." });
                }

                var verified = false;

                if (passwordProvided)
                {
                    if (AuthLockoutHelper.CheckPasswordLockout(user, _timeProvider, out var lockoutMinutes))
                    {
                        return AuthLockoutHelper.PasswordLockedOutResult(lockoutMinutes);
                    }

                    if (hasPassword)
                    {
                        var pwdVerify = _passwordHasher.VerifyHashedPassword(user, user.PasswordHash, request.CurrentPassword!);
                        if (pwdVerify == PasswordVerificationResult.Failed)
                        {
                            AuthLockoutHelper.RecordPasswordFailure(user, _timeProvider, out var isLockedOut, out var lockMinutes, out var remainingAttempts);
                            await _context.SaveChangesAsync(cancellationToken);
                            if (isLockedOut)
                            {
                                return AuthLockoutHelper.PasswordLockedOutResult(lockMinutes, isInitial: true);
                            }
                            return BadRequest(new
                            {
                                message = $"Maling kasalukuyang password. May natitira ka pang {remainingAttempts} pagsubok bago mag-lockout. / Invalid current password. {remainingAttempts} attempts remaining.",
                                remainingAttempts
                            });
                        }

                        if (pwdVerify == PasswordVerificationResult.SuccessRehashNeeded)
                        {
                            user.PasswordHash = _passwordHasher.HashPassword(user, request.CurrentPassword!);
                        }
                        AuthLockoutHelper.ResetPasswordLockout(user);
                        verified = true;
                    }
                    else if (!pinProvided)
                    {
                        return BadRequest(new { message = "Walang naka-set na password ang account. Mangyaring gamitin ang PIN. / Account has no password set. Please use PIN." });
                    }
                }

                if (!verified && pinProvided)
                {
                    if (AuthLockoutHelper.CheckPinLockout(user, _timeProvider, out var pinLockoutMinutes))
                    {
                        return AuthLockoutHelper.PinLockedOutResult(pinLockoutMinutes);
                    }

                    if (hasPin)
                    {
                        var cleanPin = request.Pin!.Trim();
                        var pinVerify = _passwordHasher.VerifyHashedPassword(user, user.PinHash!, cleanPin);
                        if (pinVerify == PasswordVerificationResult.Failed)
                        {
                            AuthLockoutHelper.RecordPinFailureInMemory(user, _timeProvider, out var isPinLockedOut, out var pinLockMinutes, out var remainingPinAttempts);
                            await _context.SaveChangesAsync(cancellationToken);
                            if (isPinLockedOut)
                            {
                                return AuthLockoutHelper.PinLockedOutResult(pinLockMinutes, isInitial: true);
                            }
                            return BadRequest(new
                            {
                                message = $"Maling PIN. May natitira ka pang {remainingPinAttempts} pagsubok bago mag-lockout. / Invalid PIN. {remainingPinAttempts} attempts remaining.",
                                remainingAttempts = remainingPinAttempts
                            });
                        }
                        AuthLockoutHelper.ResetPinLockout(user);
                        verified = true;
                    }
                    else
                    {
                        return BadRequest(new { message = "Walang naka-set na PIN ang account. Mangyaring gamitin ang kasalukuyang password. / Account has no PIN set. Please use current password." });
                    }
                }

                if (!verified)
                {
                    return BadRequest(new { message = "Kailangan ng wastong kasalukuyang password o PIN upang palitan ang email address. / Valid current password or PIN is required to change email address." });
                }
            }

            var emailExists = await _context.Users.IgnoreQueryFilters()
                .AnyAsync(u => u.NormalizedEmail == normalizedEmail && u.Id != user.Id, cancellationToken);
            if (emailExists)
            {
                return Conflict(new { message = "May account nang nakarehistro gamit ang email na ito. / An account is already registered with this email." });
            }
            user.Email = cleanEmail!;
            user.NormalizedEmail = normalizedEmail!;

            // Revoke other refresh tokens on email change
            string? currentFamilyId = null;
            string? currentTokenId = null;
            if (!string.IsNullOrWhiteSpace(request.RefreshToken) &&
                _jwtTokenService.ValidateRefreshToken(request.RefreshToken, out var refUid, out _, out var tokenId, out var famId) &&
                refUid == user.Id)
            {
                currentFamilyId = famId;
                currentTokenId = tokenId;
            }

            await AuthRefreshTokenHelper.RevokeOtherSessionsForUserAsync(
                _context, user, user.Id, currentFamilyId, _timeProvider, cancellationToken);

            if (currentFamilyId != null && currentTokenId != null)
            {
                var (rToken, _, _, _) = await AuthRefreshTokenHelper.RotatePresentedRefreshTokenAsync(
                    _context, _jwtTokenService, user, tenant.Id, _timeProvider, currentTokenId, currentFamilyId, cancellationToken);
                responseRefreshToken = rToken;
            }
        }
        else if (!string.IsNullOrWhiteSpace(request.RefreshToken) &&
            _jwtTokenService.ValidateRefreshToken(request.RefreshToken, out var refUid, out _, out var tokenId, out var famId) &&
            refUid == user.Id)
        {
            var (rToken, _, _, _) = await AuthRefreshTokenHelper.RotatePresentedRefreshTokenAsync(
                _context, _jwtTokenService, user, tenant.Id, _timeProvider, tokenId, famId, cancellationToken);
            responseRefreshToken = rToken;
        }

        try
        {
            await _context.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException ex) when (IsUniqueEmailViolation(ex))
        {
            _context.ChangeTracker.Clear();
            return Conflict(new { message = "May account nang nakarehistro gamit ang email na ito. / An account is already registered with this email." });
        }

        var access = _jwtTokenService.GenerateAccessToken(user.Id, tenant.Id, email: user.Email, role: user.Role);
        return Ok(AuthResponseBuilder.Build(user, tenant, access, refreshToken: responseRefreshToken, ownerName: user.OwnerName));
    }
}
