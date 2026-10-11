import React, { useState, useMemo } from 'react';
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
  Divider
} from '@fluentui/react-components';
import {
  SearchRegular,
  PersonAddRegular,
  PaymentRegular,
  AddRegular,
  CheckmarkRegular
} from '@fluentui/react-icons';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type CustomerRecord, type UtangLedgerRecord } from '../db/db';
import { useAuthStore } from '../state/authStore';
import { enqueueSync } from '../sync/syncEngine';
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
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    ...shorthands.gap(tokens.spacingHorizontalM),
    ...shorthands.padding(tokens.spacingVerticalS, '0'),
    ...shorthands.borderBottom('1px', 'solid', tokens.colorNeutralStroke2)
  },
  timelineLeft: {
    display: 'flex',
    flexDirection: 'column',
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0
  },
  timelineBadgeRow: {
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap(tokens.spacingHorizontalXS),
    minWidth: 0
  },
  timelineBadge: {
    whiteSpace: 'nowrap',
    flexShrink: 0
  },
  timelineNotes: {
    overflowWrap: 'break-word',
    wordBreak: 'break-word',
    minWidth: 0
  },
  timelineAmount: {
    whiteSpace: 'nowrap',
    flexShrink: 0,
    textAlign: 'right'
  }
});

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

  // Form states
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustInitialUtang, setNewCustInitialUtang] = useState('');

  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');

  const [creditAmount, setCreditAmount] = useState('');
  const [creditNotes, setCreditNotes] = useState('');

  const tenantId = useAuthStore((s) => s.tenantId);

  // Live queries
  const customers = useLiveQuery(() => db.customers.toArray(), []) || [];
  const selectedCustomerId = selectedCustomer?.id;

  const ledgerEntries = useLiveQuery(
    async (): Promise<UtangLedgerRecord[]> => {
      if (!selectedCustomerId) return [];
      const list = await db.utangLedger
        .where('customerId')
        .equals(selectedCustomerId)
        .reverse()
        .sortBy('date');
      return list;
    },
    [selectedCustomerId]
  ) || [];

  // Filtered debtors
  const filteredCustomers = useMemo(() => {
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.phone.includes(searchQuery)
    );
  }, [customers, searchQuery]);

  const totalOutstanding = useMemo(() => {
    return customers.reduce((sum, c) => sum + (c.totalUtangBalance || 0), 0);
  }, [customers]);

  // Create new customer
  const handleCreateCustomer = async () => {
    if (!newCustName.trim()) return;

    if (!canAddCustomer(customers.length)) {
      alert(
        language === 'tl'
          ? 'Naabot na ang limitasyon ng Libreng plano (30 may utang). Mag-upgrade sa Tindahan Pro o Negosyo Plus upang magtala pa.'
          : 'Limit reached for Libre plan (30 debtors maximum). Please upgrade to Tindahan Pro or Negosyo Plus to add more debtors.'
      );
      openUpgradeModal();
      return;
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const initBalance = parseFloat(newCustInitialUtang) || 0;

    const newCustomer: CustomerRecord = {
      id,
      tenantId,
      name: newCustName.trim(),
      phone: newCustPhone.trim(),
      totalUtangBalance: initBalance,
      updatedAt: now
    };

    await db.customers.add(newCustomer);
    await enqueueSync('Customer', 'Insert', newCustomer);

    if (initBalance > 0) {
      const ledgerId = crypto.randomUUID();
      const ledgerRecord: UtangLedgerRecord = {
        id: ledgerId,
        tenantId,
        customerId: id,
        amount: initBalance,
        type: 'Credit',
        date: now,
        notes: 'Unang tala ng utang'
      };
      await db.utangLedger.add(ledgerRecord);
      await enqueueSync('UtangLedger', 'Insert', ledgerRecord);
    }

    setNewCustName('');
    setNewCustPhone('');
    setNewCustInitialUtang('');
    setIsNewCustomerOpen(false);
  };

  // Record payment
  const handleRecordPayment = async () => {
    if (!selectedCustomer) return;
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) return;

    const fresh = await db.customers.get(selectedCustomer.id);
    const currentBalance = fresh?.totalUtangBalance ?? selectedCustomer.totalUtangBalance ?? 0;
    if (Math.round(amount * 100) > Math.round(currentBalance * 100)) {
      alert(
        language === 'tl'
          ? `Hindi puwedeng lumampas ang bayad (₱${amount.toFixed(2)}) sa balanse ng utang (₱${currentBalance.toFixed(2)}).`
          : `Payment (₱${amount.toFixed(2)}) cannot exceed the outstanding balance (₱${currentBalance.toFixed(2)}).`
      );
      return;
    }


    const now = new Date().toISOString();
    const ledgerId = crypto.randomUUID();

    const ledgerRecord: UtangLedgerRecord = {
      id: ledgerId,
      tenantId,
      customerId: selectedCustomer.id,
      amount,
      type: 'Payment',
      date: now,
      notes: paymentNotes || 'Bayad sa utang'
    };

    await db.utangLedger.add(ledgerRecord);
    await enqueueSync('UtangLedger', 'Insert', ledgerRecord);

    const newBalance = Math.round((currentBalance * 100 - amount * 100)) / 100;
    await db.customers.update(selectedCustomer.id, {
      totalUtangBalance: newBalance,
      updatedAt: now
    });

    setSelectedCustomer({
      ...selectedCustomer,
      totalUtangBalance: newBalance,
      updatedAt: now
    });

    setPaymentAmount('');
    setPaymentNotes('');
    setIsPaymentOpen(false);
  };

  // Add credit
  const handleAddCredit = async () => {
    if (!selectedCustomer) return;
    const amount = parseFloat(creditAmount);
    if (isNaN(amount) || amount <= 0) return;

    const now = new Date().toISOString();
    const ledgerId = crypto.randomUUID();

    const ledgerRecord: UtangLedgerRecord = {
      id: ledgerId,
      tenantId,
      customerId: selectedCustomer.id,
      amount,
      type: 'Credit',
      date: now,
      notes: creditNotes || 'Dagdag na utang'
    };

    await db.utangLedger.add(ledgerRecord);
    await enqueueSync('UtangLedger', 'Insert', ledgerRecord);

    const newBalance = Math.round((selectedCustomer.totalUtangBalance || 0) * 100 + amount * 100) / 100;
    await db.customers.update(selectedCustomer.id, {
      totalUtangBalance: newBalance,
      updatedAt: now
    });

    setSelectedCustomer({
      ...selectedCustomer,
      totalUtangBalance: newBalance,
      updatedAt: now
    });

    setCreditAmount('');
    setCreditNotes('');
    setIsAddCreditOpen(false);
  };

  return (
    <div className={styles.container}>
      {/* Top Header */}
      <div className={styles.headerRow}>
        <div>
          <Text size={500} weight="bold">{t.utang.title}</Text>
          <Text size={300} style={{ color: tokens.colorNeutralForeground3, display: 'block' }}>
            {t.utang.totalOutstanding}: <strong style={{ color: tokens.colorPaletteRedForeground1 }}>₱{totalOutstanding.toFixed(2)}</strong>
            {' • '}
            <span>{t.utang.customersCount}: {customers.length}{tier === 'Libre' ? ' / 30 (Libre)' : ''}</span>
          </Text>
        </div>
        <Button
          appearance="primary"
          icon={<PersonAddRegular />}
          onClick={() => {
            if (!canAddCustomer(customers.length)) {
              alert(
                language === 'tl'
                  ? 'Naabot na ang limitasyon ng Libreng plano (30 may utang). Mag-upgrade sa Tindahan Pro o Negosyo Plus upang magtala pa.'
                  : 'Limit reached for Libre plan (30 debtors maximum). Please upgrade to Tindahan Pro or Negosyo Plus to add more debtors.'
              );
              openUpgradeModal();
              return;
            }
            setIsNewCustomerOpen(true);
          }}
        >
          {t.utang.addNewCustomer}
        </Button>
      </div>

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
            const hasUtang = cust.totalUtangBalance > 0;
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
                      ₱{cust.totalUtangBalance.toFixed(2)}
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <DialogTitle>{selectedCustomer.name}</DialogTitle>
                    <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
                      Tel: {selectedCustomer.phone || 'N/A'}
                    </Text>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <Text size={100} style={{ color: tokens.colorNeutralForeground3 }}>{t.utang.currentDebt}</Text>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: selectedCustomer.totalUtangBalance > 0 ? tokens.colorPaletteRedForeground1 : tokens.colorPaletteGreenForeground1 }}>
                      ₱{selectedCustomer.totalUtangBalance.toFixed(2)}
                    </div>
                  </div>
                </div>

                {/* Quick actions for this customer */}
                <div style={{ display: 'flex', gap: '8px', margin: '16px 0', flexWrap: 'wrap' }}>
                  <Button
                    appearance="primary"
                    icon={<PaymentRegular />}
                    style={{ flexGrow: 1 }}
                    onClick={() => {
                      setPaymentAmount(selectedCustomer.totalUtangBalance.toString());
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
                      return (
                        <div key={entry.id} className={styles.timelineItem}>
                          <div className={styles.timelineLeft}>
                            <div className={styles.timelineBadgeRow}>
                              <Badge
                                appearance="filled"
                                color={isCredit ? 'danger' : 'success'}
                                size="small"
                                className={styles.timelineBadge}
                              >
                                {isCredit ? '+\u00A0UTANG' : '-\u00A0BAYAD'}
                              </Badge>
                              <Text weight="semibold" size={200} className={styles.timelineNotes}>
                                {entry.notes || (isCredit ? t.nav.utang : t.common.pesos)}
                              </Text>
                            </div>
                            <Text size={100} style={{ color: tokens.colorNeutralForeground3, marginTop: '2px', display: 'block' }}>
                              {new Date(entry.date).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                            </Text>
                          </div>
                          <Text
                            weight="bold"
                            size={300}
                            className={styles.timelineAmount}
                            style={{ color: isCredit ? tokens.colorPaletteRedForeground1 : tokens.colorPaletteGreenForeground1 }}
                          >
                            {isCredit ? '+' : '-'}₱{entry.amount.toFixed(2)}
                          </Text>
                        </div>
                      );
                    })
                  )}
                </div>
              </>
            )}

            <DialogActions style={{ marginTop: '16px' }}>
              <Button appearance="subtle" onClick={() => setSelectedCustomer(null)}>
                {t.common.close}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>

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
                  style={{ width: '100%', marginTop: '4px' }}
                  value={paymentAmount}
                  onChange={(_, data) => setPaymentAmount(data.value)}
                  placeholder="0.00"
                  contentBefore="₱"
                />
              </div>

              {selectedCustomer && selectedCustomer.totalUtangBalance > 0 && (
                <Button
                  size="small"
                  appearance="subtle"
                  onClick={() => setPaymentAmount(selectedCustomer.totalUtangBalance.toString())}
                >
                  {t.utang.payAll} (₱{selectedCustomer.totalUtangBalance.toFixed(2)})
                </Button>
              )}

              <div style={{ margin: '12px 0' }}>
                <Text size={200} weight="semibold">{t.utang.paymentNotesLabel}</Text>
                <Input
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
              <Button appearance="primary" icon={<CheckmarkRegular />} onClick={handleRecordPayment}>
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
                  style={{ width: '100%', marginTop: '4px' }}
                  value={creditAmount}
                  onChange={(_, data) => setCreditAmount(data.value)}
                  placeholder="0.00"
                  contentBefore="₱"
                />
              </div>

              <div style={{ margin: '12px 0' }}>
                <Text size={200} weight="semibold">{t.utang.creditNotesLabel}</Text>
                <Input
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
              <Button appearance="primary" icon={<CheckmarkRegular />} onClick={handleAddCredit}>
                {t.utang.saveCredit}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>

      {/* Create New Customer Dialog */}
      <Dialog open={isNewCustomerOpen} onOpenChange={(_, data) => setIsNewCustomerOpen(data.open)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>{t.utang.addNewCustomer}</DialogTitle>
            <DialogContent>
              <div style={{ margin: '8px 0' }}>
                <Text size={200} weight="semibold">{t.utang.customerNameLabel}</Text>
                <Input
                  style={{ width: '100%', marginTop: '4px' }}
                  value={newCustName}
                  onChange={(_, data) => setNewCustName(data.value)}
                  placeholder={t.utang.customerNamePlaceholder}
                />
              </div>

              <div style={{ margin: '8px 0' }}>
                <Text size={200} weight="semibold">{t.utang.phoneLabel}</Text>
                <Input
                  style={{ width: '100%', marginTop: '4px' }}
                  value={newCustPhone}
                  onChange={(_, data) => setNewCustPhone(data.value)}
                  placeholder="09XXXXXXXXX"
                />
              </div>

              <div style={{ margin: '8px 0' }}>
                <Text size={200} weight="semibold">{t.utang.initialDebtLabel}</Text>
                <Input
                  type="number"
                  style={{ width: '100%', marginTop: '4px' }}
                  value={newCustInitialUtang}
                  onChange={(_, data) => setNewCustInitialUtang(data.value)}
                  placeholder="0.00"
                  contentBefore="₱"
                />
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
