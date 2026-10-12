const mobileSeparators = /[\s()-]/g;
const localMobilePattern = /^09\d{9}$/;
const internationalMobilePattern = /^\+639\d{9}$/;
const internationalWithoutPlusPattern = /^639\d{9}$/;
const nationalWithoutLeadingZeroPattern = /^9\d{9}$/;

export function normalizePhilippineMobile(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return '';

  const compact = trimmed.replace(mobileSeparators, '');
  if (localMobilePattern.test(compact)) return compact;
  if (internationalMobilePattern.test(compact)) return `0${compact.slice(3)}`;
  if (internationalWithoutPlusPattern.test(compact)) return `0${compact.slice(2)}`;
  if (nationalWithoutLeadingZeroPattern.test(compact)) return `0${compact}`;
  return null;
}
