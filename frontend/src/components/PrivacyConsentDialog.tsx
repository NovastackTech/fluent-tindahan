import React, { useState } from 'react';
import {
  Dialog,
  DialogSurface,
  DialogTitle,
  DialogBody,
  DialogActions,
  DialogContent,
  Button,
  Checkbox,
  Text,
  makeStyles,
  tokens,
  shorthands
} from '@fluentui/react-components';
import { ShieldCheckmarkRegular } from '@fluentui/react-icons';
import { useAuthStore, CURRENT_TERMS_VERSION } from '../state/authStore';
import { useTermsStore } from '../state/termsStore';
import { useTranslation } from '../state/languageStore';

const useStyles = makeStyles({
  iconRow: {
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap(tokens.spacingHorizontalS),
    color: tokens.colorBrandForeground1,
    marginBottom: tokens.spacingVerticalS
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    ...shorthands.gap(tokens.spacingVerticalXS),
    marginTop: tokens.spacingVerticalS
  },
  termsBox: {
    marginTop: tokens.spacingVerticalM,
    ...shorthands.padding(tokens.spacingVerticalS, tokens.spacingHorizontalM),
    backgroundColor: tokens.colorNeutralBackground2,
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    ...shorthands.border('1px', 'solid', tokens.colorNeutralStroke2)
  },
  termsLink: {
    color: tokens.colorBrandForeground1,
    background: 'none',
    ...shorthands.border('none'),
    ...shorthands.padding('0'),
    fontSize: '12px',
    fontWeight: 600,
    textAlign: 'left',
    textDecorationLine: 'underline',
    cursor: 'pointer'
  }
});

export const PrivacyConsentDialog: React.FC = () => {
  const styles = useStyles();
  const consentAccepted = useAuthStore((s) => s.consentAccepted);
  const termsAcceptedVersion = useAuthStore((s) => s.termsAcceptedVersion);
  const setConsentAccepted = useAuthStore((s) => s.setConsentAccepted);
  const isPrivacyNoticeOpen = useAuthStore((s) => s.isPrivacyNoticeOpen);
  const closePrivacyNotice = useAuthStore((s) => s.closePrivacyNotice);
  const { t, language } = useTranslation();

  const [termsAgreed, setTermsAgreed] = useState(false);

  const isConsentRequired = !consentAccepted;
  const isOpen = isConsentRequired || isPrivacyNoticeOpen;
  const isReadOnly = !isConsentRequired && isPrivacyNoticeOpen;

  if (!isOpen) {
    return null;
  }

  const handleAccept = () => {
    setConsentAccepted(true, CURRENT_TERMS_VERSION);
    closePrivacyNotice();
  };

  const handleClose = () => {
    closePrivacyNotice();
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(_, data) => {
        if (!data.open && isReadOnly) {
          handleClose();
        }
      }}
    >
      <DialogSurface>
        <DialogBody>
          <div className={styles.iconRow}>
            <ShieldCheckmarkRegular fontSize={32} />
            <DialogTitle>{t.privacy.title}</DialogTitle>
          </div>

          <DialogContent>
            <Text weight="semibold">
              {language === 'tl'
                ? 'Alinsunod sa Republic Act No. 10173 (Data Privacy Act of 2012 ng Pilipinas):'
                : 'In accordance with Republic Act No. 10173 (Philippine Data Privacy Act of 2012):'}
            </Text>

            <div className={styles.section}>
              <Text size={300}>
                {language === 'tl'
                  ? 'Ang Fluent Tindahan ay nagtatabi ng impormasyon ng iyong mga suki sa iyong lokal na device para sa:'
                  : 'Fluent Tindahan stores customer details on your local device solely for:'}
              </Text>
              <ul>
                <li>{language === 'tl' ? 'Pagtala ng listahan ng utang at bayad' : 'Recording customer credit balances and payments'}</li>
                <li>{language === 'tl' ? 'Pag-isyu ng resibo at talaan ng benta' : 'Issuing receipts and sales ledger'}</li>
                <li>{language === 'tl' ? 'Pag-verify ng reference number sa GCash' : 'Verifying GCash transaction reference numbers'}</li>
              </ul>
              <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
                {t.privacy.description}
              </Text>

              {!isReadOnly ? (
                <div className={styles.termsBox}>
                  <Checkbox
                    data-testid="privacy-terms-checkbox"
                    checked={termsAgreed}
                    onChange={(_, data) => setTermsAgreed(!!data.checked)}
                    label={
                      <Text size={200}>
                        {t.privacy.termsCheckboxPrefix}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            useTermsStore.getState().openTerms();
                          }}
                          data-testid="privacy-view-terms-link"
                          className={styles.termsLink}
                        >
                          {t.privacy.termsCheckboxLinkText}
                        </button>
                        {t.privacy.termsCheckboxSuffix}
                      </Text>
                    }
                  />
                </div>
              ) : (
                <div style={{ marginTop: '8px' }}>
                  <button
                    type="button"
                    onClick={() => useTermsStore.getState().openTerms()}
                    data-testid="privacy-view-terms-link"
                    className={styles.termsLink}
                  >
                    {t.privacy.viewTermsLink}
                  </button>
                  {termsAcceptedVersion && (
                    <Text size={100} style={{ display: 'block', color: tokens.colorNeutralForeground3, marginTop: '4px' }}>
                      {t.privacy.acceptedVersionNotice} {termsAcceptedVersion}
                    </Text>
                  )}
                </div>
              )}
            </div>
          </DialogContent>

          <DialogActions>
            {isReadOnly ? (
              <Button appearance="primary" onClick={handleClose} data-testid="privacy-close-btn">
                {t.privacy.closeBtn}
              </Button>
            ) : (
              <Button
                appearance="primary"
                disabled={!termsAgreed}
                onClick={handleAccept}
                data-testid="privacy-accept-btn"
              >
                {t.privacy.acceptBtn}
              </Button>
            )}
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
};
