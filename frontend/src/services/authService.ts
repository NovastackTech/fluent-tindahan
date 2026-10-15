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
}

export interface LoginRequestPayload {
  email: string;
  password: string;
}

export interface LoginPinRequestPayload {
  email: string;
  pin: string;
}

export interface UpdatePinRequestPayload {
  email: string;
  password: string;
  pin?: string | null;
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
  const response = await apiClient.post<AuthResponseDto>('/auth/register', payload);
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

