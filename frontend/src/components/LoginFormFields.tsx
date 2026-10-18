import React from 'react';
import {
  tokens,
  Input,
  Button,
  Field
} from '@fluentui/react-components';
import {
  MailRegular,
  LockClosedRegular,
  KeyRegular,
  EyeRegular,
  EyeOffRegular
} from '@fluentui/react-icons';
import type { Translations } from '../i18n/translations';
import type { LoginFieldErrors } from '../utils/registrationValidation';

export interface LoginFormFieldsProps {
  idPrefix: string;
  loginEmailVal: string;
  setLoginEmailVal: (val: string) => void;
  loginPasswordVal: string;
  setLoginPasswordVal: (val: string) => void;
  loginPinVal: string;
  setLoginPinVal: (val: string) => void;
  loginMode: 'password' | 'pin';
  setLoginMode: React.Dispatch<React.SetStateAction<'password' | 'pin'>>;
  showPassword: boolean;
  setShowPassword: React.Dispatch<React.SetStateAction<boolean>>;
  loginFieldErrors: LoginFieldErrors;
  setLoginFieldErrors: React.Dispatch<React.SetStateAction<LoginFieldErrors>>;
  setAuthErrors: (errors: string[]) => void;
  t: Translations;
  toggleTestId?: string;
  toggleStyle?: React.CSSProperties;
  toggleClassName?: string;
}

export const LoginFormFields: React.FC<LoginFormFieldsProps> = ({
  idPrefix,
  loginEmailVal,
  setLoginEmailVal,
  loginPasswordVal,
  setLoginPasswordVal,
  loginPinVal,
  setLoginPinVal,
  loginMode,
  setLoginMode,
  showPassword,
  setShowPassword,
  loginFieldErrors,
  setLoginFieldErrors,
  setAuthErrors,
  t,
  toggleTestId,
  toggleStyle,
  toggleClassName
}) => {
  const emailId = idPrefix === 'landing' ? 'landing-login-email' : `${idPrefix}-email`;
  const passwordId = idPrefix === 'landing' ? 'landing-login-password' : `${idPrefix}-password`;
  const pinId = idPrefix === 'landing' ? 'landing-login-pin' : `${idPrefix}-pin`;

  return (
    <>
      <Field
        label={t.landing.emailLabel}
        required
        validationState={loginFieldErrors.email ? 'error' : undefined}
        style={{ marginBottom: tokens.spacingVerticalM }}
      >
        <Input
          type="email"
          id={emailId}
          name="email"
          autoComplete="username"
          enterKeyHint="next"
          value={loginEmailVal}
          onChange={(_, d) => {
            setLoginEmailVal(d.value);
            if (loginFieldErrors.email) {
              setLoginFieldErrors(prev => ({ ...prev, email: false }));
            }
          }}
          aria-invalid={Boolean(loginFieldErrors.email)}
          placeholder={t.landing.emailPlaceholder}
          contentBefore={<MailRegular />}
          required
        />
      </Field>

      {loginMode === 'password' ? (
        <Field
          label={t.landing.passwordLabel}
          required
          validationState={loginFieldErrors.password ? 'error' : undefined}
          style={{ marginBottom: tokens.spacingVerticalS }}
        >
          <Input
            type={showPassword ? 'text' : 'password'}
            id={passwordId}
            name="password"
            autoComplete="current-password"
            enterKeyHint="done"
            value={loginPasswordVal}
            onChange={(_, d) => {
              setLoginPasswordVal(d.value);
              if (loginFieldErrors.password) {
                setLoginFieldErrors(prev => ({ ...prev, password: false }));
              }
            }}
            aria-invalid={Boolean(loginFieldErrors.password)}
            placeholder={t.landing.passwordPlaceholder}
            contentBefore={<LockClosedRegular />}
            contentAfter={
              <Button
                appearance="subtle"
                size="small"
                icon={showPassword ? <EyeOffRegular /> : <EyeRegular />}
                onClick={() => setShowPassword(!showPassword)}
                type="button"
                aria-label="Toggle password visibility"
              />
            }
            required
          />
        </Field>
      ) : (
        <Field
          label={t.landing.pinLabel}
          hint="4–6 numeric digits"
          required
          validationState={loginFieldErrors.pin ? 'error' : undefined}
          style={{ marginBottom: tokens.spacingVerticalS }}
        >
          <Input
            type="password"
            id={pinId}
            name="pin"
            inputMode="numeric"
            pattern="[0-9]*"
            enterKeyHint="done"
            value={loginPinVal}
            onChange={(_, d) => {
              setLoginPinVal(d.value);
              if (loginFieldErrors.pin) {
                setLoginFieldErrors(prev => ({ ...prev, pin: false }));
              }
            }}
            aria-invalid={Boolean(loginFieldErrors.pin)}
            placeholder={t.landing.pinPlaceholder}
            contentBefore={<KeyRegular />}
            required
          />
        </Field>
      )}

      <div
        className={toggleClassName}
        style={toggleStyle || (toggleClassName ? undefined : { marginBottom: tokens.spacingVerticalM })}
      >
        <Button
          appearance="transparent"
          size="small"
          type="button"
          onClick={() => {
            setLoginMode(loginMode === 'password' ? 'pin' : 'password');
            setAuthErrors([]);
            setLoginFieldErrors({});
          }}
          data-testid={toggleTestId || (idPrefix === 'landing' ? 'landing-toggle-pin-btn' : 'login-toggle-mode-btn')}
        >
          {loginMode === 'password' ? t.landing.usePinToggle : t.landing.usePasswordToggle}
        </Button>
      </div>
    </>
  );
};
