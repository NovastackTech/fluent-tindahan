import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FluentProvider } from '@fluentui/react-components';
import { sariSariLightTheme } from '../theme/theme';
import { RegistrationFormFields } from './RegistrationFormFields';
import {
  validateRegistrationInput,
  type RegistrationFieldErrors
} from '../utils/registrationValidation';
import { translations } from '../i18n/translations';

describe('RegistrationFormFields', () => {
  const t = translations.en;

  const defaultProps = {
    idPrefix: 'test' as const,
    regStoreName: '',
    setRegStoreName: vi.fn(),
    regEmail: '',
    setRegEmail: vi.fn(),
    regPassword: '',
    setRegPassword: vi.fn(),
    regConfirmPassword: '',
    setRegConfirmPassword: vi.fn(),
    regPin: '',
    setRegPin: vi.fn(),
    showPassword: false,
    setShowPassword: vi.fn(),
    showConfirmPassword: false,
    setShowConfirmPassword: vi.fn(),
    regFieldErrors: {} as RegistrationFieldErrors,
    setRegFieldErrors: vi.fn(),
    t
  };

  const renderComponent = (props = {}) => {
    return render(
      <FluentProvider theme={sariSariLightTheme}>
        <RegistrationFormFields {...defaultProps} {...props} />
      </FluentProvider>
    );
  };

  it('renders all registration fields with correct prefix IDs', () => {
    renderComponent({ idPrefix: 'login' as const });

    expect(screen.getByPlaceholderText(t.landing.storeNamePlaceholder)).toHaveAttribute('id', 'login-reg-store');
    expect(screen.getByPlaceholderText(t.landing.emailPlaceholder)).toHaveAttribute('id', 'login-reg-email');
    expect(screen.getByPlaceholderText(t.landing.passwordPlaceholder)).toHaveAttribute('id', 'login-reg-password');
    expect(screen.getByPlaceholderText(t.landing.confirmPasswordPlaceholder)).toHaveAttribute('id', 'login-reg-confirm-password');
    expect(screen.getByPlaceholderText(t.landing.pinPlaceholder)).toHaveAttribute('id', 'login-reg-pin');
  });

  it('calls setRegStoreName and clears error state on store name input change', () => {
    const setRegStoreName = vi.fn();
    const setRegFieldErrors = vi.fn();
    renderComponent({
      regFieldErrors: { storeName: true },
      setRegStoreName,
      setRegFieldErrors
    });

    const input = screen.getByPlaceholderText(t.landing.storeNamePlaceholder);
    fireEvent.change(input, { target: { value: 'My Store' } });

    expect(setRegStoreName).toHaveBeenCalledWith('My Store');
    expect(setRegFieldErrors).toHaveBeenCalled();
  });

  it('renders password strength indicator when password is entered', () => {
    const { rerender } = renderComponent({ idPrefix: 'login' as const, regPassword: '' });
    expect(screen.queryByTestId('login-password-strength-indicator')).not.toBeInTheDocument();

    rerender(
      <FluentProvider theme={sariSariLightTheme}>
        <RegistrationFormFields {...defaultProps} idPrefix="login" regPassword="Pass1" />
      </FluentProvider>
    );

    expect(screen.getByTestId('login-password-strength-indicator')).toBeInTheDocument();
  });

  it('toggles password and confirm password visibility', () => {
    const setShowPassword = vi.fn();
    const setShowConfirmPassword = vi.fn();
    renderComponent({
      setShowPassword,
      setShowConfirmPassword,
      showPassword: false,
      showConfirmPassword: false
    });

    const toggleBtns = screen.getAllByRole('button');
    expect(toggleBtns.length).toBeGreaterThanOrEqual(2);

    fireEvent.click(toggleBtns[0]);
    expect(setShowPassword).toHaveBeenCalledWith(true);

    fireEvent.click(toggleBtns[1]);
    expect(setShowConfirmPassword).toHaveBeenCalledWith(true);
  });
});

describe('validateRegistrationInput', () => {
  const t = translations.en;

  it('returns errors for empty store name and invalid email', () => {
    const res = validateRegistrationInput('', 'not-an-email', '', '', '', t);

    expect(res.isValid).toBe(false);
    expect(res.fieldErrors.storeName).toBe(true);
    expect(res.fieldErrors.email).toBe(true);
    expect(res.fieldErrors.password).toBe(true);
    expect(res.fieldErrors.confirmPassword).toBe(true);
  });

  it('validates password strength and match', () => {
    const weakRes = validateRegistrationInput('Store', 'valid@store.ph', 'short', 'short', '', t);
    expect(weakRes.isValid).toBe(false);
    expect(weakRes.fieldErrors.password).toBe(true);

    const mismatchRes = validateRegistrationInput('Store', 'valid@store.ph', 'Password123', 'Password456', '', t);
    expect(mismatchRes.isValid).toBe(false);
    expect(mismatchRes.fieldErrors.confirmPassword).toBe(true);
  });

  it('validates pin format when provided', () => {
    const invalidPinRes = validateRegistrationInput('Store', 'valid@store.ph', 'Password123', 'Password123', '12', t);
    expect(invalidPinRes.isValid).toBe(false);
    expect(invalidPinRes.fieldErrors.pin).toBe(true);
  });

  it('returns valid when all inputs satisfy requirements', () => {
    const res = validateRegistrationInput('Aling Nena', 'nena@gmail.com', 'Password123', 'Password123', '1234', t);
    expect(res.isValid).toBe(true);
    expect(res.errors).toHaveLength(0);
    expect(res.trimmedStore).toBe('Aling Nena');
    expect(res.trimmedEmail).toBe('nena@gmail.com');
  });
});
