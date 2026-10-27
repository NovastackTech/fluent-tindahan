import React, { useState } from 'react';
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
  shorthands,
  Divider,
  Badge,
  mergeClasses
} from '@fluentui/react-components';
import {
  ShareRegular,
  CopyRegular,
  CheckmarkRegular,
  DismissRegular,
  PrintRegular,
  BluetoothRegular
} from '@fluentui/react-icons';
import { useAuthStore } from '../state/authStore';
import { useSubscriptionStore } from '../state/subscriptionStore';
import { useTranslation } from '../state/languageStore';
import { usePrinterStore } from '../state/printerStore';
import { formatPeso } from '../utils/currency';
import {
  printThermalReceipt,
  printBluetoothReceipt,
  isBluetoothPrintSupported
} from '../services/receiptPrinter';

export interface ReceiptData {
  saleId: string;
  date: string;
  items: Array<{
    name: string;
    qty: number;
    price: number;
    subtotal: number;
  }>;
  totalAmount: number;
  paymentMethod: string;
  cashReceived?: number;
  changeGiven?: number;
  customerName?: string;
  customerUtangBalance?: number;
  gcashRef?: string;
}

interface ReceiptModalProps {
  open: boolean;
  onClose: () => void;
  data: ReceiptData | null;
  embedded?: boolean;
}

