import React, { useState, useEffect } from 'react';
import {
  makeStyles,
  tokens,
  shorthands,
  Text,
  Input,
  Button,
  Card,
  Badge,
  Divider
} from '@fluentui/react-components';
import {
  ArrowSyncRegular,
  DeleteRegular,
  ArrowClockwiseRegular,
  CloudArrowDownRegular,
  DatabaseRegular,
  SignOutRegular,
  GlobeRegular,
  WeatherSunnyRegular,
  WeatherMoonRegular,
  DesktopRegular,
  PrintRegular,
  PhoneLaptopRegular,
  ArrowDownloadRegular,
  SparkleRegular
} from '@fluentui/react-icons';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { useThemeStore } from '../state/themeStore';
import { usePrinterStore } from '../state/printerStore';
import { DEFAULT_GCASH_FEE_TIERS, GCASH_FEE_BRACKETS, useGCashFeeStore } from '../state/gcashFeeStore';
import { usePwaStore } from '../state/pwaStore';
import { useSubscriptionStore } from '../state/subscriptionStore';
import { printThermalReceipt } from '../services/receiptPrinter';
import {
  useSyncStore,
  processSyncQueue,
  updateQueueCounts,
  retryDeadLetterItem,
  clearDeadLetterQueue,
  pullCatalogFromServer
} from '../sync/syncEngine';
import { useAuthStore } from '../state/authStore';
import { apiClient } from '../services/apiClient';
import { seedDexieDatabaseIfNeeded } from '../db/seedData';
import { useTranslation } from '../state/languageStore';

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

