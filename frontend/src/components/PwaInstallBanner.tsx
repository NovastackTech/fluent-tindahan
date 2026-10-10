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
import { ArrowDownloadRegular, DismissRegular, ShareRegular } from '@fluentui/react-icons';
import { usePwaStore } from '../state/pwaStore';
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
  banner: {
    backgroundColor: tokens.colorNeutralBackground1,
    borderLeft: `4px solid ${tokens.colorPaletteGreenBorderActive}`,
    boxShadow: tokens.shadow4,
    ...shorthands.borderRadius(tokens.borderRadiusMedium)
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    flexWrap: 'wrap'
  },
  iosBox: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXS,
    marginTop: tokens.spacingVerticalXXS,
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground2
  }
});

export const PwaInstallBanner: React.FC = () => {
  const styles = useStyles();
  const { t } = useTranslation();
  const { isStandalone, isInstalled, isInstallable, isIos, isDismissed, promptInstall, dismissPrompt } = usePwaStore();

  // If already running as standalone app, marked installed, or merchant dismissed prompt, don't show
  if (isStandalone || isInstalled || isDismissed || (!isInstallable && !isIos)) {
    return null;
  }

  const handleInstall = async () => {
    if (isInstallable) {
      await promptInstall();
    }
  };

  return (
    <div className={styles.container}>
      <MessageBar
        className={styles.banner}
        intent="success"
        layout="multiline"
      >
        <MessageBarTitle>
          {t.pwa.installTitle}
        </MessageBarTitle>
        <MessageBarBody>
          <div>{t.pwa.installDesc}</div>
          {isIos && !isInstallable && (
            <div className={styles.iosBox}>
              <ShareRegular fontSize={16} />
              <span>{t.pwa.iosInstructionsDesc}</span>
            </div>
          )}
        </MessageBarBody>
        <MessageBarActions
          containerAction={
            <div className={styles.actions}>
              {isInstallable && (
                <Button
                  size="small"
                  appearance="primary"
                  icon={<ArrowDownloadRegular />}
                  onClick={handleInstall}
                >
                  {t.pwa.installBtn}
                </Button>
              )}
              <Button
                size="small"
                appearance="subtle"
                icon={<DismissRegular />}
                onClick={dismissPrompt}
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
