import React, { useState, useMemo, useRef, useEffect } from 'react';
import Dexie from 'dexie';
import {
  makeStyles,
  tokens,
  shorthands,
  Text,
  Input,
  Button,
  Card,
  TabList,
  Tab,
  Badge,
  Divider,
  MessageBar,
  MessageBarActions,
  MessageBarBody,
  Select
} from '@fluentui/react-components';
import {
  ArrowUploadRegular,
  ArrowDownloadRegular,
  CheckmarkRegular,
  DismissRegular,
  HistoryRegular
} from '@fluentui/react-icons';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, isGCashTxnUnresolved, normalizeRef, type GCashTxnRecord, type GCashBalanceEntryRecord } from '../db/db';
import { useAuthStore } from '../state/authStore';
import { addSyncRecord, kickSync } from '../sync/syncEngine';
import { useTranslation } from '../state/languageStore';
import { useSubscriptionStore } from '../state/subscriptionStore';
import { calculateGCashFee, DEFAULT_GCASH_FEE_TIERS, useGCashFeeStore } from '../state/gcashFeeStore';
import { formatPeso } from '../utils/currency';
import { toLocalDateKey } from '../utils/date';
import { useTodayKey } from '../hooks/useTodayKey';
import { normalizePhilippineMobile } from '../utils/philippineMobile';
import { usePwaStore } from '../state/pwaStore';


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
  gridTwo: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    ...shorthands.gap(tokens.spacingHorizontalM),
    marginTop: tokens.spacingVerticalS
  },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    ...shorthands.gap(tokens.spacingHorizontalM),
    marginBottom: tokens.spacingVerticalM
  },
  summaryCard: {
    ...shorthands.padding(tokens.spacingVerticalS, tokens.spacingHorizontalS),
    textAlign: 'center'
  },
  logRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    ...shorthands.padding(tokens.spacingVerticalS, '0'),
    ...shorthands.borderBottom('1px', 'solid', tokens.colorNeutralStroke2)
  },
  tabList: {
    marginBottom: '16px',
    width: '100%',
    display: 'flex'
  },
  tabItem: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: '0px',
    minWidth: 0,
    justifyContent: 'center',
    paddingLeft: tokens.spacingHorizontalS,
    paddingRight: tokens.spacingHorizontalS
  },
  tabLabel: {
    display: 'inline-flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    lineHeight: 1.25,
    minWidth: 0
  },
  tabMainText: {
    fontWeight: 600,
    whiteSpace: 'nowrap'
  },
  tabSubText: {
    fontSize: tokens.fontSizeBase100,
    color: tokens.colorNeutralForeground3,
    fontWeight: 'normal',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: '100%'
  }
});

export const MAX_GCASH_AMOUNT = 100000;
const toCentavos = (value: number) => Math.round(value * 100);
const fromCentavos = (value: number) => value / 100;
const createTimestamp = () => new Date().toISOString();

