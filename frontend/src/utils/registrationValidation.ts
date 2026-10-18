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
    passwordRequired: string;
    passwordStrengthError: string;
    confirmPasswordRequired: string;
    passwordMismatch: string;
    pinInvalid: string;
  };
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
