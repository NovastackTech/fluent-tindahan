import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { STORAGE_KEY_REFRESH_TOKEN, STORAGE_KEY_TOKEN, useAuthStore } from '../state/authStore';
import { db } from '../db/db';
import { useGCashFeeStore } from '../state/gcashFeeStore';
import { useLanguageStore } from '../state/languageStore';
import { translations } from '../i18n/translations';
import { createClientUuid, DEFAULT_USER_ID } from '../db/seedData';

export const apiClient = axios.create({
  baseURL: '/api',
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json'
  }
});

const provisionedSessions = new Set<string>();
const provisioningPromises = new Map<string, Promise<void>>();
const GUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class TenantAccountMismatchError extends Error {
  constructor() {
    super(translations[useLanguageStore.getState().language].common.differentAccountSyncBlocked);
    this.name = 'TenantAccountMismatchError';
  }
}

export class TenantProvisioningError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(translations[useLanguageStore.getState().language].common.tenantProvisioningSyncBlocked);
    this.name = 'TenantProvisioningError';
    this.status = status;
  }
}

/** The refresh token cannot renew this session. Local queues stay on the device. */
export class SessionReauthRequiredError extends Error {
  constructor() {
    super(translations[useLanguageStore.getState().language].common.sessionReauthRequired);
    this.name = 'SessionReauthRequiredError';
  }
}

const ACCESS_TOKEN_REFRESH_SKEW_MS = 60_000;
const REFRESH_LOCK_KEY = 'fluent_tindahan_refresh_lock_v1';
const REFRESH_LOCK_TTL_MS = 15_000;
const PUBLIC_AUTH_PATH = /\/auth\/(login-pin|login|register|google|refresh|logout)(?:\?|$)/;

interface JwtPayload {
  sub?: unknown;
  exp?: unknown;
}

export function resetTenantProvisionCache(): void {
  provisionedSessions.clear();
  provisioningPromises.clear();
}

function decodeJwtPayload(segment: string): JwtPayload | null {
  try {
    const base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(globalThis.atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='))) as JwtPayload;
  } catch {
    return null;
  }
}

export function isAccessTokenUsable(token: string | null, nowMs = Date.now()): boolean {
  if (!token) return false;
  const parts = token.split('.');
  if (parts.length < 2 || !parts[1]) return true;
  const payload = decodeJwtPayload(parts[1]);
  if (!payload) return false;
  if (typeof payload.exp !== 'number') return true;
  return payload.exp * 1000 - nowMs > ACCESS_TOKEN_REFRESH_SKEW_MS;
}

function tokenExpiryMs(token: string | null): number | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length < 2 || !parts[1]) return null;
  const payload = decodeJwtPayload(parts[1]);
  return payload && typeof payload.exp === 'number' ? payload.exp * 1000 : null;
}

function preferAccessToken(memory: string | null, stored: string | null): string | null {
  if (!stored || stored === memory) return memory || stored;
  const memoryOk = isAccessTokenUsable(memory);
  const storedOk = isAccessTokenUsable(stored);
  if (storedOk && !memoryOk) return stored;
  if (memoryOk && !storedOk) return memory;
  if (storedOk && memoryOk) {
    return (tokenExpiryMs(stored) ?? 0) >= (tokenExpiryMs(memory) ?? 0) ? stored : memory;
  }
  return stored || memory;
}

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function latestAccessToken(): string | null {
  const memory = useAuthStore.getState().firebaseToken;
  const stored = readStorage(STORAGE_KEY_TOKEN);
  const chosen = preferAccessToken(memory, stored);
  if (chosen && chosen !== memory) {
    const storedRefresh = readStorage(STORAGE_KEY_REFRESH_TOKEN);
    useAuthStore.setState({
      firebaseToken: chosen,
      ...(storedRefresh ? { refreshToken: storedRefresh } : {})
    });
  }
  return chosen;
}

