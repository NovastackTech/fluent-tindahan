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
  Spinner,
  tokens
} from '@fluentui/react-components';
import { EyeRegular, EyeOffRegular } from '@fluentui/react-icons';
import { useAuthStore } from '../state/authStore';
import { useTranslation } from '../state/languageStore';
import { updatePin, generateLocalPinVerifier } from '../services/authService';
import { getLocalizedSyncErrorMessage } from '../utils/syncErrors';

export interface PinManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClose?: () => void;
}

export const PinManagementDialog: React.FC<PinManagementDialogProps> = ({
  open,
  onOpenChange,
  onClose
}) => {
  const { userEmail, setHasPin, setLocalPinVerifier } = useAuthStore();
  const { t, language } = useTranslation();

  const [pinDialogPassword, setPinDialogPassword] = useState('');
  const [pinDialogNewPin, setPinDialogNewPin] = useState('');
  const [showPinPassword, setShowPinPassword] = useState(false);
  const [pinDialogError, setPinDialogError] = useState('');
  const [pinDialogSuccess, setPinDialogSuccess] = useState('');
  const [isPinDialogSubmitting, setIsPinDialogSubmitting] = useState(false);

  const handleClose = () => {
    setPinDialogPassword('');
    setPinDialogNewPin('');
    setShowPinPassword(false);
    setPinDialogError('');
    setPinDialogSuccess('');
    onOpenChange(false);
    onClose?.();
  };

  const handleSavePin = async () => {
    if (!pinDialogPassword) {
      setPinDialogError(t.onboarding.passwordRequired);
      return;
    }
    if (pinDialogNewPin.trim() && !/^\d{4,6}$/.test(pinDialogNewPin.trim())) {
      setPinDialogError(t.onboarding.pinInvalid);
      return;
    }

    setIsPinDialogSubmitting(true);
    setPinDialogError('');
    setPinDialogSuccess('');

    try {
      const result = await updatePin({
        email: userEmail,
        password: pinDialogPassword,
        pin: pinDialogNewPin.trim() || null
      });
      setHasPin(result.hasPin);
      if (result.hasPin && pinDialogNewPin.trim()) {
        const verifier = await generateLocalPinVerifier(pinDialogNewPin.trim());
        setLocalPinVerifier(verifier);
        useAuthStore.getState().resetOfflinePinFailures();
      } else {
        setLocalPinVerifier(null);
        useAuthStore.getState().resetOfflinePinFailures();
      }
      setPinDialogSuccess(t.settings.pinUpdatedSuccess);
      setTimeout(() => {
        handleClose();
        setPinDialogPassword('');
        setPinDialogNewPin('');
        setPinDialogSuccess('');
      }, 1000);
    } catch (err: any) {
      setPinDialogError(err?.response?.data?.message || t.onboarding.loginFailed);
    } finally {
      setIsPinDialogSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(_, data) => {
        if (!data.open) {
          handleClose();
        }
      }}
    >
      <DialogSurface>
        <DialogBody>
          <DialogTitle>{t.settings.pinDialogTitle}</DialogTitle>
          <DialogContent
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: tokens.spacingVerticalM,
              marginTop: tokens.spacingVerticalS
            }}
          >
            <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
              {t.settings.pinDialogDesc}
            </Text>

            {pinDialogError && (
              <Text role="alert" size={200} style={{ color: tokens.colorPaletteRedForeground1 }}>
                {getLocalizedSyncErrorMessage(pinDialogError, language) || pinDialogError}
              </Text>
            )}
            {pinDialogSuccess && (
              <Text size={200} style={{ color: tokens.colorPaletteGreenForeground1 }}>
                {pinDialogSuccess}
              </Text>
            )}

            <Field label={t.settings.currentPasswordLabel} required>
              <Input
                type={showPinPassword ? 'text' : 'password'}
                value={pinDialogPassword}
                onChange={(_, data) => setPinDialogPassword(data.value)}
                placeholder="••••••••"
                contentAfter={
                  <Button
                    appearance="subtle"
                    size="small"
                    icon={showPinPassword ? <EyeOffRegular /> : <EyeRegular />}
                    onClick={() => setShowPinPassword(!showPinPassword)}
                    type="button"
                  />
                }
                autoFocus
              />
            </Field>

            <Field label={t.settings.newPinLabel} hint={t.onboarding.pinHint}>
              <Input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={pinDialogNewPin}
                onChange={(_, data) => setPinDialogNewPin(data.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="4-6 digits"
              />
            </Field>
          </DialogContent>
          <DialogActions
            fluid
            style={{
              gridColumn: '1 / -1',
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'flex-end',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <Button appearance="secondary" style={{ whiteSpace: 'nowrap' }} onClick={handleClose}>
              {t.common.cancel}
            </Button>
            <Button
              appearance="primary"
              style={{ whiteSpace: 'nowrap' }}
              disabled={isPinDialogSubmitting || !pinDialogPassword}
              icon={isPinDialogSubmitting ? <Spinner size="extra-tiny" /> : undefined}
              onClick={handleSavePin}
            >
              {t.common.save}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
};
