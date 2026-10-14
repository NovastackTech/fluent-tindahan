import React, { useState } from 'react';
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
  termsDetailCard: {
    ...shorthands.padding(tokens.spacingVerticalS, tokens.spacingHorizontalM),
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    backgroundColor: tokens.colorNeutralBackground2,
    ...shorthands.border('1px', 'solid', tokens.colorNeutralStroke2),
    fontSize: '12px',
    lineHeight: '18px',
    color: tokens.colorNeutralForeground2,
    marginTop: tokens.spacingVerticalXS
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
    flexGrow: 1,
    height: '48px',
    backgroundColor: '#16a34a',
    color: '#ffffff',
    fontWeight: 700,
    fontSize: '16px',
    ...shorthands.borderRadius('12px'),
    ...shorthands.border('none'),
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxSizing: 'border-box',
    transitionProperty: 'background-color, transform',
    transitionDuration: '150ms',
    '&:hover': {
      backgroundColor: '#15803d',
      color: '#ffffff'
    },
    '&:active': {
      backgroundColor: '#166534',
      transform: 'scale(0.99)'
    }
  }
});

export const DisclaimerModal: React.FC = () => {
  const styles = useStyles();
  const { isDisclaimerOpen, closeDisclaimer } = useDisclaimerStore();
  const { t, language } = useTranslation();
  const [showTermsDetail, setShowTermsDetail] = useState(false);

  if (!isDisclaimerOpen) {
    return null;
  }

  const handleClose = () => {
    setShowTermsDetail(false);
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
              aria-label="Close"
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
              {t.disclaimer.termsNotice}{' '}
              <button
                type="button"
                className={styles.termsLink}
                onClick={() => setShowTermsDetail((prev) => !prev)}
                data-testid="disclaimer-terms-link"
              >
                {t.disclaimer.termsLink}
              </button>
              .
            </div>

            {showTermsDetail && (
              <div className={styles.termsDetailCard} data-testid="terms-detail-card">
                {language === 'tl' ? (
                  <>
                    <strong>Buod ng Kasunduan sa Serbisyo:</strong>
                    <br />
                    1. <strong>Pansariling Pamamahala:</strong> Ang Fluent Tindahan ay software na gabay sa operasyon ng tindahan. Ang may-ari ang buong may pananagutan sa tamang presyo, bilang ng imbentaryo, at singilan sa pautang.
                    <br />
                    2. <strong>Walang Pananagutan sa Pondo:</strong> Hindi humahawak o nagpapadala ng digital na pera ang app; anumang transaksyon sa GCash o cash ay direktang responsibilidad ng tindahan at ng mamimili.
                    <br />
                    3. <strong>Pagsunod sa Regulasyon:</strong> Ang paggamit ng app na ito ay nagpapatunay ng iyong pagtalima sa mga batas pangkomersyo at panuntunan sa pagbubuwis sa Pilipinas.
                  </>
                ) : (
                  <>
                    <strong>Terms of Use & Service Summary:</strong>
                    <br />
                    1. <strong>Independent Merchant Utility:</strong> Fluent Tindahan is an assistive management utility. Merchants retain full ownership and responsibility for their pricing, inventory accuracy, and customer credit ledger.
                    <br />
                    2. <strong>No Fund Custody:</strong> The software does not transmit, hold, or escrow funds. All cash and GCash transactions occur directly between the merchant and their customer.
                    <br />
                    3. <strong>Regulatory Compliance:</strong> Continued use acknowledges your duty to uphold applicable Philippine municipal ordinances, commerce standards, and BIR tax mandates.
                  </>
                )}
              </div>
            )}
          </DialogContent>

          <DialogActions fluid className={styles.actions}>
            <button
              type="button"
              className={styles.closeBtn}
              onClick={handleClose}
              data-testid="disclaimer-modal-close-btn"
            >
              {t.disclaimer.closeBtn}
            </button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
};
