import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTodayKey } from './useTodayKey';

describe('useTodayKey', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('updates todayKey on day rollover', () => {
    // 1 minute before midnight
    vi.setSystemTime(new Date(2026, 9, 17, 23, 59, 0));

    const { result } = renderHook(() => useTodayKey());
    expect(result.current).toBe('2026-10-17');

    // Advance 61 seconds (past midnight + 1s delay)
    act(() => {
      vi.advanceTimersByTime(61 * 1000);
    });

    expect(result.current).toBe('2026-10-18');
  });

  it('updates todayKey on month rollover', () => {
    // 1 minute before midnight on the last day of October
    vi.setSystemTime(new Date(2026, 9, 31, 23, 59, 0));

    const { result } = renderHook(() => useTodayKey());
    expect(result.current).toBe('2026-10-31');

    // Advance 61 seconds (crosses into November 1st)
    act(() => {
      vi.advanceTimersByTime(61 * 1000);
    });

    expect(result.current).toBe('2026-11-01');
  });

  it('refreshes todayKey on visibilitychange and window focus events', () => {
    vi.setSystemTime(new Date(2026, 9, 17, 12, 0, 0));

    const { result } = renderHook(() => useTodayKey());
    expect(result.current).toBe('2026-10-17');

    // Device was suspended or tab was backgrounded and woke up on a future date
    vi.setSystemTime(new Date(2026, 9, 20, 9, 30, 0));

    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(result.current).toBe('2026-10-20');

    // Next jump and test focus event as well
    vi.setSystemTime(new Date(2026, 9, 21, 14, 0, 0));

    act(() => {
      window.dispatchEvent(new Event('focus'));
    });

    expect(result.current).toBe('2026-10-21');
  });

  it('still reschedules when a timer fires with an unchanged key', () => {
    // Initial time at 10:00:00 AM
    vi.setSystemTime(new Date(2026, 9, 17, 10, 0, 0));
    const setTimeoutSpy = vi.spyOn(window, 'setTimeout');

    const { result } = renderHook(() => useTodayKey());
    expect(result.current).toBe('2026-10-17');
    expect(setTimeoutSpy).toHaveBeenCalledTimes(1);

    // Grab the first timer callback
    const timerCallback = setTimeoutSpy.mock.calls[0][0] as () => void;

    // Simulate timer firing while date key remains unchanged
    act(() => {
      timerCallback();
    });

    // Key is unchanged
    expect(result.current).toBe('2026-10-17');
    // But it rescheduled!
    expect(setTimeoutSpy).toHaveBeenCalledTimes(2);

    // Fast-forward to midnight of next day using the rescheduled timer
    const now = new Date();
    const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const delay = nextMidnight.getTime() - now.getTime() + 1000;

    act(() => {
      vi.advanceTimersByTime(delay);
    });

    expect(result.current).toBe('2026-10-18');
  });
});
