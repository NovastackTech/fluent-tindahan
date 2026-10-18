export function evaluatePasswordStrength(password: string): {
  score: 0 | 1 | 2 | 3;
  labelKey: 'passwordStrengthWeak' | 'passwordStrengthMedium' | 'passwordStrengthStrong';
  isValid: boolean;
} {
  if (!password) {
    return { score: 0, labelKey: 'passwordStrengthWeak', isValid: false };
  }
  const hasMinLength = password.length >= 8;
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecialOrUpper = /[A-Z]/.test(password) && /[^a-zA-Z0-9]/.test(password);

  let score: 0 | 1 | 2 | 3 = 1;
  if (!hasMinLength || !hasLetter || !hasNumber) {
    score = 1;
  } else if (hasSpecialOrUpper || password.length >= 10) {
    score = 3;
  } else {
    score = 2;
  }

  const isValid = hasMinLength && hasLetter && hasNumber;
  const labelKey =
    score === 3
      ? 'passwordStrengthStrong'
      : score === 2
      ? 'passwordStrengthMedium'
      : 'passwordStrengthWeak';

  return { score, labelKey, isValid };
}
