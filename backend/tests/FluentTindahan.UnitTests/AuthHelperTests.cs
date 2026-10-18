using System.Net;
using System.Security.Claims;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Moq;
using Npgsql;
using FluentTindahan.Application.Common.Interfaces;
using FluentTindahan.Domain.Entities;
using FluentTindahan.Domain.Enums;
using FluentTindahan.Domain.Interfaces;
using FluentTindahan.Infrastructure.Persistence;
using FluentTindahan.WebApi.Controllers;
using FluentTindahan.WebApi.Controllers.Helpers;
using Xunit;

namespace FluentTindahan.UnitTests;

[Collection("AuthLockout")]
public class AuthHelperTests
{
    private sealed class MutableTimeProvider : TimeProvider
    {
        private DateTimeOffset _utcNow;
        public MutableTimeProvider(DateTimeOffset utcNow) => _utcNow = utcNow;
        public override DateTimeOffset GetUtcNow() => _utcNow;
        public void Advance(TimeSpan duration) => _utcNow = _utcNow.Add(duration);
    }

    private static AppDbContext CreateInMemoryContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;

        var userMock = new Mock<ICurrentUserService>();
        userMock.Setup(u => u.TenantId).Returns(Guid.NewGuid());
        userMock.Setup(u => u.UserId).Returns(Guid.NewGuid());

