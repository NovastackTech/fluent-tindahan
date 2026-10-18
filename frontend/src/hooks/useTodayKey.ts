import { useEffect, useState } from 'react';
import { toLocalDateKey } from '../utils/date';

/**
 * Returns today's local date key (YYYY-MM-DD).
 * Automatically updates at local midnight (+1s), re-evaluates on window focus
 * or visibility change, and always reschedules from a freshly computed delay.
 */
export function useTodayKey(): string {
  const [todayKey, setTodayKey] = useState(() => toLocalDateKey(new Date()));

  useEffect(() => {
    let timeoutId: number | undefined;

    const scheduleNext = () => {
      const now = new Date();
      const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      const delay = Math.max(nextMidnight.getTime() - now.getTime() + 1000, 1000);

      timeoutId = window.setTimeout(() => {
        setTodayKey(toLocalDateKey(new Date()));
        scheduleNext();
      }, delay);
    };

    const handleRefresh = () => {
      setTodayKey(toLocalDateKey(new Date()));
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }
      scheduleNext();
    };

    scheduleNext();

    window.addEventListener('focus', handleRefresh);
    document.addEventListener('visibilitychange', handleRefresh);

    return () => {
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }
      window.removeEventListener('focus', handleRefresh);
      document.removeEventListener('visibilitychange', handleRefresh);
    };
  }, []);

  return todayKey;
}
