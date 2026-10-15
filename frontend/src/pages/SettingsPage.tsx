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
  Divider,
  Dialog,
  DialogSurface,
  DialogTitle,
  DialogBody,
  DialogContent,
  DialogActions,
  Field,
  Spinner
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
  SparkleRegular,
  EditRegular,
  ShieldCheckmarkRegular,
  InfoRegular,
  DocumentCheckmarkRegular,
  BoxRegular,
  KeyRegular,
  LockClosedRegular,
  EyeRegular,
  EyeOffRegular,
  OpenRegular
} from '@fluentui/react-icons';
import type { NavTab } from '../components/Navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type DeadLetterRecord } from '../db/db';
import { FixDlqProductDialog } from '../components/FixDlqProductDialog';
import { ConfirmDismissDlqDialog } from '../components/ConfirmDismissDlqDialog';
import { useThemeStore } from '../state/themeStore';
import { usePrinterStore } from '../state/printerStore';
import { updatePin, generateLocalPinVerifier } from '../services/authService';
import { usePosSettingsStore } from '../state/posSettingsStore';
import { DEFAULT_GCASH_FEE_TIERS, GCASH_FEE_BRACKETS, useGCashFeeStore } from '../state/gcashFeeStore';
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
  clearDeadLetterQueue,
  pullCatalogFromServer
} from '../sync/syncEngine';
import { useAuthStore } from '../state/authStore';
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
    setHasPin,
    setLocalPinVerifier,
    setIsSessionLocked,
    openOnboarding,
    logout,
    role
  } = useAuthStore();
  const { t, language, setLanguage } = useTranslation();
  const { themeMode, setThemeMode } = useThemeStore();
  const { paperWidth, setPaperWidth } = usePrinterStore();
  const { stockValidationPolicy, setStockValidationPolicy } = usePosSettingsStore();
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
  const [selectedDlqProduct, setSelectedDlqProduct] = useState<DeadLetterRecord | null>(null);
  const [itemToDismiss, setItemToDismiss] = useState<DeadLetterRecord | null>(null);
  const [isClearDlqConfirmOpen, setIsClearDlqConfirmOpen] = useState(false);

  const [isPinDialogOpen, setIsPinDialogOpen] = useState(false);
  const [pinDialogPassword, setPinDialogPassword] = useState('');
  const [pinDialogNewPin, setPinDialogNewPin] = useState('');
  const [showPinPassword, setShowPinPassword] = useState(false);
  const [pinDialogError, setPinDialogError] = useState('');
  const [pinDialogSuccess, setPinDialogSuccess] = useState('');
  const [isPinDialogSubmitting, setIsPinDialogSubmitting] = useState(false);

  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);
  const [logoutUnsyncedCount, setLogoutUnsyncedCount] = useState(0);

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
      await db.transaction(
        'rw',
        [
          db.products,
          db.customers,
          db.sales,
          db.saleItems,
          db.utangLedger,
          db.gcashTxns,
          db.gcashTxnResolutions,
          db.syncQueue,
          db.deadLetterQueue
        ],
        async () => {
          await db.products.where('tenantId').equals(tenantId).delete();
          await db.customers.where('tenantId').equals(tenantId).delete();
          await db.sales.where('tenantId').equals(tenantId).delete();
          await db.saleItems.where('tenantId').equals(tenantId).delete();
          await db.utangLedger.where('tenantId').equals(tenantId).delete();
          await db.gcashTxns.where('tenantId').equals(tenantId).delete();
          await db.gcashTxnResolutions.where('tenantId').equals(tenantId).delete();

          const syncQueue = await db.syncQueue.toArray();
          await db.syncQueue.bulkDelete(syncQueue
            .filter((item) => item.payload?.tenantId === tenantId)
            .map((item) => item.id));

          const deadLetters = await db.deadLetterQueue.toArray();
          await db.deadLetterQueue.bulkDelete(deadLetters
            .filter((item) => item.payload?.tenantId === tenantId)
            .map((item) => item.id));
        }
      );
      await seedDexieDatabaseIfNeeded(true, tenantId, false, businessName);
      window.alert(t.settings.resetSuccess);
    }
  };

  const handleSavePin = async () => {
    if (!pinDialogPassword) {
      setPinDialogError(t.onboarding.passwordRequired);
      return;
    }
    if (pinDialogNewPin.trim() && !/^\d{4,6}$/.test(pinDialogNewPin.trim())) {
      setPinDialogError(t.onboarding.pinInvalid);
      return;
    }

    setIsPinDialogSubmitting(true);
    setPinDialogError('');
    setPinDialogSuccess('');

    try {
      const result = await updatePin({
        email: userEmail,
        password: pinDialogPassword,
        pin: pinDialogNewPin.trim() || null
      });
      setHasPin(result.hasPin);
      if (result.hasPin && pinDialogNewPin.trim()) {
        const verifier = await generateLocalPinVerifier(pinDialogNewPin.trim());
        setLocalPinVerifier(verifier);
        useAuthStore.getState().resetOfflinePinFailures();
      } else {
        setLocalPinVerifier(null);
        useAuthStore.getState().resetOfflinePinFailures();
      }
      setPinDialogSuccess(t.settings.pinUpdatedSuccess);
      setTimeout(() => {
        setIsPinDialogOpen(false);
        setPinDialogPassword('');
        setPinDialogNewPin('');
        setPinDialogSuccess('');
      }, 1000);
    } catch (err: any) {
      setPinDialogError(err?.response?.data?.message || t.onboarding.loginFailed);
    } finally {
      setIsPinDialogSubmitting(false);
    }
  };

  const handleInitiateLogout = async () => {
    let pending = 0;
    try {
      pending = await db.syncQueue.count();
    } catch (e) {
      console.warn(e);
    }
    setLogoutUnsyncedCount(pending);
    setIsLogoutConfirmOpen(true);
  };

  const handleInitiateSwitchAccount = async () => {
    let pending = 0;
    try {
      pending = await db.syncQueue.count();
    } catch (e) {
      console.warn(e);
    }
    if (pending > 0) {
      setLogoutUnsyncedCount(pending);
      setIsLogoutConfirmOpen(true);
    } else {
      if (onNavigate) {
        onNavigate('login');
      }
      await logout(true);
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <Text weight="bold" size={400}>
            {t.settings.deviceInfoSection}
          </Text>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button
              appearance="subtle"
              size="small"
              icon={<EditRegular />}
              onClick={() => openOnboarding('edit')}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Badge appearance="tint" color={hasPin ? 'success' : 'informative'}>
              {hasPin ? t.settings.pinActive : t.settings.pinInactive}
            </Badge>
            <Button
              size="small"
              appearance="subtle"
              icon={<KeyRegular />}
              onClick={() => {
                setPinDialogPassword('');
                setPinDialogNewPin('');
                setPinDialogError('');
                setPinDialogSuccess('');
                setIsPinDialogOpen(true);
              }}
            >
              {hasPin ? t.settings.changePinBtn : t.settings.setPinBtn}
            </Button>
            {hasPin && (
              <Button
                size="small"
                appearance="subtle"
                icon={<LockClosedRegular />}
                onClick={() => setIsSessionLocked(true)}
              >
                {t.settings.lockSessionBtn}
              </Button>
            )}
          </div>
        </div>
        <div className={styles.infoRow}>
          <Text size={200}>{t.settings.tenantId}:</Text>
          <Text size={200} style={{ fontFamily: 'monospace' }}>{tenantId}</Text>
        </div>
        <div className={styles.infoRow}>
          <Text size={200}>{t.settings.userId}:</Text>
          <Text size={200} style={{ fontFamily: 'monospace' }}>{userId}</Text>
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
            onClick={handleInitiateLogout}
          >
            {t.settings.logoutBtn}
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
            <DialogActions>
              <Button
                appearance="secondary"
                onClick={() => setIsClearDlqConfirmOpen(false)}
                data-testid="cancel-clear-dlq-btn"
              >
                {t.common.cancel}
              </Button>
              <Button
                appearance="primary"
                style={{
                  backgroundColor: tokens.colorPaletteRedBackground3,
                  color: tokens.colorPaletteRedForegroundInverted
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
      <Dialog
        open={isPinDialogOpen}
        onOpenChange={(_, data) => !data.open && setIsPinDialogOpen(false)}
      >
        <DialogSurface>
          <DialogBody>
            <DialogTitle>{t.settings.pinDialogTitle}</DialogTitle>
            <DialogContent style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalM, marginTop: tokens.spacingVerticalS }}>
              <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
                {t.settings.pinDialogDesc}
              </Text>

              {pinDialogError && (
                <Text role="alert" size={200} style={{ color: tokens.colorPaletteRedForeground1 }}>
                  {pinDialogError}
                </Text>
              )}
              {pinDialogSuccess && (
                <Text size={200} style={{ color: tokens.colorPaletteGreenForeground1 }}>
                  {pinDialogSuccess}
                </Text>
              )}

              <Field label={t.settings.currentPasswordLabel} required>
                <Input
                  type={showPinPassword ? 'text' : 'password'}
                  value={pinDialogPassword}
                  onChange={(_, data) => setPinDialogPassword(data.value)}
                  placeholder="••••••••"
                  contentAfter={
                    <Button
                      appearance="subtle"
                      size="small"
                      icon={showPinPassword ? <EyeOffRegular /> : <EyeRegular />}
                      onClick={() => setShowPinPassword(!showPinPassword)}
                      type="button"
                    />
                  }
                  autoFocus
                />
              </Field>

              <Field label={t.settings.newPinLabel} hint={t.onboarding.pinHint}>
                <Input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={pinDialogNewPin}
                  onChange={(_, data) => setPinDialogNewPin(data.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="4-6 digits"
                />
              </Field>
            </DialogContent>
            <DialogActions>
              <Button appearance="secondary" onClick={() => setIsPinDialogOpen(false)}>
                {t.common.cancel}
              </Button>
              <Button
                appearance="primary"
                disabled={isPinDialogSubmitting || !pinDialogPassword}
                icon={isPinDialogSubmitting ? <Spinner size="extra-tiny" /> : undefined}
                onClick={handleSavePin}
              >
                {t.common.save}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>

      {/* Safe Logout Dialog */}
      <Dialog
        open={isLogoutConfirmOpen}
        onOpenChange={(_, data) => !data.open && setIsLogoutConfirmOpen(false)}
      >
        <DialogSurface>
          <DialogBody>
            <DialogTitle>
              {t.settings.logoutConfirmTitle}
            </DialogTitle>
            <DialogContent>
              {logoutUnsyncedCount > 0 ? (
                <div>
                  <Text size={300} weight="semibold" style={{ color: tokens.colorPaletteRedForeground1, display: 'block', marginBottom: '8px' }}>
                    {t.settings.logoutUnsyncedWarning.replace('{count}', String(logoutUnsyncedCount))}
                  </Text>
                  <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
                    {t.settings.logoutConfirmDesc}
                  </Text>
                </div>
              ) : (
                <Text size={300}>{t.settings.logoutConfirmDesc}</Text>
              )}
            </DialogContent>
            <DialogActions>
              <Button appearance="secondary" onClick={() => setIsLogoutConfirmOpen(false)}>
                {t.common.cancel}
              </Button>
              {logoutUnsyncedCount > 0 && (
                <Button
                  appearance="primary"
                  icon={<ArrowSyncRegular />}
                  onClick={async () => {
                    setIsLogoutConfirmOpen(false);
                    await handleForceSync();
                  }}
                >
                  {t.settings.syncFirstBtn}
                </Button>
              )}
              <Button
                appearance={logoutUnsyncedCount > 0 ? 'secondary' : 'primary'}
                style={{
                  color: tokens.colorPaletteRedForeground1,
                  borderColor: tokens.colorPaletteRedBorder1
                }}
                onClick={async () => {
                  setIsLogoutConfirmOpen(false);
                  if (onNavigate) {
                    onNavigate('login');
                  }
                  await logout(true);
                }}
              >
                {logoutUnsyncedCount > 0 ? t.settings.forceLogoutBtn : t.settings.logoutBtn}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
};
