export const STORAGE_KEY_LAST_SYNCED = 'fluent_tindahan_last_synced_at';

/**
 * Returns the localStorage key for storing the last sync timestamp.
 * Scoped per tenant to ensure multi-tenant data isolation.
 */
export function getSyncStorageKey(tenantId?: string | null): string {
  const trimmed = tenantId?.trim();
  if (trimmed) {
    return `${STORAGE_KEY_LAST_SYNCED}:${trimmed.toLowerCase()}`;
  }
  return STORAGE_KEY_LAST_SYNCED;
}
