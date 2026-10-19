import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FluentProvider } from '@fluentui/react-components';
import { sariSariLightTheme } from '../theme/theme';
import { LoginFormFields } from './LoginFormFields';
import { translations } from '../i18n/translations';
import { validateLoginInput, type LoginFieldErrors } from '../utils/registrationValidation';

describe('LoginFormFields', () => {
  const t = translations.tl;

  const defaultProps = {
    idPrefix: 'login',
    loginEmailVal: '',
    setLoginEmailVal: vi.fn(),
    loginPasswordVal: '',
    setLoginPasswordVal: vi.fn(),
    loginPinVal: '',
    setLoginPinVal: vi.fn(),
    loginMode: 'password' as const,
    setLoginMode: vi.fn(),
    showPassword: false,
    setShowPassword: vi.fn(),
    loginFieldErrors: {} as LoginFieldErrors,
    setLoginFieldErrors: vi.fn(),
    setAuthErrors: vi.fn(),
    t,
    toggleTestId: 'login-toggle-mode-btn'
  };

  const renderComponent = (props = {}) => {
    return render(
      <FluentProvider theme={sariSariLightTheme}>
        <LoginFormFields {...defaultProps} {...props} />
      </FluentProvider>
    );
  };

  it('renders email and password fields in password mode with login idPrefix', () => {
    renderComponent({ idPrefix: 'login' });

    expect(screen.getByPlaceholderText(t.landing.emailPlaceholder)).toHaveAttribute('id', 'login-email');
    expect(screen.getByPlaceholderText(t.landing.passwordPlaceholder)).toHaveAttribute('id', 'login-password');
    expect(screen.queryByPlaceholderText(t.landing.pinPlaceholder)).not.toBeInTheDocument();
    expect(screen.getByTestId('login-toggle-mode-btn')).toHaveTextContent(t.landing.usePinToggle);
  });

  it('renders email and pin fields in pin mode with landing idPrefix', () => {
    renderComponent({ idPrefix: 'landing', loginMode: 'pin' as const, toggleTestId: 'landing-toggle-pin-btn' });

    expect(screen.getByPlaceholderText(t.landing.emailPlaceholder)).toHaveAttribute('id', 'landing-login-email');
    expect(screen.getByPlaceholderText(t.landing.pinPlaceholder)).toHaveAttribute('id', 'landing-login-pin');
    expect(screen.queryByPlaceholderText(t.landing.passwordPlaceholder)).not.toBeInTheDocument();
    expect(screen.getByTestId('landing-toggle-pin-btn')).toHaveTextContent(t.landing.usePasswordToggle);
  });

  it('switches login mode and clears errors when toggle button is clicked', () => {
    const setLoginMode = vi.fn();
    const setAuthErrors = vi.fn();
    const setLoginFieldErrors = vi.fn();

    renderComponent({
      loginMode: 'password',
      setLoginMode,
      setAuthErrors,
      setLoginFieldErrors
    });

    fireEvent.click(screen.getByTestId('login-toggle-mode-btn'));
    expect(setLoginMode).toHaveBeenCalledWith('pin');
    expect(setAuthErrors).toHaveBeenCalledWith([]);
    expect(setLoginFieldErrors).toHaveBeenCalledWith({});
  });

  it('toggles password visibility when eye button is clicked', () => {
    const setShowPassword = vi.fn();
    renderComponent({ setShowPassword, showPassword: false });

    const toggleBtn = screen.getByRole('button', { name: /toggle password visibility/i });
    fireEvent.click(toggleBtn);
    expect(setShowPassword).toHaveBeenCalledWith(true);
  });

  it('handles input changes and clears error state on email change', () => {
    const setLoginEmailVal = vi.fn();
    const setLoginFieldErrors = vi.fn();

    renderComponent({
      loginFieldErrors: { email: true },
      setLoginEmailVal,
      setLoginFieldErrors
    });

    const emailInput = screen.getByPlaceholderText(t.landing.emailPlaceholder);
    fireEvent.change(emailInput, { target: { value: 'store@tindahan.ph' } });

    expect(setLoginEmailVal).toHaveBeenCalledWith('store@tindahan.ph');
    expect(setLoginFieldErrors).toHaveBeenCalled();
  });
});

describe('validateLoginInput', () => {
  const t = translations.tl;

  it('validates valid password login input', () => {
    const res = validateLoginInput('owner@tindahan.ph', 'password', 'mypassword', '', t);
    expect(res.isValid).toBe(true);
    expect(res.errors).toHaveLength(0);
    expect(res.trimmedEmail).toBe('owner@tindahan.ph');
  });

  it('rejects invalid email and missing password', () => {
    const res = validateLoginInput('invalid-email', 'password', '', '', t);
    expect(res.isValid).toBe(false);
    expect(res.fieldErrors.email).toBe(true);
    expect(res.fieldErrors.password).toBe(true);
    expect(res.errors).toContain(t.onboarding.emailInvalid);
    expect(res.errors).toContain(t.onboarding.passwordRequired);
  });

  it('validates 4-6 digit pin in pin mode', () => {
    const validRes = validateLoginInput('owner@tindahan.ph', 'pin', '', '1234', t);
    expect(validRes.isValid).toBe(true);

    const invalidRes = validateLoginInput('owner@tindahan.ph', 'pin', '', '12', t);
    expect(invalidRes.isValid).toBe(false);
    expect(invalidRes.fieldErrors.pin).toBe(true);
    expect(invalidRes.errors).toContain(t.onboarding.pinInvalid);
  });
});