        return new AppDbContext(options, userMock.Object);
    }

    #region AuthLockoutHelper Tests

    [Fact]
    public void PasswordLockout_WhenNoLockout_ReturnsFalse()
    {
        var timeProvider = new MutableTimeProvider(DateTimeOffset.UtcNow);
        var user = new User { FailedPasswordAttempts = 0, PasswordLockoutEnd = null };

        var isLocked = AuthLockoutHelper.CheckPasswordLockout(user, timeProvider, out var remainingMinutes);

        isLocked.Should().BeFalse();
        remainingMinutes.Should().Be(0);
    }

    [Fact]
    public void PasswordLockout_WhenActive_ReturnsTrueWithRemainingMinutes()
    {
        var now = DateTimeOffset.UtcNow;
        var timeProvider = new MutableTimeProvider(now);
        var user = new User
        {
            FailedPasswordAttempts = 5,
            PasswordLockoutEnd = now.AddMinutes(12)
        };

        var isLocked = AuthLockoutHelper.CheckPasswordLockout(user, timeProvider, out var remainingMinutes);

        isLocked.Should().BeTrue();
        remainingMinutes.Should().Be(12);
    }

    [Fact]
    public void PasswordLockout_WhenExpired_ClearsLockoutAndReturnsFalse()
    {
        var now = DateTimeOffset.UtcNow;
        var timeProvider = new MutableTimeProvider(now);
        var user = new User
        {
            FailedPasswordAttempts = 5,
            PasswordLockoutEnd = now.AddMinutes(-1)
        };

        var isLocked = AuthLockoutHelper.CheckPasswordLockout(user, timeProvider, out var remainingMinutes);

        isLocked.Should().BeFalse();
        remainingMinutes.Should().Be(0);
        user.FailedPasswordAttempts.Should().Be(0);
        user.PasswordLockoutEnd.Should().BeNull();
    }

    [Fact]
    public void RecordPasswordFailure_IncrementsAndLocksOnFifthFailure()
    {
        var now = DateTimeOffset.UtcNow;
        var timeProvider = new MutableTimeProvider(now);
        var user = new User { FailedPasswordAttempts = 4 };

        AuthLockoutHelper.RecordPasswordFailure(user, timeProvider, out var isLocked, out var lockoutMins, out var remaining);

        user.FailedPasswordAttempts.Should().Be(5);
        isLocked.Should().BeTrue();
        lockoutMins.Should().Be(15);
        remaining.Should().Be(0);
        user.PasswordLockoutEnd.Should().Be(now.AddMinutes(15));
    }

    [Fact]
    public void ResetPasswordLockout_ClearsFields()
    {
        var user = new User { FailedPasswordAttempts = 3, PasswordLockoutEnd = DateTimeOffset.UtcNow.AddMinutes(10) };

        AuthLockoutHelper.ResetPasswordLockout(user);

        user.FailedPasswordAttempts.Should().Be(0);
        user.PasswordLockoutEnd.Should().BeNull();
    }

    [Fact]
    public void IpPinThrottle_TracksAndLocksOnFifthAttempt()
    {
        var clientIp = "192.168.1.100";
        AuthLockoutHelper.ResetIpPinThrottle(clientIp);
        var timeProvider = new MutableTimeProvider(DateTimeOffset.UtcNow);

        for (int i = 1; i <= 4; i++)
        {
            var attempts = AuthLockoutHelper.RecordIpPinFailure(clientIp, timeProvider, out var locked, out _);
            attempts.Should().Be(i);
            locked.Should().BeFalse();
        }

        var fifth = AuthLockoutHelper.RecordIpPinFailure(clientIp, timeProvider, out var fifthLocked, out var lockMinutes);
        fifth.Should().Be(5);
        fifthLocked.Should().BeTrue();
        lockMinutes.Should().Be(15);

        var isThrottled = AuthLockoutHelper.IsIpPinThrottled(clientIp, timeProvider, out var remaining);
        isThrottled.Should().BeTrue();
        remaining.Should().Be(15);

        AuthLockoutHelper.ResetIpPinThrottle(clientIp);
        AuthLockoutHelper.IsIpPinThrottled(clientIp, timeProvider, out _).Should().BeFalse();
    }

    [Fact]
    public void IpPinThrottle_SweepExpiredThrottles_PrunesExpiredEntries()
    {
        AuthLockoutHelper.ResetAllIpPinThrottles();
        var timeProvider = new MutableTimeProvider(DateTimeOffset.UtcNow);

        // IP1: 1 failure at T0 (failure window 15m)
        AuthLockoutHelper.RecordIpPinFailure("10.0.0.1", timeProvider, out _, out _);

        // IP2: 5 failures at T0 (lockout until T0 + 15m)
        for (int i = 0; i < 5; i++)
        {
            AuthLockoutHelper.RecordIpPinFailure("10.0.0.2", timeProvider, out _, out _);
        }

        // Advance 10m
        timeProvider.Advance(TimeSpan.FromMinutes(10));

        // IP3: 1 failure at T0 + 10m (valid until T0 + 25m)
        AuthLockoutHelper.RecordIpPinFailure("10.0.0.3", timeProvider, out _, out _);

        AuthLockoutHelper.GetIpThrottleCount().Should().Be(3);

        // Advance another 6m (now at T0 + 16m)
        timeProvider.Advance(TimeSpan.FromMinutes(6));

        // Sweep expired throttles: IP1 and IP2 expired (> 15m), IP3 has 9m left
        var pruned = AuthLockoutHelper.SweepExpiredThrottles(timeProvider);
        pruned.Should().Be(2);

        AuthLockoutHelper.GetIpThrottleCount().Should().Be(1);
        AuthLockoutHelper.IsIpPinThrottled("10.0.0.3", timeProvider, out _).Should().BeFalse();

        // Second failure for IP3 records as attempt 2
        var ip3Attempts = AuthLockoutHelper.RecordIpPinFailure("10.0.0.3", timeProvider, out _, out _);
        ip3Attempts.Should().Be(2);
    }

    [Fact]
    public void IpPinThrottle_IsIpPinThrottled_PrunesExpiredEntryOnAccess()
    {
        AuthLockoutHelper.ResetAllIpPinThrottles();
        var timeProvider = new MutableTimeProvider(DateTimeOffset.UtcNow);

        for (int i = 0; i < 5; i++)
        {
            AuthLockoutHelper.RecordIpPinFailure("10.0.0.99", timeProvider, out _, out _);
        }

        AuthLockoutHelper.IsIpPinThrottled("10.0.0.99", timeProvider, out var remaining).Should().BeTrue();
        remaining.Should().Be(15);
        AuthLockoutHelper.GetIpThrottleCount().Should().Be(1);

        // Advance past 15m lockout
        timeProvider.Advance(TimeSpan.FromMinutes(16));

        // On read, the expired entry should be pruned
        AuthLockoutHelper.IsIpPinThrottled("10.0.0.99", timeProvider, out _).Should().BeFalse();
        AuthLockoutHelper.GetIpThrottleCount().Should().Be(0);
    }

    [Fact]
    public async Task IpPinThrottle_ResetAllIpPinThrottles_ConcurrentAccess_IsRaceFree()
    {
        AuthLockoutHelper.ResetAllIpPinThrottles();
        var timeProvider = new MutableTimeProvider(DateTimeOffset.UtcNow);

        var tasks = Enumerable.Range(0, 30).Select(async taskId =>
        {
            for (int i = 0; i < 50; i++)
            {
                var ip = $"192.168.0.{taskId % 5}";
                if (i % 5 == 0)
                {
                    AuthLockoutHelper.ResetAllIpPinThrottles();
                }
                else if (i % 3 == 0)
                {
                    AuthLockoutHelper.ResetIpPinThrottle(ip);
                }
                else if (i % 2 == 0)
                {
                    AuthLockoutHelper.RecordIpPinFailure(ip, timeProvider, out _, out _);
                }
                else
                {
                    AuthLockoutHelper.IsIpPinThrottled(ip, timeProvider, out _);
                }

                await Task.Yield();
            }
        });

        Func<Task> act = async () => await Task.WhenAll(tasks);
        await act.Should().NotThrowAsync();
    }

    [Fact]
    public async Task UserPinLock_SweepIdleUserLocks_PrunesIdleLocksAndPreservesActiveLocks()
    {
        AuthLockoutHelper.ResetAllUserPinLocks();
        var timeProvider = new MutableTimeProvider(DateTimeOffset.UtcNow);

        var user1 = Guid.NewGuid();
        var user2 = Guid.NewGuid();
        var user3 = Guid.NewGuid();

        // User 1 gets lock but doesn't hold it
        var lock1 = AuthLockoutHelper.GetUserPinLock(user1, timeProvider);
        lock1.CurrentCount.Should().Be(1);

        // User 2 gets lock and holds it
        var lock2 = AuthLockoutHelper.GetUserPinLock(user2, timeProvider);
        await lock2.WaitAsync();

        // Advance 10m
        timeProvider.Advance(TimeSpan.FromMinutes(10));

        // User 3 accessed now (fresh)
        var lock3 = AuthLockoutHelper.GetUserPinLock(user3, timeProvider);

        AuthLockoutHelper.HasUserPinLock(user1).Should().BeTrue();
        AuthLockoutHelper.HasUserPinLock(user2).Should().BeTrue();
        AuthLockoutHelper.HasUserPinLock(user3).Should().BeTrue();

        // Sweep with 5m timeout:
        // user1: idle for 10m, CurrentCount == 1 -> pruned
        // user2: accessed 10m ago, but CurrentCount == 0 (held) -> NOT pruned
        // user3: accessed 0m ago -> NOT pruned
        var pruned = AuthLockoutHelper.SweepIdleUserLocks(timeProvider, TimeSpan.FromMinutes(5));
        pruned.Should().BeGreaterThanOrEqualTo(1);
        AuthLockoutHelper.HasUserPinLock(user1).Should().BeFalse();
        AuthLockoutHelper.HasUserPinLock(user2).Should().BeTrue();
        AuthLockoutHelper.HasUserPinLock(user3).Should().BeTrue();

        lock2.Release();
    }

    [Fact]
    public async Task UserPinLock_ConcurrentLockAcquisition_IsRaceFreeAndEnforcesMutualExclusion()
    {
        AuthLockoutHelper.ResetAllUserPinLocks();
        var timeProvider = new MutableTimeProvider(DateTimeOffset.UtcNow);
        var userId = Guid.NewGuid();

        var concurrentHolderCount = 0;
        var maxObservedConcurrency = 0;
        var iterations = 25;

        var tasks = Enumerable.Range(0, 10).Select(async _ =>
        {
            for (int i = 0; i < iterations; i++)
            {
                var userLock = AuthLockoutHelper.GetUserPinLock(userId, timeProvider);
                await userLock.WaitAsync();
                try
                {
                    var current = Interlocked.Increment(ref concurrentHolderCount);
                    if (current > maxObservedConcurrency)
                    {
                        Interlocked.Exchange(ref maxObservedConcurrency, current);
                    }

                    await Task.Delay(2);
                    Interlocked.Decrement(ref concurrentHolderCount);
                }
                finally
                {
                    userLock.Release();
                }

                // Randomly trigger sweeps concurrently
                if (i % 5 == 0)
                {
                    AuthLockoutHelper.SweepIdleUserLocks(timeProvider, TimeSpan.Zero);
                }
            }
        });

        await Task.WhenAll(tasks);

        maxObservedConcurrency.Should().Be(1);
        concurrentHolderCount.Should().Be(0);
    }

    #endregion

    #region AuthRefreshTokenHelper Tests

    [Fact]
    public async Task IssueRefreshToken_PersistsRecordAndAttachesToUser()
    {
        var context = CreateInMemoryContext();
        var jwtService = AuthControllerTests.CreateJwtTokenService();
        var timeProvider = new MutableTimeProvider(DateTimeOffset.UtcNow);

        var user = new User { Id = Guid.NewGuid(), TenantId = Guid.NewGuid() };
        context.Users.Add(user);
        await context.SaveChangesAsync();

        var (refreshToken, expiresAt, tokenHash, familyId) = AuthRefreshTokenHelper.IssueRefreshToken(
            context,
            jwtService,
            user,
            user.TenantId,
            timeProvider);
        await context.SaveChangesAsync();

        refreshToken.Should().NotBeNullOrWhiteSpace();
        tokenHash.Should().NotBeNullOrWhiteSpace();
        familyId.Should().NotBeNullOrWhiteSpace();
        user.RefreshTokenIdHash.Should().Be(tokenHash);
        user.RefreshTokenExpiresAt.Should().Be(expiresAt);

        var savedRecord = await context.UserRefreshTokens.IgnoreQueryFilters().FirstOrDefaultAsync(r => r.TokenHash == tokenHash);
        savedRecord.Should().NotBeNull();
        savedRecord!.FamilyId.Should().Be(familyId);
        savedRecord.UserId.Should().Be(user.Id);
    }

    [Fact]
    public async Task RevokeFamilyAsync_RevokesOnlyTargetFamily()
    {
        var context = CreateInMemoryContext();
        var timeProvider = new MutableTimeProvider(DateTimeOffset.UtcNow);
        var userId = Guid.NewGuid();
        var tenantId = Guid.NewGuid();
        var famA = "family-A";
        var famB = "family-B";

        var tokA = new UserRefreshToken { Id = Guid.NewGuid(), UserId = userId, TenantId = tenantId, FamilyId = famA, TokenHash = "hashA", CreatedAt = timeProvider.GetUtcNow() };
        var tokB = new UserRefreshToken { Id = Guid.NewGuid(), UserId = userId, TenantId = tenantId, FamilyId = famB, TokenHash = "hashB", CreatedAt = timeProvider.GetUtcNow() };
        context.UserRefreshTokens.AddRange(tokA, tokB);

        var user = new User { Id = userId, TenantId = tenantId, RefreshTokenIdHash = "hashA" };
        context.Users.Add(user);
        await context.SaveChangesAsync();

        await AuthRefreshTokenHelper.RevokeFamilyAsync(context, user, userId, famA, timeProvider, CancellationToken.None);
        await context.SaveChangesAsync();

        var reloadedA = await context.UserRefreshTokens.IgnoreQueryFilters().FirstAsync(r => r.Id == tokA.Id);
        var reloadedB = await context.UserRefreshTokens.IgnoreQueryFilters().FirstAsync(r => r.Id == tokB.Id);

        reloadedA.IsRevoked.Should().BeTrue();
        reloadedB.IsRevoked.Should().BeFalse();
        user.RefreshTokenIdHash.Should().BeNull();
    }

    [Fact]
    public async Task RevokeAllForUserAsync_RevokesAllTokensAcrossFamilies()
    {
        var context = CreateInMemoryContext();
        var timeProvider = new MutableTimeProvider(DateTimeOffset.UtcNow);
        var userId = Guid.NewGuid();
        var tenantId = Guid.NewGuid();

        var tok1 = new UserRefreshToken { Id = Guid.NewGuid(), UserId = userId, TenantId = tenantId, FamilyId = "fam1", TokenHash = "hash1", CreatedAt = timeProvider.GetUtcNow() };
        var tok2 = new UserRefreshToken { Id = Guid.NewGuid(), UserId = userId, TenantId = tenantId, FamilyId = "fam2", TokenHash = "hash2", CreatedAt = timeProvider.GetUtcNow() };
        context.UserRefreshTokens.AddRange(tok1, tok2);

        var user = new User { Id = userId, TenantId = tenantId, RefreshTokenIdHash = "hash1" };
        context.Users.Add(user);
        await context.SaveChangesAsync();

        await AuthRefreshTokenHelper.RevokeAllForUserAsync(context, user, userId, timeProvider, CancellationToken.None);
        await context.SaveChangesAsync();

        var tokens = await context.UserRefreshTokens.IgnoreQueryFilters().Where(r => r.UserId == userId).ToListAsync();
        tokens.Should().OnlyContain(r => r.IsRevoked);
        user.RefreshTokenIdHash.Should().BeNull();
    }

    #endregion

    #region AuthClaimsHelper Tests

    [Fact]
    public void GetClientIpAddress_UsesRemoteIpAddress_AndIgnoresRawForwardedForHeader()
    {
        var httpContext = new DefaultHttpContext();
        httpContext.Connection.RemoteIpAddress = IPAddress.Parse("203.0.113.195");
        httpContext.Request.Headers["X-Forwarded-For"] = "spoofed.ip.address, 70.41.3.18";

        var ip = AuthClaimsHelper.GetClientIpAddress(httpContext);

        ip.Should().Be("203.0.113.195");
    }

    [Fact]
    public void ResolveUserId_FallsBackToUserPrincipalClaims()
    {
        var expectedId = Guid.NewGuid();
        var claims = new[] { new Claim(ClaimTypes.NameIdentifier, expectedId.ToString()) };
        var principal = new ClaimsPrincipal(new ClaimsIdentity(claims, "TestAuth"));

        var resolvedId = AuthClaimsHelper.ResolveUserId(null, principal);

        resolvedId.Should().Be(expectedId);
    }

    #endregion

    #region AuthEmailNormalizer Tests

    [Fact]
    public void EmailNormalizer_StripsInvisibleCharacters_AndNormalizesCase()
    {
        var input = "  \u00A0User.\u200BName\uFEFF@Domain.PH\u3000  ";
        AuthEmailNormalizer.CleanDisplayEmail(input).Should().Be("User.Name@Domain.PH");
        AuthEmailNormalizer.NormalizeEmail(input).Should().Be("user.name@domain.ph");
    }

    #endregion

    #region DbConstraintHelper Tests

    [Fact]
    public void IsUniqueEmailViolation_IdentifiesNormalizedEmailConstraint()
    {
        var pgEx = new PostgresException("duplicate key value", "ERROR", "ERROR", PostgresErrorCodes.UniqueViolation)
        {
            // Sets internal constraint name via message containing NormalizedEmail
        };
        var dbEx = new DbUpdateException($"duplicate key value violates unique constraint \"{User.NormalizedEmailUniqueIndexName}\"", pgEx);

        DbConstraintHelper.IsUniqueEmailViolation(dbEx).Should().BeTrue();
        DbConstraintHelper.IsUniqueConstraintViolation(dbEx).Should().BeTrue();
    }

    #endregion

    #region AuthResponseBuilder Tests

    [Fact]
    public void AuthResponseBuilder_BuildsDto_WithConsistentValues()
    {
        var tenant = new Tenant { Id = Guid.NewGuid(), BusinessName = "Tindahan ni Aling Nena", Tier = PlanTier.TindahanPro };
        var user = new User { Id = Guid.NewGuid(), TenantId = tenant.Id, Email = "alena@example.ph", Phone = "09171234567", Role = "Owner", PinHash = "hashed" };
        var expiresAt = DateTimeOffset.UtcNow.AddHours(1);

        var dto = AuthResponseBuilder.Build(user, tenant, ("token123", expiresAt), "refreshToken456", "Aling Nena");

        dto.TenantId.Should().Be(tenant.Id);
        dto.UserId.Should().Be(user.Id);
        dto.Email.Should().Be("alena@example.ph");
        dto.BusinessName.Should().Be("Tindahan ni Aling Nena");
        dto.OwnerName.Should().Be("Aling Nena");
        dto.Role.Should().Be("Owner");
        dto.Tier.Should().Be(PlanTier.TindahanPro);
        dto.PlanTier.Should().Be("TindahanPro");
        dto.HasPin.Should().BeTrue();
        dto.Token.Should().Be("token123");
        dto.ExpiresAt.Should().Be(expiresAt);
        dto.RefreshToken.Should().Be("refreshToken456");
    }

    #endregion

    #region AuthClaimsHelper Tests

    [Fact]
    public void GetClientIpAddress_IgnoresSpoofedXForwardedForAndReturnsValidatedRemoteIp()
    {
        var context = new DefaultHttpContext();
        context.Connection.RemoteIpAddress = IPAddress.Parse("203.0.113.10");
        context.Request.Headers["X-Forwarded-For"] = "198.51.100.1, 70.41.3.18, 150.172.238.178";

        var ip = AuthClaimsHelper.GetClientIpAddress(context);

        ip.Should().Be("203.0.113.10");
    }

    [Fact]
    public void GetClientIpAddress_IgnoresSpoofedXRealIpAndReturnsValidatedRemoteIp()
    {
        var context = new DefaultHttpContext();
        context.Connection.RemoteIpAddress = IPAddress.Parse("203.0.113.10");
        context.Request.Headers["X-Real-IP"] = "198.51.100.42";

        var ip = AuthClaimsHelper.GetClientIpAddress(context);

        ip.Should().Be("203.0.113.10");
    }

    [Fact]
    public void GetClientIpAddress_WhenRemoteIpAddressPresent_ReturnsRemoteIpAddress()
    {
        var context = new DefaultHttpContext();
        context.Connection.RemoteIpAddress = IPAddress.Parse("192.168.1.50");

        var ip = AuthClaimsHelper.GetClientIpAddress(context);

        ip.Should().Be("192.168.1.50");
    }

    [Fact]
    public void GetClientIpAddress_WhenNoHeadersAndNoRemoteIp_ReturnsDefaultLocalhost()
    {
        var context = new DefaultHttpContext();

        var ip = AuthClaimsHelper.GetClientIpAddress(context);

        ip.Should().Be("127.0.0.1");
    }

    [Fact]
    public void GetClientIpAddress_WhenHttpContextNull_ReturnsDefaultLocalhost()
    {
        var ip = AuthClaimsHelper.GetClientIpAddress(null);

        ip.Should().Be("127.0.0.1");
    }

    #endregion
}
