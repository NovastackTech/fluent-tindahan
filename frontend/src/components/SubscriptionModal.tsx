import React, { useState, useCallback } from 'react';
import {
  Dialog,
  DialogSurface,
  DialogTitle,
  DialogBody,
  DialogContent,
  DialogActions,
  Button,
  Card,
  Badge,
  Text,
  makeStyles,
  tokens,
  shorthands,
  Spinner,
  MessageBar,
  MessageBarBody,
  mergeClasses
} from '@fluentui/react-components';
import {
  CheckmarkRegular,
  DismissRegular,
  SparkleRegular,
  StarFilled,
  CreditCardPersonRegular,
  QrCodeRegular
} from '@fluentui/react-icons';
import {
  useSubscriptionStore,
  type BillingCycle,
  IS_MOCK_PAYMENT_ENABLED,
  SUBSCRIPTION_REFRESH_ERROR
} from '../state/subscriptionStore';
import { type PlanTier } from '../db/db';
import { useLanguageStore } from '../state/languageStore';
import { formatPeso } from '../utils/currency';
import { QrPhSubscriptionDialog } from './QrPhSubscriptionDialog';
import { getLocalizedSyncErrorMessage } from '../utils/syncErrors';
import { useAuthStore } from '../state/authStore';

const useStyles = makeStyles({
  surface: {
    maxWidth: '900px',
    width: '95vw',
    ...shorthands.padding(tokens.spacingVerticalL, tokens.spacingHorizontalL),
    backgroundColor: tokens.colorNeutralBackground1,
    ...shorthands.borderRadius(tokens.borderRadiusLarge)
  },
  headerContainer: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: tokens.spacingVerticalM
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  tierActionSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
    marginTop: tokens.spacingVerticalM
  },
  cycleToggle: {
    display: 'flex',
    justifyContent: 'center',
    gap: tokens.spacingHorizontalS,
    marginBottom: tokens.spacingVerticalL
  },
  cardsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: tokens.spacingHorizontalM,
    paddingTop: '16px',
    marginBottom: tokens.spacingVerticalL
  },
  tierCard: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    height: '100%',
    ...shorthands.padding(tokens.spacingVerticalM, tokens.spacingHorizontalM),
    backgroundColor: tokens.colorNeutralBackground2,
    ...shorthands.border('1px', 'solid', tokens.colorNeutralStroke1),
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    transition: 'all 0.2s ease',
    position: 'relative',
    overflow: 'visible'
  },
  activeTierCard: {
    ...shorthands.border('2px', 'solid', tokens.colorBrandStroke1),
    backgroundColor: tokens.colorBrandBackground2,
    boxShadow: tokens.shadow8
  },
  popularTierCard: {
    ...shorthands.border('2px', 'solid', tokens.colorPaletteMarigoldBorder2),
    boxShadow: tokens.shadow4,
    overflow: 'visible'
  },
  popularBadge: {
    position: 'absolute',
    top: '-12px',
    right: tokens.spacingHorizontalM,
    zIndex: 10,
    boxShadow: tokens.shadow4
  },
  priceSection: {
    marginVertical: tokens.spacingVerticalM,
    display: 'flex',
    alignItems: 'baseline',
    gap: tokens.spacingHorizontalXS
  },
  featureList: {
    listStyleType: 'none',
    ...shorthands.padding(0),
    ...shorthands.margin(tokens.spacingVerticalM, 0),
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS
  },
  featureItem: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    fontSize: tokens.fontSizeBase300
  },
  checkIcon: {
    color: tokens.colorPaletteGreenForeground1,
    flexShrink: 0
  },
  crossIcon: {
    color: tokens.colorNeutralForeground4,
    flexShrink: 0
  },
  devActionSection: {
    marginTop: tokens.spacingVerticalM,
    ...shorthands.padding(tokens.spacingVerticalS, tokens.spacingHorizontalM),
    backgroundColor: tokens.colorNeutralBackground3,
    ...shorthands.borderRadius(tokens.borderRadiusSmall),
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.spacingHorizontalM
  }
});

