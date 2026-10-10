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
import { ArrowClockwiseRegular, DismissRegular } from '@fluentui/react-icons';
import { usePwaStore } from '../state/pwaStore';
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
  }
});

export const PwaUpdateToast: React.FC = () => {
  const styles = useStyles();
  const { t } = useTranslation();
  const { needRefresh, setNeedRefresh } = usePwaStore();

  if (!needRefresh) {
    return null;
  }

  const handleUpdate = async () => {
    await reloadAppForUpdate();
  };

  const handleDismiss = () => {
    setNeedRefresh(false);
  };

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
        </MessageBarBody>
        <MessageBarActions
          containerAction={
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <Button
                size="small"
                appearance="primary"
                icon={<ArrowClockwiseRegular />}
                onClick={handleUpdate}
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