export const GCashPage: React.FC = () => {
  const styles = useStyles();
  const { t, language } = useTranslation();
  const { tier, canAddGCashTxn, openUpgradeModal } = useSubscriptionStore();
  const [txnType, setTxnType] = useState<'CashIn' | 'CashOut'>('CashIn');
  const [amount, setAmount] = useState('');
  const [amountTouched, setAmountTouched] = useState(false);
  const [customFee, setCustomFee] = useState<string | null>(null);
  const [refNo, setRefNo] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerPhoneError, setCustomerPhoneError] = useState('');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [formErrorMessage, setFormErrorMessage] = useState<string | null>(null);
  const setHasUnsavedWork = usePwaStore((s) => s.setHasUnsavedWork);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [resolutionRefDrafts, setResolutionRefDrafts] = useState<Record<string, string>>({});
  const [resolutionErrors, setResolutionErrors] = useState<Record<string, string>>({});
  const [resolvingTxnId, setResolvingTxnId] = useState<string | null>(null);
  const [showBalanceForm, setShowBalanceForm] = useState(false);
  const [openingCash, setOpeningCash] = useState('');
  const [openingWallet, setOpeningWallet] = useState('');
  const [adjustTarget, setAdjustTarget] = useState<'cash' | 'wallet'>('cash');
  const [adjustDirection, setAdjustDirection] = useState<'add' | 'withdraw'>('add');
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [balanceError, setBalanceError] = useState('');
  const [isSavingBalance, setIsSavingBalance] = useState(false);
  const savingRef = useRef(false);

  const tenantId = useAuthStore((s) => s.tenantId);
  const feeTiers = useGCashFeeStore((state) => state.feesByTenant[tenantId] || DEFAULT_GCASH_FEE_TIERS);

  // Calculate the configured tier fee and any open-ended per-thousand increments.
  const calculatedFee = useMemo(() => {
    return calculateGCashFee(parseFloat(amount) || 0, feeTiers);
  }, [amount, feeTiers]);

  const activeFee = customFee !== null ? parseFloat(customFee) || 0 : calculatedFee;
  const numAmount = parseFloat(amount) || 0;

  const amountError = useMemo(() => {
    if (amount.trim() === '') {
      return amountTouched ? t.gcash.amountMustBePositive : '';
    }
    const val = parseFloat(amount);
    if (isNaN(val) || val <= 0) {
      return t.gcash.amountMustBePositive;
    }
    if (val > MAX_GCASH_AMOUNT) {
      return t.gcash.amountExceedsMax;
    }
    return '';
  }, [amount, amountTouched, t.gcash.amountMustBePositive, t.gcash.amountExceedsMax]);

  const customFeeError = useMemo(() => {
    if (customFee === null || customFee.trim() === '') return '';
    const feeVal = parseFloat(customFee);
    if (isNaN(feeVal) || feeVal < 0) {
      return t.gcash.feeCannotBeNegative;
    }
    if (feeVal > MAX_GCASH_AMOUNT) {
      return t.gcash.feeExceedsAmount;
    }
    if (txnType === 'CashOut' && feeVal > numAmount && numAmount > 0) {
      return t.gcash.feeExceedsAmount;
    }
    return '';
  }, [customFee, txnType, numAmount, t.gcash.feeCannotBeNegative, t.gcash.feeExceedsAmount]);

  const hasUnsavedEntry = Boolean(
    amount.trim() || refNo.trim() || customerPhone.trim() || notes.trim() || customFee?.trim() ||
    openingCash.trim() || openingWallet.trim() || adjustAmount.trim() || adjustReason.trim()
  );
  useEffect(() => {
    setHasUnsavedWork(hasUnsavedEntry);
    return () => setHasUnsavedWork(false);
  }, [hasUnsavedEntry, setHasUnsavedWork]);

  // Live query for GCash logs
  const allTxns = useLiveQuery(
    () => db.gcashTxns.where('tenantId').equals(tenantId).reverse().sortBy('date'),
    [tenantId]
  ) || [];
  const balanceEntries = useLiveQuery(
    () => db.gcashBalanceEntries.where('tenantId').equals(tenantId).sortBy('date'),
    [tenantId]
  ) || [];
  const enteredRefNorm = normalizeRef(refNo);
  const duplicateRefTxn = useLiveQuery(
    () => enteredRefNorm
      ? db.gcashTxns.where('[tenantId+refNoNorm]').equals([tenantId, enteredRefNorm]).first()
      : Promise.resolve(undefined),
    [tenantId, enteredRefNorm]
  );
  const hasDuplicateRef = Boolean(enteredRefNorm) && Boolean(duplicateRefTxn);

  const isAmountValid = numAmount > 0 && numAmount <= MAX_GCASH_AMOUNT && !amountError;
  // A blank amount after reload is not a stuck save. Keep the button clickable so
  // the validation message can explain it. Disable only for a real block: a local
  // write in progress, a stored duplicate reference, or an error already on screen.
  const isSaveDisabled = isSaving || hasDuplicateRef || Boolean(amountError) || Boolean(customerPhoneError) || Boolean(customFeeError);
  const resolutions = useLiveQuery(
    () => db.gcashTxnResolutions.where('tenantId').equals(tenantId).toArray(),
    [tenantId]
  );
  const todayStr = useTodayKey();
  const currentMonthPrefix = useMemo(() => todayStr.slice(0, 7), [todayStr]);
  const resolutionsByTxnId = useMemo(
    () => new Map((resolutions || []).map((resolution) => [resolution.gcashTxnId, resolution])),
    [resolutions]
  );
  const replacementTxnIdsResolvedToday = useMemo(
    () => new Set((resolutions || [])
      .filter((resolution) => resolution.resolution === 'Corrected' && toLocalDateKey(resolution.resolvedAt) === todayStr)
      .map((resolution) => resolution.replacementTxnId)
      .filter((id): id is string => Boolean(id))),
    [resolutions, todayStr]
  );
  const todayTxns = allTxns.filter((t) => toLocalDateKey(t.date) === todayStr);
  const visibleTxns = allTxns.filter((txn) => {
    const resolution = resolutionsByTxnId.get(txn.id);
    const resolvedToday = resolution ? toLocalDateKey(resolution.resolvedAt) === todayStr : false;
    const unresolvedAndUnresolvedLocally = !resolution && isGCashTxnUnresolved(txn);
    const isCurrentMonthEntry = toLocalDateKey(txn.date).slice(0, 7) === currentMonthPrefix;
    const isCurrentMonthVoidAudit = isCurrentMonthEntry && resolution?.resolution === 'Voided';
    return (isCurrentMonthEntry && !resolution) || unresolvedAndUnresolvedLocally || resolvedToday || isCurrentMonthVoidAudit || replacementTxnIdsResolvedToday.has(txn.id);
  });
  const countedTodayTxns = todayTxns.filter(
    (t) => !isGCashTxnUnresolved(t) && !resolutionsByTxnId.has(t.id)
  );

  const currentMonthTxnCount = allTxns.filter(
    (t) => toLocalDateKey(t.date).slice(0, 7) === currentMonthPrefix && !isGCashTxnUnresolved(t) && !resolutionsByTxnId.has(t.id)
  ).length;

  const todayCashIn = countedTodayTxns.filter((t) => t.type === 'CashIn').reduce((s, t) => s + t.amount, 0);
  const todayCashOut = countedTodayTxns.filter((t) => t.type === 'CashOut').reduce((s, t) => s + t.amount, 0);
  const todayFees = countedTodayTxns.reduce((s, t) => s + t.fee, 0);

  const activeBalanceEntries = balanceEntries.filter((entry) => entry.syncStatus !== 'Conflict');
  const openingEntry = activeBalanceEntries.find((entry) => entry.kind === 'Opening');
  const balance = (() => {
    if (!openingEntry) return null;
    let cash = toCentavos(openingEntry.cashDelta);
    let wallet = toCentavos(openingEntry.walletDelta);
    for (const entry of activeBalanceEntries) {
      if (entry.kind === 'Adjustment' && entry.date >= openingEntry.date) {
        cash += toCentavos(entry.cashDelta);
        wallet += toCentavos(entry.walletDelta);
      }
    }
    for (const txn of allTxns) {
      if (txn.date < openingEntry.date || isGCashTxnUnresolved(txn) || resolutionsByTxnId.has(txn.id)) continue;
      const amountCents = toCentavos(txn.amount);
      const feeCents = toCentavos(txn.fee);
      if (txn.type === 'CashIn') {
        cash += amountCents + feeCents;
        wallet -= amountCents;
      } else {
        cash -= amountCents - feeCents;
        wallet += amountCents;
      }
    }
    return { cashCentavos: cash, walletCentavos: wallet };
  })();

  const projectedBalance = balance && isAmountValid && !customFeeError ? {
    cashCentavos: balance.cashCentavos + (txnType === 'CashIn'
      ? toCentavos(numAmount) + toCentavos(activeFee)
      : -(toCentavos(numAmount) - toCentavos(activeFee))),
    walletCentavos: balance.walletCentavos + (txnType === 'CashIn'
      ? -toCentavos(numAmount)
      : toCentavos(numAmount))
  } : null;
  const hasCapacityShortfall = Boolean(projectedBalance && (
    (txnType === 'CashIn' && projectedBalance.walletCentavos < 0) ||
    (txnType === 'CashOut' && projectedBalance.cashCentavos < 0)
  ));

  const saveBalanceEntry = async (entry: GCashBalanceEntryRecord) => {
    await db.transaction('rw', db.gcashBalanceEntries, db.syncQueue, async () => {
      if (entry.kind === 'Opening') {
        const existing = (await db.gcashBalanceEntries.where('[tenantId+kind]').equals([tenantId, 'Opening']).toArray()).find((item) => item.syncStatus !== 'Conflict');
        if (existing) throw new Error('opening-exists');
      }
      await db.gcashBalanceEntries.add(entry);
      await addSyncRecord('GCashBalanceEntry', 'Insert', entry);
    });
    void Dexie.ignoreTransaction(() => kickSync().catch((err) => console.warn('Background sync trigger failed:', err)));
  };

  const handleSaveOpening = async (event: React.FormEvent) => {
    event.preventDefault();
    const cash = Number(openingCash);
    const wallet = Number(openingWallet);
    if (!openingCash.trim() || !openingWallet.trim() || !Number.isFinite(cash) || !Number.isFinite(wallet) || cash < 0 || wallet < 0 || cash > 10_000_000 || wallet > 10_000_000) {
      setBalanceError(language === 'tl' ? 'Maglagay ng wastong halagang zero o higit pa.' : 'Enter valid amounts of zero or more.');
      return;
    }
    setIsSavingBalance(true);
    setBalanceError('');
    try {
      await saveBalanceEntry({ id: crypto.randomUUID(), tenantId, kind: 'Opening', cashDelta: fromCentavos(toCentavos(cash)), walletDelta: fromCentavos(toCentavos(wallet)), date: createTimestamp(), reason: 'Beginning balances' });
      setOpeningCash(''); setOpeningWallet(''); setShowBalanceForm(false);
    } catch (error) {
      setBalanceError(error instanceof Error && error.message === 'opening-exists'
        ? (language === 'tl' ? 'Naitakda na ang panimulang balanse.' : 'Beginning balances are already set.')
        : t.gcash.saveFailed);
    } finally { setIsSavingBalance(false); }
  };

  const handleSaveAdjustment = async (event: React.FormEvent) => {
    event.preventDefault();
    const value = Number(adjustAmount);
    if (!openingEntry || !Number.isFinite(value) || value <= 0 || value > 10_000_000 || !adjustReason.trim()) {
      setBalanceError(language === 'tl' ? 'Kailangan ang positibong halaga at dahilan.' : 'A positive amount and reason are required.');
      return;
    }
    const signed = fromCentavos(toCentavos(value)) * (adjustDirection === 'add' ? 1 : -1);
    const date = createTimestamp();
    setIsSavingBalance(true); setBalanceError('');
    try {
      await saveBalanceEntry({ id: crypto.randomUUID(), tenantId, kind: 'Adjustment', cashDelta: adjustTarget === 'cash' ? signed : 0, walletDelta: adjustTarget === 'wallet' ? signed : 0, date, reason: adjustReason.trim(), openingEntryId: openingEntry.id });
      setAdjustAmount(''); setAdjustReason(''); setShowBalanceForm(false);
    } catch { setBalanceError(t.gcash.saveFailed); }
    finally { setIsSavingBalance(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCustomerPhoneError('');
    setFormErrorMessage(null);
    setSuccessMessage(null);
    setAmountTouched(true);

    if (!isAmountValid || Boolean(customFeeError)) {
      return;
    }

    const normalizedPhone = normalizePhilippineMobile(customerPhone);
    if (normalizedPhone === null) {
      setCustomerPhoneError(t.gcash.phoneInvalid);
      return;
    }

    if (!canAddGCashTxn(currentMonthTxnCount)) {
      setFormErrorMessage(
        language === 'tl'
          ? 'Naabot na ang limitasyon ng Libreng plano (30 GCash transactions kada buwan). Mag-upgrade sa Tindahan Pro upang magtala pa.'
          : 'Limit reached for Libre plan (30 GCash transactions per month). Please upgrade to Tindahan Pro to log more transactions.'
      );
      openUpgradeModal();
      return;
    }

    if (savingRef.current) return;
    savingRef.current = true;
    setIsSaving(true);
    let saved = false;

    try {
      const trimmedRef = refNo.trim();
      // Auto-generated refs are UUID-based (collision-safe) and still go through the same check
      const finalRef = trimmedRef || `GC-${crypto.randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase()}`;
      const refNorm = normalizeRef(finalRef);

      const record: GCashTxnRecord = {
        id: crypto.randomUUID(),
        tenantId,
        type: txnType,
        amount: numAmount,
        fee: activeFee,
        refNo: finalRef,
        refNoNorm: refNorm,
        customerPhone: normalizedPhone || undefined,
        date: new Date().toISOString(),
        notes: notes.trim() || undefined
      };

      // Atomic lookup + insert + sync enqueue: concurrent submits cannot both pass the check
      const inserted = await db.transaction('rw', db.gcashTxns, db.syncQueue, async () => {
        const existing = await db.gcashTxns
          .where('[tenantId+refNoNorm]')
          .equals([tenantId, refNorm])
          .first();
        if (existing) return false;
        await db.gcashTxns.add(record);
        await addSyncRecord('GCashTxn', 'Insert', record);
        return true;
      });

      if (!inserted) {
        setFormErrorMessage(
          language === 'tl'
            ? `Ginamit na ang reference number na ${finalRef}. Hindi maaaring magtala ng doble.`
            : `Reference number ${finalRef} has already been used. Duplicate entries are not allowed.`
        );
        return;
      }

      // The ledger row is already committed. Clear the form before any sync work
      // so a stalled queue cannot leave this button disabled.
      setAmount('');
      setAmountTouched(false);
      setCustomFee(null);
      setRefNo('');
      setCustomerPhone('');
      setCustomerPhoneError('');
      setFormErrorMessage(null);
      setNotes('');
      setSuccessMessage(t.gcash.transactionSuccess);
      saved = true;
    } catch (err) {
      console.error('GCash local save failed:', err);
      setFormErrorMessage(t.gcash.saveFailed);
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }

    if (!saved) return;

    // kickSync reads IndexedDB. Awaiting it in this continuation can stay inside
    // the save transaction's Dexie zone and never resolve, which leaves the button
    // disabled. Run it outside that zone, after the form has already been reset.
    // Return the promise so Dexie keeps kickSync in the transless zone for its awaits.
    void Dexie.ignoreTransaction(() =>
      kickSync().catch((err) => console.warn('Background sync trigger failed:', err))
    );
  };

  const handleCorrectReference = async (txn: GCashTxnRecord) => {
    const correctedRef = resolutionRefDrafts[txn.id]?.trim() || '';
    const correctedRefNorm = normalizeRef(correctedRef);
    if (!correctedRefNorm || txn.tenantId !== tenantId || txn.syncStatus !== 'DuplicateRef') return;

    setResolvingTxnId(txn.id);
    try {
      const replacement: GCashTxnRecord = {
        ...txn,
        id: crypto.randomUUID(),
        // Preserve the original transaction date; resolvedAt separately records when the reference was corrected.
        refNo: correctedRef,
        refNoNorm: correctedRefNorm,
        needsAttention: undefined,
        syncStatus: undefined,
        conflictReason: undefined
      };

      const resolved = await db.transaction(
        'rw',
        db.gcashTxns,
        db.gcashTxnResolutions,
        db.syncQueue,
        async () => {
          const current = await db.gcashTxns.get(txn.id);
          if (!current || current.tenantId !== tenantId || current.syncStatus !== 'DuplicateRef') return 'unavailable';
          if (await db.gcashTxnResolutions.get(txn.id)) return 'resolved';

          const duplicate = await db.gcashTxns
            .where('[tenantId+refNoNorm]')
            .equals([tenantId, correctedRefNorm])
            .first();
          if (duplicate) return 'duplicate';

          await db.gcashTxns.add(replacement);
          await db.gcashTxnResolutions.add({
            gcashTxnId: txn.id,
            tenantId,
            resolution: 'Corrected',
            resolvedAt: new Date().toISOString(),
            replacementTxnId: replacement.id,
            correctedRefNo: correctedRef
          });
          await addSyncRecord('GCashTxn', 'Insert', replacement);
          return 'success';
        }
      );

      if (resolved === 'duplicate') {
        setResolutionErrors((prev) => ({
          ...prev,
          [txn.id]: language === 'tl'
            ? 'Nagamit na ang reference number na ito sa tindahang ito.'
            : 'That reference number is already used by this tenant.'
        }));
        return;
      }
      if (resolved !== 'success') {
        setResolutionErrors((prev) => ({
          ...prev,
          [txn.id]: language === 'tl'
            ? 'Hindi na maaaring ayusin ang transaksyong ito.'
            : 'This transaction can no longer be resolved.'
        }));
        return;
      }

      setResolutionRefDrafts((drafts) => ({ ...drafts, [txn.id]: '' }));
      setResolutionErrors((prev) => {
        const next = { ...prev };
        delete next[txn.id];
        return next;
      });
      void Dexie.ignoreTransaction(() =>
        kickSync().catch((err) => console.warn('Background sync trigger failed:', err))
      );
    } finally {
      setResolvingTxnId(null);
    }
  };

  const handleVoidTransaction = async (txn: GCashTxnRecord) => {
    if (
      txn.tenantId !== tenantId ||
      txn.syncStatus !== 'DuplicateRef' ||
      !window.confirm(language === 'tl'
        ? 'Markahan itong transaksyon bilang void? Itatago ito sa totals, pero pananatilihin ang audit record.'
        : 'Void this transaction? It will stay in the audit log and remain excluded from totals.')
    ) return;

    setResolvingTxnId(txn.id);
    try {
      const resolved = await db.transaction('rw', db.gcashTxns, db.gcashTxnResolutions, async () => {
        const current = await db.gcashTxns.get(txn.id);
        if (!current || current.tenantId !== tenantId || current.syncStatus !== 'DuplicateRef') return false;
        if (await db.gcashTxnResolutions.get(txn.id)) return false;
        await db.gcashTxnResolutions.add({
          gcashTxnId: txn.id,
          tenantId,
          resolution: 'Voided',
          resolvedAt: new Date().toISOString()
        });
        return true;
      });
      if (!resolved) {
        setResolutionErrors((prev) => ({
          ...prev,
          [txn.id]: language === 'tl'
            ? 'Hindi na maaaring ayusin ang transaksyong ito.'
            : 'This transaction can no longer be resolved.'
        }));
      } else {
        setResolutionErrors((prev) => {
          const next = { ...prev };
          delete next[txn.id];
          return next;
        });
      }
    } finally {
      setResolvingTxnId(null);
    }
  };


  return (
    <div className={styles.container}>
      <div style={{ marginBottom: tokens.spacingVerticalM }}>
        <Text size={500} weight="bold">{t.gcash.title}</Text>
        <Text size={300} style={{ color: tokens.colorNeutralForeground3, display: 'block' }}>
          {t.gcash.subtitle}
          {tier === 'Libre' && (
            <span> • {language === 'tl' ? 'Ngayong Buwan:' : 'This Month:'} <span data-testid="monthly-gcash-count">{currentMonthTxnCount}/30</span> ({t.gcash.freePlanLabel})</span>
          )}
        </Text>
      </div>

      <div className={styles.gridTwo} style={{ marginBottom: tokens.spacingVerticalM }}>
        <Card className={styles.summaryCard}>
          <Text size={100} style={{ color: tokens.colorNeutralForeground3 }}>{t.gcash.cashCapacity}</Text>
          <Text data-testid="gcash-cash-capacity" size={400} weight="bold" style={{ display: 'block' }}>
            {balance ? formatPeso(fromCentavos(balance.cashCentavos)) : (language === 'tl' ? 'Hindi pa naitakda' : 'Not set')}
          </Text>
        </Card>
        <Card className={styles.summaryCard}>
          <Text size={100} style={{ color: tokens.colorNeutralForeground3 }}>{t.gcash.walletCapacity}</Text>
          <Text data-testid="gcash-wallet-capacity" size={400} weight="bold" style={{ display: 'block' }}>
            {balance ? formatPeso(fromCentavos(balance.walletCentavos)) : (language === 'tl' ? 'Hindi pa naitakda' : 'Not set')}
          </Text>
        </Card>
      </div>

      <Card className={styles.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <div>
            <Text weight="bold">{openingEntry ? t.gcash.adjustBalances : t.gcash.setBeginningBalances}</Text>
            {!openingEntry && <Text size={200} style={{ display: 'block', color: tokens.colorNeutralForeground3 }}>{language === 'tl' ? 'Ilagay ang cash at GCash na magagamit ngayon.' : 'Enter the cash and GCash funds available now.'}</Text>}
          </div>
          <Button onClick={() => { setShowBalanceForm((value) => !value); setBalanceError(''); }}>
            {openingEntry ? t.gcash.adjustBalances : t.gcash.setBeginningBalances}
          </Button>
        </div>

        {showBalanceForm && !openingEntry && (
          <form onSubmit={handleSaveOpening} className={styles.gridTwo}>
            <div>
              <Text size={200} weight="semibold">{t.gcash.cashCapacity}</Text>
              <Input type="number" min="0" max="10000000" step="0.01" aria-label={t.gcash.cashCapacity} contentBefore="₱" style={{ width: '100%', marginTop: '4px' }} placeholder="0.00" value={openingCash} onChange={(_, data) => setOpeningCash(data.value)} />
            </div>
            <div>
              <Text size={200} weight="semibold">{t.gcash.walletCapacity}</Text>
              <Input type="number" min="0" max="10000000" step="0.01" aria-label={t.gcash.walletCapacity} contentBefore="₱" style={{ width: '100%', marginTop: '4px' }} placeholder="0.00" value={openingWallet} onChange={(_, data) => setOpeningWallet(data.value)} />
            </div>
            <Button type="submit" appearance="primary" disabled={isSavingBalance} style={{ alignSelf: 'end' }}>{t.gcash.setBeginningBalances}</Button>
          </form>
        )}

        {showBalanceForm && openingEntry && (
          <form onSubmit={handleSaveAdjustment} className={styles.gridTwo}>
            <div>
              <Text size={200} weight="semibold">{language === 'tl' ? 'Balanse' : 'Balance'}</Text>
              <Select aria-label={language === 'tl' ? 'Balanse' : 'Balance'} style={{ width: '100%', marginTop: '4px' }} value={adjustTarget} onChange={(_, data) => setAdjustTarget(data.value as 'cash' | 'wallet')}>
              <option value="cash">{t.gcash.cashCapacity}</option>
              <option value="wallet">{t.gcash.walletCapacity}</option>
            </Select>
            </div>
            <div>
              <Text size={200} weight="semibold">{language === 'tl' ? 'Uri ng pagbabago' : 'Adjustment direction'}</Text>
              <Select aria-label={language === 'tl' ? 'Uri ng pagbabago' : 'Adjustment direction'} style={{ width: '100%', marginTop: '4px' }} value={adjustDirection} onChange={(_, data) => setAdjustDirection(data.value as 'add' | 'withdraw')}>
              <option value="add">{language === 'tl' ? 'Dagdag' : 'Add'}</option>
              <option value="withdraw">{language === 'tl' ? 'Bawas' : 'Withdraw'}</option>
            </Select>
            </div>
            <div>
              <Text size={200} weight="semibold">{language === 'tl' ? 'Halaga ng pagbabago' : 'Adjustment amount'}</Text>
              <Input type="number" min="0.01" max="10000000" step="0.01" aria-label={language === 'tl' ? 'Halaga ng pagbabago' : 'Adjustment amount'} contentBefore="₱" style={{ width: '100%', marginTop: '4px' }} placeholder="0.00" value={adjustAmount} onChange={(_, data) => setAdjustAmount(data.value)} />
            </div>
            <div>
              <Text size={200} weight="semibold">{language === 'tl' ? 'Dahilan' : 'Reason'}</Text>
              <Input maxLength={500} aria-label={language === 'tl' ? 'Dahilan' : 'Reason'} style={{ width: '100%', marginTop: '4px' }} placeholder={language === 'tl' ? 'Dahilan (kailangan)' : 'Reason (required)'} value={adjustReason} onChange={(_, data) => setAdjustReason(data.value)} />
            </div>
            <Button type="submit" appearance="primary" disabled={isSavingBalance} style={{ alignSelf: 'end' }}>{language === 'tl' ? 'I-save ang pagbabago' : 'Save adjustment'}</Button>

          </form>
        )}

        {balanceError && <MessageBar intent="error" style={{ marginTop: '8px' }}><MessageBarBody>{balanceError}</MessageBarBody></MessageBar>}
        {balanceEntries.some((entry) => entry.syncStatus === 'Conflict') && (
          <MessageBar intent="warning" style={{ marginTop: '8px' }}>
            <MessageBarBody>{language === 'tl' ? 'May panimulang balanse mula sa ibang device. Hindi isinama ang lokal na salungat na tala.' : 'Another device set the beginning balances. The conflicting local entry is excluded.'}</MessageBarBody>
            <MessageBarActions
              containerAction={
                <Button
                  appearance="subtle"
                  aria-label={language === 'tl' ? 'Isara' : 'Dismiss'}
                  icon={<DismissRegular />}
                  onClick={() => void db.gcashBalanceEntries.bulkDelete(balanceEntries.filter((entry) => entry.syncStatus === 'Conflict').map((entry) => entry.id))}
                />
              }
            />
          </MessageBar>
        )}

        {openingEntry && activeBalanceEntries.some((entry) => entry.kind === 'Adjustment') && (
          <div style={{ marginTop: '12px' }}>
            <Text weight="semibold">{t.gcash.balanceHistory}</Text>
            {activeBalanceEntries.filter((entry) => entry.kind === 'Adjustment').slice().reverse().map((entry) => (
              <div key={entry.id} className={styles.logRow}>
                <Text size={200}>{entry.cashDelta ? 'Cash' : 'GCash'}: {entry.reason}</Text>
                <Text size={200}>{formatPeso(entry.cashDelta || entry.walletDelta)} · {new Date(entry.date).toLocaleString()}</Text>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Daily Tally Summary */}
      <div className={styles.summaryGrid}>
        <Card className={styles.summaryCard}>
          <Text size={100} style={{ color: tokens.colorNeutralForeground3 }}>{t.gcash.todayCashIn}</Text>
          <Text data-testid="today-cash-in-total" size={400} weight="bold" style={{ color: tokens.colorPaletteBlueForeground2, display: 'block' }}>
            {formatPeso(todayCashIn)}
          </Text>
        </Card>

        <Card className={styles.summaryCard}>
          <Text size={100} style={{ color: tokens.colorNeutralForeground3 }}>{t.gcash.todayCashOut}</Text>
          <Text data-testid="today-cash-out-total" size={400} weight="bold" style={{ color: tokens.colorPaletteGreenForeground1, display: 'block' }}>
            {formatPeso(todayCashOut)}
          </Text>
        </Card>

        <Card className={styles.summaryCard}>
          <Text size={100} style={{ color: tokens.colorNeutralForeground3 }}>{t.gcash.todayFees}</Text>
          <Text data-testid="today-gcash-fees-total" size={400} weight="bold" style={{ color: tokens.colorBrandForeground1, display: 'block' }}>
            {formatPeso(todayFees)}
          </Text>
        </Card>
      </div>

      {/* GCash Entry Form */}
      <Card className={styles.card}>
        <form noValidate onSubmit={handleSubmit}>
          <TabList
            selectedValue={txnType}
            onTabSelect={(_, data) => setTxnType(data.value as any)}
            className={styles.tabList}
          >
            <Tab
              value="CashIn"
              icon={<ArrowUploadRegular />}
              className={styles.tabItem}
              data-testid="gcash-tab-cash-in"
            >
              <span className={styles.tabLabel}>
                <span className={styles.tabMainText}>Cash In</span>
                <span className={styles.tabSubText}>
                  {language === 'tl' ? '(Pasok sa GCash)' : '(Send to GCash)'}
                </span>
              </span>
            </Tab>
            <Tab
              value="CashOut"
              icon={<ArrowDownloadRegular />}
              className={styles.tabItem}
              data-testid="gcash-tab-cash-out"
            >
              <span className={styles.tabLabel}>
                <span className={styles.tabMainText}>Cash Out</span>
                <span className={styles.tabSubText}>
                  {language === 'tl' ? '(Bigay ng Pera)' : '(Disburse Cash)'}
                </span>
              </span>
            </Tab>
          </TabList>

          <div className={styles.gridTwo}>
            <div>
              <Text size={200} weight="semibold">{t.gcash.amountLabel}</Text>
              <Input
                type="number"
                aria-label={t.gcash.amountLabel}
                aria-invalid={Boolean(amountError)}
                aria-describedby={amountError ? 'gcash-amount-error' : undefined}
                style={{ width: '100%', marginTop: '4px' }}
                value={amount}
                onChange={(_, data) => {
                  setAmount(data.value);
                  setAmountTouched(true);
                  setCustomFee(null); // Recalculate auto fee on amount change
                }}
                placeholder="0.00"
                contentBefore="₱"
                max={MAX_GCASH_AMOUNT.toString()}
                step="any"
              />
              {amountError && (
                <Text
                  id="gcash-amount-error"
                  data-testid="gcash-amount-error"
                  role="alert"
                  size={200}
                  style={{ color: tokens.colorPaletteRedForeground1, display: 'block', marginTop: '4px' }}
                >
                  {amountError}
                </Text>
              )}
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text size={200} weight="semibold">{t.gcash.feeLabel}</Text>
                <Text size={100} style={{ color: tokens.colorBrandForeground1 }}>{t.gcash.feeAuto}</Text>
              </div>
              <Input
                type="number"
                aria-label={t.gcash.feeLabel}
                aria-invalid={Boolean(customFeeError)}
                aria-describedby={customFeeError ? 'gcash-custom-fee-error' : undefined}
                style={{ width: '100%', marginTop: '4px' }}
                value={activeFee.toString()}
                onChange={(_, data) => setCustomFee(data.value)}
                contentBefore="₱"
                min="0"
                max={MAX_GCASH_AMOUNT.toString()}
                step="any"
              />
              {customFeeError && (
                <Text
                  id="gcash-custom-fee-error"
                  data-testid="gcash-custom-fee-error"
                  role="alert"
                  size={200}
                  style={{ color: tokens.colorPaletteRedForeground1, display: 'block', marginTop: '4px' }}
                >
                  {customFeeError}
                </Text>
              )}
            </div>
          </div>

          <div className={styles.gridTwo}>
            <div>
              <Text size={200} weight="semibold">{t.gcash.refNoLabel}</Text>
              <Input
                aria-label={t.gcash.refNoLabel}
                style={{ width: '100%', marginTop: '4px' }}
                value={refNo}
                onChange={(_, data) => {
                  setRefNo(data.value);
                  if (successMessage) setSuccessMessage(null);
                }}
                placeholder={t.gcash.refNoPlaceholder}
                aria-invalid={hasDuplicateRef}
                aria-describedby={hasDuplicateRef ? 'gcash-duplicate-ref-warning' : undefined}
              />
              {hasDuplicateRef && (
                <Text
                  id="gcash-duplicate-ref-warning"
                  role="alert"
                  size={200}
                  style={{ color: tokens.colorPaletteRedForeground1, display: 'block', marginTop: '4px' }}
                >
                  {t.gcash.duplicateRefWarning} ({refNo.trim()})
                </Text>
              )}
            </div>

            <div>
              <Text size={200} weight="semibold">{t.gcash.phoneLabel}</Text>
              <Input
                type="tel"
                inputMode="tel"
                aria-label={t.gcash.phoneLabel}
                aria-invalid={Boolean(customerPhoneError)}
                aria-describedby={customerPhoneError ? 'gcash-customer-phone-error' : undefined}
                style={{ width: '100%', marginTop: '4px' }}
                value={customerPhone}
                onChange={(_, data) => {
                  setCustomerPhone(data.value);
                  if (customerPhoneError) setCustomerPhoneError('');
                }}
                placeholder="09XXXXXXXXX"
              />
              {customerPhoneError && (
                <Text
                  id="gcash-customer-phone-error"
                  role="alert"
                  size={200}
                  style={{ color: tokens.colorPaletteRedForeground1, display: 'block', marginTop: '4px' }}
                >
                  {customerPhoneError}
                </Text>
              )}
            </div>
          </div>

          <div style={{ marginTop: '12px' }}>
            <Text size={200} weight="semibold">{t.gcash.notesLabel}</Text>
            <Input
              aria-label={t.gcash.notesLabel}
              style={{ width: '100%', marginTop: '4px' }}
              value={notes}
              onChange={(_, data) => setNotes(data.value)}
              placeholder={t.gcash.notesPlaceholder}
            />
          </div>

          {isAmountValid && !customFeeError && (
            <div style={{ marginTop: '16px', padding: '12px', background: tokens.colorNeutralBackground2, borderRadius: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text size={300} weight="semibold">
                  {txnType === 'CashIn' ? t.gcash.totalFromCustomer : t.gcash.totalToCustomer}
                </Text>
                <Text size={500} weight="bold" style={{ color: tokens.colorBrandForeground1 }}>
                  {formatPeso(txnType === 'CashIn' ? numAmount + activeFee : Math.max(0, numAmount - activeFee))}
                </Text>
              </div>
            </div>
          )}

          {formErrorMessage && (
            <div role="alert" style={{ marginTop: '12px' }}>
              <MessageBar intent="error" layout="multiline">
                <MessageBarBody>{formErrorMessage}</MessageBarBody>
              </MessageBar>
            </div>
          )}

          {!hasDuplicateRef && !formErrorMessage && successMessage && (
            <div role="status" data-testid="gcash-save-success" style={{ marginTop: '12px' }}>
              <MessageBar intent="success" layout="multiline">
                <MessageBarBody>{successMessage}</MessageBarBody>
              </MessageBar>
            </div>
          )}

          {projectedBalance && (
            <div style={{ marginTop: '12px' }}>
              <Text size={200}>
                {language === 'tl' ? 'Tinatayang matitirang balanse:' : 'Projected remaining balance:'} {' '}
                {formatPeso(fromCentavos(txnType === 'CashIn' ? projectedBalance.walletCentavos : projectedBalance.cashCentavos))}
              </Text>
              {hasCapacityShortfall && (
                <MessageBar intent="warning" layout="multiline" style={{ marginTop: '6px' }}>
                  <MessageBarBody>
                    {t.gcash.insufficientCapacity} {' '}
                    {txnType === 'CashOut' && (language === 'tl'
                      ? `Cash payout: ${formatPeso(Math.max(0, numAmount - activeFee))}.`
                      : `Cash payout: ${formatPeso(Math.max(0, numAmount - activeFee))}.`)}
                  </MessageBarBody>
                </MessageBar>
              )}
            </div>
          )}

          <Button
            type="submit"
            appearance="primary"
            icon={<CheckmarkRegular />}
            disabled={isSaveDisabled}
            style={{ width: '100%', marginTop: '16px' }}
          >
            {t.gcash.saveTransaction} ({txnType === 'CashIn' ? 'Cash-In' : 'Cash-Out'})
          </Button>
        </form>
      </Card>

      {/* Current-Month GCash Log */}
      <Card className={styles.card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <HistoryRegular fontSize={20} />
          <Text weight="bold" size={300}>{t.gcash.historyTitle} ({visibleTxns.length})</Text>
        </div>
        <Divider />

        <div style={{ marginTop: '8px' }}>
          {visibleTxns.length === 0 ? (
            <Text size={200} style={{ color: tokens.colorNeutralForeground3, textAlign: 'center', display: 'block', padding: '16px' }}>
              {t.gcash.noTransactions}
            </Text>
          ) : (
            visibleTxns.map((txn) => {
              const isCashIn = txn.type === 'CashIn';
              const isToday = toLocalDateKey(txn.date) === todayStr;
              const resolution = resolutionsByTxnId.get(txn.id);
              const isCorrectionReplacement = replacementTxnIdsResolvedToday.has(txn.id);
              const canResolve = !resolution && txn.tenantId === tenantId && txn.syncStatus === 'DuplicateRef';
              return (
                <div
                  key={txn.id}
                  className={styles.logRow}
                  data-testid={isCorrectionReplacement ? 'gcash-correction-replacement-row' : undefined}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <Badge appearance="filled" color={isCashIn ? 'informative' : 'success'} size="small">
                        {isCashIn ? 'CASH-IN' : 'CASH-OUT'}
                      </Badge>
                      {isGCashTxnUnresolved(txn) && !resolution && (
                        <span data-testid="duplicate-ref-badge">
                          <Badge appearance="filled" color="danger" size="small">
                            {txn.syncStatus === 'Conflict'
                              ? (language === 'tl' ? 'Salungatan sa Sync (Kailangan ng Pansin)' : 'Sync Conflict (Needs Attention)')
                              : (language === 'tl' ? 'Dobleng Ref (Kailangan ng Pansin)' : 'Duplicate Ref (Needs Attention)')}
                          </Badge>
                        </span>
                      )}
                      {resolution?.resolution === 'Corrected' && (
                        <Badge appearance="tint" color="success" size="small">
                          {language === 'tl' ? `Naayos; bagong ref: ${resolution.correctedRefNo}` : `Corrected; new ref: ${resolution.correctedRefNo}`}
                        </Badge>
                      )}
                      {resolution?.resolution === 'Voided' && (
                        <Badge appearance="tint" color="warning" size="small">
                          {language === 'tl' ? 'Voided (lokal)' : 'Voided locally'}
                        </Badge>
                      )}
                      {isCorrectionReplacement && (
                        <Badge
                          data-testid="gcash-correction-replacement-badge"
                          appearance="tint"
                          color="brand"
                          size="small"
                        >
                          {language === 'tl' ? 'Bagong ref na naayos ngayon' : 'Corrected replacement created today'}
                        </Badge>
                      )}
                      <Text weight="semibold" size={300}>{formatPeso(txn.amount)}</Text>
                      <Text size={100} style={{ color: tokens.colorBrandForeground1 }}>
                        (Fee: {formatPeso(txn.fee)})
                      </Text>
                    </div>
                    <Text size={100} style={{ color: tokens.colorNeutralForeground3, marginTop: '2px', display: 'block' }}>
                      {!isToday && `${new Date(txn.date).toLocaleDateString()} • `}Ref: {txn.refNo} {txn.customerPhone ? `• ${txn.customerPhone}` : ''} • {new Date(txn.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                    {txn.notes && (
                      <Text size={200} style={{ color: tokens.colorNeutralForeground2, marginTop: '4px', display: 'block' }}>
                        {txn.notes}
                      </Text>
                    )}
                    {txn.conflictReason && (
                      <Text size={100} style={{ color: tokens.colorPaletteRedForeground1, marginTop: '2px', display: 'block' }}>
                        ⚠️ {txn.conflictReason}
                      </Text>
                    )}
                    {isGCashTxnUnresolved(txn) && !resolution && (
                      <Text size={100} style={{ color: tokens.colorPaletteRedForeground1, marginTop: '2px', display: 'block' }}>
                        {language === 'tl'
                          ? 'Hindi naka-sync; hindi kasama sa totals o buwanang bilang.'
                          : 'Not synced; excluded from totals and monthly count.'}
                      </Text>
                    )}
                    {canResolve && (
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
                        <Input
                          aria-label={language === 'tl' ? `Bagong reference para sa ${txn.refNo}` : `Corrected reference for ${txn.refNo}`}
                          value={resolutionRefDrafts[txn.id] ?? ''}
                          onChange={(_, data) => {
                            setResolutionRefDrafts((drafts) => ({ ...drafts, [txn.id]: data.value }));
                            if (resolutionErrors[txn.id]) {
                              setResolutionErrors((prev) => {
                                const next = { ...prev };
                                delete next[txn.id];
                                return next;
                              });
                            }
                          }}
                          placeholder={language === 'tl' ? 'Tamang GCash reference' : 'Correct GCash reference'}
                        />
                        <Button
                          appearance="primary"
                          disabled={resolvingTxnId !== null || !resolutionRefDrafts[txn.id]?.trim()}
                          onClick={() => void handleCorrectReference(txn)}
                        >
                          {language === 'tl' ? 'Ayusin at i-sync' : 'Correct & sync'}
                        </Button>
                        <Button
                          appearance="secondary"
                          disabled={resolvingTxnId !== null}
                          onClick={() => void handleVoidTransaction(txn)}
                        >
                          {language === 'tl' ? 'I-void' : 'Void'}
                        </Button>
                        {resolutionErrors[txn.id] && (
                          <div role="alert" style={{ width: '100%', marginTop: '4px' }}>
                            <Text size={200} style={{ color: tokens.colorPaletteRedForeground1, fontWeight: 600 }}>
                              ⚠️ {resolutionErrors[txn.id]}
                            </Text>
                          </div>
                        )}
                        {!isToday && (
                          <Text
                            data-testid="gcash-correction-date-note"
                            size={100}
                            style={{ color: tokens.colorNeutralForeground3, alignSelf: 'center' }}
                          >
                            {language === 'tl'
                              ? 'Pananatilihin ang orihinal na petsa; hindi madadagdag sa totals ngayong araw ang lumang transaksyon.'
                              : "Keeps the original transaction date; older corrections aren't added to today's totals."}
                          </Text>
                        )}
                      </div>
                    )}
                  </div>

                  <Text size={200} weight="bold">
                    Net: {formatPeso(txn.amount + (isCashIn ? txn.fee : -txn.fee))}
                  </Text>
                </div>
              );
            })
          )}
        </div>
      </Card>
    </div>
  );
};
