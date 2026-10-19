import React from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Text,
  tokens
} from '@fluentui/react-components';
import { ArrowSyncRegular } from '@fluentui/react-icons';
import { useTranslation } from '../state/languageStore';

export interface SafeLogoutDialogProps {
  open: boolean;
  unsyncedCount: number;
  onDismiss: () => void;
  onSyncFirst: () => void | Promise<void>;
  onConfirmLogout: () => void | Promise<void>;
}

export const SafeLogoutDialog: React.FC<SafeLogoutDialogProps> = ({
  open,
  unsyncedCount,
  onDismiss,
  onSyncFirst,
  onConfirmLogout
}) => {
  const { t } = useTranslation();
  const hasUnsynced = unsyncedCount > 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(_, data) => {
        if (!data.open) {
          onDismiss();
        }
      }}
    >
      <DialogSurface>
        <DialogBody>
          <DialogTitle>{t.settings.logoutConfirmTitle}</DialogTitle>
          <DialogContent>
            {hasUnsynced ? (
              <div>
                <Text
                  size={300}
                  weight="semibold"
                  style={{
                    color: tokens.colorPaletteRedForeground1,
                    display: 'block',
                    marginBottom: '8px'
                  }}
                >
                  {t.settings.logoutUnsyncedWarning.replace('{count}', String(unsyncedCount))}
                </Text>
                <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
                  {t.settings.logoutConfirmDesc}
                </Text>
              </div>
            ) : (
              <Text size={300}>{t.settings.logoutConfirmDesc}</Text>
            )}
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
            <Button
              appearance="secondary"
              style={{ whiteSpace: 'nowrap' }}
              onClick={onDismiss}
              data-testid="safe-logout-cancel-btn"
            >
              {t.common.cancel}
            </Button>
            {hasUnsynced && (
              <Button
                appearance="primary"
                icon={<ArrowSyncRegular />}
                style={{ whiteSpace: 'nowrap' }}
                onClick={() => {
                  void onSyncFirst();
                }}
                data-testid="safe-logout-sync-first-btn"
              >
                {t.settings.syncFirstBtn}
              </Button>
            )}
            <Button
              appearance={hasUnsynced ? 'secondary' : 'primary'}
              style={{
                color: tokens.colorPaletteRedForeground1,
                borderColor: tokens.colorPaletteRedBorder1,
                whiteSpace: 'nowrap'
              }}
              onClick={() => {
                void onConfirmLogout();
              }}
              data-testid="safe-logout-confirm-btn"
            >
              {hasUnsynced ? t.settings.forceLogoutBtn : t.settings.logoutBtn}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
};
