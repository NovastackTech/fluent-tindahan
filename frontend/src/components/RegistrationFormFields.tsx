import React from 'react';
import {
  tokens,
  Text,
  Input,
  Button,
  Field
} from '@fluentui/react-components';
import {
  BuildingShopRegular,
  MailRegular,
  LockClosedRegular,
  KeyRegular,
  EyeRegular,
  EyeOffRegular
} from '@fluentui/react-icons';
import type { Translations } from '../i18n/translations';
import { evaluatePasswordStrength } from '../utils/passwordStrength';
import type { RegistrationFieldErrors } from '../utils/registrationValidation';

export type { RegistrationFieldErrors } from '../utils/registrationValidation';

export interface RegistrationFormFieldsProps {
  idPrefix: string;
  regStoreName: string;
  setRegStoreName: (value: string) => void;
  regEmail: string;
  setRegEmail: (value: string) => void;
  regPassword: string;
  setRegPassword: (value: string) => void;
  regConfirmPassword: string;
  setRegConfirmPassword: (value: string) => void;
  regPin: string;
  setRegPin: (value: string) => void;
  showPassword: boolean;
  setShowPassword: (value: boolean) => void;
  showConfirmPassword: boolean;
  setShowConfirmPassword: (value: boolean) => void;
  regFieldErrors: RegistrationFieldErrors;
  setRegFieldErrors: React.Dispatch<React.SetStateAction<RegistrationFieldErrors>>;
  t: Translations;
}