export const SettingsPage: React.FC = () => {
  const styles = useStyles();
  const { isOnline, isSyncing, lastSyncedAt, pendingCount, deadLetterCount } = useSyncStore();
  const { tenantId, userId, businessName, logout, role } = useAuthStore();
  const { t, language, setLanguage } = useTranslation();
  const { themeMode, setThemeMode } = useThemeStore();
  const { paperWidth, setPaperWidth } = usePrinterStore();
  const gcashFees = useGCashFeeStore((state) => state.feesByTenant[tenantId] || DEFAULT_GCASH_FEE_TIERS);
  const setGcashFee = useGCashFeeStore((state) => state.setFeeForTenant);
  const [gcashFeeDrafts, setGcashFeeDrafts] = useState<Record<string, string>>({});
  const { isStandalone, isInstalled, isInstallable, isIos, promptInstall } = usePwaStore();
  const { tier, subscriptionEndDate, daysRemaining, openUpgradeModal } = useSubscriptionStore();

  const handleTestPrint = () => {
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
    window.alert(t.settings.printerTestSuccess);
  };

  const [storageEstimate, setStorageEstimate] = useState<{ usage: number; quota: number } | null>(null);
  const [isPersisted, setIsPersisted] = useState<boolean | null>(null);

  const pendingItemsResult = useLiveQuery(() => db.syncQueue.toArray(), []);
  const deadLetterItemsResult = useLiveQuery(() => db.deadLetterQueue.toArray(), []);
  const pendingItems = pendingItemsResult || [];
  const deadLetterItems = deadLetterItemsResult || [];
  const displayedPendingCount = Math.max(pendingCount, pendingItems.length);

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
    await processSyncQueue();
  };

  const handlePullCatalog = async () => {
    const count = await pullCatalogFromServer();
    window.alert(`${t.settings.pullSuccessAlert} (${count})`);
  };

  const handleResetSeed = async () => {
    if (window.confirm(t.settings.resetSeedConfirm)) {
      await db.products.clear();
      await db.customers.clear();
      await db.sales.clear();
      await db.saleItems.clear();
      await db.utangLedger.clear();
      await db.gcashTxns.clear();
      await db.gcashTxnResolutions.clear();
      await db.syncQueue.clear();
      await db.deadLetterQueue.clear();
      await seedDexieDatabaseIfNeeded(true);
      window.alert(t.settings.resetSuccess);
    }
  };

  const handleWipeDatabaseOnLogout = async () => {
    if (confirm(t.settings.wipeConfirm)) {
      try {
        await apiClient.post('/billing/reset');
      } catch (err) {
        console.warn('Backend billing reset skipped or unavailable:', err);
      }
      await db.delete();
      localStorage.clear();
      sessionStorage.clear();
      logout();
      window.location.reload();
    }
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
      </Card>

      {/* GCash Transaction Fee Settings */}
      {role === 'Owner' && (
      <Card className={styles.card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <PhoneLaptopRegular fontSize={20} />
          <Text weight="bold" size={400}>{t.settings.gcashFeeSection}</Text>
        </div>
        <Text size={200} style={{ color: tokens.colorNeutralForeground3, marginBottom: '12px', display: 'block' }}>
          {t.settings.gcashFeeDesc}
        </Text>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '8px 4px', borderBottom: `1px solid ${tokens.colorNeutralStroke2}` }}>
                {t.settings.gcashFeeRange}
              </th>
              <th style={{ textAlign: 'left', padding: '8px 4px', borderBottom: `1px solid ${tokens.colorNeutralStroke2}` }}>
                {t.settings.gcashFixedFee}
              </th>
            </tr>
          </thead>
          <tbody>
            {GCASH_FEE_BRACKETS.map((bracket, index) => {
              const draftKey = `${tenantId}:${index}`;
              return (
                <tr key={bracket.label}>
                  <td style={{ padding: '6px 4px', borderBottom: `1px solid ${tokens.colorNeutralStroke2}` }}>
                    {bracket.label}
                  </td>
                  <td style={{ padding: '6px 4px', borderBottom: `1px solid ${tokens.colorNeutralStroke2}` }}>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      aria-label={`${t.settings.gcashFixedFee} ${bracket.label}`}
                      contentBefore="₱"
                      value={gcashFeeDrafts[draftKey] ?? String(gcashFees[index])}
                      onChange={(_, data) => {
                        setGcashFeeDrafts((drafts) => ({ ...drafts, [draftKey]: data.value }));
                        const fee = Number(data.value);
                        if (data.value.trim() !== '' && Number.isFinite(fee) && fee >= 0 && fee <= 100000) {
                          setGcashFee(tenantId, index, fee);
                        }
                      }}
                      onBlur={() => {
                        const draft = gcashFeeDrafts[draftKey];
                        if (draft !== undefined) {
                          const fee = Number(draft);
                          if (draft.trim() !== '' && Number.isFinite(fee) && fee >= 0 && fee <= 100000) {
                            setGcashFee(tenantId, index, fee);
                          }
                          setGcashFeeDrafts((drafts) => {
                            const nextDrafts = { ...drafts };
                            delete nextDrafts[draftKey];
                            return nextDrafts;
                          });
                        }
                      }}
                      style={{ width: '120px' }}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
      )}

      {/* SaaS Subscription & Plan Management */}
      <Card className={styles.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <SparkleRegular fontSize={20} color={tokens.colorPaletteGoldForeground2} />
            <Text weight="bold" size={400}>{t.subscription.planSection}</Text>
          </div>
          <Badge
            appearance="filled"
            color={tier === 'NegosyoPlus' ? 'important' : tier === 'TindahanPro' ? 'warning' : 'informative'}
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
                <Badge appearance="tint" color={daysRemaining <= 3 ? 'danger' : 'success'}>
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
            {tier === 'Libre' ? '50 max' : t.subscription.unlimited}
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

      {/* Account & Multi-tenant isolation */}
      <Card className={styles.card}>
        <Text weight="bold" size={400} style={{ marginBottom: '8px', display: 'block' }}>
          {t.settings.deviceInfoSection}
        </Text>
        <div className={styles.infoRow}>
          <Text size={200}>{t.settings.storeNameLabel}</Text>
          <Text size={200} weight="bold">{businessName}</Text>
        </div>
        <div className={styles.infoRow}>
          <Text size={200}>{t.settings.tenantId}:</Text>
          <Text size={200} style={{ fontFamily: 'monospace' }}>{tenantId}</Text>
        </div>
        <div className={styles.infoRow}>
          <Text size={200}>{t.settings.userId}:</Text>
          <Text size={200} style={{ fontFamily: 'monospace' }}>{userId}</Text>
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
          <Badge appearance="tint" color={isPersisted ? 'success' : 'warning'}>
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
              Last sync: {lastSyncedAt ? lastSyncedAt.toLocaleTimeString() : 'Never'}
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
              onClick={() => clearDeadLetterQueue()}
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
                  <Button
                    size="small"
                    appearance="subtle"
                    icon={<ArrowClockwiseRegular />}
                    onClick={() => retryDeadLetterItem(item.id)}
                  >
                    {t.settings.retryBtn}
                  </Button>
                </div>
                <div style={{ color: tokens.colorPaletteRedForeground1, fontSize: '11px', marginTop: '2px' }}>
                  {item.errorMessage}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Cloud & Data Management */}
      <Card className={styles.card}>
        <Text weight="bold" size={400} style={{ marginBottom: '8px', display: 'block' }}>
          {t.settings.dataManagement}
        </Text>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <Button
            appearance="secondary"
            icon={<CloudArrowDownRegular />}
            onClick={handlePullCatalog}
          >
            {t.settings.pullCatalogBtn}
          </Button>

          <Button
            appearance="secondary"
            icon={<ArrowClockwiseRegular />}
            onClick={handleResetSeed}
          >
            {t.settings.resetSeedBtn}
          </Button>

          <Button
            appearance="subtle"
            style={{ color: tokens.colorPaletteRedForeground1 }}
            icon={<SignOutRegular />}
            onClick={handleWipeDatabaseOnLogout}
          >
            {t.settings.wipeDatabaseBtn}
          </Button>
        </div>
      </Card>
    </div>
  );
};
