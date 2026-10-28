import React from 'react';
import {
  makeStyles,
  tokens,
  shorthands,
  MessageBar,
  MessageBarTitle,
  MessageBarBody,
  MessageBarActions,
  Button,
  Dialog,
  DialogSurface,
  DialogTitle,
  DialogBody,
  DialogContent,
  DialogActions,
  Spinner
} from '@fluentui/react-components';
import { ArrowClockwiseRegular, WarningRegular } from '@fluentui/react-icons';
import { usePwaStore } from '../state/pwaStore';
import { useCartStore } from '../state/cartStore';
import { reloadAppForUpdate } from '../pwa/registerServiceWorker';
import { useTranslation } from '../state/languageStore';

const useStyles = makeStyles({
  container: {
    maxWidth: '1080px',
    width: '100%',
    marginLeft: 'auto',
    marginRight: 'auto',
    ...shorthands.padding(tokens.spacingVerticalXS, tokens.spacingHorizontalM),
    boxSizing: 'border-box'
  },
  bar: {
    backgroundColor: tokens.colorNeutralBackground1,
    borderLeft: `4px solid ${tokens.colorBrandStroke1}`,
    boxShadow: tokens.shadow8,
    ...shorthands.borderRadius(tokens.borderRadiusMedium)
  },
  warningRow: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXS,
    marginTop: tokens.spacingVerticalXXS,
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorPaletteDarkOrangeForeground1
  },
  dialogSurface: {
    maxWidth: '480px',
    width: 'calc(100vw - 32px)'
  },
  dialogContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM
  }
});

export const PwaUpdateToast: React.FC = () => {
  const styles = useStyles();
  const { t } = useTranslation();
  const { needRefresh, otherTabsHaveCart, isSaleInProgress, hasActiveReceipt } = usePwaStore();
  const cartItemCount = useCartStore((s) => s.items.length);
  const [isUpdating, setIsUpdating] = React.useState(false);
  const [showRetry, setShowRetry] = React.useState(false);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const updateButtonRef = React.useRef<HTMLButtonElement>(null);
  const hasLocalItems = cartItemCount > 0;
  const hasActiveSale = isSaleInProgress || hasActiveReceipt;
  const hasReloadBlocker = hasLocalItems || otherTabsHaveCart || hasActiveSale;

  React.useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  React.useEffect(() => {
    if (!needRefresh || hasReloadBlocker) return;
    const focusTimer = window.setTimeout(() => updateButtonRef.current?.focus(), 0);
    return () => window.clearTimeout(focusTimer);
  }, [needRefresh, hasReloadBlocker]);

  if (!needRefresh) {
    return null;
  }

  const handleUpdate = async () => {
    if (hasReloadBlocker || isUpdating) {
      return;
    }
    setShowRetry(false);
    setIsUpdating(true);
    try {
      await reloadAppForUpdate();
    } catch {
      setIsUpdating(false);
      setShowRetry(true);
      return;
    }
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => {
      setIsUpdating(false);
      setShowRetry(true);
    }, 3000);
  };

  const warningMessage = hasLocalItems || hasActiveSale
      ? t.pwa.updateWaitMsg
      : otherTabsHaveCart
        ? t.pwa.updateOtherTabsWaitMsg
        : null;

  if (hasReloadBlocker) return (
    <div className={styles.container}>
      <MessageBar
        className={styles.bar}
        intent="info"
        layout="multiline"
      >
        <MessageBarBody>
          <MessageBarTitle>
            {t.pwa.updateTitle}
          </MessageBarTitle>
          {t.pwa.updateDesc}
          {warningMessage && (
            <div className={styles.warningRow}>
              <WarningRegular />
              {warningMessage}
            </div>
          )}
        </MessageBarBody>
        <MessageBarActions
          containerAction={
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <Button
                size="small"
                appearance="primary"
                icon={<ArrowClockwiseRegular />}
                onClick={handleUpdate}
                disabled
                title={warningMessage || undefined}
                aria-label={t.pwa.updateBtn || 'Update App'}
              >
                {t.pwa.updateBtn}
              </Button>
            </div>
          }
        />
      </MessageBar>
    </div>
  );

  return (
    <Dialog open modalType="alert">
      <DialogSurface className={styles.dialogSurface} aria-label={t.pwa.updateTitle}>
        <DialogBody>
          <DialogTitle>{t.pwa.updateTitle}</DialogTitle>
          <DialogContent className={styles.dialogContent}>
            <span>{t.pwa.updateDesc}</span>
            {isUpdating && <span role="status">{t.pwa.updateProgressMsg}</span>}
            {showRetry && (
              <MessageBar intent="warning">
                <MessageBarBody>{t.pwa.updateRetryMsg}</MessageBarBody>
              </MessageBar>
            )}
          </DialogContent>
          <DialogActions>
            <Button
              ref={updateButtonRef}
              autoFocus
              appearance="primary"
              icon={isUpdating ? <Spinner size="tiny" /> : <ArrowClockwiseRegular />}
              onClick={handleUpdate}
              disabled={isUpdating}
              aria-label={t.pwa.updateBtn || 'Update App'}
            >
              {t.pwa.updateBtn}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
};
