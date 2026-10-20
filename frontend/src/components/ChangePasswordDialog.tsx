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
import { EyeRegular, EyeOffRegular, LockClosedRegular } from '@fluentui/react-icons';
import { useAuthStore } from '../state/authStore';
import { useTranslation } from '../state/languageStore';
import { changePassword, type AuthResponseDto } from '../services/authService';
import { getLocalizedSyncErrorMessage } from '../utils/syncErrors';

export interface ChangePasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClose?: () => void;
}

export const ChangePasswordDialog: React.FC<ChangePasswordDialogProps> = ({
  open,
  onOpenChange,
  onClose
}) => {
  const { setFirebaseToken } = useAuthStore();
  const { t, language } = useTranslation();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleClose = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setShowCurrent(false);
    setShowNew(false);
    setShowConfirm(false);
    setErrorMsg('');
    setSuccessMsg('');
    onOpenChange(false);
    onClose?.();
  };

  const handleSavePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      setErrorMsg(t.settings.newPasswordMinLength);
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg(t.settings.passwordMismatchError);
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const storedRefreshToken = typeof localStorage !== 'undefined'
        ? localStorage.getItem('fluent_tindahan_refresh_token_v1') || undefined
        : undefined;

      const result = await changePassword({
        currentPassword: currentPassword.trim() || undefined,
        newPassword,
        refreshToken: storedRefreshToken
      });

      // Update active token in store if new tokens were issued
      if ('token' in result && result.token) {
        const authDto = result as AuthResponseDto;
        setFirebaseToken(authDto.token);
        if (authDto.refreshToken && typeof localStorage !== 'undefined') {
          localStorage.setItem('fluent_tindahan_refresh_token_v1', authDto.refreshToken);
        }
      }

      setSuccessMsg(t.settings.passwordChangedSuccess);
      setTimeout(() => {
        handleClose();
      }, 1000);
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.message || err?.message || t.onboarding.loginFailed);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(_, data) => {
        if (!data.open) {
          handleClose();
        } else {
          onOpenChange(true);
        }
      }}
    >
      <DialogSurface aria-label={t.settings.changePasswordTitle}>
        <DialogTitle>{t.settings.changePasswordTitle}</DialogTitle>
        <DialogBody>
          <DialogContent>
            <Text size={200} style={{ display: 'block', marginBottom: tokens.spacingVerticalM }}>
              {t.settings.changePasswordDesc}
            </Text>

            {errorMsg && (
              <div
                style={{
                  backgroundColor: tokens.colorPaletteRedBackground1,
                  color: tokens.colorPaletteRedForeground1,
                  border: `1px solid ${tokens.colorPaletteRedBorder1}`,
                  borderRadius: tokens.borderRadiusMedium,
                  padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
                  marginBottom: tokens.spacingVerticalM,
                  fontSize: tokens.fontSizeBase200
                }}
                role="alert"
                data-testid="change-password-error-banner"
              >
                {getLocalizedSyncErrorMessage(errorMsg, language) || errorMsg}
              </div>
            )}

            {successMsg && (
              <div
                style={{
                  backgroundColor: tokens.colorPaletteGreenBackground1,
                  color: tokens.colorPaletteGreenForeground1,
                  border: `1px solid ${tokens.colorPaletteGreenBorder1}`,
                  borderRadius: tokens.borderRadiusMedium,
                  padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
                  marginBottom: tokens.spacingVerticalM,
                  fontSize: tokens.fontSizeBase200
                }}
                role="status"
                data-testid="change-password-success-banner"
              >
                {getLocalizedSyncErrorMessage(successMsg, language) || successMsg}
              </div>
            )}

            <Field
              label={t.settings.currentPasswordLabel}
              style={{ marginBottom: tokens.spacingVerticalM }}
            >
              <Input
                type={showCurrent ? 'text' : 'password'}
                value={currentPassword}
                onChange={(_, d) => {
                  setCurrentPassword(d.value);
                  if (errorMsg) setErrorMsg('');
                }}
                placeholder={t.settings.currentPasswordPlaceholder}
                contentBefore={<LockClosedRegular />}
                contentAfter={
                  <Button
                    appearance="subtle"
                    size="small"
                    icon={showCurrent ? <EyeOffRegular /> : <EyeRegular />}
                    onClick={() => setShowCurrent(!showCurrent)}
                    type="button"
                    aria-label="Toggle current password visibility"
                  />
                }
                data-testid="change-password-current-input"
              />
            </Field>

            <Field
              label={t.settings.newPasswordLabel}
              required
              hint={t.settings.newPasswordPlaceholder}
              style={{ marginBottom: tokens.spacingVerticalM }}
            >
              <Input
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={(_, d) => {
                  setNewPassword(d.value);
                  if (errorMsg) setErrorMsg('');
                }}
                placeholder={t.settings.newPasswordPlaceholder}
                contentBefore={<LockClosedRegular />}
                contentAfter={
                  <Button
                    appearance="subtle"
                    size="small"
                    icon={showNew ? <EyeOffRegular /> : <EyeRegular />}
                    onClick={() => setShowNew(!showNew)}
                    type="button"
                    aria-label="Toggle new password visibility"
                  />
                }
                data-testid="change-password-new-input"
              />
            </Field>

            <Field
              label={t.settings.confirmNewPasswordLabel}
              required
              style={{ marginBottom: tokens.spacingVerticalM }}
            >
              <Input
                type={showConfirm ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(_, d) => {
                  setConfirmPassword(d.value);
                  if (errorMsg) setErrorMsg('');
                }}
                placeholder={t.settings.confirmNewPasswordPlaceholder}
                contentBefore={<LockClosedRegular />}
                contentAfter={
                  <Button
                    appearance="subtle"
                    size="small"
                    icon={showConfirm ? <EyeOffRegular /> : <EyeRegular />}
                    onClick={() => setShowConfirm(!showConfirm)}
                    type="button"
                    aria-label="Toggle confirm password visibility"
                  />
                }
                data-testid="change-password-confirm-input"
              />
            </Field>
          </DialogContent>

          <DialogActions>
            <Button
              appearance="secondary"
              onClick={handleClose}
              disabled={isSubmitting}
              data-testid="change-password-cancel-btn"
            >
              {t.common.cancel}
            </Button>
            <Button
              appearance="primary"
              onClick={handleSavePassword}
              disabled={isSubmitting || !newPassword || !confirmPassword}
              icon={isSubmitting ? <Spinner size="extra-tiny" /> : undefined}
              data-testid="change-password-save-btn"
            >
              {t.settings.changePasswordBtn}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
};
