import axios from 'axios';
import { useAuthStore } from '../state/authStore';
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

function getAuthenticatedUserId(token: string): string | null {
  const payloadSegment = token.split('.')[1];
  if (!payloadSegment) return null;

  try {
    const base64 = payloadSegment.replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(globalThis.atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='))) as {
      sub?: unknown;
    };
    return typeof payload.sub === 'string' && GUID_PATTERN.test(payload.sub) ? payload.sub : null;
  } catch {
    return null;
  }
}

export async function ensureTenantProvisioned(): Promise<void> {
  const auth = useAuthStore.getState();
  const {
    tenantId,
    userId,
    firebaseToken,
    businessName,
    userPhone,
    userEmail,
    isOnboarded,
    isOnboardingStatusReady,
    locallyCreatedTenantId,
    serverConfirmedTenantId,
    serverConfirmedUserId
  } = auth;
  if (!isOnboardingStatusReady || !isOnboarded || !tenantId) return;

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
    const status = (err as { response?: { status?: unknown } })?.response?.status;
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
  provisionedSessions.add(`${canonicalTenantId}:${canonicalUserId}:${firebaseToken ?? ''}`);
}

apiClient.interceptors.request.use((config) => {
  const { tenantId, firebaseToken } = useAuthStore.getState();

  if (tenantId) {
    config.headers['X-Tenant-Id'] = tenantId;
  }

  if (firebaseToken) {
    config.headers['Authorization'] = `Bearer ${firebaseToken}`;
  }

  return config;
});

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error?.config;
    if (
      error?.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/auth/refresh')
    ) {
      const { refreshToken, setFirebaseToken, setRefreshToken } = useAuthStore.getState();
      if (!refreshToken) {
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((newToken) => {
            originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
            return apiClient.request(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshResponse = await axios.post<{
          token: string;
          refreshToken?: string;
        }>('/api/auth/refresh', { refreshToken }, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 15000
        });

        const newToken = refreshResponse.data.token;
        const newRefreshToken = refreshResponse.data.refreshToken ?? refreshToken;

        setFirebaseToken(newToken);
        if (newRefreshToken) {
          setRefreshToken(newRefreshToken);
        }

        processQueue(null, newToken);
        originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
        return apiClient.request(originalRequest);
      } catch (refreshErr: any) {
        processQueue(refreshErr, null);
        const refreshStatus = refreshErr?.response?.status;
        if (refreshStatus === 401 || refreshStatus === 403) {
          setFirebaseToken(null);
          setRefreshToken(null);
        } else {
          delete originalRequest._retry;
        }
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);
