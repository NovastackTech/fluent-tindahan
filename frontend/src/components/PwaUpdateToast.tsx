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
  const { needRefresh, setNeedRefresh } = usePwaStore();
  const cartItemCount = useCartStore((s) => s.items.length);

  if (!needRefresh) {
    return null;
  }

  const handleUpdate = async () => {
    if (cartItemCount > 0) {
      return;
    }
    await reloadAppForUpdate();
  };

  const handleDismiss = () => {
    setNeedRefresh(false);
  };

  const hasItems = cartItemCount > 0;

  return (
    <div className={styles.container}>
      <MessageBar
        className={styles.bar}
        intent="info"
        layout="multiline"
      >
        <MessageBarTitle>
          {t.pwa.updateTitle}
        </MessageBarTitle>
        <MessageBarBody>
          {t.pwa.updateDesc}
          {hasItems && (
            <div className={styles.warningRow}>
              <WarningRegular />
              {t.pwa.updateWaitMsg}
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
                disabled={hasItems}
                title={hasItems ? t.pwa.updateWaitMsg : undefined}
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
