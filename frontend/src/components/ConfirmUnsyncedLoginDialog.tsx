import React from 'react';
import {
  makeStyles,
  tokens,
  shorthands,
  Dialog,
  DialogSurface,
  DialogTitle,
  DialogBody,
  DialogContent,
  DialogActions,
  Button,
  Spinner
} from '@fluentui/react-components';
import {
  WarningRegular,
  ArrowSyncRegular
} from '@fluentui/react-icons';
import { useTranslation } from '../state/languageStore';

export interface ConfirmUnsyncedLoginDialogProps {
  isOpen: boolean;
  unsyncedCount: number;
  onClose: () => void;
  onConfirmWipeAndLogin: () => Promise<void> | void;
  onSyncFirst?: () => Promise<void> | void;
  isSyncing?: boolean;
}

const useStyles = makeStyles({
  surface: {
    maxWidth: '520px',
    width: '92%',
    ...shorthands.padding(tokens.spacingVerticalM),
    backgroundColor: tokens.colorNeutralBackground1,
    ...shorthands.borderRadius(tokens.borderRadiusLarge)
  },
  warningBox: {
    ...shorthands.padding(tokens.spacingVerticalM, tokens.spacingHorizontalM),
    backgroundColor: tokens.colorPaletteRedBackground1,
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    ...shorthands.border('1px', 'solid', tokens.colorPaletteRedBorder1),
    marginBottom: tokens.spacingVerticalM,
    display: 'flex',
    alignItems: 'flex-start',
    gap: tokens.spacingHorizontalS
  },
  warningIcon: {
    color: tokens.colorPaletteRedForeground1,
    fontSize: '20px',
    flexShrink: 0,
    marginTop: '2px'
  },
  warningText: {
    color: tokens.colorPaletteRedForeground1,
    fontSize: tokens.fontSizeBase300,
    fontWeight: tokens.fontWeightSemibold
  },
  descText: {
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200
  }
});

export const ConfirmUnsyncedLoginDialog: React.FC<ConfirmUnsyncedLoginDialogProps> = ({
  isOpen,
  unsyncedCount,
  onClose,
  onConfirmWipeAndLogin,
  onSyncFirst,
  isSyncing = false
}) => {
  const styles = useStyles();
  const { t } = useTranslation();

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(_, data) => !data.open && onClose()}>
      <DialogSurface className={styles.surface}>
        <DialogBody>
          <DialogTitle>{t.onboarding.loginUnsyncedTitle}</DialogTitle>
          <DialogContent>
            <div className={styles.warningBox}>
              <WarningRegular className={styles.warningIcon} />
              <div>
                <div className={styles.warningText}>
                  {t.onboarding.loginUnsyncedWarning.replace('{count}', String(unsyncedCount))}
                </div>
                <div className={styles.descText} style={{ marginTop: '4px' }}>
                  {t.settings.logoutConfirmDesc}
                </div>
              </div>
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
              gap: '8px'
            }}
          >
            <Button
              appearance="secondary"
              style={{ whiteSpace: 'nowrap' }}
              onClick={onClose}
              data-testid="unsynced-dialog-cancel-btn"
            >
              {t.common.cancel}
            </Button>
            {onSyncFirst && (
              <Button
                appearance="primary"
                icon={isSyncing ? <Spinner size="tiny" /> : <ArrowSyncRegular />}
                style={{ whiteSpace: 'nowrap' }}
                disabled={isSyncing}
                onClick={onSyncFirst}
                data-testid="unsynced-dialog-sync-btn"
              >
                {t.settings.syncFirstBtn}
              </Button>
            )}
            <Button
              appearance="secondary"
              style={{
                color: tokens.colorPaletteRedForeground1,
                borderColor: tokens.colorPaletteRedBorder1,
                whiteSpace: 'nowrap'
              }}
              disabled={isSyncing}
              onClick={onConfirmWipeAndLogin}
              data-testid="unsynced-dialog-wipe-btn"
            >
              {t.onboarding.forceLoginBtn}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
};
