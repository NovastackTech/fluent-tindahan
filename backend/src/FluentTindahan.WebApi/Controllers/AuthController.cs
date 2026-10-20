using System.ComponentModel.DataAnnotations;
using FluentTindahan.Application.Common.Interfaces;
using FluentTindahan.Domain.Entities;
using FluentTindahan.Domain.Enums;
using FluentTindahan.Domain.Interfaces;
using FluentTindahan.Infrastructure.Services;
using FluentTindahan.WebApi.Authorization;
using FluentTindahan.WebApi.Controllers.Helpers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

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
    private readonly IGoogleAuthService? _googleAuthService;
    private readonly IEmailOtpSender? _emailOtpSender;
    private readonly IConfiguration? _configuration;
    private readonly IWebHostEnvironment? _hostEnvironment;
    private readonly ILogger<AuthController>? _logger;

    public const int DefaultGraceWindowSeconds = AuthRefreshTokenHelper.DefaultGraceWindowSeconds;

    public AuthController(
        IApplicationDbContext context,
        IJwtTokenService jwtTokenService,
        ICurrentUserService? currentUserService = null,
        TimeProvider? timeProvider = null,
        IGoogleAuthService? googleAuthService = null,
        IEmailOtpSender? emailOtpSender = null,
        IConfiguration? configuration = null,
        IWebHostEnvironment? hostEnvironment = null,
        ILogger<AuthController>? logger = null)
    {
        _context = context;
        _jwtTokenService = jwtTokenService;
        _currentUserService = currentUserService!;
        _passwordHasher = new PasswordHasher<User>();
        _timeProvider = timeProvider ?? TimeProvider.System;
        _googleAuthService = googleAuthService;
        _emailOtpSender = emailOtpSender;
        _configuration = configuration;
        _hostEnvironment = hostEnvironment;
        _logger = logger;
    }

    private bool IsDevOrDemoMode()
    {
        if (_hostEnvironment?.IsDevelopment() == true) return true;
        var demo = _configuration?["DemoMode"] ?? _configuration?["DEMO_MODE"] ?? Environment.GetEnvironmentVariable("DEMO_MODE");
        return string.Equals(demo, "true", StringComparison.OrdinalIgnoreCase);
    }

    #region Static Helper Forwarders

    public static void ResetAllIpPinThrottles() => AuthLockoutHelper.ResetAllIpPinThrottles();
    public static void ResetIpPinThrottle(string clientIp) => AuthLockoutHelper.ResetIpPinThrottle(clientIp);
    public static string CleanDisplayEmail(string? email) => AuthEmailNormalizer.CleanDisplayEmail(email);
    public static string NormalizeEmail(string? email) => AuthEmailNormalizer.NormalizeEmail(email);
    public static bool IsDisposableEmail(string? email) => AuthEmailNormalizer.IsDisposableEmail(email);
    public static bool IsUniqueEmailViolation(DbUpdateException ex) => DbConstraintHelper.IsUniqueEmailViolation(ex);
    public static bool IsUniqueConstraintViolation(DbUpdateException ex) => DbConstraintHelper.IsUniqueConstraintViolation(ex);
    public static bool IsValidPassword(string? password)
    {
        if (string.IsNullOrWhiteSpace(password) || password.Length < 8) return false;
        return password.Any(char.IsLetter) && password.Any(char.IsDigit);
    }

    #endregion

    #region Request and Response DTOs

    public sealed record RegisterRequest
    {
        [Required, EmailAddress, StringLength(256)]
        public string Email { get; init; } = string.Empty;

        [Required, StringLength(100, MinimumLength = 8, ErrorMessage = "Password must be at least 8 characters.")]
        [RegularExpression(@"^(?=.*[a-zA-Z])(?=.*\d).{8,}$", ErrorMessage = "Password must be at least 8 characters and contain both letters and numbers.")]
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

        public bool? RestoreAccount { get; init; }
    }

    public sealed record LoginPinRequest
    {
        [Required, EmailAddress]
        public string Email { get; init; } = string.Empty;

        [Required, RegularExpression(@"^\d{4,6}$", ErrorMessage = "PIN must be between 4 and 6 digits.")]
        public string Pin { get; init; } = string.Empty;

        public bool? RestoreAccount { get; init; }
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
        public string? CurrentPassword { get; init; }

        [Required, MinLength(8, ErrorMessage = "Password must be at least 8 characters.")]
        [RegularExpression(@"^(?=.*[a-zA-Z])(?=.*\d).{8,}$", ErrorMessage = "Password must be at least 8 characters and contain both letters and numbers.")]
        public string NewPassword { get; init; } = string.Empty;

        public string? RefreshToken { get; init; }
    }

    public sealed record ForgotPasswordRequest
    {
        [Required, EmailAddress]
        public string Email { get; init; } = string.Empty;
    }

    public sealed record ResetPasswordRequest
    {
        [Required, EmailAddress]
        public string Email { get; init; } = string.Empty;

        [Required, StringLength(6, MinimumLength = 6)]
        public string Otp { get; init; } = string.Empty;

        [Required, MinLength(8, ErrorMessage = "Password must be at least 8 characters.")]
        [RegularExpression(@"^(?=.*[a-zA-Z])(?=.*\d).{8,}$", ErrorMessage = "Password must be at least 8 characters and contain both letters and numbers.")]
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

    public sealed record GoogleAuthRequest
    {
        public string? AccessToken { get; init; }
        public string? IdToken { get; init; }

        [StringLength(200)]
        public string? BusinessName { get; init; }

        [RegularExpression(@"^\d{4,6}$", ErrorMessage = "PIN must be between 4 and 6 digits.")]
        public string? Pin { get; init; }

        public Guid? TenantId { get; init; }
        public Guid? UserId { get; init; }
        public string? RefreshToken { get; init; }
        public bool? RestoreAccount { get; init; }
    }

    public sealed record DeleteAccountRequest
    {
        [StringLength(128)]
        public string? Password { get; init; }

        [RegularExpression(@"^\d{4,6}$", ErrorMessage = "PIN must be between 4 and 6 digits.")]
        public string? Pin { get; init; }

        public string? GoogleAccessToken { get; init; }
        public string? GoogleIdToken { get; init; }
        public bool Immediate { get; init; }
    }

    public sealed record DeleteAccountResponseDto(
        string Status,
        DateTimeOffset? DeletionScheduledAt,
        string Message
    );

    public sealed record VerifyEmailOtpRequest
    {
        [EmailAddress, StringLength(256)]
        public string? Email { get; init; }

        [Required, RegularExpression(@"^\d{6}$", ErrorMessage = "OTP must be a 6-digit code.")]
        public string Otp { get; init; } = string.Empty;
    }

    public sealed record ResendEmailOtpRequest
    {
        [EmailAddress, StringLength(256)]
        public string? Email { get; init; }
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
        string? RefreshToken = null,
        bool IsNewUser = false,
        bool EmailVerified = true,
        bool RequiresEmailVerification = false
    );

    #endregion

    private async Task<(Tenant? ExistingTenant, User? PlaceholderUser, ActionResult? ErrorResult)> ValidateAnonymousStoreUpgradeAsync(
        Guid tenantId,
        Guid? requestedUserId,
        string? refreshToken,
        CancellationToken cancellationToken)
    {
        var existingTenant = await _context.Tenants.IgnoreQueryFilters()
            .FirstOrDefaultAsync(t => t.Id == tenantId, cancellationToken);

        if (existingTenant == null)
        {
            return (null, null, null);
        }

        var existingUsers = await _context.Users.IgnoreQueryFilters()
            .Where(u => u.TenantId == tenantId)
            .ToListAsync(cancellationToken);

        var isAnonymousProvisionedOwner = requestedUserId.HasValue &&
            existingUsers.Count == 1 &&
            existingUsers[0].Id == requestedUserId.Value &&
            string.IsNullOrEmpty(existingUsers[0].PasswordHash) &&
            string.IsNullOrEmpty(existingUsers[0].Email);

        if (!isAnonymousProvisionedOwner)
        {
            return (null, null, Conflict(new { message = "May tindahan nang nakarehistro gamit ang ID na ito. / This store is already registered." }));
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

        var candidateSessionToken = refreshToken
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
            return (null, null, Unauthorized(new
            {
                message = "Hindi pinapayagan ang pag-upgrade ng tindahang ito nang walang authenticated session mula sa parehong device. / Upgrading this store is only allowed from an authenticated session from the same device, not from IDs alone."
            }));
        }

        return (existingTenant, placeholderUser, null);
    }

    private async Task<(Tenant? Tenant, User? User, ActionResult? ErrorResult)> ProvisionOrUpgradeStoreOwnerAsync(
        Guid? requestedTenantId,
        Guid? requestedUserId,
        string? refreshToken,
        string businessName,
        string displayEmail,
        string normalizedEmail,
        string? ownerName,
        string? phone,
        string? firebaseUid,
        CancellationToken cancellationToken)
    {
        var tenantId = requestedTenantId.HasValue && requestedTenantId.Value != Guid.Empty
            ? requestedTenantId.Value
            : Guid.NewGuid();

        var userId = requestedUserId.HasValue && requestedUserId.Value != Guid.Empty
            ? requestedUserId.Value
            : Guid.NewGuid();

        Tenant? tenant = null;
        User? user = null;

        if (requestedTenantId.HasValue && requestedTenantId.Value != Guid.Empty)
        {
            var (existingTenant, placeholderUser, upgradeError) = await ValidateAnonymousStoreUpgradeAsync(
                tenantId,
                requestedUserId,
                refreshToken,
                cancellationToken);

            if (upgradeError != null)
            {
                return (null, null, upgradeError);
            }

            if (existingTenant != null && placeholderUser != null)
            {
                tenant = existingTenant;
                if (string.IsNullOrWhiteSpace(tenant.BusinessName))
                {
                    tenant.BusinessName = businessName;
                }

                user = placeholderUser;
                user.Email = displayEmail;
                user.NormalizedEmail = normalizedEmail;
                if (!string.IsNullOrWhiteSpace(phone))
                {
                    user.Phone = phone.Trim();
                }
                if (!string.IsNullOrWhiteSpace(ownerName))
                {
                    user.OwnerName = ownerName.Trim();
                }
                if (!string.IsNullOrWhiteSpace(firebaseUid))
                {
                    user.FirebaseUid = firebaseUid;
                }
                user.Role = "Owner";
                AuthLockoutHelper.ResetPinLockout(user);
                AuthLockoutHelper.ResetPasswordLockout(user);
                user.LastLoginAt = _timeProvider.GetUtcNow();
            }
        }

        if (tenant == null || user == null)
        {
            if (requestedUserId.HasValue && requestedUserId.Value != Guid.Empty)
            {
                var userIdInUse = await _context.Users.IgnoreQueryFilters()
                    .AnyAsync(u => u.Id == userId, cancellationToken);
                if (userIdInUse)
                {
                    return (null, null, Conflict(new { message = "Ginagamit na ang user ID na ito. / The user ID is already in use." }));
                }
            }

            var now = _timeProvider.GetUtcNow();
            tenant = new Tenant
            {
                Id = tenantId,
                BusinessName = businessName,
                Tier = PlanTier.Libre,
                CreatedAt = now
            };
            _context.Tenants.Add(tenant);

            user = new User
            {
                Id = userId,
                TenantId = tenantId,
                Email = displayEmail,
                NormalizedEmail = normalizedEmail,
                Phone = !string.IsNullOrWhiteSpace(phone) ? phone.Trim() : string.Empty,
                FirebaseUid = firebaseUid ?? string.Empty,
                PasswordHash = string.Empty,
                OwnerName = !string.IsNullOrWhiteSpace(ownerName) ? ownerName.Trim() : null,
                Role = "Owner",
                FailedPinAttempts = 0,
                PinLockoutEnd = null,
                FailedPasswordAttempts = 0,
                PasswordLockoutEnd = null,
                CreatedAt = now,
                LastLoginAt = now
            };
            _context.Users.Add(user);
        }

        return (tenant, user, null);
    }

    private async Task<ActionResult<AuthResponseDto>> SaveNewUserAndRespondAsync(
        User user,
        Tenant tenant,
        bool isNewUser,
        CancellationToken cancellationToken,
        string? pendingOtpCode = null)
    {
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

        if (!string.IsNullOrEmpty(pendingOtpCode) && _emailOtpSender != null)
        {
            try
            {
                await _emailOtpSender.SendOtpAsync(user.Email, pendingOtpCode, user.OwnerName, cancellationToken);
            }
            catch (Exception ex)
            {
                _logger?.LogError(ex, "Failed to send registration OTP email to {Email}. User can request resend.", user.Email);
            }
        }

        AuthLockoutHelper.ResetIpPinThrottle(AuthClaimsHelper.GetClientIpAddress(HttpContext));

        return Ok(AuthResponseBuilder.Build(
            user,
            tenant,
            access,
            refreshToken,
            user.OwnerName,
            isNewUser: isNewUser));
    }

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
        if (request == null || !ModelState.IsValid || string.IsNullOrWhiteSpace(request.Password) || !IsValidPassword(request.Password))
        {
            return BadRequest(ModelState.IsValid ? (object)new { message = "Kailangan ng password (minimum 8 characters na may letra at numero). / Password is required (minimum 8 chars with letters & numbers)." } : ModelState);
        }

        var displayEmail = CleanDisplayEmail(request.Email);
        var normalizedEmail = NormalizeEmail(request.Email);
        if (string.IsNullOrWhiteSpace(normalizedEmail) || !new EmailAddressAttribute().IsValid(normalizedEmail))
        {
            return BadRequest(new { message = "Kailangan ng wastong email address. / Valid email address is required." });
        }

        if (IsDisposableEmail(normalizedEmail))
        {
            return BadRequest(new { message = "Hindi pinapayagan ang pansamantalang (disposable) email address. Mangyaring gumamit ng permanenteng email. / Disposable email addresses are not allowed. Please use a permanent email address." });
        }

        var emailExists = await _context.Users.IgnoreQueryFilters()
            .AnyAsync(u => u.NormalizedEmail == normalizedEmail, cancellationToken);
        if (emailExists)
        {
            return Conflict(new { message = "May tindahan nang nakarehistro gamit ang email na ito. Pakipili ang Mag-login. / A store is already registered with this email." });
        }

        var businessName = request.BusinessName.Trim();
        if (businessName.Length < 2)
        {
            return BadRequest(new { message = "Kailangan ng pangalan ng tindahan (minimum 2 letra). / Store name is required (minimum 2 chars)." });
        }

        var (tenant, user, upgradeError) = await ProvisionOrUpgradeStoreOwnerAsync(
            request.TenantId,
            request.UserId,
            request.RefreshToken,
            businessName,
            displayEmail,
            normalizedEmail,
            request.OwnerName,
            request.Phone,
            firebaseUid: null,
            cancellationToken);

        if (upgradeError != null)
        {
            return upgradeError;
        }

        user!.PasswordHash = _passwordHasher.HashPassword(user, request.Password);
        user.PinHash = !string.IsNullOrWhiteSpace(request.Pin)
            ? _passwordHasher.HashPassword(user, request.Pin.Trim())
            : null;
        user.EmailVerified = false;
        var otpCode = AuthOtpHelper.IssueOtp(user, _timeProvider);

        return await SaveNewUserAndRespondAsync(user, tenant!, isNewUser: false, cancellationToken, otpCode);
    }

    /// <summary>
    /// Authenticates or registers a store owner using a verified Google OAuth token.
    /// Links existing verified email/password accounts if emails match, overwrites credentials and invalidates
    /// active sessions when an existing matching email account is unverified, or provisions a new store with client UUIDs.
    /// </summary>
    [HttpPost("google")]
    [EnableRateLimiting("AuthSensitive")]
    [ProducesResponseType(typeof(AuthResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<AuthResponseDto>> GoogleAuth(
        [FromBody] GoogleAuthRequest request,
        CancellationToken cancellationToken)
    {
        if (request == null || (string.IsNullOrWhiteSpace(request.AccessToken) && string.IsNullOrWhiteSpace(request.IdToken)))
        {
            return BadRequest(new { message = "Kailangan ng Google access token o ID token. / Google access token or ID token is required." });
        }

        if (_googleAuthService == null)
        {
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new { message = "Hindi naka-configure ang Google authentication service. / Google auth service is not configured." });
        }

        var googleUser = await _googleAuthService.VerifyGoogleTokenAsync(request.AccessToken, request.IdToken, cancellationToken);
        if (googleUser == null || !googleUser.EmailVerified || string.IsNullOrWhiteSpace(googleUser.Subject))
        {
            return Unauthorized(new { message = "Hindi ma-verify ang Google account o hindi beripikado ang email. / Google account could not be verified or email is not verified." });
        }

        var displayEmail = CleanDisplayEmail(googleUser.Email);
        var normalizedEmail = NormalizeEmail(googleUser.Email);
        if (string.IsNullOrWhiteSpace(normalizedEmail) || !new EmailAddressAttribute().IsValid(normalizedEmail))
        {
            return BadRequest(new { message = "Kailangan ng wastong email address mula sa Google. / Valid email address from Google is required." });
        }

        if (IsDisposableEmail(normalizedEmail))
        {
            return BadRequest(new { message = "Hindi pinapayagan ang pansamantalang (disposable) email address. / Disposable email addresses are not allowed." });
        }

        var rawGoogleSubject = $"google:{googleUser.Subject}";
        var googleSubject = rawGoogleSubject.Length > 128 ? rawGoogleSubject[..128] : rawGoogleSubject;
        var googleOwnerName = string.IsNullOrWhiteSpace(googleUser.FullName)
            ? null
            : (googleUser.FullName.Trim().Length > 100 ? googleUser.FullName.Trim()[..100] : googleUser.FullName.Trim());

        // Check if user already exists by external Subject or NormalizedEmail
        var existingUser = await _context.Users.IgnoreQueryFilters()
            .FirstOrDefaultAsync(u => u.FirebaseUid == googleSubject || u.NormalizedEmail == normalizedEmail, cancellationToken);

        if (existingUser != null)
        {
            if (existingUser.TenantId != Guid.Empty)
            {
                existingUser.Tenant = await _context.Tenants.IgnoreQueryFilters()
                    .FirstOrDefaultAsync(t => t.Id == existingUser.TenantId, cancellationToken);
            }

            var googleStatusCheck = await CheckAndHandleAccountStatusOnLoginAsync(existingUser, request.RestoreAccount, cancellationToken);
            if (googleStatusCheck != null)
            {
                return googleStatusCheck;
            }

            var now = _timeProvider.GetUtcNow();

            // Never auto-merge unverified accounts: overwrite credentials and invalidate active sessions
            if (!existingUser.EmailVerified)
            {
                existingUser.PasswordHash = string.Empty;
                existingUser.PinHash = null;
                AuthOtpHelper.ClearOtp(existingUser);
                existingUser.SessionsInvalidatedAt = now;
                await AuthRefreshTokenHelper.RevokeAllForUserAsync(_context, existingUser, existingUser.Id, _timeProvider, cancellationToken);
            }

            existingUser.EmailVerified = true;

            if (existingUser.FirebaseUid != googleSubject)
            {
                existingUser.FirebaseUid = googleSubject;
            }

            if (existingUser.Email != displayEmail)
            {
                existingUser.Email = displayEmail;
            }

            if (existingUser.NormalizedEmail != normalizedEmail)
            {
                existingUser.NormalizedEmail = normalizedEmail;
            }

            if (string.IsNullOrWhiteSpace(existingUser.OwnerName) && googleOwnerName != null)
            {
                existingUser.OwnerName = googleOwnerName;
            }
            else if (existingUser.OwnerName?.Length > 100)
            {
                existingUser.OwnerName = existingUser.OwnerName[..100];
            }

            // Guard against orphaned or missing tenants on legacy users
            if (existingUser.Tenant == null || existingUser.TenantId == Guid.Empty)
            {
                var targetTenantId = existingUser.TenantId != Guid.Empty
                    ? existingUser.TenantId
                    : (request.TenantId.HasValue && request.TenantId.Value != Guid.Empty
                        ? request.TenantId.Value
                        : Guid.NewGuid());

                var resolvedTenant = await _context.Tenants.IgnoreQueryFilters()
                    .FirstOrDefaultAsync(t => t.Id == targetTenantId, cancellationToken);

                if (resolvedTenant == null)
                {
                    var resolvedBusinessName = !string.IsNullOrWhiteSpace(request.BusinessName) && request.BusinessName.Trim().Length >= 2
                        ? request.BusinessName.Trim()
                        : (!string.IsNullOrWhiteSpace(existingUser.OwnerName)
                            ? $"{existingUser.OwnerName.Trim()}'s Tindahan"
                            : (!string.IsNullOrWhiteSpace(googleUser.GivenName)
                                ? $"{googleUser.GivenName.Trim()}'s Tindahan"
                                : (!string.IsNullOrWhiteSpace(googleOwnerName)
                                    ? $"{googleOwnerName}'s Tindahan"
                                    : "Aking Tindahan")));

                    if (resolvedBusinessName.Length > 200)
                    {
                        resolvedBusinessName = resolvedBusinessName[..200];
                    }

                    resolvedTenant = new Tenant
                    {
                        Id = targetTenantId,
                        BusinessName = resolvedBusinessName,
                        Tier = PlanTier.Libre,
                        CreatedAt = now
                    };
                    _context.Tenants.Add(resolvedTenant);
                }

                existingUser.Tenant = resolvedTenant;
                existingUser.TenantId = resolvedTenant.Id;
            }

            existingUser.LastLoginAt = now;
            AuthLockoutHelper.ResetPasswordLockout(existingUser);
            AuthLockoutHelper.ResetPinLockout(existingUser);

            var access = _jwtTokenService.GenerateAccessToken(existingUser.Id, existingUser.TenantId, email: existingUser.Email, role: existingUser.Role);
            var (refreshToken, _, _, _) = AuthRefreshTokenHelper.IssueRefreshToken(
                _context,
                _jwtTokenService,
                existingUser,
                existingUser.TenantId,
                _timeProvider);

            try
            {
                await _context.SaveChangesAsync(cancellationToken);
            }
            catch (DbUpdateException ex) when (IsUniqueEmailViolation(ex))
            {
                _context.ChangeTracker.Clear();
                return Conflict(new { message = "May account nang nakarehistro gamit ang email na ito. / An account is already registered with this email." });
            }
            catch (DbUpdateException ex) when (IsUniqueConstraintViolation(ex))
            {
                _context.ChangeTracker.Clear();
                return Conflict(new { message = "May account o tindahan nang nakaugnay sa impormasyong ito. / An account or store is already linked with this information." });
            }

            AuthLockoutHelper.ResetIpPinThrottle(AuthClaimsHelper.GetClientIpAddress(HttpContext));

            return Ok(AuthResponseBuilder.Build(
                existingUser,
                existingUser.Tenant,
                access,
                refreshToken,
                existingUser.OwnerName,
                isNewUser: false));
        }

        // New User (Sign-Up / Store Provisioning)
        var businessName = !string.IsNullOrWhiteSpace(request.BusinessName) && request.BusinessName.Trim().Length >= 2
            ? request.BusinessName.Trim()
            : (!string.IsNullOrWhiteSpace(googleUser.GivenName)
                ? $"{googleUser.GivenName.Trim()}'s Tindahan"
                : (!string.IsNullOrWhiteSpace(googleOwnerName)
                    ? $"{googleOwnerName}'s Tindahan"
                    : "Aking Tindahan"));

        var (tenant, user, upgradeError) = await ProvisionOrUpgradeStoreOwnerAsync(
            request.TenantId,
            request.UserId,
            request.RefreshToken,
            businessName,
            displayEmail,
            normalizedEmail,
            googleOwnerName,
            phone: null,
            firebaseUid: googleSubject,
            cancellationToken);

        if (upgradeError != null)
        {
            return upgradeError;
        }

        user!.EmailVerified = true;
        AuthOtpHelper.ClearOtp(user);

        if (!string.IsNullOrWhiteSpace(request.Pin))
        {
            user.PinHash = _passwordHasher.HashPassword(user, request.Pin.Trim());
        }

        return await SaveNewUserAndRespondAsync(user, tenant!, isNewUser: true, cancellationToken);
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

        var loginStatusCheck = await CheckAndHandleAccountStatusOnLoginAsync(user, request.RestoreAccount, cancellationToken);
        if (loginStatusCheck != null)
        {
            return loginStatusCheck;
        }

        if (verifyResult == PasswordVerificationResult.SuccessRehashNeeded)
        {
            user.PasswordHash = _passwordHasher.HashPassword(user, request.Password);
        }

        AuthLockoutHelper.ResetPasswordLockout(user);
        AuthLockoutHelper.ResetPinLockout(user);
        var now = _timeProvider.GetUtcNow();
        user.LastLoginAt = now;

        string? pendingOtpCode = null;
        if (!user.EmailVerified &&
            (string.IsNullOrEmpty(user.EmailOtpHash) || !user.EmailOtpExpiresAt.HasValue || user.EmailOtpExpiresAt.Value < now))
        {
            pendingOtpCode = AuthOtpHelper.IssueOtp(user, _timeProvider);
        }

        var access = _jwtTokenService.GenerateAccessToken(user.Id, user.TenantId, email: user.Email, role: user.Role);
        var (refreshToken, _, _, _) = AuthRefreshTokenHelper.IssueRefreshToken(
            _context,
            _jwtTokenService,
            user,
            user.TenantId,
            _timeProvider);

        await _context.SaveChangesAsync(cancellationToken);
        if (!string.IsNullOrEmpty(pendingOtpCode) && _emailOtpSender != null)
        {
            try
            {
                await _emailOtpSender.SendOtpAsync(user.Email, pendingOtpCode, user.OwnerName, cancellationToken);
            }
            catch (Exception ex)
            {
                _logger?.LogError(ex, "Failed to send login OTP email to {Email}. User can request resend.", user.Email);
            }
        }

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

            var pin = (request.Pin ?? string.Empty).Trim();
            var verifyResult = _passwordHasher.VerifyHashedPassword(freshUser, freshUser.PinHash, pin);
            if (verifyResult == PasswordVerificationResult.Failed)
            {
                AuthLockoutHelper.RecordIpPinFailure(clientIp, _timeProvider, out var ipLockedOut, out var ipLockMinutes);
                AuthLockoutHelper.RecordPinFailureInMemory(freshUser, _timeProvider, out var isPinLockedOut, out var pinLockMinutes, out var remainingAttempts);
                await _context.SaveChangesAsync(cancellationToken);

                if (ipLockedOut)
                {
                    return AuthLockoutHelper.IpPinLockedOutResult(ipLockMinutes, isInitial: true);
                }

                if (isPinLockedOut)
                {
                    return AuthLockoutHelper.PinLockedOutResult(pinLockMinutes, isInitial: true);
                }

                return AuthLockoutHelper.PinFailedResult(remainingAttempts);
            }

            var pinStatusCheck = await CheckAndHandleAccountStatusOnLoginAsync(freshUser, request.RestoreAccount, cancellationToken);
            if (pinStatusCheck != null)
            {
                return pinStatusCheck;
            }

            AuthLockoutHelper.ResetIpPinThrottle(clientIp);

            var access = _jwtTokenService.GenerateAccessToken(freshUser.Id, freshUser.TenantId, email: freshUser.Email, role: freshUser.Role);
            var (refreshToken, _, _, _) = AuthRefreshTokenHelper.IssueRefreshToken(
                _context,
                _jwtTokenService,
                freshUser,
                freshUser.TenantId,
                _timeProvider);

            AuthLockoutHelper.ResetPinLockout(freshUser);
            var now = _timeProvider.GetUtcNow();
            freshUser.LastLoginAt = now;

            string? pendingOtpCode = null;
            if (!freshUser.EmailVerified &&
                (string.IsNullOrEmpty(freshUser.EmailOtpHash) || !freshUser.EmailOtpExpiresAt.HasValue || freshUser.EmailOtpExpiresAt.Value < now))
            {
                pendingOtpCode = AuthOtpHelper.IssueOtp(freshUser, _timeProvider);
            }

            await _context.SaveChangesAsync(cancellationToken);
            if (!string.IsNullOrEmpty(pendingOtpCode) && _emailOtpSender != null)
            {
                try
                {
                    await _emailOtpSender.SendOtpAsync(freshUser.Email, pendingOtpCode, freshUser.OwnerName, cancellationToken);
                }
                catch (Exception ex)
                {
                    _logger?.LogError(ex, "Failed to send PIN login OTP email to {Email}. User can request resend.", freshUser.Email);
                }
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

        if (user == null)
        {
            return Unauthorized(new { message = "Hindi natagpuan ang account. / User not found." });
        }

        var isGoogleUserWithoutPassword = string.IsNullOrEmpty(user.PasswordHash) && !string.IsNullOrEmpty(user.FirebaseUid);

        if (!isGoogleUserWithoutPassword)
        {
            if (string.IsNullOrEmpty(user.PasswordHash))
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
        }
        else
        {
            if (!string.IsNullOrEmpty(user.PinHash))
            {
                if (AuthLockoutHelper.CheckPinLockout(user, _timeProvider, out var pinLockoutMinutes))
                {
                    return AuthLockoutHelper.PinLockedOutResult(pinLockoutMinutes);
                }

                var pinVerify = _passwordHasher.VerifyHashedPassword(user, user.PinHash, (request.Password ?? string.Empty).Trim());
                if (pinVerify == PasswordVerificationResult.Failed)
                {
                    AuthLockoutHelper.RecordPinFailureInMemory(user, _timeProvider, out var isLockedOut, out var lockMinutes, out var remainingAttempts);
                    await _context.SaveChangesAsync(cancellationToken);

                    if (isLockedOut)
                    {
                        return AuthLockoutHelper.PinLockedOutResult(lockMinutes, isInitial: true);
                    }

                    return AuthLockoutHelper.PinFailedResult(remainingAttempts);
                }

                AuthLockoutHelper.ResetPinLockout(user);
            }
        }
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
        var clientIp = AuthClaimsHelper.GetClientIpAddress(HttpContext);
        AuthLockoutHelper.ResetIpPinThrottle(clientIp);

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
        if (request == null || !ModelState.IsValid || string.IsNullOrWhiteSpace(request.NewPassword) || !IsValidPassword(request.NewPassword))
        {
            return BadRequest(ModelState.IsValid ? (object)new { message = "Kailangan ng bagong password (minimum 8 characters na may letra at numero). / New password is required (minimum 8 chars with letters & numbers)." } : ModelState);
        }

        var userId = AuthClaimsHelper.ResolveUserId(_currentUserService, HttpContext?.User);
        if (!userId.HasValue || userId == Guid.Empty)
        {
            return Unauthorized(new { message = "User is not authenticated." });
        }

        var user = await _context.Users.IgnoreQueryFilters()
            .FirstOrDefaultAsync(u => u.Id == userId.Value, cancellationToken);

        if (user == null)
        {
            return Unauthorized(new { message = "Hindi natagpuan ang account. / User account not found." });
        }

        var hasExistingPassword = !string.IsNullOrEmpty(user.PasswordHash);
        if (hasExistingPassword)
        {
            if (string.IsNullOrWhiteSpace(request.CurrentPassword))
            {
                return BadRequest(new { message = "Kailangan ng kasalukuyang password. / Current password is required." });
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
        }

        user.PasswordHash = _passwordHasher.HashPassword(user, request.NewPassword);
        AuthLockoutHelper.ResetPasswordLockout(user);

        string? responseRefreshToken = null;
        string? currentFamilyId = null;
        string? currentTokenId = null;
        if (!string.IsNullOrWhiteSpace(request.RefreshToken) &&
            _jwtTokenService.ValidateRefreshToken(request.RefreshToken, out var refUid, out _, out var tokenId, out var famId) &&
            refUid == user.Id)
        {
            currentFamilyId = famId;
            currentTokenId = tokenId;
        }

        if (currentFamilyId != null && currentTokenId != null)
        {
            await AuthRefreshTokenHelper.RevokeOtherSessionsForUserAsync(
                _context, user, user.Id, currentFamilyId, _timeProvider, cancellationToken);
            var (rToken, _, _, _) = await AuthRefreshTokenHelper.RotatePresentedRefreshTokenAsync(
                _context, _jwtTokenService, user, user.TenantId, _timeProvider, currentTokenId, currentFamilyId, cancellationToken);
            responseRefreshToken = rToken;
        }
        else
        {
            await AuthRefreshTokenHelper.RevokeAllForUserAsync(_context, user, user.Id, _timeProvider, cancellationToken);
        }

        await _context.SaveChangesAsync(cancellationToken);

        if (responseRefreshToken != null)
        {
            var tenant = await _context.Tenants.IgnoreQueryFilters()
                .FirstOrDefaultAsync(t => t.Id == user.TenantId, cancellationToken);
            var access = _jwtTokenService.GenerateAccessToken(user.Id, user.TenantId, email: user.Email, role: user.Role);
            return Ok(AuthResponseBuilder.Build(user, tenant, access, refreshToken: responseRefreshToken, ownerName: user.OwnerName));
        }

        return Ok(new { message = "Matagumpay na nabago ang password. Na-revoke ang lahat ng lumang sessions. / Password changed successfully. All previous sessions revoked." });
    }

    /// <summary>
    /// Initiates password reset by issuing a 6-digit OTP to the registered email address.
    /// Returns 200 generic message if email is not found to prevent user enumeration.
    /// </summary>
    [AllowAnonymous]
    [EnableRateLimiting("AuthSensitive")]
    [HttpPost("forgot-password")]
    [Route("/auth/forgot-password")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> ForgotPassword(
        [FromBody] ForgotPasswordRequest request,
        CancellationToken cancellationToken)
    {
        if (request == null || !ModelState.IsValid || string.IsNullOrWhiteSpace(request.Email))
        {
            return BadRequest(ModelState.IsValid ? (object)new { message = "Kailangan ng wastong email address. / Valid email address is required." } : ModelState);
        }

        var cleanEmail = request.Email.Trim().ToLowerInvariant();
        var user = await _context.Users.IgnoreQueryFilters()
            .FirstOrDefaultAsync(u => u.NormalizedEmail == cleanEmail, cancellationToken);

        // Anti-enumeration: return success message even if account is not found or deleted
        if (user == null || user.AccountStatus == FluentTindahan.Domain.Entities.User.StatusDeleted)
        {
            return Ok(new { message = "Kung may account para sa email na ito, nagpadala kami ng 6-digit verification code. / If an account exists for this email, we sent a 6-digit verification code." });
        }

        if (!AuthOtpHelper.CanResendOtp(user, _timeProvider, out _))
        {
            return Ok(new { message = "Kung may account para sa email na ito, nagpadala kami ng 6-digit verification code. / If an account exists for this email, we sent a 6-digit verification code." });
        }

        var otpCode = AuthOtpHelper.IssueOtp(user, _timeProvider);
        await _context.SaveChangesAsync(cancellationToken);

        if (_emailOtpSender != null)
        {
            try
            {
                await _emailOtpSender.SendOtpAsync(user.Email, otpCode, user.OwnerName, cancellationToken);
            }
            catch (Exception ex)
            {
                _logger?.LogError(ex, "Failed to send forgot-password OTP email to {Email}", user.Email);
            }
        }

        return Ok(new
        {
            message = "Nagpadala kami ng 6-digit verification code sa iyong email. / We sent a 6-digit verification code to your email."
        });
    }

    /// <summary>
    /// Resets the user's password using the 6-digit email verification OTP.
    /// Revokes all existing refresh tokens and invalidates past sessions upon success.
    /// </summary>
    [AllowAnonymous]
    [EnableRateLimiting("AuthSensitive")]
    [HttpPost("reset-password")]
    [Route("/auth/reset-password")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> ResetPassword(
        [FromBody] ResetPasswordRequest request,
        CancellationToken cancellationToken)
    {
        if (request == null || !ModelState.IsValid ||
            string.IsNullOrWhiteSpace(request.Email) ||
            string.IsNullOrWhiteSpace(request.Otp) ||
            string.IsNullOrWhiteSpace(request.NewPassword) ||
            !IsValidPassword(request.NewPassword))
        {
            return BadRequest(ModelState.IsValid ? (object)new { message = "Kailangan ng email, 6-digit code, at bagong password (minimum 8 characters na may letra at numero). / Email, 6-digit code, and new password (minimum 8 chars with letters & numbers) are required." } : ModelState);
        }

        var cleanEmail = request.Email.Trim().ToLowerInvariant();
        var user = await _context.Users.IgnoreQueryFilters()
            .FirstOrDefaultAsync(u => u.NormalizedEmail == cleanEmail, cancellationToken);

        if (user == null || user.AccountStatus == FluentTindahan.Domain.Entities.User.StatusDeleted)
        {
            return BadRequest(new { message = "Hindi natagpuan ang account o hindi wasto ang verification code. / Account not found or invalid verification code." });
        }

        var otpStatus = AuthOtpHelper.VerifyOtp(user, request.Otp, _timeProvider);
        if (otpStatus != OtpVerificationStatus.Success)
        {
            await _context.SaveChangesAsync(cancellationToken);
            return otpStatus switch
            {
                OtpVerificationStatus.InvalidFormat => BadRequest(new { message = "Kailangan ng 6-digit verification code. / 6-digit verification code required." }),
                OtpVerificationStatus.MissingOrExpired => BadRequest(new { message = "Nag-expire na ang verification code o walang aktibong request. / Verification code has expired or is invalid." }),
                OtpVerificationStatus.TooManyAttempts => StatusCode(StatusCodes.Status429TooManyRequests, new { message = "Masyadong maraming maling pagsubok. Humiling ng bagong code. / Too many failed attempts. Please request a new code." }),
                _ => BadRequest(new { message = "Maling verification code. / Invalid verification code." })
            };
        }

        user.PasswordHash = _passwordHasher.HashPassword(user, request.NewPassword);
        AuthLockoutHelper.ResetPasswordLockout(user);
        user.SessionsInvalidatedAt = _timeProvider.GetUtcNow();

        await AuthRefreshTokenHelper.RevokeAllForUserAsync(_context, user, user.Id, _timeProvider, cancellationToken);
        await _context.SaveChangesAsync(cancellationToken);

        return Ok(new { message = "Matagumpay na na-reset ang iyong password. Maaari ka nang mag-login gamit ang bagong password. / Password reset successfully. You can now log in with your new password." });
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

            if (IsDisposableEmail(normalizedEmail))
            {
                return BadRequest(new { message = "Hindi pinapayagan ang pansamantalang (disposable) email address. Mangyaring gumamit ng permanenteng email. / Disposable email addresses are not allowed. Please use a permanent email address." });
            }

            if (!string.Equals(user.NormalizedEmail, normalizedEmail, StringComparison.OrdinalIgnoreCase))
            {
                isEmailChanging = true;
            }
        }

        string? responseRefreshToken = null;
        string? pendingOtpCode = null;

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
            user.EmailVerified = false;
            pendingOtpCode = AuthOtpHelper.IssueOtp(user, _timeProvider);

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

        if (!string.IsNullOrEmpty(pendingOtpCode) && _emailOtpSender != null)
        {
            try
            {
                await _emailOtpSender.SendOtpAsync(user.Email, pendingOtpCode, user.OwnerName, cancellationToken);
            }
            catch (Exception ex)
            {
                _logger?.LogError(ex, "Failed to send profile update OTP email to {Email}. User can request resend.", user.Email);
            }
        }

        var access = _jwtTokenService.GenerateAccessToken(user.Id, tenant.Id, email: user.Email, role: user.Role);
        return Ok(AuthResponseBuilder.Build(user, tenant, access, refreshToken: responseRefreshToken, ownerName: user.OwnerName));
    }

    /// <summary>
    /// Verifies a 6-digit email OTP for a newly registered or email-updated account.
    /// Can be called with an authenticated session or by supplying the email address.
    /// </summary>
    [HttpPost("verify-email-otp")]
    [EnableRateLimiting("AuthSensitive")]
    [ProducesResponseType(typeof(AuthResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<ActionResult<AuthResponseDto>> VerifyEmailOtp(
        [FromBody] VerifyEmailOtpRequest request,
        CancellationToken cancellationToken)
    {
        if (request == null || !ModelState.IsValid || string.IsNullOrWhiteSpace(request.Otp))
        {
            return BadRequest(ModelState.IsValid ? (object)new { message = "Kailangan ng 6-digit OTP code. / A 6-digit OTP code is required." } : ModelState);
        }

        var user = await ResolveUserForOtpAsync(request.Email, cancellationToken);
        if (user == null || user.Tenant == null)
        {
            return Unauthorized(new { message = "Hindi natagpuan ang account. / Account not found." });
        }

        if (user.EmailVerified)
        {
            return BadRequest(new { message = "Beripikado na ang email address na ito. / This email address is already verified." });
        }

        var status = AuthOtpHelper.VerifyOtp(user, request.Otp, _timeProvider);
        switch (status)
        {
            case OtpVerificationStatus.InvalidFormat:
                return BadRequest(new { message = "Kailangan ng 6-digit OTP code. / A 6-digit OTP code is required." });

            case OtpVerificationStatus.MissingOrExpired:
                return BadRequest(new { message = "Paso na o walang OTP code. Mangyaring humingi ng bagong code. / OTP code has expired or is missing. Please request a new code." });

            case OtpVerificationStatus.TooManyAttempts:
                await _context.SaveChangesAsync(cancellationToken);
                return StatusCode(StatusCodes.Status429TooManyRequests, new
                {
                    message = "Masyadong maraming maling pagsubok sa OTP. Mangyaring humingi ng bagong code. / Too many failed OTP attempts. Please request a new code."
                });

            case OtpVerificationStatus.InvalidCode:
                await _context.SaveChangesAsync(cancellationToken);
                var remainingAttempts = Math.Max(0, AuthOtpHelper.MaxVerificationAttempts - user.EmailOtpAttempts);
                return BadRequest(new
                {
                    message = $"Maling OTP code. May natitira ka pang {remainingAttempts} pagsubok. / Invalid OTP code. {remainingAttempts} attempts remaining.",
                    remainingAttempts
                });

            default:
                var access = _jwtTokenService.GenerateAccessToken(user.Id, user.TenantId, email: user.Email, role: user.Role);
                var (refreshToken, _, _, _) = AuthRefreshTokenHelper.IssueRefreshToken(
                    _context,
                    _jwtTokenService,
                    user,
                    user.TenantId,
                    _timeProvider);
                await _context.SaveChangesAsync(cancellationToken);
                return Ok(AuthResponseBuilder.Build(user, user.Tenant, access, refreshToken, user.OwnerName));
        }
    }

    /// <summary>
    /// Issues and dispatches a fresh 6-digit email verification OTP with a 60-second resend cooldown.
    /// </summary>
    [HttpPost("resend-email-otp")]
    [EnableRateLimiting("AuthSensitive")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> ResendEmailOtp(
        [FromBody] ResendEmailOtpRequest? request,
        CancellationToken cancellationToken)
    {
        var user = await ResolveUserForOtpAsync(request?.Email, cancellationToken);
        if (user == null || user.Tenant == null)
        {
            return Unauthorized(new { message = "Hindi natagpuan ang account. / Account not found." });
        }

        if (user.EmailVerified)
        {
            return BadRequest(new { message = "Beripikado na ang email address na ito. / This email address is already verified." });
        }

        if (!AuthOtpHelper.CanResendOtp(user, _timeProvider, out var retryAfterSeconds))
        {
            return StatusCode(StatusCodes.Status429TooManyRequests, new
            {
                message = $"Mangyaring maghintay ng {retryAfterSeconds} segundo bago humingi ng bagong OTP. / Please wait {retryAfterSeconds} seconds before requesting a new OTP.",
                retryAfterSeconds
            });
        }

        var otpCode = AuthOtpHelper.IssueOtp(user, _timeProvider);
        await _context.SaveChangesAsync(cancellationToken);

        if (_emailOtpSender != null)
        {
            await _emailOtpSender.SendOtpAsync(user.Email, otpCode, user.OwnerName, cancellationToken);
        }

        return Ok(new
        {
            message = "Naipadala na ang bagong 6-digit OTP sa iyong email. / A new 6-digit OTP has been sent to your email."
        });
    }

    private async Task<User?> ResolveUserForOtpAsync(string? email, CancellationToken cancellationToken)
    {
        var userId = AuthClaimsHelper.ResolveUserId(_currentUserService, HttpContext?.User);
        if (userId.HasValue && userId.Value != Guid.Empty)
        {
            var byId = await _context.Users.IgnoreQueryFilters()
                .Include(u => u.Tenant)
                .FirstOrDefaultAsync(u => u.Id == userId.Value, cancellationToken);
            if (byId != null)
            {
                return byId;
            }
        }

        var normalizedEmail = NormalizeEmail(email);
        if (string.IsNullOrWhiteSpace(normalizedEmail))
        {
            return null;
        }

        return await _context.Users.IgnoreQueryFilters()
            .Include(u => u.Tenant)
            .FirstOrDefaultAsync(u => u.NormalizedEmail == normalizedEmail, cancellationToken);
    }

    /// <summary>
    /// Initiates self-service account deactivation (30-day grace period) or immediate permanent anonymization.
    /// Requires step-up re-authentication via current password, PIN, or Google ID token.
    /// Immediately revokes all active sessions and refresh tokens.
    /// </summary>
    [Authorize]
    [EnableRateLimiting("AuthSensitive")]
    [HttpPost("delete-account")]
    [Route("/auth/delete-account")]
    [ProducesResponseType(typeof(DeleteAccountResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<ActionResult<DeleteAccountResponseDto>> DeleteAccount(
        [FromBody] DeleteAccountRequest? request,
        CancellationToken cancellationToken)
    {
        if (request == null)
        {
            return BadRequest(new { message = "Kailangan ng kumpirmasyon upang burahin ang account. / Confirmation is required to delete the account." });
        }

        var userId = AuthClaimsHelper.ResolveUserId(_currentUserService, HttpContext?.User);
        if (!userId.HasValue || userId == Guid.Empty)
        {
            return Unauthorized(new { message = "User is not authenticated." });
        }

        var user = await _context.Users.IgnoreQueryFilters()
            .Include(u => u.Tenant)
            .FirstOrDefaultAsync(u => u.Id == userId.Value, cancellationToken);

        if (user == null || string.Equals(user.AccountStatus, Domain.Entities.User.StatusDeleted, StringComparison.OrdinalIgnoreCase))
        {
            return Unauthorized(new { message = "Hindi natagpuan ang account. / User account not found." });
        }

        var verified = false;
        var hasPassword = !string.IsNullOrEmpty(user.PasswordHash);
        var hasPin = !string.IsNullOrEmpty(user.PinHash);
        var hasGoogle = !string.IsNullOrEmpty(user.FirebaseUid);

        if (!string.IsNullOrWhiteSpace(request.Password))
        {
            if (!hasPassword)
            {
                return BadRequest(new { message = "Walang naka-set na password ang account. / Account has no password configured." });
            }

            if (AuthLockoutHelper.CheckPasswordLockout(user, _timeProvider, out var lockoutMinutes))
            {
                return AuthLockoutHelper.PasswordLockedOutResult(lockoutMinutes);
            }

            var pwdVerify = _passwordHasher.VerifyHashedPassword(user, user.PasswordHash, request.Password);
            if (pwdVerify == PasswordVerificationResult.Failed)
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

            AuthLockoutHelper.ResetPasswordLockout(user);
            verified = true;
        }
        else if (!string.IsNullOrWhiteSpace(request.Pin))
        {
            if (!hasPin)
            {
                return BadRequest(new { message = "Walang naka-set na PIN ang account. / Account has no PIN configured." });
            }

            if (AuthLockoutHelper.CheckPinLockout(user, _timeProvider, out var pinLockoutMinutes))
            {
                return AuthLockoutHelper.PinLockedOutResult(pinLockoutMinutes);
            }

            var pinVerify = _passwordHasher.VerifyHashedPassword(user, user.PinHash!, request.Pin.Trim());
            if (pinVerify == PasswordVerificationResult.Failed)
            {
                AuthLockoutHelper.RecordPinFailureInMemory(user, _timeProvider, out var isPinLockedOut, out var pinLockMinutes, out var remainingPinAttempts);
                await _context.SaveChangesAsync(cancellationToken);
                if (isPinLockedOut)
                {
                    return AuthLockoutHelper.PinLockedOutResult(pinLockMinutes, isInitial: true);
                }

                return AuthLockoutHelper.PinFailedResult(remainingPinAttempts);
            }

            AuthLockoutHelper.ResetPinLockout(user);
            verified = true;
        }
        else if (!string.IsNullOrWhiteSpace(request.GoogleIdToken) || !string.IsNullOrWhiteSpace(request.GoogleAccessToken))
        {
            if (_googleAuthService == null)
            {
                return StatusCode(StatusCodes.Status503ServiceUnavailable, new { message = "Hindi available ang Google verification. / Google verification is unavailable." });
            }

            var googleUser = await _googleAuthService.VerifyGoogleTokenAsync(request.GoogleAccessToken, request.GoogleIdToken, cancellationToken);
            if (googleUser == null)
            {
                return Unauthorized(new { message = "Hindi balido o nag-expire na ang Google token. / Invalid or expired Google token." });
            }

            var rawGoogleSubject = $"google:{googleUser.Subject}";
            var googleSubject = rawGoogleSubject.Length > 128 ? rawGoogleSubject[..128] : rawGoogleSubject;
            var matchesSubject = hasGoogle && (
                string.Equals(user.FirebaseUid, googleSubject, StringComparison.Ordinal) ||
                string.Equals(user.FirebaseUid, googleUser.Subject?.Trim(), StringComparison.Ordinal));
            var matchesEmail = !string.IsNullOrWhiteSpace(googleUser.Email) &&
                               string.Equals(user.NormalizedEmail, NormalizeEmail(googleUser.Email), StringComparison.OrdinalIgnoreCase);

            if (!matchesSubject && !matchesEmail)
            {
                return Unauthorized(new { message = "Hindi tugma ang Google account sa kasalukuyang tindahan. / Google account does not match the current store account." });
            }

            verified = true;
        }

        if (!verified)
        {
            return BadRequest(new
            {
                message = "Kailangan ng kasalukuyang password, PIN, o Google re-authentication upang kumpirmahin ang pagbura ng account. / Current password, PIN, or Google re-authentication is required to confirm account deletion."
            });
        }

        var now = _timeProvider.GetUtcNow();

        if (request.Immediate)
        {
            await AccountDeletionHelper.AnonymizeUserAndTenantAsync(_context, user, user.Tenant, now, cancellationToken);
            await _context.SaveChangesAsync(cancellationToken);

            return Ok(new DeleteAccountResponseDto(
                Domain.Entities.User.StatusDeleted,
                null,
                "Permanenteng binura at in-anonymize na ang iyong account. / Your account has been permanently deleted and anonymized."));
        }

        var scheduledAt = now.AddDays(AccountDeletionHelper.GracePeriodDays);
        user.AccountStatus = Domain.Entities.User.StatusPendingDeletion;
        user.DeletionScheduledAt = scheduledAt;
        await AuthRefreshTokenHelper.RevokeAllForUserAsync(_context, user, user.Id, _timeProvider, cancellationToken);
        await _context.SaveChangesAsync(cancellationToken);

        return Ok(new DeleteAccountResponseDto(
            Domain.Entities.User.StatusPendingDeletion,
            scheduledAt,
            "Naka-iskedyul na ang pagbura ng iyong account sa loob ng 30 araw. Maaari mo itong ibalik sa pamamagitan ng pag-login bago ang petsang ito. / Your account is scheduled for deletion in 30 days. You can restore it by signing in before this date."));
    }

    private async Task<ActionResult<AuthResponseDto>?> CheckAndHandleAccountStatusOnLoginAsync(
        User user,
        bool? restoreAccount,
        CancellationToken cancellationToken)
    {
        if (string.Equals(user.AccountStatus, Domain.Entities.User.StatusDeleted, StringComparison.OrdinalIgnoreCase))
        {
            return Unauthorized(new { message = "Ang account na ito ay permanente nang binura. / This account has been permanently deleted." });
        }

        if (string.Equals(user.AccountStatus, Domain.Entities.User.StatusPendingDeletion, StringComparison.OrdinalIgnoreCase))
        {
            var now = _timeProvider.GetUtcNow();
            if (user.DeletionScheduledAt.HasValue && user.DeletionScheduledAt.Value <= now)
            {
                await AccountDeletionHelper.AnonymizeUserAndTenantAsync(_context, user, user.Tenant, now, cancellationToken);
                await _context.SaveChangesAsync(cancellationToken);
                return Unauthorized(new { message = "Ang account na ito ay permanente nang binura matapos ang 30-day grace period. / This account has been permanently deleted after the 30-day grace period." });
            }

            if (restoreAccount == true)
            {
                user.AccountStatus = Domain.Entities.User.StatusActive;
                user.DeletionScheduledAt = null;
                return null;
            }

            return Conflict(new
            {
                message = "Naka-deactivate ang iyong account at nakatakdang burahin. Gusto mo bang ibalik ang iyong account? / Your account is deactivated and scheduled for deletion. Would you like to restore your account?",
                pendingDeletion = true,
                deletionScheduledAt = user.DeletionScheduledAt
            });
        }

        return null;
    }
}
