import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  makeStyles,
  tokens,
  shorthands,
  Text,
  Input,
  Button,
  Card,
  Badge,
  Dialog,
  DialogSurface,
  DialogTitle,
  DialogBody,
  DialogActions,
  DialogContent,
  Divider,
  MessageBar,
  MessageBarBody,
  MessageBarActions
} from '@fluentui/react-components';
import {
  SearchRegular,
  PersonAddRegular,
  PaymentRegular,
  AddRegular,
  CheckmarkRegular,
  DismissRegular
} from '@fluentui/react-icons';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type CustomerRecord, type UtangLedgerRecord } from '../db/db';
import { useAuthStore } from '../state/authStore';
import { enqueueSync, addSyncRecord, kickSync } from '../sync/syncEngine';
import { useTranslation } from '../state/languageStore';
import { useSubscriptionStore } from '../state/subscriptionStore';
import { formatPeso } from '../utils/currency';
import { normalizePhilippineMobile } from '../utils/philippineMobile';

const useStyles = makeStyles({
  container: {
    ...shorthands.padding(tokens.spacingVerticalM, tokens.spacingHorizontalM),
    maxWidth: '1080px',
    marginLeft: 'auto',
    marginRight: 'auto',
    paddingBottom: '100px'
  },
  headerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: tokens.spacingVerticalM
  },
  debtorCard: {
    ...shorthands.padding(tokens.spacingVerticalM, tokens.spacingHorizontalM),
    cursor: 'pointer',
    marginBottom: tokens.spacingVerticalS,
    transitionProperty: 'all',
    transitionDuration: tokens.durationNormal,
    '&:hover': {
      backgroundColor: tokens.colorNeutralBackground1Hover,
      transform: 'translateX(2px)'
    }
  },
  timelineItem: {
    display: 'flex',
    flexDirection: 'column',
    ...shorthands.padding(tokens.spacingVerticalS, '0'),
    ...shorthands.borderBottom('1px', 'solid', tokens.colorNeutralStroke2),
    width: '100%'
  },
  timelineHeaderRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: '2px'
  },
  timelineBadge: {
    whiteSpace: 'nowrap',
    flexShrink: 0
  },
  timelineNotes: {
    overflowWrap: 'break-word',
    wordBreak: 'break-word',
    marginTop: '2px',
    display: 'block'
  },
  timelineAmount: {
    whiteSpace: 'nowrap',
    flexShrink: 0,
    textAlign: 'right'
  }
});

const EMPTY_CUSTOMERS: CustomerRecord[] = [];
const LEGACY_DEFAULT_NOTES = new Set(['Unang tala ng utang', 'Dagdag na utang', 'Bayad sa utang']);

function createUtangLedgerRecord(
  tenantId: string,
  customerId: string,
  amount: number,
  type: 'Payment' | 'Credit',
  date: string,
  notes: string
): UtangLedgerRecord {
  return {
    id: crypto.randomUUID(),
    tenantId,
    customerId,
    amount,
    type,
    date,
    notes
  };
}

