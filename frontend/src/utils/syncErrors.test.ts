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

    const tlNested = 'Nalipat sa Dead Letter Queue ang 1 transaksyon: Failed';
    const enNested = '1 transaction moved to Dead Letter Queue: Failed';
    expect(getLocalizedSyncErrorMessage(tlNested, 'tl')).toBe('Nalipat sa Dead Letter Queue ang 1 transaksyon: Bumagsak');
    expect(getLocalizedSyncErrorMessage(enNested, 'tl')).toBe('Nalipat sa Dead Letter Queue ang 1 transaksyon: Bumagsak');
  });

  it('translates Network Error and server status errors', () => {
    expect(getLocalizedSyncErrorMessage('Network Error', 'tl')).toBe('Hindi makakonekta sa server');
    expect(getLocalizedSyncErrorMessage('Network Error.', 'tl')).toBe('Hindi makakonekta sa server.');
    expect(getLocalizedSyncErrorMessage('Sync server error (500)', 'tl')).toBe('Problema sa server ng sync (500)');
    expect(getLocalizedSyncErrorMessage('Problema sa server ng sync (500)', 'en')).toBe('Sync server error (500)');
  });

  it('translates GCash duplicate references and transaction conflicts', () => {
    expect(getLocalizedSyncErrorMessage('2 duplicate GCash references detected.', 'tl')).toBe(
      'May 2 dobleng reference ng GCash na natukoy.'
    );
    expect(getLocalizedSyncErrorMessage('1 duplicate GCash reference detected.', 'tl')).toBe(
      'May 1 dobleng reference ng GCash na natukoy.'
    );
    expect(getLocalizedSyncErrorMessage('May 2 dobleng reference ng GCash na natukoy.', 'en')).toBe(
      '2 duplicate GCash references detected.'
    );

    expect(getLocalizedSyncErrorMessage('1 GCash transaction conflict detected.', 'tl')).toBe(
      'May 1 salungatan sa transaksyon ng GCash na natukoy.'
    );
    expect(getLocalizedSyncErrorMessage('May 1 salungatan sa transaksyon ng GCash na natukoy.', 'en')).toBe(
      '1 GCash transaction conflict detected.'
    );
  });

  it('extracts either TL or EN from bilingual slash-separated messages', () => {
    const lockout =
      'Naka-lockout ang iyong IP address dahil sa 5 sunod-sunod na maling pagsubok sa PIN. Maghintay nang 15 minuto. / IP address throttled for 15 minutes due to 5 failed PIN attempts.';

    expect(getLocalizedSyncErrorMessage(lockout, 'tl')).toBe(
      'Naka-lockout ang iyong IP address dahil sa 5 sunod-sunod na maling pagsubok sa PIN. Maghintay nang 15 minuto.'
    );
    expect(getLocalizedSyncErrorMessage(lockout, 'en')).toBe(
      'IP address throttled for 15 minutes due to 5 failed PIN attempts.'
    );

    const pinFailed =
      'Maling email o PIN code. May natitira ka pang 4 pagsubok bago mag-lockout. / Invalid email or PIN code. 4 attempts remaining.';
    expect(getLocalizedSyncErrorMessage(pinFailed, 'tl')).toBe(
      'Maling email o PIN code. May natitira ka pang 4 pagsubok bago mag-lockout.'
    );
    expect(getLocalizedSyncErrorMessage(pinFailed, 'en')).toBe(
      'Invalid email or PIN code. 4 attempts remaining.'
    );
  });

  it('returns untouched string for unknown messages and null for falsy values', () => {
    expect(getLocalizedSyncErrorMessage(null, 'en')).toBeNull();
    expect(getLocalizedSyncErrorMessage(undefined, 'tl')).toBeNull();
    expect(getLocalizedSyncErrorMessage('Unknown error 500', 'en')).toBe('Unknown error 500');
    expect(getLocalizedSyncErrorMessage('Unknown error 500', 'tl')).toBe('Unknown error 500');
  });
});
