import React from 'react';
import {
  Dialog,
  DialogSurface,
  DialogBody,
  DialogContent,
  DialogActions,
  Button,
  Text,
  makeStyles,
  tokens,
  shorthands
} from '@fluentui/react-components';
import { DismissRegular } from '@fluentui/react-icons';
import { useDisclaimerStore } from '../state/disclaimerStore';
import { useTermsStore } from '../state/termsStore';
import { useTranslation } from '../state/languageStore';

const useStyles = makeStyles({
  surface: {
    maxWidth: '480px',
    width: '92vw',
    ...shorthands.borderRadius('16px'),
    ...shorthands.padding('24px'),
    boxShadow: tokens.shadow16,
    boxSizing: 'border-box'
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: tokens.spacingVerticalM,
    gridColumn: '1 / -1',
    width: '100%'
  },
  title: {
    fontSize: '20px',
    fontWeight: 700,
    color: tokens.colorNeutralForeground1,
    lineHeight: '26px',
    flexGrow: 1
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    ...shorthands.gap(tokens.spacingVerticalM),
    paddingRight: '2px',
    gridColumn: '1 / -1'
  },
  paragraph: {
    fontSize: '14px',
    lineHeight: '21px',
    color: tokens.colorNeutralForeground1
  },
  boldLead: {
    fontWeight: 700,
    color: tokens.colorNeutralForeground1
  },
  termsText: {
    fontSize: '13px',
    color: tokens.colorNeutralForeground2,
    marginTop: tokens.spacingVerticalXS
  },
  termsLink: {
    color: tokens.colorPaletteGreenForeground1,
    fontWeight: 600,
    textDecorationLine: 'underline',
    cursor: 'pointer',
    background: 'none',
    ...shorthands.border('none'),
    ...shorthands.padding('0'),
    fontFamily: 'inherit',
    fontSize: 'inherit'
  },
  actions: {
    width: '100%',
    gridColumn: '1 / -1',
    justifySelf: 'stretch',
    marginTop: tokens.spacingVerticalM,
    paddingLeft: 0,
    paddingRight: 0,
    paddingBottom: 0,
    paddingTop: 0,
    display: 'flex',
    boxSizing: 'border-box'
  },
  closeBtn: {
    width: '100%',
    minWidth: '100%',
    height: '48px',
    fontSize: '16px',
    fontWeight: 700,
    ...shorthands.borderRadius(tokens.borderRadiusMedium)
  }
});

export const DisclaimerModal: React.FC = () => {
  const styles = useStyles();
  const { isDisclaimerOpen, closeDisclaimer } = useDisclaimerStore();
  const { t } = useTranslation();

  const handleClose = () => {
    closeDisclaimer();
  };

  return (
    <Dialog open={isDisclaimerOpen} onOpenChange={(_, data) => !data.open && handleClose()}>
      <DialogSurface className={styles.surface} data-testid="disclaimer-modal">
        <DialogBody>
          <div className={styles.header}>
            <Text className={styles.title}>{t.disclaimer.modalTitle}</Text>
            <Button
              appearance="subtle"
              size="small"
              icon={<DismissRegular />}
              onClick={handleClose}
              aria-label={t.common.close}
              data-testid="disclaimer-modal-x-btn"
            />
          </div>

          <DialogContent className={styles.content}>
            <div className={styles.paragraph}>
              <span className={styles.boldLead}>{t.disclaimer.section1Title} </span>
              <span>{t.disclaimer.section1Desc}</span>
            </div>

            <div className={styles.paragraph}>
              <span className={styles.boldLead}>{t.disclaimer.section2Title} </span>
              <span>{t.disclaimer.section2Desc}</span>
            </div>

            <div className={styles.paragraph}>
              <span className={styles.boldLead}>{t.disclaimer.section3Title} </span>
              <span>{t.disclaimer.section3Desc}</span>
            </div>

            <div className={styles.paragraph}>
              <span className={styles.boldLead}>{t.disclaimer.section4Title} </span>
              <span>{t.disclaimer.section4Desc}</span>
            </div>

            <div className={styles.termsText}>
              <button
                type="button"
                className={styles.termsLink}
                onClick={() => useTermsStore.getState().openTerms()}
                data-testid="disclaimer-open-full-terms-btn"
                style={{ textAlign: 'left', fontWeight: 600 }}
              >
                {t.disclaimer.openFullTerms}
              </button>
            </div>
          </DialogContent>

          <DialogActions fluid className={styles.actions}>
            <Button
              appearance="primary"
              size="large"
              className={styles.closeBtn}
              onClick={handleClose}
              data-testid="disclaimer-modal-close-btn"
            >
              {t.disclaimer.closeBtn}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
};
