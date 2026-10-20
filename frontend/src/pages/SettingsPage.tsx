import React, { useState, useEffect, useCallback } from 'react';
import {
  makeStyles,
  tokens,
  shorthands,
  Text,
  Button,
  Card,
  Badge,
  Divider,
  Dialog,
  DialogSurface,
  DialogTitle,
  DialogBody,
  DialogContent,
  DialogActions
} from '@fluentui/react-components';
import {
  ArrowSyncRegular,
  DeleteRegular,
  ArrowClockwiseRegular,
  DatabaseRegular,
  SignOutRegular,
  GlobeRegular,
  WeatherSunnyRegular,
  WeatherMoonRegular,
  DesktopRegular,
  PrintRegular,
  PhoneLaptopRegular,
  ArrowDownloadRegular,
  SparkleRegular,
  EditRegular,
  ShieldCheckmarkRegular,
  InfoRegular,
  DocumentCheckmarkRegular,
  BoxRegular,
  KeyRegular,
  LockClosedRegular,
  OpenRegular
} from '@fluentui/react-icons';
import type { NavTab } from '../components/Navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type DeadLetterRecord } from '../db/db';
import { FixDlqProductDialog } from '../components/FixDlqProductDialog';
import { ConfirmDismissDlqDialog } from '../components/ConfirmDismissDlqDialog';
import { useThemeStore } from '../state/themeStore';
import { usePrinterStore } from '../state/printerStore';
import { usePosSettingsStore } from '../state/posSettingsStore';
import { usePwaStore } from '../state/pwaStore';
import { useSubscriptionStore } from '../state/subscriptionStore';
import { useDisclaimerStore } from '../state/disclaimerStore';
import { useTermsStore } from '../state/termsStore';
import { printThermalReceipt } from '../services/receiptPrinter';
import {
  useSyncStore,
  processSyncQueue,
  updateQueueCounts,
  retryDeadLetterItem,
  deleteDeadLetterItem,
  clearDeadLetterQueue
} from '../sync/syncEngine';
import { useAuthStore } from '../state/authStore';
import { useTranslation } from '../state/languageStore';
import { SafeLogoutDialog } from '../components/SafeLogoutDialog';
import { useSafeLogout } from '../components/useSafeLogout';
import { PinManagementDialog } from '../components/PinManagementDialog';
import { DeleteAccountDialog } from '../components/DeleteAccountDialog';
import { ChangePasswordDialog } from '../components/ChangePasswordDialog';
import { GCashFeeSettingsCard } from '../components/GCashFeeSettingsCard';

const useStyles = makeStyles({
  container: {
    ...shorthands.padding(tokens.spacingVerticalM, tokens.spacingHorizontalM),
    maxWidth: '1080px',
    marginLeft: 'auto',
    marginRight: 'auto',
    paddingBottom: '100px'
  },
  card: {
    ...shorthands.padding(tokens.spacingVerticalM, tokens.spacingHorizontalM),
    marginBottom: tokens.spacingVerticalM
  },
  infoRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: tokens.spacingHorizontalS,
    ...shorthands.padding(tokens.spacingVerticalXS, '0')
  },
  queueItem: {
    ...shorthands.padding(tokens.spacingVerticalS, tokens.spacingHorizontalS),
    ...shorthands.borderRadius(tokens.borderRadiusSmall),
    backgroundColor: tokens.colorNeutralBackground2,
    marginBottom: tokens.spacingVerticalS,
    fontSize: tokens.fontSizeBase200
  }
});

