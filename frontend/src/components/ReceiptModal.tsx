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
  Badge
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
import { useTranslation } from '../state/languageStore';
import { usePrinterStore } from '../state/printerStore';
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
}

interface ReceiptModalProps {
  open: boolean;
  onClose: () => void;
  data: ReceiptData | null;
}

const useStyles = makeStyles({
  receiptPaper: {
    backgroundColor: tokens.colorNeutralBackground2,
    ...shorthands.padding(tokens.spacingVerticalM, tokens.spacingHorizontalM),
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    ...shorthands.border('1px', 'dashed', tokens.colorNeutralStroke2),
    position: 'relative',
    fontFamily: 'monospace',
    overflow: 'hidden'
  },
  watermark: {
    position: 'absolute',
    top: '40%',
    left: '50%',
    transform: 'translate(-50%, -50%) rotate(-25deg)',
    fontSize: '14px',
    fontWeight: 'bold',
    color: 'rgba(219, 58, 58, 0.18)',
    textAlign: 'center',
    width: '90%',
    pointerEvents: 'none',
    userSelect: 'none',
    lineHeight: '1.4',
    ...shorthands.border('2px', 'dashed', 'rgba(219, 58, 58, 0.25)'),
    ...shorthands.padding(tokens.spacingVerticalS, tokens.spacingHorizontalS)
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
    marginTop: '4px'
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
  }
});

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ open, onClose, data }) => {
  const styles = useStyles();
  const businessName = useAuthStore((s) => s.businessName);
  const tier = useAuthStore((s) => s.tier);
  const { t } = useTranslation();
  const { paperWidth, setPaperWidth } = usePrinterStore();
  const [copied, setCopied] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  if (!data) return null;

  const formattedDate = new Date(data.date).toLocaleString('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });

  const generateReceiptText = (): string => {
    let text = `🛒 ${businessName.toUpperCase()}\n`;
    text += `${t.receipt.dateLabel} ${formattedDate}\n`;
    text += `${t.receipt.txnLabel} #${data.saleId.slice(0, 8)}\n`;
    text += `--------------------------------\n`;
    data.items.forEach((item) => {
      text += `${item.qty}x ${item.name} @ ₱${item.price.toFixed(2)} = ₱${item.subtotal.toFixed(2)}\n`;
    });
    text += `--------------------------------\n`;
    text += `${t.receipt.totalLabel} ₱${data.totalAmount.toFixed(2)}\n`;
    text += `${t.receipt.paymentMethodLabel} ${data.paymentMethod}\n`;

    if (data.cashReceived !== undefined && data.cashReceived > 0) {
      text += `${t.receipt.tenderedLabel} ₱${data.cashReceived.toFixed(2)}\n`;
      text += `${t.receipt.changeLabel} ₱${(data.changeGiven || 0).toFixed(2)}\n`;
    }

    if (data.customerName) {
      text += `${t.receipt.customerLabel} ${data.customerName}\n`;
      if (data.customerUtangBalance !== undefined) {
        text += `${t.receipt.remainingDebtLabel} ₱${data.customerUtangBalance.toFixed(2)}\n`;
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
    if (!isBluetoothPrintSupported()) {
      alert(t.receipt.bluetoothNotSupported);
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

  return (
    <Dialog open={open} onOpenChange={(_, data) => !data.open && onClose()}>
      <DialogSurface>
        <DialogBody>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <DialogTitle>{t.receipt.receiptTitle}</DialogTitle>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ fontSize: '11px', color: tokens.colorNeutralForeground3 }}>
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
            <div style={{
              padding: '6px 10px',
              margin: '6px 0',
              borderRadius: '4px',
              backgroundColor: tokens.colorNeutralBackground3,
              fontSize: '12px',
              textAlign: 'center',
              fontWeight: 600,
              color: tokens.colorBrandForeground1
            }}>
              {statusMsg}
            </div>
          )}

          <DialogContent>
            <div className={`${styles.receiptPaper} receipt-printable`}>
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
                    <span>{item.qty}x {item.name}</span>
                    <span>₱{item.subtotal.toFixed(2)}</span>
                  </div>
                ))}
              </div>

              <Divider style={{ margin: '8px 0' }} />

              <div className={styles.totalRow}>
                <span>{t.receipt.totalLabel}</span>
                <span>₱{data.totalAmount.toFixed(2)}</span>
              </div>

              <div className={styles.itemRow} style={{ marginTop: '6px' }}>
                <span>{t.receipt.paymentMethodLabel}</span>
                <Badge appearance="tint" color="brand">{data.paymentMethod}</Badge>
              </div>

              {data.cashReceived !== undefined && data.cashReceived > 0 && (
                <>
                  <div className={styles.itemRow}>
                    <span>{t.receipt.tenderedLabel}</span>
                    <span>₱{data.cashReceived.toFixed(2)}</span>
                  </div>
                  <div className={styles.itemRow}>
                    <span style={{ fontWeight: 'bold' }}>{t.receipt.changeLabel}</span>
                    <span style={{ fontWeight: 'bold', color: tokens.colorPaletteGreenForeground1 }}>
                      ₱{(data.changeGiven || 0).toFixed(2)}
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
                      <strong style={{ color: tokens.colorPaletteRedForeground1 }}>₱{data.customerUtangBalance.toFixed(2)}</strong>
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
                  ✓ {tier === 'NegosyoPlus' ? 'Negosyo Plus' : 'Tindahan Pro'} Verified Receipt
                </div>
              )}
            </div>
          </DialogContent>

          <DialogActions style={{ flexWrap: 'wrap', gap: '6px', justifyContent: 'flex-end' }}>
            <Button
              appearance="primary"
              icon={<PrintRegular />}
              onClick={handlePrintThermal}
              disabled={isPrinting}
            >
              {isPrinting ? t.receipt.printing : t.receipt.printReceipt}
            </Button>
            <Button
              appearance="secondary"
              icon={<BluetoothRegular />}
              onClick={handlePrintBluetooth}
              disabled={isPrinting}
            >
              {t.receipt.bluetoothPrint}
            </Button>
            <Button
              appearance="secondary"
              icon={copied ? <CheckmarkRegular /> : <CopyRegular />}
              onClick={handleCopy}
            >
              {copied ? t.receipt.copied : t.receipt.copyReceipt}
            </Button>
            <Button
              appearance="subtle"
              icon={<ShareRegular />}
              onClick={handleShare}
            >
              Share
            </Button>
            <Button appearance="subtle" icon={<DismissRegular />} onClick={onClose}>
              {t.common.close}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
};
