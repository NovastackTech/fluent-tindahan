import { evaluatePasswordStrength } from './passwordStrength';

export interface RegistrationFieldErrors {
  storeName?: boolean;
  email?: boolean;
  password?: boolean;
  confirmPassword?: boolean;
  pin?: boolean;
}

export interface RegistrationValidationTranslations {
  onboarding: {
    storeNameRequired: string;
    emailInvalid: string;
    emailDisposableNotAllowed?: string;
    passwordRequired: string;
    passwordStrengthError: string;
    confirmPasswordRequired: string;
    passwordMismatch: string;
    pinInvalid: string;
  };
}

const DISPOSABLE_EMAIL_DOMAINS = new Set([
  '10minutemail.com', '10minutemail.net', '10minutemail.org', '20minutemail.com',
  '33mail.com', 'anonaddy.com', 'anonaddy.me', 'burnermail.io', 'discard.email',
  'discardmail.com', 'dispostable.com', 'dropmail.me', 'emailondeck.com',
  'fakeinbox.com', 'fakemailgenerator.com', 'generator.email', 'getairmail.com',
  'getnada.com', 'grr.la', 'guerrillamail.biz', 'guerrillamail.com',
  'guerrillamail.de', 'guerrillamail.info', 'guerrillamail.net', 'guerrillamail.org',
  'guerrillamailblock.com', 'harakirimail.com', 'inboxkitten.com', 'jetable.org',
  'mailcatch.com', 'maildrop.cc', 'mailforspam.com', 'mailinator.com',
  'mailinator.net', 'mailinator.org', 'mailnesia.com', 'mailnull.com',
  'mailsac.com', 'mailtemp.info', 'meltmail.com', 'mintemail.com',
  'moakt.com', 'mohmal.com', 'mytemp.email', 'mytrashmail.com', 'nada.email',
  'sharklasers.com', 'spam4.me', 'spambox.us', 'spamgourmet.com', 'temp-mail.com',
  'temp-mail.org', 'temp-mail.ru', 'tempail.com', 'tempemail.com', 'tempinbox.com',
  'tempmail.co', 'tempmail.com', 'tempmail.de', 'tempmail.eu', 'tempmail.net',
  'tempmail.org', 'tempmail.us', 'tempmailo.com', 'throwawaymail.com',
  'trashmail.com', 'trashmail.de', 'trashmail.me', 'trashmail.net', 'trashmail.org',
  'yopmail.com', 'yopmail.fr', 'yopmail.net'
]);

export function isDisposableEmail(email: string): boolean {
  const trimmed = email.trim().toLowerCase();
  const atIdx = trimmed.lastIndexOf('@');
  if (atIdx < 0 || atIdx >= trimmed.length - 1) return false;
  let domain = trimmed.slice(atIdx + 1).replace(/^\.+|\.+$/g, '');
  while (domain) {
    if (DISPOSABLE_EMAIL_DOMAINS.has(domain)) return true;
    const dotIdx = domain.indexOf('.');
    if (dotIdx < 0) break;
    domain = domain.slice(dotIdx + 1);
  }
  return false;
}

export function validateRegistrationInput(
  storeName: string,
  email: string,
  password: string,
  confirmPassword: string,
  pin: string,
  t: RegistrationValidationTranslations
): {
  isValid: boolean;
  errors: string[];
  fieldErrors: RegistrationFieldErrors;
  trimmedStore: string;
  trimmedEmail: string;
} {
  const trimmedStore = storeName.trim();
  const trimmedEmail = email.trim().toLowerCase();
  const errors: string[] = [];
  const fieldErrors: RegistrationFieldErrors = {};

  if (!trimmedStore || trimmedStore.length < 2) {
    errors.push(t.onboarding.storeNameRequired);
    fieldErrors.storeName = true;
  }
  if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
    errors.push(t.onboarding.emailInvalid);
    fieldErrors.email = true;
  } else if (isDisposableEmail(trimmedEmail)) {
    errors.push(t.onboarding.emailDisposableNotAllowed || t.onboarding.emailInvalid);
    fieldErrors.email = true;
  }
  if (!password) {
    errors.push(t.onboarding.passwordRequired);
    fieldErrors.password = true;
  } else if (!evaluatePasswordStrength(password).isValid) {
    errors.push(t.onboarding.passwordStrengthError);
    fieldErrors.password = true;
  }

  if (!confirmPassword) {
    errors.push(t.onboarding.confirmPasswordRequired);
    fieldErrors.confirmPassword = true;
  } else if (password !== confirmPassword) {
    errors.push(t.onboarding.passwordMismatch);
    fieldErrors.confirmPassword = true;
  }

  if (pin.trim() && !/^\d{4,6}$/.test(pin.trim())) {
    errors.push(t.onboarding.pinInvalid);
    fieldErrors.pin = true;
  }

  return {
    isValid: errors.length === 0,
    errors,
    fieldErrors,
    trimmedStore,
    trimmedEmail
  };
}

export interface LoginFieldErrors {
  email?: boolean;
  password?: boolean;
  pin?: boolean;
}

export interface LoginValidationTranslations {
  onboarding: {
    emailInvalid: string;
    passwordRequired: string;
    pinInvalid: string;
  };
}

export function validateLoginInput(
  email: string,
  loginMode: 'password' | 'pin',
  passwordVal: string,
  pinVal: string,
  t: LoginValidationTranslations
): {
  isValid: boolean;
  errors: string[];
  fieldErrors: LoginFieldErrors;
  trimmedEmail: string;
} {
  const trimmedEmail = email.trim().toLowerCase();
  const errors: string[] = [];
  const fieldErrors: LoginFieldErrors = {};

  if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
    errors.push(t.onboarding.emailInvalid);
    fieldErrors.email = true;
  }

  if (loginMode === 'password') {
    if (!passwordVal) {
      errors.push(t.onboarding.passwordRequired);
      fieldErrors.password = true;
    }
  } else {
    if (!pinVal.trim() || !/^\d{4,6}$/.test(pinVal.trim())) {
      errors.push(t.onboarding.pinInvalid);
      fieldErrors.pin = true;
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    fieldErrors,
    trimmedEmail
  };
}