export const RegistrationFormFields: React.FC<RegistrationFormFieldsProps> = ({
  idPrefix,
  regStoreName,
  setRegStoreName,
  regEmail,
  setRegEmail,
  regPassword,
  setRegPassword,
  regConfirmPassword,
  setRegConfirmPassword,
  regPin,
  setRegPin,
  showPassword,
  setShowPassword,
  showConfirmPassword,
  setShowConfirmPassword,
  regFieldErrors,
  setRegFieldErrors,
  t
}) => {
  const pwdStrength = evaluatePasswordStrength(regPassword);

  return (
    <>
      <Field
        label={t.landing.storeNameLabel}
        required
        validationState={regFieldErrors.storeName ? 'error' : undefined}
        style={{ marginBottom: tokens.spacingVerticalS }}
      >
        <Input
          id={`${idPrefix}-reg-store`}
          name="businessName"
          value={regStoreName}
          onChange={(_, d) => {
            setRegStoreName(d.value);
            if (regFieldErrors.storeName) {
              setRegFieldErrors(prev => ({ ...prev, storeName: false }));
            }
          }}
          aria-invalid={Boolean(regFieldErrors.storeName)}
          placeholder={t.landing.storeNamePlaceholder}
          contentBefore={<BuildingShopRegular />}
          required
        />
      </Field>

      <Field
        label={t.landing.emailLabel}
        required
        validationState={regFieldErrors.email ? 'error' : undefined}
        style={{ marginBottom: tokens.spacingVerticalS }}
      >
        <Input
          type="email"
          id={`${idPrefix}-reg-email`}
          name="email"
          autoComplete="username"
          value={regEmail}
          onChange={(_, d) => {
            setRegEmail(d.value);
            if (regFieldErrors.email) {
              setRegFieldErrors(prev => ({ ...prev, email: false }));
            }
          }}
          aria-invalid={Boolean(regFieldErrors.email)}
          placeholder={t.landing.emailPlaceholder}
          contentBefore={<MailRegular />}
          required
        />
      </Field>

      <Field
        label={t.landing.passwordLabel}
        required
        validationState={regFieldErrors.password ? 'error' : undefined}
        style={{ marginBottom: tokens.spacingVerticalS }}
      >
        <Input
          type={showPassword ? 'text' : 'password'}
          id={`${idPrefix}-reg-password`}
          name="new-password"
          autoComplete="new-password"
          value={regPassword}
          onChange={(_, d) => {
            setRegPassword(d.value);
            if (regFieldErrors.password) {
              setRegFieldErrors(prev => ({ ...prev, password: false }));
            }
          }}
          aria-invalid={Boolean(regFieldErrors.password)}
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

      {regPassword.length > 0 && (
        <div
          style={{ marginBottom: tokens.spacingVerticalS, marginTop: '2px' }}
          data-testid={`${idPrefix}-password-strength-indicator`}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
            <Text size={100} style={{ color: tokens.colorNeutralForeground3 }}>
              {t.landing.passwordStrengthHint}
            </Text>
            <Text
              size={100}
              weight="bold"
              style={{
                color:
                  pwdStrength.score === 3
                    ? tokens.colorPaletteGreenForeground1
                    : pwdStrength.score === 2
                    ? tokens.colorPaletteYellowForeground1
                    : tokens.colorPaletteRedForeground1
              }}
            >
              {t.landing[pwdStrength.labelKey]}
            </Text>
          </div>
          <div style={{ display: 'flex', gap: '4px', height: '4px' }}>
            <div
              style={{
                flex: 1,
                borderRadius: '2px',
                backgroundColor:
                  pwdStrength.score >= 1
                    ? pwdStrength.score === 1
                      ? tokens.colorPaletteRedBackground3
                      : pwdStrength.score === 2
                      ? tokens.colorPaletteYellowBackground3
                      : tokens.colorPaletteGreenBackground3
                    : tokens.colorNeutralStroke2
              }}
            />
            <div
              style={{
                flex: 1,
                borderRadius: '2px',
                backgroundColor:
                  pwdStrength.score >= 2
                    ? pwdStrength.score === 2
                      ? tokens.colorPaletteYellowBackground3
                      : tokens.colorPaletteGreenBackground3
                    : tokens.colorNeutralStroke2
              }}
            />
            <div
              style={{
                flex: 1,
                borderRadius: '2px',
                backgroundColor:
                  pwdStrength.score >= 3
                    ? tokens.colorPaletteGreenBackground3
                    : tokens.colorNeutralStroke2
              }}
            />
          </div>
        </div>
      )}

      <Field
        label={t.landing.confirmPasswordLabel}
        required
        validationState={regFieldErrors.confirmPassword ? 'error' : undefined}
        style={{ marginBottom: tokens.spacingVerticalS }}
      >
        <Input
          type={showConfirmPassword ? 'text' : 'password'}
          id={`${idPrefix}-reg-confirm-password`}
          name="confirm-password"
          autoComplete="new-password"
          value={regConfirmPassword}
          onChange={(_, d) => {
            setRegConfirmPassword(d.value);
            if (regFieldErrors.confirmPassword) {
              setRegFieldErrors(prev => ({ ...prev, confirmPassword: false }));
            }
          }}
          aria-invalid={Boolean(regFieldErrors.confirmPassword)}
          placeholder={t.landing.confirmPasswordPlaceholder}
          contentBefore={<LockClosedRegular />}
          contentAfter={
            <Button
              appearance="subtle"
              size="small"
              icon={showConfirmPassword ? <EyeOffRegular /> : <EyeRegular />}
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              type="button"
              aria-label="Toggle confirm password visibility"
            />
          }
          required
          data-testid={`${idPrefix}-reg-confirm-password`}
        />
      </Field>

      <Field
        label={t.landing.pinLabel}
        validationState={regFieldErrors.pin ? 'error' : undefined}
        style={{ marginBottom: tokens.spacingVerticalS }}
      >
        <Input
          type="password"
          id={`${idPrefix}-reg-pin`}
          name="pin"
          inputMode="numeric"
          value={regPin}
          onChange={(_, d) => {
            setRegPin(d.value);
            if (regFieldErrors.pin) {
              setRegFieldErrors(prev => ({ ...prev, pin: false }));
            }
          }}
          aria-invalid={Boolean(regFieldErrors.pin)}
          placeholder={t.landing.pinPlaceholder}
          contentBefore={<KeyRegular />}
        />
      </Field>
    </>
  );
};
