using System.Collections.Concurrent;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using FluentTindahan.Domain.Entities;

namespace FluentTindahan.WebApi.Controllers.Helpers;

/// <summary>
/// Manages password lockouts, PIN lockouts, and IP-level PIN throttling for authentication endpoints.
/// </summary>
public static class AuthLockoutHelper
{
    private sealed class IpPinThrottleInfo
    {
        public int FailedAttempts;
        public DateTimeOffset? LockoutEnd;
    }

    private static readonly ConcurrentDictionary<string, IpPinThrottleInfo> _ipPinThrottles = new();
    private static readonly ConcurrentDictionary<Guid, SemaphoreSlim> _userPinLocks = new();

    public const int MaxFailedAttempts = 5;
    public const int LockoutDurationMinutes = 15;

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

    public static SemaphoreSlim GetUserPinLock(Guid userId)
    {
        return _userPinLocks.GetOrAdd(userId, _ => new SemaphoreSlim(1, 1));
    }

    public static bool IsIpPinThrottled(string clientIp, TimeProvider timeProvider, out int remainingMinutes)
    {
        remainingMinutes = 0;
        if (_ipPinThrottles.TryGetValue(clientIp, out var info))
        {
            lock (info)
            {
                var now = timeProvider.GetUtcNow();
                if (info.LockoutEnd.HasValue)
                {
                    if (info.LockoutEnd.Value > now)
                    {
                        remainingMinutes = Math.Max(1, (int)Math.Ceiling((info.LockoutEnd.Value - now).TotalMinutes));
                        return true;
                    }

                    info.FailedAttempts = 0;
                    info.LockoutEnd = null;
                }
            }
        }
        return false;
    }

    public static int RecordIpPinFailure(string clientIp, TimeProvider timeProvider, out bool isNowLockedOut, out int lockoutMinutes)
    {
        var info = _ipPinThrottles.GetOrAdd(clientIp, _ => new IpPinThrottleInfo());
        lock (info)
        {
            var now = timeProvider.GetUtcNow();
            if (info.LockoutEnd.HasValue && info.LockoutEnd.Value <= now)
            {
                info.FailedAttempts = 0;
                info.LockoutEnd = null;
            }

            info.FailedAttempts++;
            if (info.FailedAttempts >= MaxFailedAttempts)
            {
                info.LockoutEnd = now.AddMinutes(LockoutDurationMinutes);
                isNowLockedOut = true;
                lockoutMinutes = LockoutDurationMinutes;
                return info.FailedAttempts;
            }

            isNowLockedOut = false;
            lockoutMinutes = 0;
            return info.FailedAttempts;
        }
    }

    public static bool CheckPasswordLockout(User user, TimeProvider timeProvider, out int remainingMinutes)
    {
        remainingMinutes = 0;
        if (user.PasswordLockoutEnd.HasValue)
        {
            var now = timeProvider.GetUtcNow();
            if (user.PasswordLockoutEnd.Value > now)
            {
                remainingMinutes = Math.Max(1, (int)Math.Ceiling((user.PasswordLockoutEnd.Value - now).TotalMinutes));
                return true;
            }

            user.FailedPasswordAttempts = 0;
            user.PasswordLockoutEnd = null;
        }
        return false;
    }

    public static void RecordPasswordFailure(User user, TimeProvider timeProvider, out bool isLockedOut, out int lockoutMinutes, out int remainingAttempts)
    {
        var now = timeProvider.GetUtcNow();
        user.FailedPasswordAttempts++;
        if (user.FailedPasswordAttempts >= MaxFailedAttempts)
        {
            user.PasswordLockoutEnd = now.AddMinutes(LockoutDurationMinutes);
            isLockedOut = true;
            lockoutMinutes = LockoutDurationMinutes;
        }
        else
        {
            isLockedOut = false;
            lockoutMinutes = 0;
        }
        remainingAttempts = Math.Max(0, MaxFailedAttempts - user.FailedPasswordAttempts);
    }

    public static void ResetPasswordLockout(User user)
    {
        user.FailedPasswordAttempts = 0;
        user.PasswordLockoutEnd = null;
    }

