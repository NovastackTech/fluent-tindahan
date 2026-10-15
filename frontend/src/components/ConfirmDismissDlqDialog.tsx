import React from 'react';
import {
  makeStyles,
  tokens,
  shorthands,
  Dialog,
  DialogSurface,
  DialogTitle,
  DialogBody,
  DialogContent,
  DialogActions,
  Button,
  Text,
  Badge,
  MessageBar,
  MessageBarBody,
  MessageBarTitle
} from '@fluentui/react-components';
import {
  WarningRegular,
  DeleteRegular,
  DismissRegular
} from '@fluentui/react-icons';
import { type DeadLetterRecord } from '../db/db';
import { useTranslation } from '../state/languageStore';
import { formatPeso } from '../utils/currency';

interface ConfirmDismissDlqDialogProps {
  isOpen: boolean;
  item: DeadLetterRecord | null;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
}

const useStyles = makeStyles({
  surface: {
    maxWidth: '520px',
    width: '92%',
    ...shorthands.padding(tokens.spacingVerticalM),
    backgroundColor: tokens.colorNeutralBackground1,
    ...shorthands.borderRadius(tokens.borderRadiusLarge)
  },
  warningBanner: {
    marginBottom: tokens.spacingVerticalM
  },
  entityBox: {
    ...shorthands.padding(tokens.spacingVerticalM, tokens.spacingHorizontalM),
    backgroundColor: tokens.colorNeutralBackground2,
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    ...shorthands.border('1px', 'solid', tokens.colorNeutralStroke2),
    marginBottom: tokens.spacingVerticalM
  },
  detailRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: tokens.spacingVerticalXXS
  },
  errorBox: {
    ...shorthands.padding(tokens.spacingVerticalS, tokens.spacingHorizontalM),
    backgroundColor: tokens.colorPaletteRedBackground1,
    color: tokens.colorPaletteRedForeground1,
    ...shorthands.borderRadius(tokens.borderRadiusSmall),
    fontSize: '12px',
    wordBreak: 'break-word',
    marginTop: tokens.spacingVerticalS
  },
  dismissBtn: {
    backgroundColor: tokens.colorPaletteRedBackground3,
    color: tokens.colorPaletteRedForegroundInverted,
    '&:hover': {
      backgroundColor: tokens.colorPaletteRedBackground2
    }
  }
});