const useStyles = makeStyles({
  surface: {
    maxWidth: '520px',
    width: '100%',
    boxSizing: 'border-box'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: tokens.spacingVerticalS,
    flexWrap: 'wrap',
    ...shorthands.gap('8px')
  },
  dialogTitle: {
    whiteSpace: 'nowrap',
    margin: 0
  },
  paperToggleGroup: {
    display: 'inline-flex',
    alignItems: 'center',
    ...shorthands.gap('2px'),
    backgroundColor: tokens.colorNeutralBackground3,
    ...shorthands.padding('2px', '4px'),
    ...shorthands.borderRadius(tokens.borderRadiusMedium)
  },
  paperLabel: {
    fontSize: '11px',
    color: tokens.colorNeutralForeground3,
    ...shorthands.padding(0, '4px', 0, '2px'),
    userSelect: 'none'
  },
  statusMsg: {
    padding: '6px 10px',
    margin: '6px 0',
    borderRadius: '4px',
    backgroundColor: tokens.colorNeutralBackground3,
    fontSize: '12px',
    textAlign: 'center',
    fontWeight: 600,
    color: tokens.colorBrandForeground1
  },
  receiptContent: {
    display: 'flex',
    justifyContent: 'center',
    padding: '4px 0'
  },
  receiptPaper: {
    backgroundColor: tokens.colorNeutralBackground2,
    ...shorthands.padding(tokens.spacingVerticalL, tokens.spacingHorizontalL),
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    ...shorthands.border('1px', 'dashed', tokens.colorNeutralStroke2),
    position: 'relative',
    fontFamily: '"Courier New", Courier, monospace',
    ...shorthands.overflow('hidden'),
    overflowX: 'hidden',
    overflowY: 'hidden',
    boxSizing: 'border-box',
    width: '100%',
    transition: 'max-width 0.2s ease'
  },
  receiptPaper58: {
    maxWidth: '340px'
  },
  receiptPaper80: {
    maxWidth: '440px'
  },
  watermark: {
    position: 'absolute',
    top: '45%',
    left: '50%',
    transform: 'translate(-50%, -50%) rotate(-25deg)',
    fontSize: '13px',
    fontWeight: 'bold',
    color: 'rgba(219, 58, 58, 0.18)',
    textAlign: 'center',
    width: '85%',
    maxWidth: '260px',
    pointerEvents: 'none',
    userSelect: 'none',
    lineHeight: '1.4',
    ...shorthands.border('2px', 'dashed', 'rgba(219, 58, 58, 0.25)'),
    ...shorthands.padding(tokens.spacingVerticalS, tokens.spacingHorizontalS),
    ...shorthands.borderRadius(tokens.borderRadiusSmall),
    boxSizing: 'border-box'
  },
  headerText: {
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    ...shorthands.gap('2px'),
    marginBottom: tokens.spacingVerticalS
  },
  itemRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: tokens.fontSizeBase200,
    marginTop: '4px',
    ...shorthands.gap(tokens.spacingHorizontalS)
  },
  itemName: {
    flexGrow: 1,
    wordBreak: 'break-word'
  },
  itemPrice: {
    whiteSpace: 'nowrap'
  },
  totalRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: tokens.fontSizeBase400,
    fontWeight: 'bold',
    marginTop: tokens.spacingVerticalS
  },
  noticeBox: {
    marginTop: tokens.spacingVerticalM,
    textAlign: 'center',
    fontSize: '11px',
    color: tokens.colorPaletteRedForeground1,
    fontWeight: 'bold',
    letterSpacing: '0.5px'
  },
  dialogActions: {
    width: '100%',
    gridColumnStart: 1,
    gridColumnEnd: -1,
    justifySelf: 'stretch',
    boxSizing: 'border-box',
    marginTop: tokens.spacingVerticalM,
    ...shorthands.padding(tokens.spacingVerticalS, 0, 0, 0)
  },
  actionsContainer: {
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    boxSizing: 'border-box',
    ...shorthands.gap('10px')
  },
  actionsPrimaryRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    ...shorthands.gap('8px'),
    width: '100%',
    boxSizing: 'border-box'
  },
  actionsSecondaryRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    boxSizing: 'border-box',
    flexWrap: 'wrap',
    ...shorthands.gap('8px')
  },
  actionsUtilityGroup: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'nowrap',
    ...shorthands.gap('6px')
  },
  actionButton: {
    width: '100%',
    whiteSpace: 'nowrap',
    fontWeight: 600,
    boxSizing: 'border-box'
  },
  utilityButton: {
    whiteSpace: 'nowrap',
    flexShrink: 0,
    boxSizing: 'border-box'
  },
  closeButton: {
    whiteSpace: 'nowrap',
    flexShrink: 0,
    fontWeight: 600,
    boxSizing: 'border-box'
  }
});

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ open, onClose, data, embedded = false }) => {
  const styles = useStyles();
  const businessName = useAuthStore((s) => s.businessName);
  const tier = useSubscriptionStore((s) => s.tier);
  const { t } = useTranslation();
  const { paperWidth, setPaperWidth } = usePrinterStore();
  const [copied, setCopied] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const formattedDate = data
    ? new Date(data.date).toLocaleString('en-PH', {
        dateStyle: 'medium',
        timeStyle: 'short'
      })
    : '';

  const generateReceiptText = (): string => {
    if (!data) return '';
    let text = `🛒 ${businessName.toUpperCase()}\n`;
    text += `${t.receipt.dateLabel} ${formattedDate}\n`;
    text += `${t.receipt.txnLabel} #${data.saleId.slice(0, 8)}\n`;
    text += `--------------------------------\n`;
    data.items.forEach((item) => {
      text += `${item.qty}x ${item.name} @ ${formatPeso(item.price)} = ${formatPeso(item.subtotal)}\n`;
    });
    text += `--------------------------------\n`;
    text += `${t.receipt.totalLabel} ${formatPeso(data.totalAmount)}\n`;
    text += `${t.receipt.paymentMethodLabel} ${data.paymentMethod}\n`;

    if (data.gcashRef) {
      text += `${t.receipt.gcashRefLabel} ${data.gcashRef}\n`;
    }

    if (data.cashReceived !== undefined && data.cashReceived > 0) {
      text += `${t.receipt.tenderedLabel} ${formatPeso(data.cashReceived)}\n`;
      text += `${t.receipt.changeLabel} ${formatPeso(data.changeGiven || 0)}\n`;
    }

    if (data.customerName) {
      text += `${t.receipt.customerLabel} ${data.customerName}\n`;
      if (data.customerUtangBalance !== undefined) {
        text += `${t.receipt.remainingDebtLabel} ${formatPeso(data.customerUtangBalance)}\n`;
      }
    }

    text += `\n*** NOT AN OFFICIAL RECEIPT ***\n`;
    text += `*** FOR ACKNOWLEDGMENT ONLY ***\n`;
    text += `${t.receipt.thankYou}`;

    if (tier === 'Libre') {
      text += `\n🛒 Powered by Fluent Tindahan`;
    }

    return text;
  };

  const handlePrintThermal = () => {
    if (!data) return;
    setIsPrinting(true);
    setStatusMsg(t.receipt.printing);
    try {
      printThermalReceipt(data, businessName, { paperWidth, tier });
      setStatusMsg(t.receipt.printSuccess);
      setTimeout(() => setStatusMsg(null), 3000);
    } catch (err: any) {
      setStatusMsg(err.message || 'Print error');
    } finally {
      setIsPrinting(false);
    }
  };

  const handlePrintBluetooth = async () => {
    if (!data) return;
    if (!isBluetoothPrintSupported()) {
      setStatusMsg(t.receipt.bluetoothNotSupported);
      return;
    }
    setIsPrinting(true);
    setStatusMsg(t.receipt.bluetoothConnecting);
    try {
      const result = await printBluetoothReceipt(data, businessName, { paperWidth });
      if (result.success) {
        setStatusMsg(t.receipt.printSuccess);
        setTimeout(() => setStatusMsg(null), 3000);
      } else {
        setStatusMsg(result.error || t.receipt.bluetoothError);
      }
    } catch (err: any) {
      setStatusMsg(err.message || t.receipt.bluetoothError);
    } finally {
      setIsPrinting(false);
    }
  };

  const handleShare = async () => {
    const text = generateReceiptText();
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${t.receipt.shareTitle} - ${businessName}`,
          text: text
        });
      } catch (err) {
        console.warn('Share was cancelled or failed:', err);
      }
    } else {
      handleCopy();
    }
  };

  const handleCopy = () => {
    const text = generateReceiptText();
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const dialogBody = data && (
    <DialogBody>
      <div className={styles.header}>
        <DialogTitle className={styles.dialogTitle}>{t.receipt.receiptTitle}</DialogTitle>
        <div className={styles.paperToggleGroup}>
          <span className={styles.paperLabel}>
            {t.receipt.paperWidthLabel}
          </span>
          <Button
            size="small"
            appearance={paperWidth === '58mm' ? 'primary' : 'subtle'}
            onClick={() => setPaperWidth('58mm')}
          >
            58mm
          </Button>
          <Button
            size="small"
            appearance={paperWidth === '80mm' ? 'primary' : 'subtle'}
            onClick={() => setPaperWidth('80mm')}
          >
            80mm
          </Button>
        </div>
      </div>

      {statusMsg && (
        <div className={styles.statusMsg}>
          {statusMsg}
        </div>
      )}

      <DialogContent className={styles.receiptContent}>
        <div
          className={mergeClasses(
            styles.receiptPaper,
            paperWidth === '58mm' ? styles.receiptPaper58 : styles.receiptPaper80,
            'receipt-printable'
          )}
        >
          {/* Mandatory Watermark */}
          <div className={styles.watermark}>
            NOT AN OFFICIAL RECEIPT<br />FOR ACKNOWLEDGMENT ONLY
          </div>

          <div className={styles.headerText}>
            <Text weight="bold" size={400}>{businessName}</Text>
            <Text size={200}>{formattedDate}</Text>
            <Text size={100} style={{ color: tokens.colorNeutralForeground3 }}>
              Ref: {data.saleId.slice(0, 8)}
            </Text>
          </div>

          <Divider style={{ margin: '8px 0' }} />

          <div>
            {data.items.map((item, idx) => (
              <div key={idx} className={styles.itemRow}>
                <span className={styles.itemName}>{item.qty}x {item.name}</span>
                <span className={styles.itemPrice}>{formatPeso(item.subtotal)}</span>
              </div>
            ))}
          </div>

          <Divider style={{ margin: '8px 0' }} />

          <div className={styles.totalRow}>
            <span>{t.receipt.totalLabel}</span>
            <span>{formatPeso(data.totalAmount)}</span>
          </div>

          <div className={styles.itemRow} style={{ marginTop: '6px' }}>
            <span>{t.receipt.paymentMethodLabel}</span>
            <Badge appearance="tint" color="brand">{data.paymentMethod}</Badge>
          </div>

          {data.gcashRef && (
            <div className={styles.itemRow}>
              <span>{t.receipt.gcashRefLabel}</span>
              <span className={styles.itemPrice} style={{ fontFamily: 'monospace' }}>{data.gcashRef}</span>
            </div>
          )}

          {data.cashReceived !== undefined && data.cashReceived > 0 && (
            <>
              <div className={styles.itemRow}>
                <span>{t.receipt.tenderedLabel}</span>
                <span className={styles.itemPrice}>{formatPeso(data.cashReceived)}</span>
              </div>
              <div className={styles.itemRow}>
                <span style={{ fontWeight: 'bold' }}>{t.receipt.changeLabel}</span>
                <span style={{ fontWeight: 'bold', color: tokens.colorPaletteGreenForeground1 }} className={styles.itemPrice}>
                  {formatPeso(data.changeGiven || 0)}
                </span>
              </div>
            </>
          )}

          {data.customerName && (
            <div style={{ marginTop: '8px', padding: '6px', background: tokens.colorNeutralBackground1, borderRadius: '4px' }}>
              <div className={styles.itemRow}>
                <span>{t.receipt.customerLabel}</span>
                <strong>{data.customerName}</strong>
              </div>
              {data.customerUtangBalance !== undefined && (
                <div className={styles.itemRow}>
                  <span>{t.receipt.remainingDebtLabel}</span>
                  <strong style={{ color: tokens.colorPaletteRedForeground1 }} className={styles.itemPrice}>
                    {formatPeso(data.customerUtangBalance)}
                  </strong>
                </div>
              )}
            </div>
          )}

          <div className={styles.noticeBox}>
            NOT AN OFFICIAL RECEIPT.<br />FOR ACKNOWLEDGMENT ONLY.
          </div>

          {tier === 'Libre' ? (
            <div style={{ textAlign: 'center', marginTop: '6px', fontSize: '10px', color: tokens.colorNeutralForeground4 }}>
              🛒 Powered by Fluent Tindahan (Libre Plan)
            </div>
          ) : (
            <div style={{ textAlign: 'center', marginTop: '6px', fontSize: '10px', color: tokens.colorPaletteGreenForeground1 }}>
              ✓ Tindahan Pro Verified Receipt
            </div>
          )}
        </div>
      </DialogContent>

      <DialogActions fluid position="start" className={styles.dialogActions}>
        <div className={styles.actionsContainer}>
          <div className={styles.actionsPrimaryRow}>
            <Button
              appearance="primary"
              size="medium"
              icon={<PrintRegular />}
              onClick={handlePrintThermal}
              disabled={isPrinting}
              className={styles.actionButton}
            >
              {isPrinting ? t.receipt.printing : t.receipt.printReceipt}
            </Button>
            <Button
              appearance="secondary"
              size="medium"
              icon={<BluetoothRegular />}
              onClick={handlePrintBluetooth}
              disabled={isPrinting}
              className={styles.actionButton}
            >
              {t.receipt.bluetoothPrint}
            </Button>
          </div>
          <div className={styles.actionsSecondaryRow}>
            <div className={styles.actionsUtilityGroup}>
              <Button
                appearance="subtle"
                size="medium"
                icon={copied ? <CheckmarkRegular /> : <CopyRegular />}
                onClick={handleCopy}
                className={styles.utilityButton}
              >
                {copied ? t.receipt.copied : t.receipt.copyReceipt}
              </Button>
              <Button
                appearance="subtle"
                size="medium"
                icon={<ShareRegular />}
                onClick={handleShare}
                className={styles.utilityButton}
              >
                Share
              </Button>
            </div>
            <Button
              appearance="secondary"
              size="medium"
              icon={<DismissRegular />}
              onClick={onClose}
              className={styles.closeButton}
            >
              {t.common.close}
            </Button>
          </div>
        </div>
      </DialogActions>
    </DialogBody>
  );

  if (embedded) return dialogBody;

  return (
    <Dialog
      open={open && Boolean(data)}
      modalType="modal"
      onOpenChange={(_, dialogState) => {
        if (!dialogState.open && dialogState.type !== 'backdropClick') {
          onClose();
        }
      }}
    >
      <DialogSurface className={styles.surface}>
        {dialogBody}
      </DialogSurface>
    </Dialog>
  );
};