function latestRefreshToken(): string | null {
  const memory = useAuthStore.getState().refreshToken;
  const stored = readStorage(STORAGE_KEY_REFRESH_TOKEN);
  if (stored && stored !== memory) {
    useAuthStore.setState({ refreshToken: stored });
    return stored;
  }
  return memory || stored;
}

function isPublicAuthRequest(url?: string): boolean {
  return typeof url === 'string' && PUBLIC_AUTH_PATH.test(url);
}

function getErrorStatus(err: unknown): number | undefined {
  const status = (err as { response?: { status?: unknown } })?.response?.status;
  return typeof status === 'number' ? status : undefined;
}

function authorizationToken(headers: unknown): string | null {
  if (!headers || typeof headers !== 'object') return null;
  const bag = headers as { Authorization?: unknown; authorization?: unknown; get?: (name: string) => unknown };
  const raw = bag.get?.('Authorization') ?? bag.Authorization ?? bag.authorization;
  if (typeof raw !== 'string') return null;
  const match = raw.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

interface RefreshOptions {
  force?: boolean;
  rejectedAccessToken?: string | null;
}

let refreshPromise: Promise<void> | null = null;

function startRefresh(options: RefreshOptions): Promise<void> {
  if (!refreshPromise) {
    refreshPromise = refreshAccessToken(options).finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

export function ensureAccessTokenFresh(): Promise<void> | void {
  const token = latestAccessToken();
  if (useAuthStore.getState().reauthRequired && !isAccessTokenUsable(token)) {
    throw new SessionReauthRequiredError();
  }
  if (isAccessTokenUsable(token)) {
    if (useAuthStore.getState().reauthRequired) {
      useAuthStore.getState().setReauthRequired(false);
    }
    return;
  }
  if (!latestRefreshToken()) return;
  return startRefresh({ force: true, rejectedAccessToken: token });
}

function acquireRefreshLock(owner: string): boolean {
  const now = Date.now();
  const existing = readStorage(REFRESH_LOCK_KEY);
  if (existing) {
    try {
      const parsed = JSON.parse(existing) as { owner?: string; expiresAt?: number };
      if (parsed.owner && parsed.owner !== owner && typeof parsed.expiresAt === 'number' && parsed.expiresAt > now) {
        return false;
      }
    } catch {
      // Replace a corrupt lock.
    }
  }
  try {
    localStorage.setItem(REFRESH_LOCK_KEY, JSON.stringify({ owner, expiresAt: now + REFRESH_LOCK_TTL_MS }));
  } catch {
    return true;
  }
  return readStorage(REFRESH_LOCK_KEY)?.includes(owner) ?? false;
}

function releaseRefreshLock(owner: string): void {
  if (readStorage(REFRESH_LOCK_KEY)?.includes(owner)) {
    try {
      localStorage.removeItem(REFRESH_LOCK_KEY);
    } catch {
      // The lock expires on its own.
    }
  }
}

async function waitForPeerRefresh(rejectedAccessToken: string | null): Promise<boolean> {
  const started = Date.now();
  while (Date.now() - started < 5000) {
    await new Promise((resolve) => setTimeout(resolve, 200));
    const token = latestAccessToken();
    if (isAccessTokenUsable(token) && token !== rejectedAccessToken) return true;
  }
  return false;
}

function markRefreshInvalid(presentedRefreshToken: string): void {
  const storedRefresh = readStorage(STORAGE_KEY_REFRESH_TOKEN);
  const memoryRefresh = useAuthStore.getState().refreshToken;
  const latest = storedRefresh || memoryRefresh;
  const access = latestAccessToken();
  if (latest && latest !== presentedRefreshToken && isAccessTokenUsable(access)) {
    if (useAuthStore.getState().reauthRequired) {
      useAuthStore.getState().setReauthRequired(false);
    }
    return;
  }
  if (!storedRefresh || storedRefresh === presentedRefreshToken) {
    useAuthStore.getState().setFirebaseToken(null);
    useAuthStore.getState().setRefreshToken(null);
  }
  useAuthStore.getState().setReauthRequired(true);
  throw new SessionReauthRequiredError();
}

async function refreshAccessToken(options: RefreshOptions): Promise<void> {
  const rejectedAccessToken = options.rejectedAccessToken ?? null;
  const current = latestAccessToken();
  if (isAccessTokenUsable(current) && current !== rejectedAccessToken) {
    if (useAuthStore.getState().reauthRequired) {
      useAuthStore.getState().setReauthRequired(false);
    }
    return;
  }
  if (!options.force && isAccessTokenUsable(current)) return;

  const refreshToken = latestRefreshToken();
  if (!refreshToken) {
    if (options.force) {
      if (!isAccessTokenUsable(useAuthStore.getState().firebaseToken)) {
        useAuthStore.getState().setFirebaseToken(null);
      }
      useAuthStore.getState().setReauthRequired(true);
      throw new SessionReauthRequiredError();
    }
    return;
  }

  const lockOwner = createClientUuid();
  if (!acquireRefreshLock(lockOwner)) {
    if (await waitForPeerRefresh(rejectedAccessToken)) return;
    if (!acquireRefreshLock(lockOwner)) {
      throw new Error('Token refresh is already running in another tab');
    }
  }

  let presentedRefreshToken = refreshToken;
  try {
    presentedRefreshToken = latestRefreshToken() ?? refreshToken;
    const adopted = latestAccessToken();
    if (isAccessTokenUsable(adopted) && adopted !== rejectedAccessToken) return;

    const refreshResponse = await axios.post<{
      token: string;
      refreshToken?: string;
    }>('/api/auth/refresh', { refreshToken: presentedRefreshToken }, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 15000
    });

    const newToken = refreshResponse.data.token;
    const newRefreshToken = refreshResponse.data.refreshToken ?? presentedRefreshToken;
    if (!newToken) {
      markRefreshInvalid(presentedRefreshToken);
      return;
    }
    useAuthStore.getState().setFirebaseToken(newToken);
    if (newRefreshToken) {
      useAuthStore.getState().setRefreshToken(newRefreshToken);
    }
    useAuthStore.getState().setReauthRequired(false);
  } catch (refreshErr) {
    if (refreshErr instanceof SessionReauthRequiredError) throw refreshErr;
    const refreshStatus = getErrorStatus(refreshErr);
    if (refreshStatus === 401 || refreshStatus === 403) {
      markRefreshInvalid(presentedRefreshToken);
      return;
    }
    throw refreshErr;
  } finally {
    releaseRefreshLock(lockOwner);
  }
}

function getAuthenticatedUserId(token: string): string | null {
  const payloadSegment = token.split('.')[1];
  if (!payloadSegment) return null;
  const payload = decodeJwtPayload(payloadSegment);
  return typeof payload?.sub === 'string' && GUID_PATTERN.test(payload.sub) ? payload.sub : null;
}

export async function ensureTenantProvisioned(): Promise<void> {
  const initialAuth = useAuthStore.getState();
  if (!initialAuth.isOnboardingStatusReady || !initialAuth.isOnboarded || !initialAuth.tenantId) return;

  const refreshing = ensureAccessTokenFresh();
  if (refreshing) await refreshing;

  const auth = useAuthStore.getState();
  const {
    tenantId,
    userId,
    firebaseToken,
    businessName,
    userPhone,
    userEmail,
    locallyCreatedTenantId,
    serverConfirmedTenantId,
    serverConfirmedUserId
  } = auth;
  if (!tenantId) return;

  const authenticatedUserId = firebaseToken ? getAuthenticatedUserId(firebaseToken) : null;
  if (firebaseToken && !authenticatedUserId) {
    throw new TenantProvisioningError(401);
  }

  let requestedUserId = authenticatedUserId
    || (userId !== DEFAULT_USER_ID ? userId : serverConfirmedUserId)
    || createClientUuid();
  if (requestedUserId === DEFAULT_USER_ID) {
    requestedUserId = createClientUuid();
  }
  if (!authenticatedUserId && requestedUserId !== userId) {
    auth.setUserId(requestedUserId);
  }

  const normalizedTenantId = tenantId.toLowerCase();
  const confirmedTenantId = serverConfirmedTenantId?.toLowerCase();
  const confirmedUserId = serverConfirmedUserId?.toLowerCase();
  if (
    (confirmedTenantId && confirmedTenantId !== normalizedTenantId)
    || (confirmedUserId && confirmedUserId !== requestedUserId.toLowerCase())
  ) {
    throw new TenantAccountMismatchError();
  }

  const sessionKey = `${normalizedTenantId}:${requestedUserId.toLowerCase()}:${firebaseToken ?? ''}`;
  if (provisionedSessions.has(sessionKey)) return;
  const inFlightProvision = provisioningPromises.get(sessionKey);
  if (inFlightProvision) return inFlightProvision;

  const provisionPromise = provisionTenantSession({
    tenantId,
    requestedUserId,
    authenticatedUserId,
    firebaseToken,
    businessName,
    userPhone,
    userEmail,
    locallyCreatedTenantId,
    normalizedTenantId,
    confirmedTenantId,
    confirmedUserId
  });
  provisioningPromises.set(sessionKey, provisionPromise);
  try {
    await provisionPromise;
  } finally {
    if (provisioningPromises.get(sessionKey) === provisionPromise) {
      provisioningPromises.delete(sessionKey);
    }
  }
}

async function provisionTenantSession({
  tenantId,
  requestedUserId,
  authenticatedUserId,
  firebaseToken,
  businessName,
  userPhone,
  userEmail,
  locallyCreatedTenantId,
  normalizedTenantId,
  confirmedTenantId,
  confirmedUserId
}: {
  tenantId: string;
  requestedUserId: string;
  authenticatedUserId: string | null;
  firebaseToken: string | null;
  businessName: string;
  userPhone: string;
  userEmail: string;
  locallyCreatedTenantId: string | null;
  normalizedTenantId: string;
  confirmedTenantId: string | undefined;
  confirmedUserId: string | undefined;
}): Promise<void> {
  let response;
  try {
    response = await apiClient.put('/tenant/provision', {
      userId: requestedUserId,
      businessName,
      phone: userPhone,
      email: userEmail || undefined
    });
  } catch (err) {
    if (err instanceof SessionReauthRequiredError) throw err;
    const status = getErrorStatus(err);
    if (status === 401) {
      useAuthStore.getState().setReauthRequired(true);
      throw new SessionReauthRequiredError();
    }
    if (typeof status === 'number' && status >= 400 && status < 500) {
      throw new TenantProvisioningError(status);
    }
    throw err;
  }
  const provisionedTenantId = response.data?.tenantId;
  if (typeof provisionedTenantId !== 'string' || !provisionedTenantId) {
    throw new TenantProvisioningError(409);
  }
  const provisionedUserId = response.data?.userId || requestedUserId;
  if (typeof provisionedUserId !== 'string' || !GUID_PATTERN.test(provisionedUserId)) {
    throw new TenantProvisioningError(409);
  }

  if (response.data?.token) {
    useAuthStore.getState().setFirebaseToken(response.data.token);
  }
  if (response.data?.refreshToken) {
    useAuthStore.getState().setRefreshToken(response.data.refreshToken);
  }

  const normalizedProvisionedTenantId = provisionedTenantId.toLowerCase();
  const canonicalTenantId = normalizedProvisionedTenantId === tenantId.toLowerCase()
    ? tenantId
    : normalizedProvisionedTenantId;
  const canonicalUserId = provisionedUserId.toLowerCase();
  if (authenticatedUserId && canonicalUserId !== authenticatedUserId.toLowerCase()) {
    throw new TenantAccountMismatchError();
  }
  if (
    (confirmedTenantId && canonicalTenantId.toLowerCase() !== confirmedTenantId)
    || (confirmedUserId && canonicalUserId !== confirmedUserId)
  ) {
    throw new TenantAccountMismatchError();
  }

  if (canonicalTenantId !== tenantId) {
    if (locallyCreatedTenantId?.toLowerCase() !== normalizedTenantId || confirmedTenantId) {
      throw new TenantAccountMismatchError();
    }

    const tables = [
      db.products,
      db.customers,
      db.sales,
      db.saleItems,
      db.utangLedger,
      db.gcashTxns,
      db.gcashTxnResolutions,
      db.tenants,
      db.syncQueue,
      db.deadLetterQueue
    ];

    await db.transaction('rw', tables, async () => {
      await db.products.where('tenantId').equals(tenantId).modify({ tenantId: canonicalTenantId });
      await db.customers.where('tenantId').equals(tenantId).modify({ tenantId: canonicalTenantId });
      await db.sales.where('tenantId').equals(tenantId).modify({ tenantId: canonicalTenantId });
      await db.saleItems.where('tenantId').equals(tenantId).modify({ tenantId: canonicalTenantId });
      await db.utangLedger.where('tenantId').equals(tenantId).modify({ tenantId: canonicalTenantId });
      await db.gcashTxns.where('tenantId').equals(tenantId).modify({ tenantId: canonicalTenantId });
      await db.gcashTxnResolutions.where('tenantId').equals(tenantId).modify({ tenantId: canonicalTenantId });

      const sourceTenant = await db.tenants.get(tenantId);
      const destinationTenant = await db.tenants.get(canonicalTenantId);
      if (sourceTenant) {
        if (!destinationTenant) {
          await db.tenants.put({ ...sourceTenant, id: canonicalTenantId });
        }
        await db.tenants.delete(tenantId);
      }

      await db.syncQueue.toCollection().modify((item) => {
        if (item.payload?.tenantId?.toLowerCase() === tenantId.toLowerCase()) {
          item.payload = { ...item.payload, tenantId: canonicalTenantId };
        }
      });
      await db.deadLetterQueue.toCollection().modify((item) => {
        if (item.payload?.tenantId?.toLowerCase() === tenantId.toLowerCase()) {
          item.payload = { ...item.payload, tenantId: canonicalTenantId };
        }
      });
    });

    useGCashFeeStore.getState().migrateTenantFees(tenantId, canonicalTenantId);
  }

  useAuthStore.getState().confirmServerIdentity(canonicalTenantId, canonicalUserId);
  const activeToken = useAuthStore.getState().firebaseToken ?? firebaseToken;
  provisionedSessions.add(`${canonicalTenantId}:${canonicalUserId}:${activeToken ?? ''}`);
}

apiClient.interceptors.request.use(async (config) => {
  if (!isPublicAuthRequest(config.url)) {
    await ensureAccessTokenFresh();
  }

  const { tenantId, firebaseToken } = useAuthStore.getState();

  if (tenantId) {
    config.headers['X-Tenant-Id'] = tenantId;
  }

  if (firebaseToken && isAccessTokenUsable(firebaseToken)) {
    config.headers['Authorization'] = `Bearer ${firebaseToken}`;
  }

  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error?.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
    if (
      error?.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !isPublicAuthRequest(originalRequest.url)
    ) {
      originalRequest._retry = true;
      try {
        await startRefresh({
          force: true,
          rejectedAccessToken: authorizationToken(originalRequest.headers)
        });
        const newToken = useAuthStore.getState().firebaseToken;
        if (!newToken) {
          useAuthStore.getState().setReauthRequired(true);
          throw new SessionReauthRequiredError();
        }
        originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
        return apiClient.request(originalRequest);
      } catch (refreshErr) {
        if (!(refreshErr instanceof SessionReauthRequiredError)) {
          const refreshStatus = getErrorStatus(refreshErr);
          if (refreshStatus !== 401 && refreshStatus !== 403) {
            delete originalRequest._retry;
          }
        }
        return Promise.reject(refreshErr);
      }
    }

    return Promise.reject(error);
  }
);
