import { describe, it, expect } from 'vitest';
import { getLocalizedSyncErrorMessage } from './syncErrors';
import { translations } from '../i18n/translations';

describe('syncErrors utility', () => {
  it('translates TenantAccountMismatchError between Tagalog and English', () => {
    const tlMsg = translations.tl.common.differentAccountSyncBlocked;
    const enMsg = translations.en.common.differentAccountSyncBlocked;

    expect(getLocalizedSyncErrorMessage(tlMsg, 'en')).toBe(enMsg);
    expect(getLocalizedSyncErrorMessage(enMsg, 'tl')).toBe(tlMsg);
    expect(getLocalizedSyncErrorMessage(tlMsg, 'tl')).toBe(tlMsg);
    expect(getLocalizedSyncErrorMessage(enMsg, 'en')).toBe(enMsg);
  });

  it('translates TenantProvisioningError between Tagalog and English', () => {
    const tlMsg = translations.tl.common.tenantProvisioningSyncBlocked;
    const enMsg = translations.en.common.tenantProvisioningSyncBlocked;

    expect(getLocalizedSyncErrorMessage(tlMsg, 'en')).toBe(enMsg);
    expect(getLocalizedSyncErrorMessage(enMsg, 'tl')).toBe(tlMsg);
  });

  it('translates DLQ edit required error between Tagalog and English', () => {
    const tlMsg = 'May mga produkto sa Dead Letter Queue na kailangang ayusin sa Settings bago ma-sync.';
    const enMsg = 'Some products in the Dead Letter Queue require editing in Settings before syncing.';

    expect(getLocalizedSyncErrorMessage(tlMsg, 'en')).toBe(enMsg);
    expect(getLocalizedSyncErrorMessage(enMsg, 'tl')).toBe(tlMsg);
  });

  it('translates 401 and 403 sync rejection errors', () => {
    const tl403 = 'Tinanggihan ang pag-sync dahil walang awtorisadong tindahan ang account na ito. Mag-sign in muli para magpatuloy. Nananatili sa device na ito ang mga nakabinbing pagbabago.';
    const en403 = 'Sync was rejected because this account has no authorized tenant. Re-authenticate to resume syncing. Pending changes remain on this device.';

    expect(getLocalizedSyncErrorMessage(tl403, 'en')).toBe(en403);
    expect(getLocalizedSyncErrorMessage(en403, 'tl')).toBe(tl403);

    const tl401 = 'Tinanggihan ang pag-sync dahil walang wastong session ng tindahan ang device na ito. Mag-sign in muli para magpatuloy. Nananatili sa device na ito ang mga nakabinbing pagbabago.';
    const en401 = 'Sync was rejected because this device has no valid tenant session. Re-authenticate to resume syncing. Pending changes remain on this device.';

    expect(getLocalizedSyncErrorMessage(tl401, 'en')).toBe(en401);
    expect(getLocalizedSyncErrorMessage(en401, 'tl')).toBe(tl401);
  });

  it('translates connection and backoff composite errors', () => {
    const tlComposite = 'Hindi makakonekta sa server. Sinusubukang muli gamit ang backoff; nananatili sa device na ito ang mga nakabinbing pagbabago.';
    const enComposite = 'Could not connect to server. Retrying with backoff; pending changes remain on this device.';

    expect(getLocalizedSyncErrorMessage(tlComposite, 'en')).toBe(enComposite);
    expect(getLocalizedSyncErrorMessage(enComposite, 'tl')).toBe(tlComposite);
  });

  it('translates DLQ item moved errors', () => {
    const tl = 'Nalipat sa Dead Letter Queue ang 1 transaksyon: Invalid payload';
    const en = '1 transaction moved to Dead Letter Queue: Invalid payload';

    expect(getLocalizedSyncErrorMessage(tl, 'en')).toBe(en);
    expect(getLocalizedSyncErrorMessage(en, 'tl')).toBe(tl);
  });

  it('returns untouched string for unknown messages and null for falsy values', () => {
    expect(getLocalizedSyncErrorMessage(null, 'en')).toBeNull();
    expect(getLocalizedSyncErrorMessage(undefined, 'tl')).toBeNull();
    expect(getLocalizedSyncErrorMessage('Unknown error 500', 'en')).toBe('Unknown error 500');
    expect(getLocalizedSyncErrorMessage('Unknown error 500', 'tl')).toBe('Unknown error 500');
  });
});
