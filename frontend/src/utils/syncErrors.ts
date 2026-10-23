import { translations, type Language } from '../i18n/translations';

interface ExactErrorMapping {
  tl: string;
  en: string;
}

const EXACT_ERROR_MAPPINGS: ExactErrorMapping[] = [
  // Tenant account mismatch
  {
    tl: translations.tl.common.differentAccountSyncBlocked,
    en: translations.en.common.differentAccountSyncBlocked
  },
  // Tenant provisioning blocked
  {
    tl: translations.tl.common.tenantProvisioningSyncBlocked,
    en: translations.en.common.tenantProvisioningSyncBlocked
  },
  {
    tl: translations.tl.common.sessionReauthRequired,
    en: translations.en.common.sessionReauthRequired
  },
  // DLQ items require correction in Settings
  {
    tl: 'May mga produkto sa Dead Letter Queue na kailangang ayusin sa Settings bago ma-sync.',
    en: 'Some products in the Dead Letter Queue require editing in Settings before syncing.'
  },
  // 403 sync rejection
  {
    tl: 'Tinanggihan ang pag-sync dahil walang awtorisadong tindahan ang account na ito. Mag-sign in muli para magpatuloy. Nananatili sa device na ito ang mga nakabinbing pagbabago.',
    en: 'Sync was rejected because this account has no authorized tenant. Re-authenticate to resume syncing. Pending changes remain on this device.'
  },
  // 401 sync rejection
  {
    tl: 'Tinanggihan ang pag-sync dahil walang wastong session ng tindahan ang device na ito. Mag-sign in muli para magpatuloy. Nananatili sa device na ito ang mga nakabinbing pagbabago.',
    en: 'Sync was rejected because this device has no valid tenant session. Re-authenticate to resume syncing. Pending changes remain on this device.'
  },
  // Offline / connection error
  {
    tl: 'Hindi makakonekta sa server',
    en: 'Could not connect to server'
  },
  {
    tl: 'Hindi makakonekta sa server',
    en: 'Network Error'
  },
  {
    tl: 'Hindi makakonekta sa server.',
    en: 'Network Error.'
  },
  {
    tl: 'Bumagsak',
    en: 'Failed'
  },
  {
    tl: 'Lumampas sa limitasyon ng retry',
    en: 'Max retries exceeded'
  },
  {
    tl: 'Problema sa server ng sync',
    en: 'Sync server error'
  },
  // Backoff retry text (with period)
  {
    tl: 'Sinusubukang muli gamit ang backoff; nananatili sa device na ito ang mga nakabinbing pagbabago.',
    en: 'Retrying with backoff; pending changes remain on this device.'
  },
  // Backoff retry text (without period)
  {
    tl: 'Sinusubukang muli gamit ang backoff; nananatili sa device na ito ang mga nakabinbing pagbabago',
    en: 'Retrying with backoff; pending changes remain on this device'
  }
];

