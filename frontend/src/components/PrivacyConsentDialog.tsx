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
  const { t, language } = useTranslation();

  if (consentAccepted) {
    return null;
  }

  const handleAccept = () => {
    setConsentAccepted(true);
  };

  return (
    <Dialog open={!consentAccepted}>
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
            <Button appearance="primary" onClick={handleAccept}>
              {t.privacy.acceptBtn}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
};
