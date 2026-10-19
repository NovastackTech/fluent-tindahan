import React, { useState, useEffect } from 'react';
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
  Badge,
  tokens
} from '@fluentui/react-components';
import {
  EyeRegular,
  EyeOffRegular,
  WarningRegular,
  DeleteRegular,
  ArrowSyncRegular,
  ShieldCheckmarkRegular
} from '@fluentui/react-icons';
import { db } from '../db/db';
import { useAuthStore } from '../state/authStore';
import { useSubscriptionStore } from '../state/subscriptionStore';
import { useSyncStore, processSyncQueue } from '../sync/syncEngine';
import { useTranslation } from '../state/languageStore';
import { deleteAccount } from '../services/authService';
import { getLocalizedSyncErrorMessage } from '../utils/syncErrors';

export interface DeleteAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted?: () => void;
}

export const DeleteAccountDialog: React.FC<DeleteAccountDialogProps> = ({
  open,
  onOpenChange,
  onDeleted
}) => {
  const { hasPin, logout } = useAuthStore();
  const { tier } = useSubscriptionStore();
  const { isOnline, isSyncing } = useSyncStore();
  const { t, language } = useTranslation();

  const [mode, setMode] = useState<'grace' | 'immediate'>('grace');
  const [authMethod, setAuthMethod] = useState<'password' | 'pin'>('password');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [unsyncedCount, setUnsyncedCount] = useState(0);
  const [utangDebtorCount, setUtangDebtorCount] = useState(0);
  const [utangTotalFormatted, setUtangTotalFormatted] = useState('₱0.00');

  useEffect(() => {
    if (!open) return;
    // oxlint-disable-next-line react/set-state-in-effect - Reset form inputs and errors when dialog opens
    setError('');
    setPassword('');
    setPin('');

    void (async () => {
      try {
        const qCount = await db.syncQueue.count();
        setUnsyncedCount(qCount);

        const customers = await db.customers.filter((c) => c.totalUtangBalance > 0).toArray();
        setUtangDebtorCount(customers.length);
        // Rule 2: Integer centavo currency math
        const totalCentavos = customers.reduce(
          (acc, c) => acc + Math.round((c.totalUtangBalance || 0) * 100),
          0
        );
        const totalPesos = (totalCentavos / 100).toFixed(2);
        setUtangTotalFormatted(`₱${totalPesos}`);
      } catch (e) {
        console.warn('[DeleteAccountDialog] Pre-flight check error:', e);
      }
    })();
  }, [open]);

  const handleClose = () => {
    if (isSubmitting) return;
    setPassword('');
    setPin('');
    // oxlint-disable-next-line react/set-state-in-effect - Reset form inputs and errors when dialog opens
    setError('');
    onOpenChange(false);
  };

  const handleSyncFirst = async () => {
    await processSyncQueue({ force: true });
    const qCount = await db.syncQueue.count();
    setUnsyncedCount(qCount);
  };

  const handleSubmit = async () => {
    const credentialReady = authMethod === 'password' ? Boolean(password.trim()) : /^\d{4,6}$/.test(pin.trim());
    if (!credentialReady) {
      setError(authMethod === 'password' ? t.onboarding.passwordRequired : t.onboarding.pinInvalid);
      return;
    }

    setIsSubmitting(true);
    // oxlint-disable-next-line react/set-state-in-effect - Reset form inputs and errors when dialog opens
    setError('');

    try {
      await deleteAccount({
        password: authMethod === 'password' ? password : undefined,
        pin: authMethod === 'pin' ? pin.trim() : undefined,
        immediate: mode === 'immediate'
      });

      onOpenChange(false);
      await logout(true);
      onDeleted?.();
    } catch (err: any) {
      const rawMessage = err?.response?.data?.message || t.onboarding.loginFailed;
      setError(getLocalizedSyncErrorMessage(rawMessage, language) || rawMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const canSubmit =
    !isSubmitting &&
    (authMethod === 'password' ? password.trim().length > 0 : /^\d{4,6}$/.test(pin.trim()));

  return (
    <Dialog
      open={open}
      onOpenChange={(_, data) => {
        if (!data.open) {
          handleClose();
        }
      }}
    >
      <DialogSurface style={{ maxWidth: '520px', width: '95vw' }}>
        <DialogBody>
          <DialogTitle>{t.settings.deleteAccountTitle}</DialogTitle>
          <DialogContent
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: tokens.spacingVerticalM,
              marginTop: tokens.spacingVerticalXS
            }}
          >
            <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
              {t.settings.deleteAccountDesc}
            </Text>

            {/* Pre-flight Warning 1: Unsynced Local Queue */}
            {unsyncedCount > 0 && (
              <div
                style={{
                  backgroundColor: tokens.colorPaletteRedBackground1,
                  borderLeft: `4px solid ${tokens.colorPaletteRedBorderActive}`,
                  padding: '10px 12px',
                  borderRadius: '6px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <WarningRegular style={{ color: tokens.colorPaletteRedForeground1, flexShrink: 0 }} />
                  <Text size={200} weight="semibold" style={{ color: tokens.colorPaletteRedForeground1 }}>
                    {t.settings.deleteUnsyncedWarning.replace('{count}', String(unsyncedCount))}
                  </Text>
                </div>
                <div>
                  <Button
                    size="small"
                    appearance="secondary"
                    icon={<ArrowSyncRegular />}
                    disabled={!isOnline || isSyncing}
                    onClick={handleSyncFirst}
                    data-testid="delete-account-sync-first-btn"
                  >
                    {t.settings.syncFirstBtn}
                  </Button>
                </div>
              </div>
            )}

            {/* Pre-flight Warning 2: Active Paid Subscription */}
            {tier !== 'Libre' && (
              <div
                style={{
                  backgroundColor: tokens.colorPaletteYellowBackground1,
                  borderLeft: `4px solid ${tokens.colorPaletteYellowBorderActive}`,
                  padding: '10px 12px',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px'
                }}
                data-testid="delete-account-sub-warning"
              >
                <WarningRegular style={{ color: tokens.colorPaletteYellowForeground2, flexShrink: 0, marginTop: '2px' }} />
                <Text size={200} style={{ color: tokens.colorNeutralForeground1 }}>
                  {t.settings.deleteSubWarning.replace('{tier}', tier)}
                </Text>
              </div>
            )}

            {/* Pre-flight Warning 3: Unpaid Utang Receivables */}
            {utangDebtorCount > 0 && (
              <div
                style={{
                  backgroundColor: tokens.colorPaletteYellowBackground1,
                  borderLeft: `4px solid ${tokens.colorPaletteYellowBorderActive}`,
                  padding: '10px 12px',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px'
                }}
                data-testid="delete-account-utang-warning"
              >
                <WarningRegular style={{ color: tokens.colorPaletteYellowForeground2, flexShrink: 0, marginTop: '2px' }} />
                <Text size={200} style={{ color: tokens.colorNeutralForeground1 }}>
                  {t.settings.deleteUtangWarning
                    .replace('{amount}', utangTotalFormatted)
                    .replace('{count}', String(utangDebtorCount))}
                </Text>
              </div>
            )}

            {/* Mode Selection */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div
                role="radio"
                aria-checked={mode === 'grace'}
                tabIndex={0}
                onClick={() => setMode('grace')}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setMode('grace')}
                data-testid="delete-mode-grace"
                style={{
                  padding: '10px 12px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  border:
                    mode === 'grace'
                      ? `2px solid ${tokens.colorBrandStroke1}`
                      : `1px solid ${tokens.colorNeutralStroke1}`,
                  backgroundColor:
                    mode === 'grace' ? tokens.colorNeutralBackground1Selected : tokens.colorNeutralBackground2
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text weight="semibold" size={300}>
                    {t.settings.deleteModeGraceTitle}
                  </Text>
                  <Badge appearance="tint" color="brand">
                    30d
                  </Badge>
                </div>
                <Text size={200} style={{ color: tokens.colorNeutralForeground3, display: 'block', marginTop: '4px' }}>
                  {t.settings.deleteModeGraceDesc}
                </Text>
              </div>

              <div
                role="radio"
                aria-checked={mode === 'immediate'}
                tabIndex={0}
                onClick={() => setMode('immediate')}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setMode('immediate')}
                data-testid="delete-mode-immediate"
                style={{
                  padding: '10px 12px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  border:
                    mode === 'immediate'
                      ? `2px solid ${tokens.colorPaletteRedBorderActive}`
                      : `1px solid ${tokens.colorNeutralStroke1}`,
                  backgroundColor:
                    mode === 'immediate' ? tokens.colorPaletteRedBackground1 : tokens.colorNeutralBackground2
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text weight="semibold" size={300} style={{ color: tokens.colorPaletteRedForeground1 }}>
                    {t.settings.deleteModeImmediateTitle}
                  </Text>
                  <Badge appearance="filled" color="danger">
                    Permanent
                  </Badge>
                </div>
                <Text size={200} style={{ color: tokens.colorNeutralForeground2, display: 'block', marginTop: '4px' }}>
                  {t.settings.deleteModeImmediateDesc}
                </Text>
              </div>
            </div>

            {/* Statutory Data Retention Disclosure */}
            <div
              style={{
                backgroundColor: tokens.colorNeutralBackground2,
                padding: '10px 12px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '8px'
              }}
            >
              <ShieldCheckmarkRegular style={{ color: tokens.colorBrandForeground1, flexShrink: 0, marginTop: '2px' }} />
              <Text size={100} style={{ color: tokens.colorNeutralForeground3 }}>
                {t.settings.deleteRetentionNotice}
              </Text>
            </div>

            {error && (
              <Text role="alert" size={200} style={{ color: tokens.colorPaletteRedForeground1 }}>
                {error}
              </Text>
            )}

            {/* Step-Up Re-Authentication Gate */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <Text size={200} weight="semibold">
                  {t.settings.deleteReauthLabel}
                </Text>
                {hasPin && (
                  <Button
                    size="small"
                    appearance="subtle"
                    onClick={() => {
                      setAuthMethod(authMethod === 'password' ? 'pin' : 'password');
                      // oxlint-disable-next-line react/set-state-in-effect - Reset form inputs and errors when dialog opens
    setError('');
                    }}
                    data-testid="delete-account-toggle-auth-method"
                  >
                    {authMethod === 'password' ? t.onboarding.loginModePin : t.onboarding.loginModePassword}
                  </Button>
                )}
              </div>

              {authMethod === 'password' ? (
                <Field required>
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(_, data) => setPassword(data.value)}
                    placeholder={t.settings.deleteReauthPasswordPlaceholder}
                    data-testid="delete-account-password-input"
                    contentAfter={
                      <Button
                        appearance="subtle"
                        size="small"
                        icon={showPassword ? <EyeOffRegular /> : <EyeRegular />}
                        onClick={() => setShowPassword(!showPassword)}
                        type="button"
                      />
                    }
                  />
                </Field>
              ) : (
                <Field required>
                  <Input
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    value={pin}
                    onChange={(_, data) => setPin(data.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder={t.settings.deleteReauthPinPlaceholder}
                    data-testid="delete-account-pin-input"
                  />
                </Field>
              )}
            </div>
          </DialogContent>

          <DialogActions
            fluid
            style={{
              gridColumn: '1 / -1',
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'flex-end',
              alignItems: 'center',
              gap: '8px',
              marginTop: '8px'
            }}
          >
            <Button appearance="secondary" onClick={handleClose} disabled={isSubmitting}>
              {t.common.cancel}
            </Button>
            <Button
              appearance="primary"
              disabled={!canSubmit}
              icon={isSubmitting ? <Spinner size="extra-tiny" /> : <DeleteRegular />}
              onClick={handleSubmit}
              data-testid="confirm-delete-account-btn"
              style={{
                backgroundColor: tokens.colorPaletteRedBackground3,
                color: tokens.colorPaletteRedForegroundInverted,
                whiteSpace: 'nowrap'
              }}
            >
              {mode === 'immediate'
                ? t.settings.deleteConfirmImmediateBtn
                : t.settings.deleteConfirmDeactivateBtn}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
};