function normalizeQuotes(str: string): string {
  return str.replace(/[’']/g, "'").trim();
}

const TL_BACKOFF_SUFFIX = 'Sinusubukang muli gamit ang backoff; nananatili sa device na ito ang mga nakabinbing pagbabago.';
const EN_BACKOFF_SUFFIX = 'Retrying with backoff; pending changes remain on this device.';

const TL_BACKOFF_SUFFIX_NO_DOT = 'Sinusubukang muli gamit ang backoff; nananatili sa device na ito ang mga nakabinbing pagbabago';
const EN_BACKOFF_SUFFIX_NO_DOT = 'Retrying with backoff; pending changes remain on this device';

export function getLocalizedSyncErrorMessage(
  message: string | null | undefined,
  targetLang: Language
): string | null {
  if (!message) return null;

  // 1. Check bilingual slash-separated messages: "Tagalog message / English message"
  if (message.includes(' / ')) {
    const slashIdx = message.indexOf(' / ');
    const tlPart = message.slice(0, slashIdx).trim();
    const enPart = message.slice(slashIdx + 3).trim();
    const selected = targetLang === 'tl' ? tlPart : enPart;
    return getLocalizedSyncErrorMessage(selected, targetLang) || selected;
  }

  const normalized = normalizeQuotes(message);

  // 2. Check exact mappings
  for (const mapping of EXACT_ERROR_MAPPINGS) {
    if (normalized === normalizeQuotes(mapping.tl) || normalized === normalizeQuotes(mapping.en)) {
      return targetLang === 'tl' ? mapping.tl : mapping.en;
    }
  }

  // 3. Check server error with status code: "Sync server error (500)" <-> "Problema sa server ng sync (500)"
  const enServerErrMatch = message.match(/^Sync server error \((.+)\)$/i);
  if (enServerErrMatch) {
    return targetLang === 'tl' ? `Problema sa server ng sync (${enServerErrMatch[1]})` : message;
  }
  const tlServerErrMatch = message.match(/^(?:Error|Problema) sa (?:server ng sync|sync server) \((.+)\)$/i);
  if (tlServerErrMatch) {
    return targetLang === 'en' ? `Sync server error (${tlServerErrMatch[1]})` : message;
  }

  // 4. Check GCash reference / conflict errors
  const enGcashDupMatch = message.match(/^(\d+) duplicate GCash references? detected\.?$/i);
  if (enGcashDupMatch) {
    const count = enGcashDupMatch[1];
    return targetLang === 'tl'
      ? `May ${count} dobleng reference ng GCash na natukoy.`
      : `${count} duplicate GCash reference${count === '1' ? '' : 's'} detected.`;
  }
  const tlGcashDupMatch = message.match(/^May (\d+) dobleng reference ng GCash na natukoy\.?$/i);
  if (tlGcashDupMatch) {
    const count = tlGcashDupMatch[1];
    return targetLang === 'en'
      ? `${count} duplicate GCash reference${count === '1' ? '' : 's'} detected.`
      : `May ${count} dobleng reference ng GCash na natukoy.`;
  }

  const enGcashConflictMatch = message.match(/^(\d+) GCash transaction conflicts? detected\.?$/i);
  if (enGcashConflictMatch) {
    const count = enGcashConflictMatch[1];
    return targetLang === 'tl'
      ? `May ${count} salungatan sa transaksyon ng GCash na natukoy.`
      : `${count} GCash transaction conflict${count === '1' ? '' : 's'} detected.`;
  }
  const tlGcashConflictMatch = message.match(/^May (\d+) salungatan sa transaksyon ng GCash na natukoy\.?$/i);
  if (tlGcashConflictMatch) {
    const count = tlGcashConflictMatch[1];
    return targetLang === 'en'
      ? `${count} GCash transaction conflict${count === '1' ? '' : 's'} detected.`
      : `May ${count} salungatan sa transaksyon ng GCash na natukoy.`;
  }

  // 5. Check DLQ single item moved message
  const tlDlqMatch = message.match(/^Nalipat sa Dead Letter Queue ang (\d+) transaksyon: (.+)$/i);
  if (tlDlqMatch) {
    const [, count, rawDetail] = tlDlqMatch;
    const detail = rawDetail.trim();
    const localizedDetail = getLocalizedSyncErrorMessage(detail, targetLang) || detail;
    if (targetLang === 'en') {
      return `${count} transaction${count === '1' ? '' : 's'} moved to Dead Letter Queue: ${localizedDetail}`;
    }
    return `Nalipat sa Dead Letter Queue ang ${count} transaksyon: ${localizedDetail}`;
  }
  const enDlqMatch = message.match(/^(\d+) transactions? moved to Dead Letter Queue: (.+)$/i);
  if (enDlqMatch) {
    const [, count, rawDetail] = enDlqMatch;
    const detail = rawDetail.trim();
    const localizedDetail = getLocalizedSyncErrorMessage(detail, targetLang) || detail;
    if (targetLang === 'tl') {
      return `Nalipat sa Dead Letter Queue ang ${count} transaksyon: ${localizedDetail}`;
    }
    return `${count} transaction${count === '1' ? '' : 's'} moved to Dead Letter Queue: ${localizedDetail}`;
  }

  // 6. Check composite backoff messages
  const hasTlBackoff =
    normalized.includes(normalizeQuotes(TL_BACKOFF_SUFFIX)) ||
    normalized.endsWith(normalizeQuotes(TL_BACKOFF_SUFFIX_NO_DOT));
  const hasEnBackoff =
    normalized.includes(normalizeQuotes(EN_BACKOFF_SUFFIX)) ||
    normalized.endsWith(normalizeQuotes(EN_BACKOFF_SUFFIX_NO_DOT));

  if (hasTlBackoff || hasEnBackoff) {
    const matchedSuffix = hasTlBackoff ? TL_BACKOFF_SUFFIX_NO_DOT : EN_BACKOFF_SUFFIX_NO_DOT;
    const parts = message.split(new RegExp(matchedSuffix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
    const rawPrefix = parts[0]?.trim()?.replace(/\.$/, '') || '';
    const localizedPrefix = rawPrefix ? (getLocalizedSyncErrorMessage(rawPrefix, targetLang) || rawPrefix) : '';
    const targetSuffix = targetLang === 'tl' ? TL_BACKOFF_SUFFIX : EN_BACKOFF_SUFFIX;

    if (localizedPrefix) {
      return `${localizedPrefix}. ${targetSuffix}`;
    }
    return targetSuffix;
  }

  return message;
}

export const getLocalizedErrorMessage = getLocalizedSyncErrorMessage;