    public static bool CheckPinLockout(User user, TimeProvider timeProvider, out int remainingMinutes)
    {
        remainingMinutes = 0;
        if (user.PinLockoutEnd.HasValue)
        {
            var now = timeProvider.GetUtcNow();
            if (user.PinLockoutEnd.Value > now)
            {
                remainingMinutes = Math.Max(1, (int)Math.Ceiling((user.PinLockoutEnd.Value - now).TotalMinutes));
                return true;
            }

            user.FailedPinAttempts = 0;
            user.PinLockoutEnd = null;
        }
        return false;
    }

    public static void RecordPinFailureInMemory(User user, TimeProvider timeProvider, out bool isLockedOut, out int lockoutMinutes, out int remainingAttempts)
    {
        var now = timeProvider.GetUtcNow();
        user.FailedPinAttempts++;
        if (user.FailedPinAttempts >= MaxFailedAttempts)
        {
            user.PinLockoutEnd = now.AddMinutes(LockoutDurationMinutes);
            isLockedOut = true;
            lockoutMinutes = LockoutDurationMinutes;
        }
        else
        {
            isLockedOut = false;
            lockoutMinutes = 0;
        }
        remainingAttempts = Math.Max(0, MaxFailedAttempts - user.FailedPinAttempts);
    }

    public static void ResetPinLockout(User user)
    {
        user.FailedPinAttempts = 0;
        user.PinLockoutEnd = null;
    }

    public static ObjectResult PasswordLockedOutResult(int lockoutMinutes, bool isInitial = false)
    {
        return new ObjectResult(new
        {
            message = isInitial
                ? "Naka-lockout ang account dahil sa 5 sunod-sunod na maling pagsubok sa password. Maghintay nang 15 minuto. / Account locked for 15 minutes due to 5 failed password attempts."
                : $"Naka-lockout ang account dahil sa sunod-sunod na maling pagsubok sa password. Maghintay nang {lockoutMinutes} minuto. / Account locked due to repeated failed password attempts. Wait {lockoutMinutes} minutes.",
            lockoutMinutes,
            accountLocked = true
        })
        {
            StatusCode = StatusCodes.Status429TooManyRequests
        };
    }

    public static UnauthorizedObjectResult PasswordFailedResult(int remainingAttempts, string message)
    {
        return new UnauthorizedObjectResult(new
        {
            message,
            remainingAttempts
        });
    }

    public static ObjectResult PinLockedOutResult(int lockoutMinutes, bool isInitial = false)
    {
        return new ObjectResult(new
        {
            message = isInitial
                ? "Naka-lockout ang PIN dahil sa 5 sunod-sunod na maling pagsubok. Mag-login gamit ang Password o maghintay nang 15 minuto. / PIN locked for 15 minutes due to 5 failed attempts."
                : $"Naka-lockout ang PIN dahil sa sunod-sunod na maling pagsubok. Mag-login gamit ang Password o maghintay nang {lockoutMinutes} minuto. / PIN locked. Use password or wait {lockoutMinutes} minutes.",
            lockoutMinutes,
            pinLocked = true
        })
        {
            StatusCode = StatusCodes.Status429TooManyRequests
        };
    }

    public static UnauthorizedObjectResult PinFailedResult(int remainingAttempts, string? message = null)
    {
        return new UnauthorizedObjectResult(new
        {
            message = message ?? $"Maling email o PIN code. May natitira ka pang {remainingAttempts} pagsubok bago mag-lockout. / Invalid email or PIN code. {remainingAttempts} attempts remaining.",
            remainingAttempts
        });
    }

    public static ObjectResult IpPinLockedOutResult(int lockoutMinutes, bool isInitial = false)
    {
        return new ObjectResult(new
        {
            message = isInitial
                ? $"Naka-lockout ang iyong IP address dahil sa 5 sunod-sunod na maling pagsubok sa PIN. Mag-login gamit ang Password o maghintay nang {lockoutMinutes} minuto. / IP address throttled for 15 minutes due to 5 failed PIN attempts. Use password to log in or wait {lockoutMinutes} minutes."
                : $"Naka-lockout ang iyong IP address dahil sa sunod-sunod na maling pagsubok sa PIN. Mag-login gamit ang Password o maghintay nang {lockoutMinutes} minuto. / IP address throttled due to repeated failed PIN attempts. Use password to log in or wait {lockoutMinutes} minutes.",
            lockoutMinutes,
            ipThrottled = true
        })
        {
            StatusCode = StatusCodes.Status429TooManyRequests
        };
    }
}
