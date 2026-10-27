import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  Spinner,
  Text,
  Badge,
  Divider
} from '@fluentui/react-components';
import {
  QrCodeRegular,
  CheckmarkCircleRegular,
  DismissRegular,
  ArrowClockwiseRegular,
  WarningRegular,
  ShieldCheckmarkRegular
} from '@fluentui/react-icons';
import { useSubscriptionStore, type BillingCycle } from '../state/subscriptionStore';
import { formatPeso } from '../utils/currency';
import { useLanguageStore } from '../state/languageStore';
import { playScanBeep } from '../utils/sound';

const useStyles = makeStyles({
  surface: {
    maxWidth: '440px',
    width: '100%',
    textAlign: 'center',
    ...shorthands.padding(tokens.spacingVerticalL, tokens.spacingHorizontalL)
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: tokens.spacingVerticalM
  },
  titleWrapper: {
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap(tokens.spacingHorizontalS)
  },
  qrContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: tokens.spacingVerticalM,
    marginBottom: tokens.spacingVerticalM
  },
  qrImageWrapper: {
    width: '230px',
    height: '230px',
    backgroundColor: '#ffffff',
    ...shorthands.borderRadius(tokens.borderRadiusLarge),
    ...shorthands.border('2px', 'solid', tokens.colorBrandStroke1),
    boxShadow: tokens.shadow8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative'
  },
  qrImage: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
    display: 'block'
  },
  amountBadge: {
    fontSize: '28px',
    fontWeight: 'bold',
    color: tokens.colorBrandForeground1,
    marginTop: tokens.spacingVerticalS,
    marginBottom: tokens.spacingVerticalXXS
  },
  planBadge: {
    fontSize: tokens.fontSizeBase300,
    fontWeight: '600',
    color: tokens.colorNeutralForeground2,
    marginBottom: tokens.spacingVerticalXS
  },
  refBadge: {
    fontFamily: 'monospace',
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
    marginBottom: tokens.spacingVerticalM
  },
  statusNotice: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    ...shorthands.gap(tokens.spacingHorizontalXS),
    ...shorthands.padding(tokens.spacingVerticalXS, tokens.spacingHorizontalM),
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    backgroundColor: tokens.colorNeutralBackground2,
    marginTop: tokens.spacingVerticalS
  },
  successContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    ...shorthands.padding(tokens.spacingVerticalXL, 0),
    ...shorthands.gap(tokens.spacingVerticalM)
  },
  successIcon: {
    fontSize: '64px',
    color: tokens.colorPaletteGreenForeground1
  },
  supportedAppsRow: {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'center',
    ...shorthands.gap(tokens.spacingHorizontalXS),
    marginTop: tokens.spacingVerticalM
  }
});

export interface QrPhSubscriptionDialogProps {
  open: boolean;
  onClose: () => void;
  targetTier: 'TindahanPro' | 'NegosyoPlus';
  cycle: BillingCycle;
  amount: number;
}

