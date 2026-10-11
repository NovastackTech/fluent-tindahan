import React, { useState, useMemo, useRef } from 'react';
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
  Divider
} from '@fluentui/react-components';
import {
  ArrowUploadRegular,
  ArrowDownloadRegular,
  CheckmarkRegular,
  HistoryRegular
} from '@fluentui/react-icons';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, isGCashTxnUnresolved, normalizeRef, type GCashTxnRecord } from '../db/db';
import { useAuthStore } from '../state/authStore';
import { addSyncRecord, kickSync } from '../sync/syncEngine';
import { useTranslation } from '../state/languageStore';
import { useSubscriptionStore } from '../state/subscriptionStore';

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
  }
});

export const GCashPage: React.FC = () => {
  const styles = useStyles();
  const { t, language } = useTranslation();
  const { tier, canAddGCashTxn, openUpgradeModal } = useSubscriptionStore();
  const [txnType, setTxnType] = useState<'CashIn' | 'CashOut'>('CashIn');
  const [amount, setAmount] = useState('');
  const [customFee, setCustomFee] = useState<string | null>(null);
  const [refNo, setRefNo] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const savingRef = useRef(false);

  const tenantId = useAuthStore((s) => s.tenantId);

  // Calculate default sari-sari store fee tier
  const calculatedFee = useMemo(() => {
    const num = parseFloat(amount) || 0;
    if (num <= 0) return 0;
    if (num <= 500) return 10;
    if (num <= 1000) return 15;
    if (num <= 2000) return 30;
    if (num <= 3000) return 45;
    if (num <= 4000) return 60;
    if (num <= 5000) return 75;
    return Math.ceil(num / 1000) * 15; // ₱15 per ₱1,000
  }, [amount]);

  const activeFee = customFee !== null ? parseFloat(customFee) || 0 : calculatedFee;
  const numAmount = parseFloat(amount) || 0;

  // Live query for GCash logs
  const allTxns = useLiveQuery(() => db.gcashTxns.reverse().sortBy('date'), []) || [];

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayTxns = allTxns.filter((t) => t.date.slice(0, 10) === todayStr);
  const countedTodayTxns = todayTxns.filter((t) => !isGCashTxnUnresolved(t));

  const currentMonthPrefix = new Date().toISOString().slice(0, 7);
  const currentMonthTxnCount = allTxns.filter(
    (t) => t.date.slice(0, 7) === currentMonthPrefix && !isGCashTxnUnresolved(t)
  ).length;

  const todayCashIn = countedTodayTxns.filter((t) => t.type === 'CashIn').reduce((s, t) => s + t.amount, 0);
  const todayCashOut = countedTodayTxns.filter((t) => t.type === 'CashOut').reduce((s, t) => s + t.amount, 0);
  const todayFees = countedTodayTxns.reduce((s, t) => s + t.fee, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (numAmount <= 0) {
      alert(t.gcash.invalidAmountAlert);
      return;
    }

    if (!canAddGCashTxn(currentMonthTxnCount)) {
      alert(
        language === 'tl'
          ? 'Naabot na ang limitasyon ng Libreng plano (30 GCash transactions kada buwan). Mag-upgrade sa Tindahan Pro o Negosyo Plus upang magtala pa.'
          : 'Limit reached for Libre plan (30 GCash transactions per month). Please upgrade to Tindahan Pro or Negosyo Plus to log more transactions.'
      );
      openUpgradeModal();
      return;
    }

    if (savingRef.current) return;
    savingRef.current = true;
    setIsSaving(true);

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
        customerPhone: customerPhone.trim() || undefined,
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
        alert(
          language === 'tl'
            ? `Ginamit na ang reference number na ${finalRef}. Hindi maaaring magtala ng doble.`
            : `Reference number ${finalRef} has already been used. Duplicate entries are not allowed.`
        );
        return;
      }

      await kickSync();

      // Reset form
      setAmount('');
      setCustomFee(null);
      setRefNo('');
      setCustomerPhone('');
      setNotes('');
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  };


  return (
    <div className={styles.container}>
      <div style={{ marginBottom: tokens.spacingVerticalM }}>
        <Text size={500} weight="bold">{t.gcash.title}</Text>
        <Text size={300} style={{ color: tokens.colorNeutralForeground3, display: 'block' }}>
          {t.gcash.subtitle}
          {tier === 'Libre' && (
            <span> • {language === 'tl' ? 'Ngayong Buwan:' : 'This Month:'} <span data-testid="monthly-gcash-count">{currentMonthTxnCount}/30</span> (Libre)</span>
          )}
        </Text>
      </div>

      {/* Daily Tally Summary */}
      <div className={styles.summaryGrid}>
        <Card className={styles.summaryCard}>
          <Text size={100} style={{ color: tokens.colorNeutralForeground3 }}>{t.gcash.todayCashIn}</Text>
          <Text data-testid="today-cash-in-total" size={400} weight="bold" style={{ color: tokens.colorPaletteBlueForeground2, display: 'block' }}>
            ₱{todayCashIn.toFixed(2)}
          </Text>
        </Card>

        <Card className={styles.summaryCard}>
          <Text size={100} style={{ color: tokens.colorNeutralForeground3 }}>{t.gcash.todayCashOut}</Text>
          <Text data-testid="today-cash-out-total" size={400} weight="bold" style={{ color: tokens.colorPaletteGreenForeground1, display: 'block' }}>
            ₱{todayCashOut.toFixed(2)}
          </Text>
        </Card>

        <Card className={styles.summaryCard}>
          <Text size={100} style={{ color: tokens.colorNeutralForeground3 }}>{t.gcash.todayFees}</Text>
          <Text data-testid="today-gcash-fees-total" size={400} weight="bold" style={{ color: tokens.colorBrandForeground1, display: 'block' }}>
            ₱{todayFees.toFixed(2)}
          </Text>
        </Card>
      </div>

      {/* GCash Entry Form */}
      <Card className={styles.card}>
        <form onSubmit={handleSubmit}>
          <TabList
            selectedValue={txnType}
            onTabSelect={(_, data) => setTxnType(data.value as any)}
            style={{ marginBottom: '16px' }}
          >
            <Tab value="CashIn" icon={<ArrowUploadRegular />}>{t.gcash.cashIn}</Tab>
            <Tab value="CashOut" icon={<ArrowDownloadRegular />}>{t.gcash.cashOut}</Tab>
          </TabList>

          <div className={styles.gridTwo}>
            <div>
              <Text size={200} weight="semibold">{t.gcash.amountLabel}</Text>
              <Input
                type="number"
                style={{ width: '100%', marginTop: '4px' }}
                value={amount}
                onChange={(_, data) => {
                  setAmount(data.value);
                  setCustomFee(null); // Recalculate auto fee on amount change
                }}
                placeholder="0.00"
                contentBefore="₱"
                required
              />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text size={200} weight="semibold">{t.gcash.feeLabel}</Text>
                <Text size={100} style={{ color: tokens.colorBrandForeground1 }}>{t.gcash.feeAuto}</Text>
              </div>
              <Input
                type="number"
                style={{ width: '100%', marginTop: '4px' }}
                value={activeFee.toString()}
                onChange={(_, data) => setCustomFee(data.value)}
                contentBefore="₱"
              />
            </div>
          </div>

          <div className={styles.gridTwo}>
            <div>
              <Text size={200} weight="semibold">{t.gcash.refNoLabel}</Text>
              <Input
                style={{ width: '100%', marginTop: '4px' }}
                value={refNo}
                onChange={(_, data) => setRefNo(data.value)}
                placeholder={t.gcash.refNoPlaceholder}
              />
            </div>

            <div>
              <Text size={200} weight="semibold">{t.gcash.phoneLabel}</Text>
              <Input
                style={{ width: '100%', marginTop: '4px' }}
                value={customerPhone}
                onChange={(_, data) => setCustomerPhone(data.value)}
                placeholder="09XXXXXXXXX"
              />
            </div>
          </div>

          <div style={{ marginTop: '12px' }}>
            <Text size={200} weight="semibold">{t.gcash.notesLabel}</Text>
            <Input
              style={{ width: '100%', marginTop: '4px' }}
              value={notes}
              onChange={(_, data) => setNotes(data.value)}
              placeholder={t.gcash.notesPlaceholder}
            />
          </div>

          {numAmount > 0 && (
            <div style={{ marginTop: '16px', padding: '12px', background: tokens.colorNeutralBackground2, borderRadius: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text size={300} weight="semibold">
                  {txnType === 'CashIn' ? t.gcash.totalFromCustomer : t.gcash.totalToCustomer}
                </Text>
                <Text size={500} weight="bold" style={{ color: tokens.colorBrandForeground1 }}>
                  ₱{txnType === 'CashIn' ? (numAmount + activeFee).toFixed(2) : (numAmount - activeFee).toFixed(2)}
                </Text>
              </div>
            </div>
          )}

          <Button
            type="submit"
            appearance="primary"
            icon={<CheckmarkRegular />}
            disabled={isSaving}
            style={{ width: '100%', marginTop: '16px' }}
          >
            {t.gcash.saveTransaction} ({txnType === 'CashIn' ? 'Cash-In' : 'Cash-Out'})
          </Button>
        </form>
      </Card>

      {/* Running Daily GCash Log */}
      <Card className={styles.card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <HistoryRegular fontSize={20} />
          <Text weight="bold" size={300}>{t.gcash.historyTitle} ({todayTxns.length})</Text>
        </div>
        <Divider />

        <div style={{ marginTop: '8px' }}>
          {todayTxns.length === 0 ? (
            <Text size={200} style={{ color: tokens.colorNeutralForeground3, textAlign: 'center', display: 'block', padding: '16px' }}>
              {t.gcash.noTransactions}
            </Text>
          ) : (
            todayTxns.map((txn) => {
              const isCashIn = txn.type === 'CashIn';
              return (
                <div key={txn.id} className={styles.logRow}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <Badge appearance="filled" color={isCashIn ? 'informative' : 'success'} size="small">
                        {isCashIn ? 'CASH-IN' : 'CASH-OUT'}
                      </Badge>
                      {isGCashTxnUnresolved(txn) && (
                        <span data-testid="duplicate-ref-badge">
                          <Badge appearance="filled" color="danger" size="small">
                            {language === 'tl' ? 'Dobleng Ref (Kailangan ng Pansin)' : 'Duplicate Ref (Needs Attention)'}
                          </Badge>
                        </span>
                      )}
                      <Text weight="semibold" size={300}>₱{txn.amount.toFixed(2)}</Text>
                      <Text size={100} style={{ color: tokens.colorBrandForeground1 }}>
                        (Fee: ₱{txn.fee.toFixed(2)})
                      </Text>
                    </div>
                    <Text size={100} style={{ color: tokens.colorNeutralForeground3, marginTop: '2px', display: 'block' }}>
                      Ref: {txn.refNo} {txn.customerPhone ? `• ${txn.customerPhone}` : ''} • {new Date(txn.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                    {txn.conflictReason && (
                      <Text size={100} style={{ color: tokens.colorPaletteRedForeground1, marginTop: '2px', display: 'block' }}>
                        ⚠️ {txn.conflictReason}
                      </Text>
                    )}
                    {isGCashTxnUnresolved(txn) && (
                      <Text size={100} style={{ color: tokens.colorPaletteRedForeground1, marginTop: '2px', display: 'block' }}>
                        {language === 'tl' ? 'Hindi naka-sync; hindi kasama sa totals.' : 'Not synced; excluded from totals.'}
                      </Text>
                    )}
                  </div>

                  <Text size={200} weight="bold">
                    Net: ₱{(txn.amount + (isCashIn ? txn.fee : -txn.fee)).toFixed(2)}
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
