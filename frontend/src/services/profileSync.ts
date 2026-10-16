import { updateProfile, type UpdateProfileRequestPayload, type AuthResponseDto } from './authService';
import { useAuthStore } from '../state/authStore';

export const STORAGE_KEY_PENDING_PROFILE_UPDATE = 'fluent_tindahan_pending_profile_update_v1';

export interface PendingProfileUpdateRecord {
  tenantId: string;
  payload: UpdateProfileRequestPayload;
  enqueuedAt: string;
  retryCount?: number;
  lastError?: string;
}

export function getPendingProfileUpdate(): PendingProfileUpdateRecord | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(STORAGE_KEY_PENDING_PROFILE_UPDATE);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    console.warn('[profileSync] Failed to parse pending profile update:', e);
    return null;
  }
}

export function queuePendingProfileUpdate(payload: UpdateProfileRequestPayload, tenantId: string): void {
  try {
    if (typeof localStorage === 'undefined') return;
    const record: PendingProfileUpdateRecord = {
      tenantId,
      payload,
      enqueuedAt: new Date().toISOString(),
      retryCount: 0
    };
    localStorage.setItem(STORAGE_KEY_PENDING_PROFILE_UPDATE, JSON.stringify(record));
  } catch (e) {
    console.warn('[profileSync] Failed to queue pending profile update:', e);
  }
}

export function clearPendingProfileUpdate(): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(STORAGE_KEY_PENDING_PROFILE_UPDATE);
  } catch (e) {
    console.warn('[profileSync] Failed to clear pending profile update:', e);
  }
}

export function hasPendingProfileUpdate(): boolean {
  return getPendingProfileUpdate() !== null;
}

let isSyncingProfile = false;

export async function syncPendingProfileUpdate(): Promise<{
  success: boolean;
  deferred?: boolean;
  error?: any;
}> {
  if (isSyncingProfile) {
    return { success: false, deferred: true };
  }

  const pending = getPendingProfileUpdate();
  if (!pending) {
    return { success: true };
  }

  // Only attempt online HTTP sync if browser indicates online
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { success: false, deferred: true };
  }

  isSyncingProfile = true;
  try {
    const authResult: AuthResponseDto = await updateProfile(pending.payload);
    clearPendingProfileUpdate();
    await useAuthStore.getState().loginWithAuthPayload(authResult);
    return { success: true };
  } catch (err: any) {
    const status = err?.response?.status;
    // Non-retryable permanent server rejections:
    // 400 Bad Request (invalid data/format)
    // 403 Forbidden (not store owner)
    // 409 Conflict (email already registered to another user)
    // 429 (rate-limited/lockout) and 401 (temporary auth issue) are transient and should be retried.
    if (status === 400 || status === 403 || status === 409) {
      console.error('[profileSync] Server permanently rejected pending profile update, clearing queue:', err);
      clearPendingProfileUpdate();
      return { success: false, error: err };
    }

    // Network error / server unavailable / 5xx -> keep in pending storage for retry
    console.warn('[profileSync] Pending profile update sync deferred, will retry on reconnect:', err);
    try {
      const current = getPendingProfileUpdate();
      if (current) {
        current.retryCount = (current.retryCount || 0) + 1;
        current.lastError = err?.message || 'Network error';
        localStorage.setItem(STORAGE_KEY_PENDING_PROFILE_UPDATE, JSON.stringify(current));
      }
    } catch {
      // Ignore storage write failure
    }
    return { success: false, deferred: true, error: err };
  } finally {
    isSyncingProfile = false;
  }
}
