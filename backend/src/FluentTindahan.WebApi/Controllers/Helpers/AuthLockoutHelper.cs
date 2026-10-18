using System.Collections.Concurrent;
using System.Linq;
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
        public DateTimeOffset LastAttemptAt;

        public bool IsExpired(DateTimeOffset now)
        {
            if (LockoutEnd.HasValue)
            {
                return now >= LockoutEnd.Value;
            }

            return now >= LastAttemptAt.AddMinutes(LockoutDurationMinutes);
        }
    }

    private sealed class UserLockEntry
    {
        public readonly SemaphoreSlim Semaphore = new(1, 1);
        public DateTimeOffset LastAccessedAt;
    }

    private static readonly ConcurrentDictionary<string, IpPinThrottleInfo> _ipPinThrottles = new();
    private static readonly ConcurrentDictionary<Guid, UserLockEntry> _userPinLocks = new();
    private static int _ipWriteCounter;
    private static int _userLockWriteCounter;

    public const int MaxFailedAttempts = 5;
    public const int LockoutDurationMinutes = 15;
    public const int MaxTrackedIps = 5000;
    public const int MaxTrackedUserLocks = 5000;
    public const int SweepIntervalOperations = 50;
    public static readonly TimeSpan DefaultLockIdleTimeout = TimeSpan.FromMinutes(5);

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

    public static int GetIpThrottleCount() => _ipPinThrottles.Count;
    public static int GetUserPinLockCount() => _userPinLocks.Count;
    public static bool HasUserPinLock(Guid userId) => _userPinLocks.ContainsKey(userId);

    public static SemaphoreSlim GetUserPinLock(Guid userId, TimeProvider? timeProvider = null)
    {
        var tp = timeProvider ?? TimeProvider.System;
        var now = tp.GetUtcNow();

        if (Interlocked.Increment(ref _userLockWriteCounter) % SweepIntervalOperations == 0 || _userPinLocks.Count > MaxTrackedUserLocks)
        {
            SweepIdleUserLocks(tp);
        }

        var entry = _userPinLocks.GetOrAdd(userId, _ => new UserLockEntry { LastAccessedAt = now });
        lock (entry)
        {
            entry.LastAccessedAt = now;
        }
        return entry.Semaphore;
    }

    public static int SweepIdleUserLocks(TimeProvider? timeProvider = null, TimeSpan? idleTimeout = null)
    {
        var now = (timeProvider ?? TimeProvider.System).GetUtcNow();
        var timeout = idleTimeout ?? DefaultLockIdleTimeout;
        var prunedCount = 0;

        foreach (var kvp in _userPinLocks)
        {
            var entry = kvp.Value;
            lock (entry)
            {
                if (entry.Semaphore.CurrentCount == 1 && (now - entry.LastAccessedAt) >= timeout)
                {
                    if (_userPinLocks.TryRemove(new KeyValuePair<Guid, UserLockEntry>(kvp.Key, entry)))
                    {
                        prunedCount++;
                    }
                }
            }
        }

        if (_userPinLocks.Count > MaxTrackedUserLocks)
        {
            var overflow = _userPinLocks
                .Where(kv => kv.Value.Semaphore.CurrentCount == 1)
                .OrderBy(kv => kv.Value.LastAccessedAt)
                .Take(_userPinLocks.Count - MaxTrackedUserLocks);

            foreach (var kvp in overflow)
            {
                lock (kvp.Value)
                {
                    if (kvp.Value.Semaphore.CurrentCount == 1)
                    {
                        if (_userPinLocks.TryRemove(new KeyValuePair<Guid, UserLockEntry>(kvp.Key, kvp.Value)))
                        {
                            prunedCount++;
                        }
                    }
                }
            }
        }

        return prunedCount;
    }

    public static void ResetAllUserPinLocks()
    {
        foreach (var kvp in _userPinLocks)
        {
            var entry = kvp.Value;
            lock (entry)
            {
                if (entry.Semaphore.CurrentCount == 1)
                {
                    _userPinLocks.TryRemove(new KeyValuePair<Guid, UserLockEntry>(kvp.Key, entry));
                }
            }
        }
    }

    public static int SweepExpiredThrottles(TimeProvider? timeProvider = null)
    {
        var now = (timeProvider ?? TimeProvider.System).GetUtcNow();
        var prunedCount = 0;

        foreach (var kvp in _ipPinThrottles)
        {
            var info = kvp.Value;
            lock (info)
            {
                if (info.IsExpired(now))
                {
                    if (_ipPinThrottles.TryRemove(new KeyValuePair<string, IpPinThrottleInfo>(kvp.Key, info)))
                    {
                        prunedCount++;
                    }
                }
            }
        }

        if (_ipPinThrottles.Count > MaxTrackedIps)
        {
            var overflow = _ipPinThrottles
                .Where(kv => !kv.Value.LockoutEnd.HasValue)
                .OrderBy(kv => kv.Value.LastAttemptAt)
                .Take(_ipPinThrottles.Count - MaxTrackedIps);

            foreach (var kvp in overflow)
            {
                if (_ipPinThrottles.TryRemove(new KeyValuePair<string, IpPinThrottleInfo>(kvp.Key, kvp.Value)))
                {
                    prunedCount++;
                }
            }
        }

        return prunedCount;
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
                    _ipPinThrottles.TryRemove(new KeyValuePair<string, IpPinThrottleInfo>(clientIp, info));
                    return false;
                }

                if (now >= info.LastAttemptAt.AddMinutes(LockoutDurationMinutes))
                {
                    _ipPinThrottles.TryRemove(new KeyValuePair<string, IpPinThrottleInfo>(clientIp, info));
                    return false;
                }
            }
        }
        return false;
    }

    public static int RecordIpPinFailure(string clientIp, TimeProvider timeProvider, out bool isNowLockedOut, out int lockoutMinutes)
    {
        if (Interlocked.Increment(ref _ipWriteCounter) % SweepIntervalOperations == 0 || _ipPinThrottles.Count > MaxTrackedIps)
        {
            SweepExpiredThrottles(timeProvider);
        }

        var info = _ipPinThrottles.GetOrAdd(clientIp, _ => new IpPinThrottleInfo
        {
            LastAttemptAt = timeProvider.GetUtcNow()
        });
        lock (info)
        {
            var now = timeProvider.GetUtcNow();
            info.LastAttemptAt = now;
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
