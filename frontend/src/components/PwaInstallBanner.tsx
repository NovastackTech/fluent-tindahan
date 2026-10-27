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
  DialogBody,
  DialogTitle,
  DialogContent,
  DialogActions
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
  const {
    isStandalone,
    isInstalled,
    isInstallable,
    isIos,
    isDismissed,
    showIosInstallModal,
    promptInstall,
    dismissPrompt,
    closeIosInstallModal
  } = usePwaStore();

  const hideBanner = isStandalone || isInstalled || (isDismissed && !isIos) || (!isInstallable && !isIos);

  if (hideBanner && !showIosInstallModal) {
    return null;
  }

  const handleInstall = async () => {
    await promptInstall();
  };

  return (
    <>
      {!hideBanner && (
        <div className={styles.container}>
          <MessageBar
            className={styles.banner}
            intent="success"
            layout="multiline"
          >
            <MessageBarBody>
              <MessageBarTitle>
                {t.pwa.installTitle}
              </MessageBarTitle>
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
                  {(isInstallable || isIos) && (
                    <Button
                      size="small"
                      appearance="primary"
                      icon={<ArrowDownloadRegular />}
                      onClick={handleInstall}
                      aria-label={t.pwa.installBtn || 'Install App'}
                    >
                      {t.pwa.installBtn}
                    </Button>
                  )}
                  <Button
                    size="small"
                    appearance="subtle"
                    icon={<DismissRegular />}
                    onClick={dismissPrompt}
                    aria-label={t.pwa.dismissBtn || 'Dismiss'}
                  >
                    {t.pwa.dismissBtn}
                  </Button>
                </div>
              }
            />
          </MessageBar>
        </div>
      )}
      {showIosInstallModal && (
        <Dialog
          open={showIosInstallModal}
          onOpenChange={(_, data) => {
            if (!data.open) closeIosInstallModal();
          }}
        >
          <DialogSurface>
            <DialogBody>
              <DialogTitle>{t.pwa.iosInstructionsTitle}</DialogTitle>
              <DialogContent>
                <div className={styles.iosBox}>
                  <ShareRegular fontSize={20} />
                  <span>{t.pwa.iosInstructionsDesc}</span>
                </div>
              </DialogContent>
              <DialogActions>
                <Button
                  appearance="primary"
                  onClick={closeIosInstallModal}
                  aria-label={t.common.close || 'Close'}
                >
                  {t.common.close}
                </Button>
              </DialogActions>
            </DialogBody>
          </DialogSurface>
        </Dialog>
      )}
    </>
  );
};