export const QrPhSubscriptionDialog: React.FC<QrPhSubscriptionDialogProps> = ({
  open,
  onClose,
  targetTier,
  cycle,
  amount
}) => {
  const styles = useStyles();
  const { language } = useLanguageStore();
  const isTagalog = language === 'tl';

  const {
    generateQrPhPayment,
    checkQrPhStatus,
    confirmQrPhPayment
  } = useSubscriptionStore();

  const [isLoading, setIsLoading] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPaid, setIsPaid] = useState(false);
  const [retryTrigger, setRetryTrigger] = useState(0);

  const [qrResult, setQrResult] = useState<{
    paymentIntentId: string;
    paymentMethodId: string;
    qrCodeUrl: string;
    orderId: string;
  } | null>(null);

  const pollTimerRef = useRef<number | null>(null);
  const successTimeoutRef = useRef<number | null>(null);
  const isCheckingRef = useRef(false);
  const paymentReceivedRef = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const isTagalogRef = useRef(isTagalog);
  isTagalogRef.current = isTagalog;

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current !== null) {
      window.clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const handleClose = () => {
    try {
      if (!paymentReceivedRef.current && qrResult?.paymentIntentId &&
          localStorage.getItem('fluent_last_checkout_session_id') === qrResult.paymentIntentId) {
        localStorage.removeItem('fluent_last_checkout_session_id');
      }
    } catch {
      // Installation and payment remain usable when browser storage is unavailable.
    }
    onClose();
  };

  const handleStatusCheck = useCallback(async (paymentIntentId: string) => {
    if (isCheckingRef.current) return;
    isCheckingRef.current = true;
    setIsChecking(true);

    try {
      const statusData = await checkQrPhStatus(paymentIntentId);
      if (statusData.isPaid) {
        paymentReceivedRef.current = true;
        stopPolling();
        try {
          await confirmQrPhPayment(paymentIntentId, targetTier, cycle);
        } catch (e: any) {
          setError(
            e?.response?.data?.message ||
            e?.message ||
            (isTagalogRef.current
              ? 'Natanggap ang bayad ngunit nabigo ang pag-upgrade. Pakisubukan muli.'
              : 'Payment received but upgrade failed. Please retry.')
          );
          return;
        }

        setIsPaid(true);
        playScanBeep();

        if (successTimeoutRef.current !== null) {
          window.clearTimeout(successTimeoutRef.current);
        }
        successTimeoutRef.current = window.setTimeout(() => {
          onCloseRef.current();
        }, 1600);
      }
    } catch {
      // Quiet background poll retry
    } finally {
      isCheckingRef.current = false;
      setIsChecking(false);
    }
  }, [checkQrPhStatus, confirmQrPhPayment, targetTier, cycle, stopPolling]);

  const handleStatusCheckRef = useRef(handleStatusCheck);
  handleStatusCheckRef.current = handleStatusCheck;

  // Generate QR intent on dialog open or retry
  useEffect(() => {
    if (!open) {
      stopPolling();
      if (successTimeoutRef.current !== null) {
        window.clearTimeout(successTimeoutRef.current);
        successTimeoutRef.current = null;
      }
      setQrResult(null);
      setIsPaid(false);
      setError(null);
      return;
    }

    let isMounted = true;
    const generate = async () => {
      setIsLoading(true);
      setError(null);
      setIsPaid(false);
      paymentReceivedRef.current = false;

      try {
        const result = await generateQrPhPayment(targetTier, cycle);
        if (!isMounted) return;

        try {
          localStorage.setItem('fluent_last_checkout_session_id', result.paymentIntentId);
        } catch {
          // Continue displaying the QR code when browser storage is unavailable.
        }
        setQrResult(result);
        setIsLoading(false);

        // Start background polling every 3 seconds
        stopPolling();
        pollTimerRef.current = window.setInterval(() => {
          handleStatusCheckRef.current(result.paymentIntentId);
        }, 3000);
      } catch (err: any) {
        if (!isMounted) return;
        setError(
          err?.response?.data?.message ||
          err?.message ||
          (isTagalogRef.current
            ? 'Hindi makagawa ng QR Ph payment. Pakisubukan muli.'
            : 'Unable to generate QR Ph payment. Please try again.')
        );
        setIsLoading(false);
      }
    };

    void generate();

    return () => {
      isMounted = false;
      stopPolling();
      if (successTimeoutRef.current !== null) {
        window.clearTimeout(successTimeoutRef.current);
        successTimeoutRef.current = null;
      }
    };
  }, [open, retryTrigger, targetTier, cycle, generateQrPhPayment, stopPolling]);

  const tierDisplayName = targetTier === 'TindahanPro' ? 'Tindahan Pro' : 'Negosyo Plus';

  useEffect(() => {
    if (!open || !qrResult?.paymentIntentId || isPaid) return;
    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        void handleStatusCheckRef.current(qrResult.paymentIntentId);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
    };
  }, [open, qrResult?.paymentIntentId, isPaid]);
  const cycleDisplayName = cycle === 'Weekly'
    ? (isTagalog ? 'Lingguhan' : 'Weekly')
    : (isTagalog ? 'Buwanan' : 'Monthly');

  return (
    <Dialog open={open} onOpenChange={(_, data) => !data.open && handleClose()}>
      <DialogSurface className={styles.surface}>
        <DialogBody>
          <div className={styles.header}>
            <div className={styles.titleWrapper}>
              <QrCodeRegular style={{ fontSize: '24px', color: tokens.colorBrandForeground1 }} />
              <DialogTitle style={{ margin: 0 }}>
                {isTagalog ? 'Magbayad gamit ang QR Ph' : 'Pay via QR Ph'}
              </DialogTitle>
            </div>
            <Button
              appearance="subtle"
              size="small"
              icon={<DismissRegular />}
              onClick={handleClose}
              aria-label={isTagalog ? 'Isara' : 'Close'}
            />
          </div>

          <DialogContent>
            {isPaid ? (
              <div className={styles.successContainer}>
                <CheckmarkCircleRegular className={styles.successIcon} />
                <Text size={500} weight="bold" style={{ color: tokens.colorPaletteGreenForeground1 }}>
                  {isTagalog
                    ? 'Matagumpay na na-upgrade ang tindahan!'
                    : 'Store subscription successfully upgraded!'}
                </Text>
                <Text size={300} style={{ color: tokens.colorNeutralForeground3 }}>
                  {tierDisplayName} • {formatPeso(amount)}
                </Text>
              </div>
            ) : isLoading ? (
              <div style={{ padding: '40px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                <Spinner size="large" label={isTagalog ? 'Inihahanda ang QR Ph code...' : 'Generating QR Ph code...'} />
              </div>
            ) : error ? (
              <div
                role="alert"
                style={{
                  padding: '16px',
                  borderRadius: tokens.borderRadiusMedium,
                  backgroundColor: tokens.colorPaletteRedBackground1,
                  border: `1px solid ${tokens.colorPaletteRedBorder2}`,
                  color: tokens.colorPaletteRedForeground1,
                  margin: '16px 0'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <WarningRegular />
                  <Text weight="semibold">{error}</Text>
                </div>
                <Button
                  size="small"
                  appearance="primary"
                  icon={<ArrowClockwiseRegular />}
                  onClick={() => {
                    const intentId = qrResult?.paymentIntentId;
                    setError(null);
                    if (intentId) {
                      handleStatusCheck(intentId);
                    } else {
                      setRetryTrigger(c => c + 1);
                    }
                  }}
                >
                  {isTagalog ? 'Subukan Muli' : 'Try Again'}
                </Button>
              </div>
            ) : qrResult ? (
              <>
                <div className={styles.amountBadge}>
                  {formatPeso(amount)}
                </div>

                <div className={styles.planBadge}>
                  {tierDisplayName} ({cycleDisplayName})
                </div>

                <div className={styles.refBadge}>
                  Ref: {qrResult.orderId}
                </div>

                <div className={styles.qrContainer}>
                  <div className={styles.qrImageWrapper}>
                    {qrResult.qrCodeUrl ? (
                      <img
                        src={qrResult.qrCodeUrl}
                        alt="QR Ph Subscription Code"
                        className={styles.qrImage}
                      />
                    ) : (
                      <Spinner label={isTagalog ? 'Kinukuha ang code...' : 'Loading code...'} />
                    )}
                  </div>
                </div>

                <Text size={200} weight="semibold" style={{ display: 'block', color: tokens.colorNeutralForeground2 }}>
                  {isTagalog
                    ? 'Buksan ang iyong GCash, Maya, o mobile banking app at i-scan ang code sa itaas.'
                    : 'Open your GCash, Maya, or banking app to scan the code above.'}
                </Text>

                <div className={styles.statusNotice}>
                  <Spinner size="extra-tiny" />
                  <Text size={100} style={{ color: tokens.colorNeutralForeground3 }}>
                    {isTagalog ? 'Naghihintay ng bayad...' : 'Waiting for payment...'}
                  </Text>
                </div>

                <div className={styles.supportedAppsRow}>
                  <Badge size="small" appearance="tint">GCash</Badge>
                  <Badge size="small" appearance="tint">Maya</Badge>
                  <Badge size="small" appearance="tint">ShopeePay</Badge>
                  <Badge size="small" appearance="tint">BPI</Badge>
                  <Badge size="small" appearance="tint">BDO</Badge>
                  <Badge size="small" appearance="tint">UnionBank</Badge>
                  <Badge size="small" appearance="tint">GoTyme</Badge>
                </div>

                <Divider style={{ margin: '16px 0 8px' }} />

                <Text size={100} style={{ color: tokens.colorNeutralForeground4, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                  <ShieldCheckmarkRegular />
                  {isTagalog
                    ? 'Ligtas na transaksyon sa pamamagitan ng PayMongo'
                    : 'Secure payment powered by PayMongo'}
                </Text>
              </>
            ) : null}
          </DialogContent>

          {!isPaid && (
            <DialogActions style={{ justifyContent: 'space-between', marginTop: '16px' }}>
              <Button appearance="subtle" onClick={handleClose}>
                {isTagalog ? 'Kanselahin' : 'Cancel'}
              </Button>
              {qrResult && !isLoading && !error && (
                <Button
                  appearance="primary"
                  icon={<ArrowClockwiseRegular />}
                  disabled={isChecking}
                  onClick={() => handleStatusCheck(qrResult.paymentIntentId)}
                >
                  {isChecking
                    ? (isTagalog ? 'Sinusuri...' : 'Checking...')
                    : (isTagalog ? 'Suriin ang Bayad' : 'Check Payment Status')}
                </Button>
              )}
            </DialogActions>
          )}
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
};
