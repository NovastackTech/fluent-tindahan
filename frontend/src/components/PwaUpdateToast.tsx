import React from 'react';
import {
  makeStyles,
  tokens,
  shorthands,
  MessageBar,
  MessageBarTitle,
  MessageBarBody,
  MessageBarActions,
  Button
} from '@fluentui/react-components';
import { ArrowClockwiseRegular, DismissRegular, WarningRegular } from '@fluentui/react-icons';
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
  }
});

export const PwaUpdateToast: React.FC = () => {
  const styles = useStyles();
  const { t } = useTranslation();
  const { needRefresh, setNeedRefresh, otherTabsHaveCart, isSaleInProgress, hasActiveReceipt } = usePwaStore();
  const cartItemCount = useCartStore((s) => s.items.length);

  if (!needRefresh) {
    return null;
  }

  const hasLocalItems = cartItemCount > 0;
  const hasActiveSale = isSaleInProgress || hasActiveReceipt;
  const isBlocked = hasLocalItems || otherTabsHaveCart || hasActiveSale;

  const handleUpdate = async () => {
    if (isBlocked) {
      return;
    }
    await reloadAppForUpdate();
  };

  const handleDismiss = () => {
    setNeedRefresh(false);
  };

  const warningMessage = hasLocalItems || hasActiveSale
      ? t.pwa.updateWaitMsg
      : otherTabsHaveCart
        ? t.pwa.updateOtherTabsWaitMsg
        : null;

  return (
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
                disabled={isBlocked}
                title={warningMessage || undefined}
              >
                {t.pwa.updateBtn}
              </Button>
              <Button
                size="small"
                appearance="subtle"
                icon={<DismissRegular />}
                onClick={handleDismiss}
              >
                {t.pwa.dismissBtn}
              </Button>
            </div>
          }
        />
      </MessageBar>
    </div>
  );
};
