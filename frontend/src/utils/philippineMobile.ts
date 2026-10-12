const mobileSeparators = /[\s()-]/g;
const localMobilePattern = /^09\d{9}$/;
const internationalMobilePattern = /^\+639\d{9}$/;

export function normalizePhilippineMobile(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return '';

  const compact = trimmed.replace(mobileSeparators, '');
  if (localMobilePattern.test(compact)) return compact;
  if (internationalMobilePattern.test(compact)) return `0${compact.slice(3)}`;
  return null;
}
