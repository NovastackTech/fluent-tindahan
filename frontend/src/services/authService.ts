import { apiClient } from './apiClient';
import type { PlanTier } from '../db/db';

export interface AuthResponseDto {
  tenantId: string;
  userId: string;
  email: string;
  businessName: string;
  ownerName: string | null;
  phone: string | null;
  role: 'Owner' | 'Staff';
  tier: PlanTier;
  planTier: string;
  subscriptionEndDate: string | null;
  hasPin: boolean;
  token: string;
  expiresAt: string;
  refreshToken?: string;
}

export interface RegisterRequestPayload {
  tenantId?: string;
  userId?: string;
  email: string;
  password: string;
  pin?: string;
  businessName: string;
  ownerName?: string;
  phone?: string;
  refreshToken?: string;
}

export interface LoginRequestPayload {
  email: string;
  password: string;
}

export interface LoginPinRequestPayload {
  email: string;
  pin: string;
}

export interface UpdateProfileRequestPayload {
  businessName?: string | null;
  ownerName?: string | null;
  phone?: string | null;
  email?: string | null;
  currentPassword?: string;
  pin?: string;
  refreshToken?: string;
}

export interface UpdatePinRequestPayload {
  email: string;
  password: string;
  pin?: string | null;
}

export const PBKDF2_PIN_ITERATIONS = 100_000;

/**
 * Derives a 256-bit PBKDF2-HMAC-SHA-256 key from a numeric PIN and salt.
 */
export async function derivePbkdf2PinHash(
  pin: string,
  salt: Uint8Array,
  iterations = PBKDF2_PIN_ITERATIONS
): Promise<string> {
  const encoder = new TextEncoder();
  const pinData = encoder.encode(pin.trim());
  const baseKey = await crypto.subtle.importKey(
    'raw',
    pinData,
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt as unknown as BufferSource,
      iterations,
      hash: 'SHA-256'
    },
    baseKey,
    256
  );
  return Array.from(new Uint8Array(derivedBits))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Generates a PBKDF2-HMAC-SHA-256 verifier string with a random 16-byte salt and high iteration count.
 * Format: `pbkdf2:v1:<iterations>:<saltHex>:<hashHex>`
 */
export async function generateLocalPinVerifier(
  pin: string,
  iterations = PBKDF2_PIN_ITERATIONS
): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hashHex = await derivePbkdf2PinHash(pin, salt, iterations);
  const saltHex = Array.from(salt)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `pbkdf2:v1:${iterations}:${saltHex}:${hashHex}`;
}

/**
 * Verifies a PIN against a stored verifier string.
 * Supports modern PBKDF2 format `pbkdf2:v1:<iterations>:<saltHex>:<hashHex>`
 * and falls back to legacy single-pass SHA-256 if legacySalt is provided.
 */
export async function verifyLocalPin(
  pin: string,
  storedVerifier: string,
  legacySalt?: string
): Promise<boolean> {
  if (!storedVerifier || !pin) return false;

  if (storedVerifier.startsWith('pbkdf2:v1:')) {
    const parts = storedVerifier.split(':');
    if (parts.length !== 5) return false;
    const iterations = parseInt(parts[2], 10);
    const saltHex = parts[3];
    const expectedHashHex = parts[4];
    if (isNaN(iterations) || iterations < 1000 || !saltHex || !expectedHashHex) {
      return false;
    }
    const match = saltHex.match(/.{1,2}/g);
    if (!match) return false;
    const salt = new Uint8Array(match.map((byte) => parseInt(byte, 16)));
    const computedHashHex = await derivePbkdf2PinHash(pin, salt, iterations);
    return computedHashHex === expectedHashHex;
  }

  // Backward compatibility with legacy SHA-256 verifier
  if (legacySalt) {
    const legacyHash = await computeLocalPinHash(pin, legacySalt);
    return legacyHash === storedVerifier;
  }

  return false;
}

export async function computeLocalPinHash(pin: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`fluent-tindahan-pin:${salt}:${pin.trim()}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function registerStore(payload: RegisterRequestPayload): Promise<AuthResponseDto> {
  const storedRefreshToken = typeof localStorage !== 'undefined'
    ? localStorage.getItem('fluent_tindahan_refresh_token_v1')
    : null;
  const requestPayload: RegisterRequestPayload = {
    ...payload,
    refreshToken: payload.refreshToken || storedRefreshToken || undefined
  };
  const response = await apiClient.post<AuthResponseDto>('/auth/register', requestPayload);
  return response.data;
}

export async function loginStore(payload: LoginRequestPayload): Promise<AuthResponseDto> {
  const response = await apiClient.post<AuthResponseDto>('/auth/login', payload);
  return response.data;
}

export async function loginPin(payload: LoginPinRequestPayload): Promise<AuthResponseDto> {
  const response = await apiClient.post<AuthResponseDto>('/auth/login-pin', payload);
  return response.data;
}

export async function updatePin(payload: UpdatePinRequestPayload): Promise<{ message: string; hasPin: boolean }> {
  const response = await apiClient.put<{ message: string; hasPin: boolean }>('/auth/pin', payload);
  return response.data;
}

export async function updateProfile(payload: UpdateProfileRequestPayload): Promise<AuthResponseDto> {
  const storedRefreshToken = typeof localStorage !== 'undefined'
    ? localStorage.getItem('fluent_tindahan_refresh_token_v1')
    : null;
  const requestPayload: UpdateProfileRequestPayload = {
    ...payload,
    refreshToken: payload.refreshToken || storedRefreshToken || undefined
  };
  const response = await apiClient.put<AuthResponseDto>('/auth/profile', requestPayload);
  return response.data;
}

export async function refreshAuthToken(refreshToken: string): Promise<AuthResponseDto> {
  const response = await apiClient.post<AuthResponseDto>('/auth/refresh', { refreshToken });
  return response.data;
}

export async function logoutStore(refreshToken?: string | null): Promise<void> {
  try {
    await apiClient.post('/auth/logout', { refreshToken });
  } catch (e) {
    // Suppress network errors on logout (local-first Rule 1)
    console.warn('[authService] Server logout notification failed:', e);
  }
}