export const ConfirmDismissDlqDialog: React.FC<ConfirmDismissDlqDialogProps> = ({
  isOpen,
  item,
  onClose,
  onConfirm
}) => {
  const styles = useStyles();
  const { t, language } = useTranslation();

  if (!isOpen || !item) {
    return null;
  }

  const payload = item.payload || {};

  const getEntityDisplayName = (entity: string): string => {
    switch (entity) {
      case 'Sale':
        return language === 'tl' ? 'Benta (Sale)' : 'Sale';
      case 'UtangLedger':
        return language === 'tl' ? 'Talaan ng Utang / Bayad (UtangLedger)' : 'Credit Ledger (Utang / Bayad)';
      case 'GCashTxn':
        return language === 'tl' ? 'GCash Transaksyon (GCashTxn)' : 'GCash Transaction';
      case 'Product':
        return language === 'tl' ? 'Paninda (Product)' : 'Product';
      case 'Customer':
        return language === 'tl' ? 'Suki (Customer)' : 'Customer';
      default:
        return entity;
    }
  };

  const renderEntityDetails = () => {
    switch (item.entity) {
      case 'Sale':
        return (
          <>
            <div className={styles.detailRow}>
              <Text weight="semibold" size={200}>{language === 'tl' ? 'Kabuuang Halaga:' : 'Total Amount:'}</Text>
              <Text weight="bold" size={300}>{formatPeso(payload.totalAmount ?? 0)}</Text>
            </div>
            <div className={styles.detailRow}>
              <Text size={200}>{language === 'tl' ? 'Paraan ng Bayad:' : 'Payment Method:'}</Text>
              <Text size={200}>{payload.paymentMethod || 'Cash'}</Text>
            </div>
            {payload.date && (
              <div className={styles.detailRow}>
                <Text size={200}>{language === 'tl' ? 'Petsa:' : 'Date:'}</Text>
                <Text size={200}>{new Date(payload.date).toLocaleString()}</Text>
              </div>
            )}
            {Array.isArray(payload.items) && (
              <div className={styles.detailRow}>
                <Text size={200}>{language === 'tl' ? 'Bilang ng Paninda:' : 'Item Count:'}</Text>
                <Text size={200}>{payload.items.length} {language === 'tl' ? 'uri' : 'item(s)'}</Text>
              </div>
            )}
          </>
        );

      case 'UtangLedger':
        return (
          <>
            <div className={styles.detailRow}>
              <Text weight="semibold" size={200}>{language === 'tl' ? 'Uri ng Transaksyon:' : 'Transaction Type:'}</Text>
              <Text weight="bold" size={200}>
                {payload.type === 'Credit'
                  ? (language === 'tl' ? 'Utang (Credit)' : 'Credit (Utang)')
                  : (language === 'tl' ? 'Bayad (Payment)' : 'Payment (Bayad)')}
              </Text>
            </div>
            <div className={styles.detailRow}>
              <Text weight="semibold" size={200}>{language === 'tl' ? 'Halaga:' : 'Amount:'}</Text>
              <Text weight="bold" size={300}>{formatPeso(payload.amount ?? 0)}</Text>
            </div>
            {payload.customerId && (
              <div className={styles.detailRow}>
                <Text size={200}>Customer ID:</Text>
                <Text size={200} style={{ fontFamily: 'monospace' }}>{payload.customerId}</Text>
              </div>
            )}
            {payload.notes && (
              <div className={styles.detailRow}>
                <Text size={200}>Notes:</Text>
                <Text size={200}>{payload.notes}</Text>
              </div>
            )}
            {payload.date && (
              <div className={styles.detailRow}>
                <Text size={200}>{language === 'tl' ? 'Petsa:' : 'Date:'}</Text>
                <Text size={200}>{new Date(payload.date).toLocaleString()}</Text>
              </div>
            )}
          </>
        );

      case 'GCashTxn':
        return (
          <>
            <div className={styles.detailRow}>
              <Text weight="semibold" size={200}>{language === 'tl' ? 'Uri ng GCash:' : 'GCash Type:'}</Text>
              <Text weight="bold" size={200}>{payload.type === 'CashIn' ? 'Cash-In' : 'Cash-Out'}</Text>
            </div>
            <div className={styles.detailRow}>
              <Text weight="semibold" size={200}>{language === 'tl' ? 'Halaga:' : 'Amount:'}</Text>
              <Text weight="bold" size={300}>{formatPeso(payload.amount ?? 0)}</Text>
            </div>
            <div className={styles.detailRow}>
              <Text size={200}>{language === 'tl' ? 'Singil / Fee:' : 'Fee:'}</Text>
              <Text size={200}>{formatPeso(payload.fee ?? 0)}</Text>
            </div>
            {payload.refNo && (
              <div className={styles.detailRow}>
                <Text size={200}>Ref No:</Text>
                <Text size={200} style={{ fontFamily: 'monospace' }}>{payload.refNo}</Text>
              </div>
            )}
            {payload.customerPhone && (
              <div className={styles.detailRow}>
                <Text size={200}>{language === 'tl' ? 'Telepono:' : 'Phone:'}</Text>
                <Text size={200}>{payload.customerPhone}</Text>
              </div>
            )}
          </>
        );

      case 'Product':
        return (
          <>
            <div className={styles.detailRow}>
              <Text weight="semibold" size={200}>{language === 'tl' ? 'Paninda:' : 'Product Name:'}</Text>
              <Text weight="bold" size={200}>{payload.name || 'Walang Pangalan'}</Text>
            </div>
            <div className={styles.detailRow}>
              <Text size={200}>{language === 'tl' ? 'Presyo (SRP):' : 'Price (SRP):'}</Text>
              <Text size={200}>{formatPeso(payload.price ?? 0)}</Text>
            </div>
            <div className={styles.detailRow}>
              <Text size={200}>{language === 'tl' ? 'Puhunan (Cost):' : 'Cost:'}</Text>
              <Text size={200}>{formatPeso(payload.cost ?? 0)}</Text>
            </div>
            <div className={styles.detailRow}>
              <Text size={200}>{language === 'tl' ? 'Stock:' : 'Stock Quantity:'}</Text>
              <Text size={200}>{payload.stockQty ?? 0}</Text>
            </div>
          </>
        );

      case 'Customer':
        return (
          <>
            <div className={styles.detailRow}>
              <Text weight="semibold" size={200}>{language === 'tl' ? 'Suki:' : 'Customer Name:'}</Text>
              <Text weight="bold" size={200}>{payload.name || 'Walang Pangalan'}</Text>
            </div>
            {payload.phone && (
              <div className={styles.detailRow}>
                <Text size={200}>{language === 'tl' ? 'Telepono:' : 'Phone:'}</Text>
                <Text size={200}>{payload.phone}</Text>
              </div>
            )}
            <div className={styles.detailRow}>
              <Text size={200}>{language === 'tl' ? 'Balanse sa Utang:' : 'Utang Balance:'}</Text>
              <Text size={200}>{formatPeso(payload.totalUtangBalance ?? 0)}</Text>
            </div>
          </>
        );

      default:
        return (
          <div className={styles.detailRow}>
            <Text size={200}>Entity ID:</Text>
            <Text size={200} style={{ fontFamily: 'monospace' }}>{payload.id || item.id}</Text>
          </div>
        );
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(_, data) => !data.open && onClose()}>
      <DialogSurface className={styles.surface}>
        <DialogBody>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <DialogTitle>
              {t.settings.dlqDismissConfirmTitle}
            </DialogTitle>
            <Button
              appearance="subtle"
              icon={<DismissRegular />}
              onClick={onClose}
              aria-label="Close"
            />
          </div>

          <DialogContent>
            <MessageBar intent="error" className={styles.warningBanner}>
              <MessageBarBody>
                <MessageBarTitle>
                  <WarningRegular style={{ marginRight: '6px', verticalAlign: 'text-bottom' }} />
                  {t.settings.dlqDismissConfirmWarning}
                </MessageBarTitle>
                <Text size={200} style={{ display: 'block', marginTop: '4px' }}>
                  {t.settings.dlqDismissConfirmDesc}
                </Text>
              </MessageBarBody>
            </MessageBar>

            <div className={styles.entityBox}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <Text weight="bold" size={300} style={{ color: tokens.colorBrandForeground1 }}>
                  {getEntityDisplayName(item.entity)}
                </Text>
                <Badge appearance="filled" color={item.action === 'Delete' ? 'danger' : 'informative'}>
                  {item.action}
                </Badge>
              </div>

              {renderEntityDetails()}

              {item.errorMessage && (
                <div className={styles.errorBox}>
                  <strong>Error: </strong>{item.errorMessage}
                </div>
              )}
            </div>
          </DialogContent>

          <DialogActions>
            <Button
              appearance="secondary"
              onClick={onClose}
              data-testid="cancel-dismiss-dlq-btn"
            >
              {t.common.cancel}
            </Button>
            <Button
              className={styles.dismissBtn}
              icon={<DeleteRegular />}
              onClick={async () => {
                await onConfirm();
                onClose();
              }}
              data-testid="confirm-dismiss-dlq-btn"
            >
              {t.settings.dlqDismissConfirmBtn}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
};