export const SubscriptionModal: React.FC = () => {
  const styles = useStyles();
  const language = useLanguageStore((s) => s.language);
  const isDemo = useAuthStore((s) => s.isDemo);
  const isTagalog = language === 'tl';

  const {
    tier: currentTier,
    subscriptionEndDate,
    daysRemaining,
    isUpgradeModalOpen,
    closeUpgradeModal,
    refreshSubscription,
    confirmCheckoutSession,
    createCheckoutSession,
    simulateMockPayment,
    isLoading,
    error
  } = useSubscriptionStore();

  const [cycle, setCycle] = useState<BillingCycle>('Monthly');
  const [processingTier, setProcessingTier] = useState<PlanTier | null>(null);
  const [qrModalTier, setQrModalTier] = useState<'TindahanPro' | 'NegosyoPlus' | null>(null);
  const handleCloseQrModal = useCallback(() => {
    setQrModalTier(null);
    if (typeof window !== 'undefined' && localStorage.getItem('fluent_last_checkout_session_id')) {
      void confirmCheckoutSession().then(() => refreshSubscription());
    }
  }, [confirmCheckoutSession, refreshSubscription]);
  const isRefreshError = error === SUBSCRIPTION_REFRESH_ERROR;
  const displayedError = getLocalizedSyncErrorMessage(error, language) || error;

  const runTierAction = async (targetTier: PlanTier, action: () => Promise<void>) => {
    setProcessingTier(targetTier);
    try {
      await action();
    } catch {
      // Error is stored in Zustand
    } finally {
      setProcessingTier(null);
    }
  };

  const handleCheckout = async (targetTier: PlanTier) => {
    await runTierAction(targetTier, async () => {
      const checkoutUrl = await createCheckoutSession(targetTier, cycle);
      if (checkoutUrl) {
        window.location.href = checkoutUrl;
      }
    });
  };

  const handleSimulatePayment = async (targetTier: PlanTier) => {
    await runTierAction(targetTier, () => simulateMockPayment(targetTier, cycle));
  };

  const cycleUnitText = cycle === 'Weekly'
    ? (isTagalog ? '/ linggo' : '/ week')
    : (isTagalog ? '/ buwan' : '/ month');

  const renderActiveBadge = (targetTier: PlanTier) =>
    currentTier === targetTier ? (
      <Badge color="success" appearance="filled">
        {isTagalog ? 'Aktibo' : 'Active'}
      </Badge>
    ) : null;

  const renderPaidTierActions = (
    targetTier: 'TindahanPro' | 'NegosyoPlus',
    extendLabel: string,
    upgradeLabel: string
  ) => (
    <div className={styles.tierActionSection}>
      <Button
        appearance="primary"
        icon={<QrCodeRegular />}
        disabled={isLoading && processingTier === targetTier}
        onClick={() => setQrModalTier(targetTier)}
      >
        {isTagalog ? 'Magbayad gamit ang QR Ph' : 'Pay via QR Ph'}
      </Button>
      <Button
        appearance="secondary"
        icon={<CreditCardPersonRegular />}
        disabled={isLoading && processingTier === targetTier}
        onClick={() => handleCheckout(targetTier)}
      >
        {isLoading && processingTier === targetTier ? (
          <Spinner size="tiny" />
        ) : currentTier === targetTier ? (
          extendLabel
        ) : (
          upgradeLabel
        )}
      </Button>
      {IS_MOCK_PAYMENT_ENABLED && (
        <Button
          appearance="subtle"
          size="small"
          icon={<SparkleRegular />}
          onClick={() => handleSimulatePayment(targetTier)}
        >
          {isTagalog ? 'Subukan (Simulate Test)' : 'Simulate Test Upgrade'}
        </Button>
      )}
    </div>
  );

  if (!isUpgradeModalOpen) return null;

  return (
    <>
      <Dialog open={isUpgradeModalOpen} onOpenChange={(_, data) => !data.open && closeUpgradeModal()}>
      <DialogSurface className={styles.surface}>
        <DialogTitle className={styles.headerContainer}>
          <div>
            <Text weight="bold" size={600}>
              {isTagalog ? 'Mga Plano at Subscription ng Tindahan' : 'Tindahan Subscription Plans'}
            </Text>
            <br />
            <Text size={300} style={{ color: tokens.colorNeutralForeground3 }}>
              {isTagalog
                ? 'Piliin ang swak na sachet o buwanang plano para sa iyong negosyo'
                : 'Select the right sachet weekly or monthly plan for your store'}
            </Text>
          </div>
          <Button
            appearance="subtle"
            icon={<DismissRegular />}
            onClick={closeUpgradeModal}
            aria-label="Close"
          />
        </DialogTitle>

        <DialogBody>
          <DialogContent>
            {error && !isDemo && (
              <MessageBar intent={isRefreshError ? 'warning' : 'error'} style={{ marginBottom: tokens.spacingVerticalM }}>
                <MessageBarBody>
                  {isRefreshError
                    ? (isTagalog
                      ? 'Hindi ma-refresh ang detalye ng subscription. Ipinapakita pa rin ang mga plano at presyo gamit ang huling na-save na plano.'
                      : 'Subscription details could not be refreshed. Plans and prices are still available using your saved plan.')
                    : displayedError}
                </MessageBarBody>
                {isRefreshError && (
                  <Button
                    appearance="subtle"
                    size="small"
                    disabled={isLoading}
                    onClick={() => void refreshSubscription()}
                  >
                    {isTagalog ? 'Subukan muli' : 'Retry'}
                  </Button>
                )}
              </MessageBar>
            )}

            {currentTier === 'Libre' && (
              <div style={{ marginBottom: tokens.spacingVerticalM, display: 'flex', justifyContent: 'flex-end' }}>
                <Button
                  appearance="subtle"
                  size="small"
                  disabled={isLoading}
                  onClick={async () => {
                    const upgraded = await confirmCheckoutSession();
                    if (upgraded) {
                      closeUpgradeModal();
                    } else {
                      await refreshSubscription();
                    }
                  }}
                >
                  {isTagalog ? 'Nakatapos na ng bayad? I-verify ang status' : 'Already paid? Verify subscription'}
                </Button>
              </div>
            )}

            {/* Cycle Toggle */}
            <div className={styles.cycleToggle}>
              <Button
                appearance={cycle === 'Weekly' ? 'primary' : 'secondary'}
                onClick={() => setCycle('Weekly')}
                size="medium"
              >
                {isTagalog ? 'Lingguhan (Sachet Pass)' : 'Weekly Pass (Sachet)'}
              </Button>
              <Button
                appearance={cycle === 'Monthly' ? 'primary' : 'secondary'}
                onClick={() => setCycle('Monthly')}
                size="medium"
              >
                {isTagalog ? 'Buwanan (Mas Matipid ⭐)' : 'Monthly (Best Value ⭐)'}
              </Button>
            </div>

            {/* Current Active Plan Notice */}
            {currentTier !== 'Libre' && (
              <div style={{ marginBottom: tokens.spacingVerticalM }}>
                <Badge color="success" size="large">
                  {isTagalog ? 'Aktibong Plano:' : 'Active Plan:'} {currentTier}
                  {daysRemaining !== null && ` (${daysRemaining} ${isTagalog ? 'araw natitira' : 'days left'})`}
                  {subscriptionEndDate && ` — ${new Date(subscriptionEndDate).toLocaleDateString()}`}
                </Badge>
              </div>
            )}

            {/* Cards Grid */}
            <div className={styles.cardsGrid}>
              {/* LIBRE */}
              <Card className={mergeClasses(styles.tierCard, currentTier === 'Libre' && styles.activeTierCard)} style={{ overflow: 'visible' }}>
                <div>
                  <div className={styles.cardHeader}>
                    <Text weight="bold" size={500}>Libre</Text>
                    {currentTier === 'Libre' && (
                      <Badge color="informative" appearance="filled">
                        {isTagalog ? 'Kasalukuyan' : 'Current'}
                      </Badge>
                    )}
                  </div>
                  <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
                    {isTagalog ? 'Para sa sari-sari store na nagsisimula' : 'For single-owner micro tindahans'}
                  </Text>

                  <div className={styles.priceSection}>
                    <Text size={700} weight="bold">{formatPeso(0)}</Text>
                    <Text size={300} style={{ color: tokens.colorNeutralForeground3 }}>
                      {isTagalog ? '/ habangbuhay' : '/ forever'}
                    </Text>
                  </div>

                  <ul className={styles.featureList}>
                    <li className={styles.featureItem}>
                      <CheckmarkRegular className={styles.checkIcon} />
                      <span>{isTagalog ? 'Hanggang 30 paninda' : 'Up to 30 product items'}</span>
                    </li>
                    <li className={styles.featureItem}>
                      <CheckmarkRegular className={styles.checkIcon} />
                      <span>{isTagalog ? 'Hanggang 30 may utang (suki)' : 'Up to 30 debtor accounts'}</span>
                    </li>
                    <li className={styles.featureItem}>
                      <CheckmarkRegular className={styles.checkIcon} />
                      <span>{isTagalog ? '30 GCash logs / buwan' : '30 GCash txns / month'}</span>
                    </li>
                    <li className={styles.featureItem}>
                      <CheckmarkRegular className={styles.checkIcon} />
                      <span>{isTagalog ? '1 device (offline-first PWA)' : '1 device (offline PWA)'}</span>
                    </li>
                    <li className={styles.featureItem}>
                      <DismissRegular className={styles.crossIcon} />
                      <span style={{ color: tokens.colorNeutralForeground4 }}>
                        {isTagalog ? 'Walang CSV bulk import' : 'No CSV catalog import'}
                      </span>
                    </li>
                    <li className={styles.featureItem}>
                      <DismissRegular className={styles.crossIcon} />
                      <span style={{ color: tokens.colorNeutralForeground4 }}>
                        {isTagalog ? 'May watermark sa resibo' : 'Watermarked receipts'}
                      </span>
                    </li>
                  </ul>
                </div>

                <Button
                  disabled={currentTier === 'Libre'}
                  appearance="secondary"
                  style={{ marginTop: tokens.spacingVerticalM }}
                >
                  {currentTier === 'Libre' ? (isTagalog ? 'Kasalukuyang Plano' : 'Current Plan') : (isTagalog ? 'Pumili ng Libre' : 'Select Free')}
                </Button>
              </Card>

              {/* TINDAHAN PRO */}
              <Card
                className={mergeClasses(
                  styles.tierCard,
                  styles.popularTierCard,
                  currentTier === 'TindahanPro' && styles.activeTierCard
                )}
                style={{ overflow: 'visible' }}
              >
                <Badge color="warning" appearance="filled" className={styles.popularBadge} icon={<StarFilled />}>
                  {isTagalog ? 'Pinakasulit / Popular' : 'Most Popular'}
                </Badge>
                <div>
                  <div className={styles.cardHeader}>
                    <Text weight="bold" size={500} style={{ color: tokens.colorBrandForeground1 }}>
                      Tindahan Pro
                    </Text>
                    {renderActiveBadge('TindahanPro')}
                  </div>
                  <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
                    {isTagalog ? 'Para sa lumalakas na benta at aktibong GCash agent' : 'For busy stores & high-volume GCash agents'}
                  </Text>

                  <div className={styles.priceSection}>
                    <Text size={700} weight="bold">
                      {formatPeso(cycle === 'Weekly' ? 35 : 129)}
                    </Text>
                    <Text size={300} style={{ color: tokens.colorNeutralForeground3 }}>
                      {cycleUnitText}
                    </Text>
                  </div>

                  <ul className={styles.featureList}>
                    <li className={styles.featureItem}>
                      <CheckmarkRegular className={styles.checkIcon} />
                      <Text weight="semibold">{isTagalog ? 'Walang limitasyong paninda' : 'Unlimited products'}</Text>
                    </li>
                    <li className={styles.featureItem}>
                      <CheckmarkRegular className={styles.checkIcon} />
                      <Text weight="semibold">{isTagalog ? 'Walang limitasyong may utang' : 'Unlimited debtors'}</Text>
                    </li>
                    <li className={styles.featureItem}>
                      <CheckmarkRegular className={styles.checkIcon} />
                      <Text weight="semibold">{isTagalog ? 'Walang limitasyong GCash logs' : 'Unlimited GCash logs'}</Text>
                    </li>
                    <li className={styles.featureItem}>
                      <CheckmarkRegular className={styles.checkIcon} />
                      <span>{isTagalog ? 'Hanggang 2 sabay na devices' : 'Up to 2 synced devices'}</span>
                    </li>
                    <li className={styles.featureItem}>
                      <CheckmarkRegular className={styles.checkIcon} />
                      <span>{isTagalog ? 'Mabilis na CSV Catalog Import' : 'Fast CSV catalog bulk import'}</span>
                    </li>
                    <li className={styles.featureItem}>
                      <CheckmarkRegular className={styles.checkIcon} />
                      <span>{isTagalog ? 'Tatak ng tindahan sa resibo (walang watermark)' : 'Custom store-branded receipts'}</span>
                    </li>
                    <li className={styles.featureItem}>
                      <CheckmarkRegular className={styles.checkIcon} />
                      <span>{isTagalog ? 'Detalyadong tubo at margin analytics' : 'Full profit & margin analytics'}</span>
                    </li>
                  </ul>
                </div>

                {renderPaidTierActions(
                  'TindahanPro',
                  isTagalog ? 'Palawigin ang Pro' : 'Extend Pro',
                  isTagalog ? 'Mag-upgrade sa Pro' : 'Upgrade to Pro'
                )}
              </Card>

              {/* NEGOSYO PLUS */}
              <Card
                className={mergeClasses(styles.tierCard, currentTier === 'NegosyoPlus' && styles.activeTierCard)}
                style={{ overflow: 'visible' }}
              >
                <div>
                  <div className={styles.cardHeader}>
                    <Text weight="bold" size={500}>Negosyo Plus</Text>
                    {renderActiveBadge('NegosyoPlus')}
                  </div>
                  <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
                    {isTagalog ? 'Para sa minimart o tindahan na may tauhan / tindera' : 'For minimarts & stores with staff helpers'}
                  </Text>

                  <div className={styles.priceSection}>
                    <Text size={700} weight="bold">
                      {formatPeso(cycle === 'Weekly' ? 89 : 349)}
                    </Text>
                    <Text size={300} style={{ color: tokens.colorNeutralForeground3 }}>
                      {cycleUnitText}
                    </Text>
                  </div>

                  <ul className={styles.featureList}>
                    <li className={styles.featureItem}>
                      <CheckmarkRegular className={styles.checkIcon} />
                      <Text weight="semibold">{isTagalog ? 'Lahat ng Pro features kasama' : 'All Pro features included'}</Text>
                    </li>
                    <li className={styles.featureItem}>
                      <CheckmarkRegular className={styles.checkIcon} />
                      <Text weight="semibold">{isTagalog ? 'Hanggang 5 Staff / Tindera accounts' : 'Up to 5 Staff accounts'}</Text>
                    </li>
                    <li className={styles.featureItem}>
                      <CheckmarkRegular className={styles.checkIcon} />
                      <span>{isTagalog ? 'Staff Role Permissions (Tago ang tubo)' : 'Staff RBAC (Hides profit metrics)'}</span>
                    </li>
                    <li className={styles.featureItem}>
                      <CheckmarkRegular className={styles.checkIcon} />
                      <span>{isTagalog ? 'Hanggang 4 sabay na devices' : 'Up to 4 synced devices'}</span>
                    </li>
                    <li className={styles.featureItem}>
                      <CheckmarkRegular className={styles.checkIcon} />
                      <span>{isTagalog ? 'Audit Trail (Sino ang nag-benta)' : 'Audit trail & shift activity logs'}</span>
                    </li>
                    <li className={styles.featureItem}>
                      <CheckmarkRegular className={styles.checkIcon} />
                      <span>{isTagalog ? 'Priority Support at Remote Recovery' : 'Priority support & remote recovery'}</span>
                    </li>
                  </ul>
                </div>

                {renderPaidTierActions(
                  'NegosyoPlus',
                  isTagalog ? 'Palawigin ang Negosyo Plus' : 'Extend Negosyo Plus',
                  isTagalog ? 'Mag-upgrade sa Negosyo' : 'Upgrade to Negosyo'
                )}
              </Card>
            </div>

            {/* Note on PayMongo payment methods */}
            <div className={styles.devActionSection}>
              <Text size={200}>
                {isTagalog
                  ? '🔒 Tumatanggap ng GCash, Maya, ShopeePay, GrabPay, Card, at 7-Eleven via PayMongo gateway.'
                  : '🔒 Accepts GCash, Maya, ShopeePay, GrabPay, Cards, and 7-Eleven via PayMongo gateway.'}
              </Text>
            </div>
          </DialogContent>

          <DialogActions>
            <Button appearance="subtle" onClick={closeUpgradeModal}>
              {isTagalog ? 'Isara' : 'Close'}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>

      {qrModalTier && (
        <QrPhSubscriptionDialog
          open={Boolean(qrModalTier)}
          onClose={handleCloseQrModal}
          targetTier={qrModalTier}
          cycle={cycle}
          amount={
            qrModalTier === 'TindahanPro'
              ? (cycle === 'Weekly' ? 35 : 129)
              : (cycle === 'Weekly' ? 89 : 349)
          }
        />
      )}
    </>
  );
};