export interface SettingsPageProps {
  onNavigate?: (tab: NavTab) => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ onNavigate }) => {
  const styles = useStyles();
  const { isOnline, isSyncing, lastSyncedAt, pendingCount, deadLetterCount } = useSyncStore();
  const {
    tenantId,
    userId,
    businessName,
    ownerName,
    userPhone,
    userEmail,
    hasPin,
    setIsSessionLocked,
    openOnboarding,
    role
  } = useAuthStore();
  const { t, language, setLanguage } = useTranslation();
  const { themeMode, setThemeMode } = useThemeStore();
  const { paperWidth, setPaperWidth } = usePrinterStore();
  const { stockValidationPolicy, setStockValidationPolicy } = usePosSettingsStore();
  const { isStandalone, isInstalled, isInstallable, isIos, promptInstall } = usePwaStore();
  const { tier, subscriptionEndDate, daysRemaining, openUpgradeModal } = useSubscriptionStore();
  const {
    isLogoutConfirmOpen,
    logoutUnsyncedCount,
    initiateLogout: handleInitiateLogout,
    initiateSwitchAccount: handleInitiateSwitchAccount,
    cancelLogout,
    syncFirst,
    confirmLogout
  } = useSafeLogout({
    onLoggedOut: () => {
      if (onNavigate) {
        onNavigate('login');
      }
    }
  });

  const [printerMessage, setPrinterMessage] = useState<string | null>(null);
  const [storageEstimate, setStorageEstimate] = useState<{ usage: number; quota: number } | null>(null);
  const [isPersisted, setIsPersisted] = useState<boolean | null>(null);

  const handleTestPrint = useCallback(() => {
    const testData = {
      saleId: 'TEST-PRINTER-01',
      date: new Date().toISOString(),
      items: [
        { name: 'Kape 3-in-1', qty: 2, price: 12, subtotal: 24 },
        { name: 'Pandesal', qty: 10, price: 3, subtotal: 30 }
      ],
      totalAmount: 54,
      paymentMethod: 'Cash',
      cashReceived: 100,
      changeGiven: 46
    };
    printThermalReceipt(testData, businessName || "Aling Nena's Tindahan", { paperWidth });
    setPrinterMessage(t.settings.printerTestSuccess);
  }, [businessName, paperWidth, t.settings.printerTestSuccess]);

  const pendingItemsResult = useLiveQuery(() => db.syncQueue.toArray(), []);
  const deadLetterItemsResult = useLiveQuery(() => db.deadLetterQueue.toArray(), []);
  const pendingItems = pendingItemsResult || [];
  const deadLetterItems = deadLetterItemsResult || [];
  const displayedPendingCount = Math.max(pendingCount, pendingItems.length);
  const [selectedDlqProduct, setSelectedDlqProduct] = useState<DeadLetterRecord | null>(null);
  const [itemToDismiss, setItemToDismiss] = useState<DeadLetterRecord | null>(null);
  const [isClearDlqConfirmOpen, setIsClearDlqConfirmOpen] = useState(false);

  const [isPinDialogOpen, setIsPinDialogOpen] = useState(false);
  const [isDeleteAccountOpen, setIsDeleteAccountOpen] = useState(() => {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    return params.get('tab') === 'delete-account' || params.get('intent') === 'delete-account';
  });
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(() => {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    return params.get('tab') === 'change-password' || params.get('intent') === 'change-password';
  });

  useEffect(() => {
    updateQueueCounts().catch(console.error);
    if (navigator.storage && navigator.storage.estimate) {
      navigator.storage.estimate().then((est) => {
        setStorageEstimate({
          usage: Math.round((est.usage || 0) / (1024 * 1024) * 100) / 100,
          quota: Math.round((est.quota || 0) / (1024 * 1024) * 100) / 100
        });
      }).catch(console.error);
    }
    if (navigator.storage && navigator.storage.persisted) {
      navigator.storage.persisted().then(setIsPersisted).catch(console.error);
    }
  }, []);

  const handleForceSync = async () => {
    await processSyncQueue({ force: true });
  };



  return (
    <div className={styles.container}>
      <div style={{ marginBottom: tokens.spacingVerticalM }}>
        <Text size={500} weight="bold">{t.settings.title}</Text>
        <Text size={300} style={{ color: tokens.colorNeutralForeground3, display: 'block' }}>
          {t.settings.subtitle}
        </Text>
      </div>

      {/* Language / Wika Selection */}
      <Card className={styles.card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <GlobeRegular fontSize={20} />
          <Text weight="bold" size={400}>{t.settings.languageSection}</Text>
        </div>
        <Text size={200} style={{ color: tokens.colorNeutralForeground3, marginBottom: '12px', display: 'block' }}>
          {t.settings.languageDesc}
        </Text>
        <div style={{ display: 'flex', gap: '10px' }}>
          <Button
            appearance={language === 'tl' ? 'primary' : 'secondary'}
            onClick={() => setLanguage('tl')}
          >
            {t.settings.taglish}
          </Button>
          <Button
            appearance={language === 'en' ? 'primary' : 'secondary'}
            onClick={() => setLanguage('en')}
          >
            {t.settings.english}
          </Button>
        </div>
      </Card>

      {/* Theme / Tema Selection */}
      <Card className={styles.card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <DesktopRegular fontSize={20} />
          <Text weight="bold" size={400}>{t.settings.themeSection}</Text>
        </div>
        <Text size={200} style={{ color: tokens.colorNeutralForeground3, marginBottom: '12px', display: 'block' }}>
          {t.settings.themeDesc}
        </Text>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <Button
            appearance={themeMode === 'light' ? 'primary' : 'secondary'}
            icon={<WeatherSunnyRegular />}
            onClick={() => setThemeMode('light')}
          >
            {t.settings.themeLight}
          </Button>
          <Button
            appearance={themeMode === 'dark' ? 'primary' : 'secondary'}
            icon={<WeatherMoonRegular />}
            onClick={() => setThemeMode('dark')}
          >
            {t.settings.themeDark}
          </Button>
          <Button
            appearance={themeMode === 'system' ? 'primary' : 'secondary'}
            icon={<DesktopRegular />}
            onClick={() => setThemeMode('system')}
          >
            {t.settings.themeSystem}
          </Button>
        </div>
      </Card>

      {/* POS Stock Policy */}
      <Card className={styles.card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <BoxRegular fontSize={20} />
          <Text weight="bold" size={400}>{t.settings.stockPolicySection}</Text>
        </div>
        <Text size={200} style={{ color: tokens.colorNeutralForeground3, marginBottom: '12px', display: 'block' }}>
          {t.settings.stockPolicyDesc}
        </Text>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <Button
              appearance={stockValidationPolicy === 'warn' ? 'primary' : 'secondary'}
              onClick={() => setStockValidationPolicy('warn')}
              data-testid="stock-policy-warn-btn"
            >
              {t.settings.stockPolicyWarn}
            </Button>
            <Button
              appearance={stockValidationPolicy === 'block' ? 'primary' : 'secondary'}
              onClick={() => setStockValidationPolicy('block')}
              data-testid="stock-policy-block-btn"
            >
              {t.settings.stockPolicyBlock}
            </Button>
          </div>
          <Text size={200} style={{ color: tokens.colorNeutralForeground2, fontStyle: 'italic' }}>
            {stockValidationPolicy === 'warn'
              ? t.settings.stockPolicyWarnDesc
              : t.settings.stockPolicyBlockDesc}
          </Text>
        </div>
      </Card>

      {/* Receipt & Printer Device Settings */}
      <Card className={styles.card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <PrintRegular fontSize={20} />
          <Text weight="bold" size={400}>{t.settings.printerSection}</Text>
        </div>
        <Text size={200} style={{ color: tokens.colorNeutralForeground3, marginBottom: '12px', display: 'block' }}>
          {t.settings.printerDesc}
        </Text>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
          <Text size={200}>{t.settings.printerPaperWidth}:</Text>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button
              size="small"
              appearance={paperWidth === '58mm' ? 'primary' : 'secondary'}
              onClick={() => setPaperWidth('58mm')}
            >
              58mm (Mini POS)
            </Button>
            <Button
              size="small"
              appearance={paperWidth === '80mm' ? 'primary' : 'secondary'}
              onClick={() => setPaperWidth('80mm')}
            >
              80mm (Standard POS)
            </Button>
          </div>
        </div>
        <Button
          appearance="secondary"
          icon={<PrintRegular />}
          onClick={handleTestPrint}
        >
          {t.settings.printerTestBtn}
        </Button>
        {printerMessage && (
          <Text
            role="status"
            size={200}
            style={{
              color: tokens.colorPaletteGreenForeground1,
              display: 'block',
              marginTop: '8px',
              fontWeight: 600
            }}
          >
            ✓ {printerMessage}
          </Text>
        )}
      </Card>

      {/* GCash Transaction Fee Settings */}
      <GCashFeeSettingsCard className={styles.card} role={role} tenantId={tenantId} />

      {/* SaaS Subscription & Plan Management */}
      <Card className={styles.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <SparkleRegular fontSize={20} color={tokens.colorPaletteGoldForeground2} />
            <Text weight="bold" size={400}>{t.subscription.planSection}</Text>
          </div>
          <Badge
            appearance="filled"
            color={tier === 'NegosyoPlus' ? 'important' : tier === 'TindahanPro' ? 'warning' : 'informative'}
            style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
          >
            {tier === 'NegosyoPlus' ? 'NEGOSYO+' : tier === 'TindahanPro' ? 'PRO' : 'LIBRE'}
          </Badge>
        </div>

        <Text size={200} style={{ color: tokens.colorNeutralForeground3, marginBottom: '12px', display: 'block' }}>
          {t.subscription.planDesc}
        </Text>

        <div className={styles.infoRow}>
          <Text size={200}>{t.subscription.currentPlan}</Text>
          <Text size={200} weight="bold">
            {tier === 'NegosyoPlus' ? t.subscription.plusTier : tier === 'TindahanPro' ? t.subscription.proTier : t.subscription.libreTier}
          </Text>
        </div>

        {tier !== 'Libre' && subscriptionEndDate && (
          <>
            <div className={styles.infoRow}>
              <Text size={200}>{t.subscription.expiresOn}</Text>
              <Text size={200} style={{ fontFamily: 'monospace' }}>
                {new Date(subscriptionEndDate).toLocaleDateString()}
              </Text>
            </div>
            {daysRemaining !== null && (
              <div className={styles.infoRow}>
                <Text size={200}>{t.subscription.daysRemaining}</Text>
                <Badge appearance="tint" color={daysRemaining <= 3 ? 'danger' : 'success'} style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {daysRemaining} {daysRemaining === 1 ? 'araw / day' : 'araw / days'}
                </Badge>
              </div>
            )}
          </>
        )}

        <Divider style={{ margin: '8px 0' }} />

        <Text size={200} weight="semibold" style={{ marginBottom: '6px', display: 'block' }}>
          {t.subscription.limitsTitle}
        </Text>

        <div className={styles.infoRow}>
          <Text size={200}>{t.subscription.productLimit}</Text>
          <Text size={200}>
            {tier === 'Libre' ? '30 max' : t.subscription.unlimited}
          </Text>
        </div>

        <div className={styles.infoRow}>
          <Text size={200}>{t.subscription.debtorLimit}</Text>
          <Text size={200}>
            {tier === 'Libre' ? '30 max' : t.subscription.unlimited}
          </Text>
        </div>

        <div className={styles.infoRow}>
          <Text size={200}>{t.subscription.gcashLimit}</Text>
          <Text size={200}>
            {tier === 'Libre' ? '30 / buwan (month)' : t.subscription.unlimited}
          </Text>
        </div>

        <div className={styles.infoRow}>
          <Text size={200}>{t.subscription.csvImportStatus}</Text>
          <Text size={200} style={{ color: tier === 'Libre' ? tokens.colorNeutralForeground4 : tokens.colorPaletteGreenForeground1 }}>
            {tier === 'Libre' ? t.subscription.lockedForLibre : t.subscription.unlocked}
          </Text>
        </div>

        <div style={{ marginTop: '12px' }}>
          <Button
            appearance="primary"
            icon={<SparkleRegular />}
            onClick={() => openUpgradeModal()}
          >
            {tier === 'Libre' ? t.subscription.upgradeBtn : t.subscription.managePlanBtn}
          </Button>
        </div>
      </Card>



      {/* Progressive Web App (PWA) System */}
      <Card className={styles.card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <PhoneLaptopRegular fontSize={20} />
          <Text weight="bold" size={400}>{t.pwa.pwaSection}</Text>
        </div>
        <Text size={200} style={{ color: tokens.colorNeutralForeground3, marginBottom: '12px', display: 'block' }}>
          {t.pwa.pwaDesc}
        </Text>

        <div className={styles.infoRow}>
          <Text size={200}>{t.pwa.appStatus}</Text>
          <Badge
            appearance="filled"
            color={isStandalone ? 'success' : 'informative'}
            style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
          >
            {isStandalone ? t.pwa.statusInstalled : t.pwa.statusBrowser}
          </Badge>
        </div>

        {isInstallable && !isStandalone && !isInstalled && (
          <div style={{ marginTop: '12px' }}>
            <Button
              appearance="primary"
              icon={<ArrowDownloadRegular />}
              onClick={() => promptInstall()}
            >
              {t.pwa.installBtn}
            </Button>
          </div>
        )}

        {!isInstallable && !isStandalone && !isIos && (
          <div style={{ marginTop: '12px', fontSize: '12px', color: tokens.colorNeutralForeground2, backgroundColor: tokens.colorNeutralBackground2, padding: '10px', borderRadius: '6px', borderLeft: `3px solid ${tokens.colorBrandStroke1}` }}>
            <div style={{ marginBottom: '4px' }}>{t.pwa.browserInstallTip}</div>
            <div style={{ fontSize: '11px', color: tokens.colorNeutralForeground3 }}>{t.pwa.browserInstallNote}</div>
          </div>
        )}

        {isIos && !isStandalone && (
          <div style={{ marginTop: '12px', fontSize: '12px', color: tokens.colorNeutralForeground3, backgroundColor: tokens.colorNeutralBackground2, padding: '8px', borderRadius: '4px' }}>
            <strong>{t.pwa.iosInstructionsTitle}</strong> {t.pwa.iosInstructionsDesc}
          </div>
        )}
      </Card>

      {/* Storage and Offline Resilience */}
      <Card className={styles.card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <DatabaseRegular fontSize={20} />
          <Text weight="bold" size={400}>{t.settings.storageSection}</Text>
        </div>
        <div className={styles.infoRow}>
          <Text size={200}>{t.settings.persistentStorage}:</Text>
          <Badge appearance="tint" color={isPersisted ? 'success' : 'warning'} style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
            {isPersisted ? t.settings.persistentActive : t.settings.persistentInactive}
          </Badge>
        </div>
        {storageEstimate && (
          <div className={styles.infoRow}>
            <Text size={200}>{t.settings.usedStorage}:</Text>
            <Text size={200} weight="bold">
              {storageEstimate.usage} MB / {storageEstimate.quota} MB
            </Text>
          </div>
        )}
      </Card>

      {/* Sync Queue Inspector */}
      <Card className={styles.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <div>
            <Text weight="bold" size={400}>{t.settings.syncSection}</Text>
            <Text size={100} style={{ color: tokens.colorNeutralForeground3, display: 'block' }}>
              Last sync: {lastSyncedAt ? lastSyncedAt.toLocaleString() : 'Never'}
            </Text>
          </div>
          <Button
            appearance="primary"
            icon={<ArrowSyncRegular />}
            size="small"
            disabled={!isOnline || isSyncing}
            onClick={handleForceSync}
          >
            {isSyncing ? t.common.syncing : t.settings.forceSyncBtn}
          </Button>
        </div>

        <Divider style={{ margin: '8px 0' }} />

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
          <Text size={200}>{t.settings.pendingSync}</Text>
          <Badge data-testid="sync-pending-count" appearance="filled" color={displayedPendingCount > 0 ? 'warning' : 'success'}>
            {displayedPendingCount}
          </Badge>
        </div>

        {displayedPendingCount === 0 ? (
          pendingItemsResult === undefined ? (
            <Text size={200} style={{ color: tokens.colorNeutralForeground3, fontStyle: 'italic' }}>
              {language === 'tl' ? 'Sinusuri ang sync queue…' : 'Checking sync queue…'}
            </Text>
          ) : (
            <Text size={200} style={{ color: tokens.colorNeutralForeground3, fontStyle: 'italic' }}>
              {deadLetterCount > 0 || deadLetterItems.length > 0
                ? (language === 'tl' ? 'Walang nakapila, pero may hindi na-sync na item.' : 'No pending items, but some items still need attention.')
                : t.common.allSynced}
            </Text>
          )
        ) : pendingItems.length === 0 ? (
          <Text size={200} style={{ color: tokens.colorPaletteRedForeground1 }}>
            {language === 'tl'
              ? `${displayedPendingCount} item ang nakapila at hindi pa naka-sync. Hindi pa kumpleto ang detalye ng queue.`
              : `${displayedPendingCount} items are queued and not synced. Queue details are still loading.`}
          </Text>
        ) : (
          <div style={{ maxHeight: '160px', overflowY: 'auto' }}>
            {displayedPendingCount > pendingItems.length && (
              <Text size={100} style={{ color: tokens.colorPaletteRedForeground1, display: 'block', marginBottom: '8px' }}>
                {language === 'tl'
                  ? `${displayedPendingCount - pendingItems.length} pang item ang nakapila ngunit hindi pa naipapakita.`
                  : `${displayedPendingCount - pendingItems.length} additional queued items are not shown yet.`}
              </Text>
            )}
            {pendingItems.map((item) => (
              <div key={item.id} className={styles.queueItem}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <strong>{item.entity} ({item.action})</strong>
                  <span>{new Date(item.timestamp).toLocaleTimeString()}</span>
                </div>
                <div style={{ fontSize: '11px', color: tokens.colorNeutralForeground3 }}>
                  ID: {item.payload?.id || item.id} (Attempts: {item.retryCount})
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Dead Letter Queue Inspector */}
      {deadLetterItems.length > 0 && (
        <Card className={styles.card} style={{ borderLeft: `4px solid ${tokens.colorPaletteRedBorderActive}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Text weight="bold" size={400} style={{ color: tokens.colorPaletteRedForeground1 }}>
                {t.settings.dlqTitle}
              </Text>
              <Badge appearance="filled" color="danger">
                {deadLetterItems.length}
              </Badge>
            </div>
            <Button
              size="small"
              appearance="subtle"
              icon={<DeleteRegular />}
              onClick={() => setIsClearDlqConfirmOpen(true)}
            >
              {t.settings.dlqClearBtn}
            </Button>
          </div>

          <Text size={200} style={{ color: tokens.colorNeutralForeground3, marginBottom: '8px', display: 'block' }}>
            {t.settings.dlqDesc}
          </Text>

          <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
            {deadLetterItems.map((item) => (
              <div key={item.id} className={styles.queueItem}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong>{item.entity} ({item.action})</strong>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {item.entity === 'Product' && item.action !== 'Delete' && (
                      <Button
                        size="small"
                        appearance="subtle"
                        icon={<EditRegular />}
                        onClick={() => setSelectedDlqProduct(item)}
                        title={t.settings.dlqEditBtn}
                      >
                        {t.settings.dlqEditBtn}
                      </Button>
                    )}
                    <Button
                      size="small"
                      appearance="subtle"
                      icon={<ArrowClockwiseRegular />}
                      onClick={async () => {
                        const res = await retryDeadLetterItem(item.id);
                        if (res && !res.success && res.requiresEdit && item.entity === 'Product') {
                          setSelectedDlqProduct(item);
                        }
                      }}
                      title={t.settings.retryBtn}
                    >
                      {t.settings.retryBtn}
                    </Button>
                    <Button
                      size="small"
                      appearance="subtle"
                      icon={<DeleteRegular style={{ color: tokens.colorPaletteRedForeground1 }} />}
                      onClick={() => setItemToDismiss(item)}
                      title={t.settings.dlqDismissBtn}
                    >
                      {t.settings.dlqDismissBtn}
                    </Button>
                  </div>
                </div>
                <div style={{ color: tokens.colorPaletteRedForeground1, fontSize: '11px', marginTop: '2px' }}>
                  {item.errorMessage}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Legal & Compliance / Disclaimer */}
      <Card className={styles.card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <ShieldCheckmarkRegular fontSize={20} />
          <Text weight="bold" size={400}>{t.disclaimer.legalCardTitle}</Text>
        </div>
        <Text size={200} style={{ color: tokens.colorNeutralForeground3, marginBottom: '12px', display: 'block' }}>
          {t.disclaimer.legalCardDesc}
        </Text>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          <Button
            appearance="primary"
            icon={<InfoRegular />}
            onClick={() => useDisclaimerStore.getState().openDisclaimer()}
            data-testid="settings-open-disclaimer-btn"
          >
            {t.disclaimer.buttonLabel}
          </Button>
          <Button
            appearance="secondary"
            icon={<ShieldCheckmarkRegular />}
            onClick={() => useAuthStore.getState().openPrivacyNotice()}
            data-testid="settings-open-privacy-btn"
          >
            {t.disclaimer.viewPrivacyBtn}
          </Button>
          <Button
            appearance="secondary"
            icon={<DocumentCheckmarkRegular />}
            onClick={() => useTermsStore.getState().openTerms()}
            data-testid="settings-open-terms-btn"
          >
            {t.disclaimer.viewFullTermsBtn}
          </Button>
          {onNavigate && (
            <Button
              appearance="secondary"
              icon={<OpenRegular />}
              onClick={() => onNavigate('landing')}
              data-testid="settings-open-landing-btn"
            >
              {language === 'tl' ? 'Tingnan ang Landing Page' : 'View Landing Page'}
            </Button>
          )}
        </div>
      </Card>

      {/* Account & Multi-tenant isolation / Store & Device Details */}
      <Card className={styles.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
          <Text weight="bold" size={400}>
            {t.settings.deviceInfoSection}
          </Text>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button
              appearance="subtle"
              size="small"
              icon={<EditRegular />}
              onClick={() => openOnboarding('edit')}
              style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
            >
              {t.settings.editProfileBtn}
            </Button>
          </div>
        </div>
        <div className={styles.infoRow}>
          <Text size={200}>{t.settings.storeNameLabel}</Text>
          <Text size={200} weight="bold">{businessName}</Text>
        </div>
        {ownerName && (
          <div className={styles.infoRow}>
            <Text size={200}>{t.settings.ownerNameLabel}</Text>
            <Text size={200}>{ownerName}</Text>
          </div>
        )}
        <div className={styles.infoRow}>
          <Text size={200}>{t.settings.emailLabel}</Text>
          <Text size={200} style={{ fontFamily: 'monospace' }}>{userEmail || '—'}</Text>
        </div>
        {userPhone && (
          <div className={styles.infoRow}>
            <Text size={200}>{t.settings.userPhoneLabel}</Text>
            <Text size={200} style={{ fontFamily: 'monospace' }}>{userPhone}</Text>
          </div>
        )}
        <div className={styles.infoRow}>
          <Text size={200}>{t.settings.pinStatusLabel}</Text>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px', flexWrap: 'wrap' }}>
            <Badge
              appearance="tint"
              color={hasPin ? 'success' : 'informative'}
              style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
            >
              {hasPin ? t.settings.pinActive : t.settings.pinInactive}
            </Badge>
            <Button
              size="small"
              appearance="subtle"
              icon={<KeyRegular />}
              style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
              onClick={() => setIsPinDialogOpen(true)}
            >
              {hasPin ? t.settings.changePinBtn : t.settings.setPinBtn}
            </Button>
            {hasPin && (
              <Button
                size="small"
                appearance="subtle"
                icon={<LockClosedRegular />}
                style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
                onClick={() => setIsSessionLocked(true)}
              >
                {t.settings.lockSessionBtn}
              </Button>
            )}
          </div>
        </div>
        <div className={styles.infoRow}>
          <Text size={200}>{t.settings.passwordLabel}</Text>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px', flexWrap: 'wrap' }}>
            <Button
              size="small"
              appearance="subtle"
              icon={<LockClosedRegular />}
              style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
              onClick={() => setIsChangePasswordOpen(true)}
              data-testid="settings-change-password-btn"
            >
              {t.settings.changePasswordBtn}
            </Button>
          </div>
        </div>
        <div className={styles.infoRow}>
          <Text size={200}>{t.settings.tenantId}:</Text>
          <Text size={200} style={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>{tenantId}</Text>
        </div>
        <div className={styles.infoRow}>
          <Text size={200}>{t.settings.userId}:</Text>
          <Text size={200} style={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>{userId}</Text>
        </div>

        <Divider style={{ margin: '12px 0 8px 0' }} />
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <Button
            appearance="secondary"
            size="small"
            icon={<ArrowClockwiseRegular />}
            onClick={handleInitiateSwitchAccount}
          >
            {t.settings.switchAccountBtn}
          </Button>
          <Button
            appearance="subtle"
            size="small"
            style={{ color: tokens.colorPaletteRedForeground1 }}
            icon={<SignOutRegular />}
            onClick={handleInitiateLogout}
          >
            {t.settings.logoutBtn}
          </Button>
          <Button
            appearance="subtle"
            size="small"
            style={{ color: tokens.colorPaletteRedForeground1 }}
            icon={<DeleteRegular />}
            onClick={() => setIsDeleteAccountOpen(true)}
            data-testid="settings-delete-account-btn"
          >
            {t.settings.deleteAccountBtn}
          </Button>
        </div>
      </Card>

      <FixDlqProductDialog
        isOpen={!!selectedDlqProduct}
        item={selectedDlqProduct}
        onClose={() => setSelectedDlqProduct(null)}
      />

      <ConfirmDismissDlqDialog
        isOpen={!!itemToDismiss}
        item={itemToDismiss}
        onClose={() => setItemToDismiss(null)}
        onConfirm={async () => {
          if (itemToDismiss) {
            await deleteDeadLetterItem(itemToDismiss.id);
          }
        }}
      />

      <Dialog
        open={isClearDlqConfirmOpen}
        onOpenChange={(_, data) => !data.open && setIsClearDlqConfirmOpen(false)}
      >
        <DialogSurface>
          <DialogBody>
            <DialogTitle>{t.settings.dlqClearConfirmTitle}</DialogTitle>
            <DialogContent>
              <Text size={300}>{t.settings.dlqClearConfirmDesc}</Text>
              <div style={{ marginTop: '12px' }}>
                <Badge color="danger">
                  {deadLetterItems.length} {language === 'tl' ? 'mga bagsak na transaksyon' : 'failed transactions'}
                </Badge>
              </div>
            </DialogContent>
            <DialogActions
              fluid
              style={{
                gridColumn: '1 / -1',
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'flex-end',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <Button
                appearance="secondary"
                style={{ whiteSpace: 'nowrap' }}
                onClick={() => setIsClearDlqConfirmOpen(false)}
                data-testid="cancel-clear-dlq-btn"
              >
                {t.common.cancel}
              </Button>
              <Button
                appearance="primary"
                style={{
                  backgroundColor: tokens.colorPaletteRedBackground3,
                  color: tokens.colorPaletteRedForegroundInverted,
                  whiteSpace: 'nowrap'
                }}
                onClick={async () => {
                  await clearDeadLetterQueue();
                  setIsClearDlqConfirmOpen(false);
                }}
                data-testid="confirm-clear-dlq-btn"
              >
                {t.settings.dlqClearConfirmBtn}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>

      {/* Quick PIN Dialog */}
      <PinManagementDialog
        open={isPinDialogOpen}
        onOpenChange={setIsPinDialogOpen}
      />

      {/* Change Password Dialog */}
      <ChangePasswordDialog
        open={isChangePasswordOpen}
        onOpenChange={setIsChangePasswordOpen}
      />

      {/* Self-Service Account Deactivation / Deletion Dialog */}
      <DeleteAccountDialog
        open={isDeleteAccountOpen}
        onOpenChange={setIsDeleteAccountOpen}
        onDeleted={() => {
          if (onNavigate) {
            onNavigate('login');
          }
        }}
      />

      <SafeLogoutDialog
        open={isLogoutConfirmOpen}
        unsyncedCount={logoutUnsyncedCount}
        onDismiss={cancelLogout}
        onSyncFirst={syncFirst}
        onConfirmLogout={confirmLogout}
      />
    </div>
  );
};
