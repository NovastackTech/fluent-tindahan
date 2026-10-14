import React from 'react';
import {
  Dialog,
  DialogSurface,
  DialogTitle,
  DialogBody,
  DialogActions,
  DialogContent,
  Button,
  Text,
  makeStyles,
  tokens,
  shorthands
} from '@fluentui/react-components';
import { ShieldCheckmarkRegular } from '@fluentui/react-icons';
import { useAuthStore } from '../state/authStore';
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
  }
});

export const PrivacyConsentDialog: React.FC = () => {
  const styles = useStyles();
  const consentAccepted = useAuthStore((s) => s.consentAccepted);
  const setConsentAccepted = useAuthStore((s) => s.setConsentAccepted);
  const isPrivacyNoticeOpen = useAuthStore((s) => s.isPrivacyNoticeOpen);
  const closePrivacyNotice = useAuthStore((s) => s.closePrivacyNotice);
  const { t, language } = useTranslation();

  const isConsentRequired = !consentAccepted;
  const isOpen = isConsentRequired || isPrivacyNoticeOpen;
  const isReadOnly = !isConsentRequired && isPrivacyNoticeOpen;

  if (!isOpen) {
    return null;
  }

  const handleAccept = () => {
    setConsentAccepted(true);
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
            </div>
          </DialogContent>

          <DialogActions>
            {isReadOnly ? (
              <Button appearance="primary" onClick={handleClose} data-testid="privacy-close-btn">
                {t.privacy.closeBtn || t.common.close}
              </Button>
            ) : (
              <Button appearance="primary" onClick={handleAccept} data-testid="privacy-accept-btn">
                {t.privacy.acceptBtn}
              </Button>
            )}
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
};