export const UtangPage: React.FC = () => {
  const styles = useStyles();
  const { t, language } = useTranslation();
  const { tier, canAddCustomer, openUpgradeModal } = useSubscriptionStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerRecord | null>(null);

  // Modals state
  const [isNewCustomerOpen, setIsNewCustomerOpen] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isAddCreditOpen, setIsAddCreditOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const savingRef = useRef(false);

  // Form states
  const [newCustName, setNewCustName] = useState('');
  const [newCustNameError, setNewCustNameError] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustPhoneError, setNewCustPhoneError] = useState('');
  const [newCustInitialUtang, setNewCustInitialUtang] = useState('');
  const [newCustInitialUtangError, setNewCustInitialUtangError] = useState('');
  const [pageBannerMessage, setPageBannerMessage] = useState<string | null>(null);
  const [newCustLimitError, setNewCustLimitError] = useState<string | null>(null);

  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentAmountError, setPaymentAmountError] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');

  const [creditAmount, setCreditAmount] = useState('');
  const [creditAmountError, setCreditAmountError] = useState('');
  const [creditNotes, setCreditNotes] = useState('');

  const tenantId = useAuthStore((s) => s.tenantId);

  // Live queries
  const customerResults = useLiveQuery(
    () => db.customers.where('tenantId').equals(tenantId).toArray(),
    [tenantId]
  );
  const customers = customerResults || EMPTY_CUSTOMERS;
  const selectedCustomerId = selectedCustomer?.id;

  const allUtangEntries = useLiveQuery(
    () => db.utangLedger.where('tenantId').equals(tenantId).toArray(),
    [tenantId]
  );

  const ledgerEntries = useMemo(() => {
    if (!selectedCustomerId || !allUtangEntries) return [];
    return allUtangEntries
      .filter((entry) => entry.customerId === selectedCustomerId)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [allUtangEntries, selectedCustomerId]);

  // Flag mismatch between stored balance and local ledger entries without overwriting stored balance
  useEffect(() => {
    if (!selectedCustomer || ledgerEntries.length === 0) return;
    const ledgerCentavos = ledgerEntries.reduce(
      (sum, e) => sum + (e.type === 'Credit' ? 1 : -1) * Math.round(e.amount * 100),
      0
    );
    const ledgerBal = Math.max(0, ledgerCentavos) / 100;
    if (Math.abs((selectedCustomer.totalUtangBalance ?? 0) - ledgerBal) > 0.01) {
      console.warn(
        `[UtangPage] Mismatch detected for customer ${selectedCustomer.name} (${selectedCustomer.id}): ` +
        `stored balance is ₱${selectedCustomer.totalUtangBalance}, but local ledger calculates ₱${ledgerBal}. ` +
        `Not overwriting stored balance because local ledger may be partial or pending sync.`
      );
    }
  }, [selectedCustomer, ledgerEntries]);

  const selectedCustomerBalance = selectedCustomer?.totalUtangBalance ?? 0;

  // Filtered debtors
  const filteredCustomers = useMemo(() => {
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.phone.includes(searchQuery)
    );
  }, [customers, searchQuery]);

  const totalOutstanding = useMemo(() => {
    return customers.reduce((sum, c) => sum + (c.totalUtangBalance ?? 0), 0);
  }, [customers]);

  // Create new customer
  const handleCreateCustomer = async () => {
    setNewCustNameError('');
    setNewCustPhoneError('');
    setNewCustInitialUtangError('');

    if (!newCustName.trim()) {
      setNewCustNameError(t.utang.customerNameRequired);
      return;
    }

    const phone = normalizePhilippineMobile(newCustPhone);
    if (phone === null) {
      setNewCustPhoneError(t.onboarding.phoneInvalid);
      return;
    }

    const enteredInitialBalance = newCustInitialUtang.trim() === '' ? 0 : Number(newCustInitialUtang);
    if (!Number.isFinite(enteredInitialBalance) || enteredInitialBalance < 0) {
      setNewCustInitialUtangError(
        language === 'tl'
          ? 'Hindi maaaring negatibo ang panimulang balanse ng utang.'
          : 'The opening utang balance cannot be negative.'
      );
      return;
    }

    if (!canAddCustomer(customers.length)) {
      setNewCustLimitError(
        language === 'tl'
          ? 'Naabot na ang limitasyon ng Libreng plano (30 may utang). Mag-upgrade sa Tindahan Pro o Negosyo Plus upang magtala pa.'
          : 'Limit reached for Libre plan (30 debtors maximum). Please upgrade to Tindahan Pro or Negosyo Plus to add more debtors.'
      );
      openUpgradeModal();
      return;
    }
    setNewCustLimitError(null);

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const initBalance = enteredInitialBalance;

    const newCustomer: CustomerRecord = {
      id,
      tenantId,
      name: newCustName.trim(),
      phone,
      totalUtangBalance: initBalance,
      updatedAt: now
    };

    await db.customers.add(newCustomer);
    await enqueueSync('Customer', 'Insert', { ...newCustomer, totalUtangBalance: 0 });

    if (initBalance > 0) {
      const ledgerId = crypto.randomUUID();
      const ledgerRecord: UtangLedgerRecord = {
        id: ledgerId,
        tenantId,
        customerId: id,
        amount: initBalance,
        type: 'Credit',
        date: now,
        notes: ''
      };
      await db.utangLedger.add(ledgerRecord);
      await enqueueSync('UtangLedger', 'Insert', ledgerRecord);
    }

    setNewCustName('');
    setNewCustNameError('');
    setNewCustPhone('');
    setNewCustPhoneError('');
    setNewCustInitialUtang('');
    setIsNewCustomerOpen(false);
  };

  // Record payment
  const handleRecordPayment = async () => {
    if (!selectedCustomer || selectedCustomer.tenantId !== tenantId || savingRef.current) return;
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      setPaymentAmountError(t.utang.paymentAmountInvalid);
      return;
    }

    const currentBalance = selectedCustomerBalance;
    if (Math.round(amount * 100) > Math.round(currentBalance * 100)) {
      setPaymentAmountError(
        language === 'tl'
          ? `Hindi puwedeng lumampas ang bayad (${formatPeso(amount)}) sa balanse ng utang (${formatPeso(currentBalance)}).`
          : `Payment (${formatPeso(amount)}) cannot exceed the outstanding balance (${formatPeso(currentBalance)}).`
      );
      return;
    }
    setPaymentAmountError('');

    savingRef.current = true;
    setIsSaving(true);
    try {
      const now = new Date().toISOString();
      const ledgerRecord = createUtangLedgerRecord(
        tenantId,
        selectedCustomer.id,
        amount,
        'Payment',
        now,
        paymentNotes.trim()
      );

      // Atomic read-check-write so concurrent submits cannot both pass the check
      const result = await db.transaction('rw', db.customers, db.utangLedger, db.syncQueue, async () => {
        const fresh = await db.customers.get(selectedCustomer.id);
        const latestBalance = fresh?.totalUtangBalance ?? 0;
        if (Math.round(amount * 100) > Math.round(latestBalance * 100)) {
          return { ok: false as const, currentBalance: latestBalance };
        }
        await db.utangLedger.add(ledgerRecord);
        await addSyncRecord('UtangLedger', 'Insert', ledgerRecord);
        const newBalance = Math.round(latestBalance * 100 - amount * 100) / 100;
        await db.customers.update(selectedCustomer.id, {
          totalUtangBalance: newBalance,
          updatedAt: now
        });
        return { ok: true as const, newBalance };
      });

      if (!result.ok) {
        setPaymentAmountError(
          language === 'tl'
            ? `Hindi puwedeng lumampas ang bayad (${formatPeso(amount)}) sa balanse ng utang (${formatPeso(result.currentBalance)}).`
            : `Payment (${formatPeso(amount)}) cannot exceed the outstanding balance (${formatPeso(result.currentBalance)}).`
        );
        return;
      }

      await kickSync();

      setSelectedCustomer({
        ...selectedCustomer,
        totalUtangBalance: result.newBalance,
        updatedAt: now
      });

      setPaymentAmount('');
      setPaymentNotes('');
      setIsPaymentOpen(false);
      setSelectedCustomer(null);
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  };

  // Add credit
  const handleAddCredit = async () => {
    if (!selectedCustomer || selectedCustomer.tenantId !== tenantId || savingRef.current) return;
    const amount = parseFloat(creditAmount);
    if (isNaN(amount) || amount <= 0) {
      setCreditAmountError(
        language === 'tl'
          ? 'Ang halaga ng utang ay dapat higit sa ₱0.'
          : 'Credit amount must be greater than ₱0.'
      );
      return;
    }
    setCreditAmountError('');

    savingRef.current = true;
    setIsSaving(true);
    try {
      const now = new Date().toISOString();
      const ledgerRecord = createUtangLedgerRecord(
        tenantId,
        selectedCustomer.id,
        amount,
        'Credit',
        now,
        creditNotes.trim()
      );

      const newBalance = await db.transaction('rw', db.customers, db.utangLedger, db.syncQueue, async () => {
        const fresh = await db.customers.get(selectedCustomer.id);
        const currentBalance = fresh?.totalUtangBalance ?? (selectedCustomer.totalUtangBalance ?? 0);
        await db.utangLedger.add(ledgerRecord);
        await addSyncRecord('UtangLedger', 'Insert', ledgerRecord);
        const updated = Math.round(currentBalance * 100 + amount * 100) / 100;
        await db.customers.update(selectedCustomer.id, {
          totalUtangBalance: updated,
          updatedAt: now
        });
        return updated;
      });

      await kickSync();

      setSelectedCustomer({
        ...selectedCustomer,
        totalUtangBalance: newBalance,
        updatedAt: now
      });

      setCreditAmount('');
      setCreditNotes('');
      setIsAddCreditOpen(false);
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  };

  return (
    <div className={styles.container}>
      {/* Top Header */}
      <div className={styles.headerRow}>
        <div>
          <Text size={500} weight="bold">{t.utang.title}</Text>
          <Text size={300} style={{ color: tokens.colorNeutralForeground3, display: 'block' }}>
            {t.utang.totalOutstanding}: <strong style={{ color: tokens.colorPaletteRedForeground1 }}>{formatPeso(totalOutstanding)}</strong>
            {' • '}
            <span>{t.utang.customersCount}: {customers.length}{tier === 'Libre' ? ' / 30 (Libre)' : ''}</span>
          </Text>
        </div>
        <Button
          appearance="primary"
          icon={<PersonAddRegular />}
          onClick={() => {
            if (!canAddCustomer(customers.length)) {
              setPageBannerMessage(
                language === 'tl'
                  ? 'Naabot na ang limitasyon ng Libreng plano (30 may utang). Mag-upgrade sa Tindahan Pro o Negosyo Plus upang magtala pa.'
                  : 'Limit reached for Libre plan (30 debtors maximum). Please upgrade to Tindahan Pro or Negosyo Plus to add more debtors.'
              );
              openUpgradeModal();
              return;
            }
            setPageBannerMessage(null);
            setNewCustLimitError(null);
            setIsNewCustomerOpen(true);
          }}
        >
          {t.utang.addNewCustomer}
        </Button>
      </div>

      {/* Limit Warning Banner */}
      {pageBannerMessage && (
        <div role="alert" style={{ marginBottom: tokens.spacingVerticalM }}>
          <MessageBar intent="warning" layout="multiline">
            <MessageBarBody>{pageBannerMessage}</MessageBarBody>
            <MessageBarActions
              containerAction={
                <Button
                  appearance="subtle"
                  aria-label="Dismiss"
                  icon={<DismissRegular />}
                  onClick={() => setPageBannerMessage(null)}
                />
              }
            />
          </MessageBar>
        </div>
      )}

      {/* Search Bar */}
      <div style={{ marginBottom: tokens.spacingVerticalM }}>
        <Input
          style={{ width: '100%' }}
          placeholder={t.utang.searchCustomer}
          value={searchQuery}
          onChange={(_, data) => setSearchQuery(data.value)}
          contentBefore={<SearchRegular />}
        />
      </div>

      {/* Debtors List */}
      <div>
        {filteredCustomers.length === 0 ? (
          <Card style={{ padding: '24px', textAlign: 'center' }}>
            <Text size={300} style={{ color: tokens.colorNeutralForeground3 }}>
              {t.utang.noCustomerFound}
            </Text>
          </Card>
        ) : (
          filteredCustomers.map((cust) => {
            const balance = cust.totalUtangBalance ?? 0;
            const hasUtang = balance > 0;
            return (
              <Card
                key={cust.id}
                className={styles.debtorCard}
                onClick={() => setSelectedCustomer(cust)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        backgroundColor: hasUtang ? '#FFEBEE' : '#E8F5E9',
                        color: hasUtang ? '#C62828' : '#2E7D32',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 'bold'
                      }}
                    >
                      {cust.name.slice(0, 1)}
                    </div>
                    <div>
                      <Text weight="bold" size={300}>{cust.name}</Text>
                      <Text size={200} style={{ color: tokens.colorNeutralForeground3, display: 'block' }}>
                        {cust.phone || t.utang.noPhone}
                      </Text>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <Text
                      size={400}
                      weight="bold"
                      style={{
                        color: hasUtang ? tokens.colorPaletteRedForeground1 : tokens.colorPaletteGreenForeground1,
                        display: 'block'
                      }}
                    >
                      {formatPeso(balance)}
                    </Text>
                    <Badge
                      appearance="tint"
                      color={hasUtang ? 'danger' : 'success'}
                      size="small"
                    >
                      {hasUtang ? t.utang.hasUtang : t.utang.paid}
                    </Badge>
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>

      {/* Debtor Details & Timeline Dialog */}
      <Dialog open={!!selectedCustomer} onOpenChange={(_, data) => !data.open && setSelectedCustomer(null)}>
        <DialogSurface style={{ maxWidth: '500px', width: '100%' }}>
          <DialogBody>
            {selectedCustomer && (
              <>
                <DialogTitle
                  action={
                    <div style={{ textAlign: 'right' }}>
                      <Text size={100} style={{ color: tokens.colorNeutralForeground3, display: 'block' }}>{t.utang.currentDebt}</Text>
                      <div style={{ fontSize: '24px', fontWeight: 'bold', color: selectedCustomerBalance > 0 ? tokens.colorPaletteRedForeground1 : tokens.colorPaletteGreenForeground1 }}>
                        {formatPeso(selectedCustomerBalance)}
                      </div>
                    </div>
                  }
                >
                  <span style={{ display: 'block' }}>{selectedCustomer.name}</span>
                  <span style={{ fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground3, fontWeight: 'normal', display: 'block' }}>
                    Tel: {selectedCustomer.phone || 'N/A'}
                  </span>
                </DialogTitle>

                <DialogContent>
                  {/* Quick actions for this customer */}
                  <div style={{ display: 'flex', gap: '8px', margin: '16px 0', flexWrap: 'wrap' }}>
                    <Button
                      appearance="primary"
                      icon={<PaymentRegular />}
                      style={{ flexGrow: 1 }}
                      onClick={() => {
                        setPaymentAmount(selectedCustomerBalance.toString());
                        setIsPaymentOpen(true);
                      }}
                    >
                      {t.utang.payButton}
                    </Button>
                    <Button
                      appearance="secondary"
                      icon={<AddRegular />}
                      style={{ flexGrow: 1 }}
                      onClick={() => setIsAddCreditOpen(true)}
                    >
                      {t.utang.addDebtButton}
                    </Button>
                  </div>

                  <Divider style={{ margin: '8px 0' }} />

                  <Text weight="semibold" size={300} style={{ marginBottom: '8px', display: 'block' }}>
                    {t.utang.timelineTitle}
                  </Text>

                  <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
                    {ledgerEntries.length === 0 ? (
                      <Text size={200} style={{ color: tokens.colorNeutralForeground3, textAlign: 'center', display: 'block', padding: '12px' }}>
                        {t.utang.noTransactions}
                      </Text>
                    ) : (
                      ledgerEntries.map((entry) => {
                        const isCredit = entry.type === 'Credit';
                        const rawNotes = entry.notes?.trim() || '';
                        const displayNotes = LEGACY_DEFAULT_NOTES.has(rawNotes) ? '' : rawNotes;

                        return (
                          <div key={entry.id} className={styles.timelineItem}>
                            <div className={styles.timelineHeaderRow}>
                              <Badge
                                appearance="filled"
                                color={isCredit ? 'danger' : 'success'}
                                size="small"
                                className={styles.timelineBadge}
                              >
                                {isCredit ? '+\u00A0UTANG' : '-\u00A0BAYAD'}
                              </Badge>
                              <Text
                                weight="bold"
                                size={300}
                                className={styles.timelineAmount}
                                style={{ color: isCredit ? tokens.colorPaletteRedForeground1 : tokens.colorPaletteGreenForeground1 }}
                              >
                                {isCredit ? '+' : '-'}{formatPeso(entry.amount)}
                              </Text>
                            </div>
                            {displayNotes && (
                              <Text weight="semibold" size={200} className={styles.timelineNotes}>
                                {displayNotes}
                              </Text>
                            )}
                            <Text size={100} style={{ color: tokens.colorNeutralForeground3, marginTop: '2px', display: 'block' }}>
                              {new Date(entry.date).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                            </Text>
                          </div>
                        );
                      })
                    )}
                  </div>
                </DialogContent>
              </>
            )}

            <DialogActions style={{ marginTop: '16px' }}>
              <Button appearance="subtle" onClick={() => setSelectedCustomer(null)}>
                {t.common.close}
              </Button>
            </DialogActions>

      {/* Record Payment Dialog */}
      <Dialog open={isPaymentOpen} onOpenChange={(_, data) => setIsPaymentOpen(data.open)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>{t.utang.recordPaymentTitle} {selectedCustomer?.name}</DialogTitle>
            <DialogContent>
              <div style={{ margin: '8px 0' }}>
                <Text size={200} weight="semibold">{t.utang.paymentAmountLabel}</Text>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  aria-label={t.utang.paymentAmountLabel}
                  style={{ width: '100%', marginTop: '4px' }}
                  value={paymentAmount}
                  onChange={(_, data) => {
                    setPaymentAmount(data.value);
                    setPaymentAmountError('');
                  }}
                  placeholder="0.00"
                  contentBefore="₱"
                  aria-invalid={!!paymentAmountError}
                />
                {paymentAmountError && (
                  <Text role="alert" size={200} style={{ color: tokens.colorPaletteRedForeground1, display: 'block', marginTop: '4px' }}>
                    {paymentAmountError}
                  </Text>
                )}
              </div>

              {selectedCustomer && selectedCustomerBalance > 0 && (
                <Button
                  size="small"
                  appearance="subtle"
                  onClick={() => setPaymentAmount(selectedCustomerBalance.toString())}
                >
                  {t.utang.payAll} ({formatPeso(selectedCustomerBalance)})
                </Button>
              )}

                    <div style={{ margin: '12px 0' }}>
                      <Text size={200} weight="semibold">{t.utang.paymentNotesLabel}</Text>
                      <Input
                        aria-label={t.utang.paymentNotesLabel}
                        style={{ width: '100%', marginTop: '4px' }}
                        value={paymentNotes}
                        onChange={(_, data) => setPaymentNotes(data.value)}
                        placeholder={t.utang.paymentNotesPlaceholder}
                      />
                    </div>
                  </DialogContent>

                  <DialogActions>
                    <Button appearance="subtle" onClick={() => setIsPaymentOpen(false)}>
                      {t.common.cancel}
                    </Button>
                    <Button appearance="primary" icon={<CheckmarkRegular />} onClick={handleRecordPayment} disabled={isSaving}>
                      {t.utang.confirmPayment}
                    </Button>
                  </DialogActions>
                </DialogBody>
              </DialogSurface>
            </Dialog>

            {/* Add Credit Dialog */}
            <Dialog open={isAddCreditOpen} onOpenChange={(_, data) => setIsAddCreditOpen(data.open)}>
              <DialogSurface>
                <DialogBody>
                  <DialogTitle>{t.utang.addCreditTitle} {selectedCustomer?.name}</DialogTitle>
                  <DialogContent>
                    <div style={{ margin: '8px 0' }}>
                      <Text size={200} weight="semibold">{t.utang.creditAmountLabel}</Text>
                      <Input
                        type="number"
                        aria-invalid={!!creditAmountError}
                        style={{ width: '100%', marginTop: '4px' }}
                        value={creditAmount}
                        onChange={(_, data) => {
                          setCreditAmount(data.value);
                          if (creditAmountError) setCreditAmountError('');
                        }}
                        placeholder="0.00"
                        contentBefore="₱"
                      />
                      {creditAmountError && (
                        <Text role="alert" size={200} style={{ color: tokens.colorPaletteRedForeground1, marginTop: '2px', display: 'block' }}>
                          {creditAmountError}
                        </Text>
                      )}
                    </div>

                    <div style={{ margin: '12px 0' }}>
                      <Text size={200} weight="semibold">{t.utang.creditNotesLabel}</Text>
                      <Input
                        aria-label={t.utang.customerNameLabel}
                        style={{ width: '100%', marginTop: '4px' }}
                        value={creditNotes}
                        onChange={(_, data) => setCreditNotes(data.value)}
                        placeholder={t.utang.creditNotesPlaceholder}
                      />
                    </div>
                  </DialogContent>

                  <DialogActions>
                    <Button appearance="subtle" onClick={() => setIsAddCreditOpen(false)}>
                      {t.common.cancel}
                    </Button>
                    <Button appearance="primary" icon={<CheckmarkRegular />} onClick={handleAddCredit} disabled={isSaving}>
                      {t.utang.saveCredit}
                    </Button>
                  </DialogActions>
                </DialogBody>
              </DialogSurface>
            </Dialog>
          </DialogBody>
        </DialogSurface>
      </Dialog>


      {/* Create New Customer Dialog */}
      <Dialog open={isNewCustomerOpen} onOpenChange={(_, data) => {
        setIsNewCustomerOpen(data.open);
        if (!data.open) {
          setNewCustNameError('');
          setNewCustPhoneError('');
          setNewCustInitialUtangError('');
          setNewCustLimitError(null);
        }
      }}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>{t.utang.addNewCustomer}</DialogTitle>
            <DialogContent>
              {newCustLimitError && (
                <div role="alert" style={{ marginBottom: tokens.spacingVerticalS }}>
                  <MessageBar intent="warning" layout="multiline">
                    <MessageBarBody>{newCustLimitError}</MessageBarBody>
                  </MessageBar>
                </div>
              )}
              <div style={{ margin: '8px 0' }}>
                <Text size={200} weight="semibold">{t.utang.customerNameLabel}</Text>
                <Input
                  aria-label={t.utang.customerNameLabel}
                  aria-invalid={Boolean(newCustNameError)}
                  aria-describedby={newCustNameError ? 'utang-customer-name-error' : undefined}
                  style={{ width: '100%', marginTop: '4px' }}
                  value={newCustName}
                  onChange={(_, data) => {
                    setNewCustName(data.value);
                    if (newCustNameError) setNewCustNameError('');
                  }}
                  placeholder={t.utang.customerNamePlaceholder}
                />
                {newCustNameError && (
                  <Text id="utang-customer-name-error" role="alert" size={200} style={{ color: tokens.colorPaletteRedForeground1, marginTop: '2px', display: 'block' }}>
                    {newCustNameError}
                  </Text>
                )}
              </div>

              <div style={{ margin: '8px 0' }}>
                <Text size={200} weight="semibold">{t.utang.phoneLabel}</Text>
                <Input
                  type="tel"
                  aria-label={t.utang.phoneLabel}
                  aria-invalid={Boolean(newCustPhoneError)}
                  aria-describedby={newCustPhoneError ? 'utang-customer-phone-error' : undefined}
                  inputMode="tel"
                  style={{ width: '100%', marginTop: '4px' }}
                  value={newCustPhone}
                  onChange={(_, data) => {
                    setNewCustPhone(data.value);
                    if (newCustPhoneError) setNewCustPhoneError('');
                  }}
                  placeholder="09XXXXXXXXX"
                />
                {newCustPhoneError && (
                  <Text id="utang-customer-phone-error" role="alert" size={200} style={{ color: tokens.colorPaletteRedForeground1, marginTop: '2px', display: 'block' }}>
                    {newCustPhoneError}
                  </Text>
                )}
              </div>

              <div style={{ margin: '8px 0' }}>
                <Text size={200} weight="semibold">{t.utang.initialDebtLabel}</Text>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  aria-label={t.utang.initialDebtLabel}
                  aria-invalid={!!newCustInitialUtangError}
                  aria-describedby={newCustInitialUtangError ? 'utang-initial-debt-error' : undefined}
                  style={{ width: '100%', marginTop: '4px' }}
                  value={newCustInitialUtang}
                  onChange={(_, data) => {
                    setNewCustInitialUtang(data.value);
                    if (newCustInitialUtangError) setNewCustInitialUtangError('');
                  }}
                  placeholder="0.00"
                  contentBefore="₱"
                />
                {newCustInitialUtangError && (
                  <Text id="utang-initial-debt-error" role="alert" size={200} style={{ color: tokens.colorPaletteRedForeground1, marginTop: '2px', display: 'block' }}>
                    {newCustInitialUtangError}
                  </Text>
                )}
              </div>
            </DialogContent>

            <DialogActions>
              <Button appearance="subtle" onClick={() => setIsNewCustomerOpen(false)}>
                {t.common.cancel}
              </Button>
              <Button appearance="primary" icon={<CheckmarkRegular />} onClick={handleCreateCustomer}>
                {t.utang.saveCustomer}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
};
