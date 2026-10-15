import React, { useState } from 'react';
import {
  Dialog,
  DialogSurface,
  DialogTitle,
  DialogBody,
  DialogContent,
  DialogActions,
  Field,
  Input,
  Button,
  Text,
  makeStyles,
  tokens,
  shorthands,
  Spinner
} from '@fluentui/react-components';
import {
  KeyRegular,
  LockClosedRegular,
  EyeRegular,
  EyeOffRegular
} from '@fluentui/react-icons';
import { useAuthStore } from '../state/authStore';
import { useTranslation } from '../state/languageStore';
import { computeLocalPinHash, loginPin, loginStore } from '../services/authService';

const useStyles = makeStyles({
  surface: {
    maxWidth: '400px',
    width: '90vw',
    ...shorthands.padding(tokens.spacingVerticalL, tokens.spacingHorizontalL),
    backgroundColor: tokens.colorNeutralBackground1,
    ...shorthands.borderRadius(tokens.borderRadiusLarge),
    textAlign: 'center'
  },
  lockIcon: {
    width: '48px',
    height: '48px',
    marginRight: 'auto',
    marginLeft: 'auto',
    marginBottom: tokens.spacingVerticalM,
    ...shorthands.borderRadius(tokens.borderRadiusCircular),
    backgroundColor: tokens.colorBrandBackground,
    color: tokens.colorNeutralBackground1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '24px'
  },
  keypadGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: tokens.spacingHorizontalS,
    marginTop: tokens.spacingVerticalM,
    marginBottom: tokens.spacingVerticalM
  },
  keypadBtn: {
    height: '48px',
    fontSize: '18px',
    fontWeight: 'bold'
  },
  errorText: {
    color: tokens.colorPaletteRedForeground1,
    display: 'block',
    marginTop: tokens.spacingVerticalS,
    marginBottom: tokens.spacingVerticalS
  }
});

export const SessionLockModal: React.FC = () => {
  const styles = useStyles();
  const { t } = useTranslation();
  const {
    isSessionLocked,
    setIsSessionLocked,
    hasPin,
    userEmail,
    tenantId,
    localPinVerifier,
    businessName
  } = useAuthStore();

  const [pin, setPin] = useState('');
  const [usePassword, setUsePassword] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  if (!isSessionLocked || !hasPin) {
    return null;
  }

  const handleUnlock = async () => {
    if (isVerifying) return;
    setError('');
    setIsVerifying(true);

    try {
      if (usePassword) {
        if (!password) {
          setError(t.onboarding.passwordRequired);
          setIsVerifying(false);
          return;
        }
        await loginStore({ email: userEmail, password });
        setIsSessionLocked(false);
        setPassword('');
        setPin('');
      } else {
        if (!pin || pin.length < 4) {
          setError(t.onboarding.pinInvalid);
          setIsVerifying(false);
          return;
        }

        // 1. Offline fast check if localPinVerifier is present
        if (localPinVerifier) {
          const hashedInput = await computeLocalPinHash(pin, tenantId);
          if (hashedInput === localPinVerifier) {
            setIsSessionLocked(false);
            setPin('');
            setIsVerifying(false);
            return;
          }
        }

        // 2. If online or no localPinVerifier match, check with backend API
        if (navigator.onLine) {
          await loginPin({ email: userEmail, pin });
          setIsSessionLocked(false);
          setPin('');
        } else {
          setError(t.settings.invalidPinOrPassword);
        }
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || t.settings.invalidPinOrPassword;
      setError(msg);
      setPin('');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleKeyPress = (num: string) => {
    if (pin.length < 6) {
      const nextPin = pin + num;
      setPin(nextPin);
      setError('');
    }
  };

  const handleBackspace = () => {
    setPin((prev) => prev.slice(0, -1));
    setError('');
  };

  return (
    <Dialog open={isSessionLocked} modalType="alert">
      <DialogSurface className={styles.surface} aria-label={t.settings.sessionLockedTitle}>
        <DialogBody>
          <div className={styles.lockIcon}>
            <LockClosedRegular />
          </div>

          <DialogTitle>{t.settings.sessionLockedTitle}</DialogTitle>
          <Text size={200} style={{ color: tokens.colorNeutralForeground3, display: 'block', marginTop: '4px' }}>
            {businessName} • {userEmail}
          </Text>
          <Text size={200} style={{ color: tokens.colorNeutralForeground3, display: 'block', marginTop: '4px' }}>
            {t.settings.sessionLockedDesc}
          </Text>

          <DialogContent style={{ marginTop: tokens.spacingVerticalM }}>
            {error && (
              <Text role="alert" size={200} className={styles.errorText}>
                {error}
              </Text>
            )}

            {!usePassword ? (
              <div>
                <Field>
                  <Input
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    value={pin}
                    onChange={(_, data) => setPin(data.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="••••"
                    style={{ textAlign: 'center', fontSize: '24px', letterSpacing: '8px' }}
                    contentBefore={<KeyRegular />}
                    autoFocus
                  />
                </Field>

                <div className={styles.keypadGrid}>
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'].map((k) => (
                    <Button
                      key={k}
                      className={styles.keypadBtn}
                      appearance="secondary"
                      onClick={() => {
                        if (k === 'C') setPin('');
                        else if (k === '⌫') handleBackspace();
                        else handleKeyPress(k);
                      }}
                      type="button"
                    >
                      {k}
                    </Button>
                  ))}
                </div>

                <Button
                  appearance="transparent"
                  size="small"
                  onClick={() => {
                    setUsePassword(true);
                    setError('');
                  }}
                >
                  {t.onboarding.loginModePassword}
                </Button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalM }}>
                <Field label={t.onboarding.passwordLabel}>
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(_, data) => setPassword(data.value)}
                    contentBefore={<LockClosedRegular />}
                    contentAfter={
                      <Button
                        appearance="subtle"
                        size="small"
                        icon={showPassword ? <EyeOffRegular /> : <EyeRegular />}
                        onClick={() => setShowPassword(!showPassword)}
                        type="button"
                      />
                    }
                    autoFocus
                  />
                </Field>

                <Button
                  appearance="transparent"
                  size="small"
                  onClick={() => {
                    setUsePassword(false);
                    setError('');
                  }}
                >
                  {t.onboarding.loginModePin}
                </Button>
              </div>
            )}
          </DialogContent>

          <DialogActions style={{ justifyContent: 'center', marginTop: tokens.spacingVerticalM }}>
            <Button
              appearance="primary"
              size="large"
              icon={isVerifying ? <Spinner size="extra-tiny" /> : <LockClosedRegular />}
              onClick={handleUnlock}
              disabled={isVerifying || (!usePassword && pin.length < 4) || (usePassword && !password)}
            >
              {t.settings.unlockBtn}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
};
