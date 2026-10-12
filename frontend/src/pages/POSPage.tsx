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
  TabList,
  Tab,
  Select,
  Divider
} from '@fluentui/react-components';
import {
  SearchRegular,
  BarcodeScannerRegular,
  AddRegular,
  SubtractRegular,
  DeleteRegular,
  ShoppingBagRegular,
  CheckmarkCircleRegular,
  MoneyRegular,
  PhoneRegular,
  NotebookRegular,
  ArrowSwapRegular,
  ChevronLeftRegular,
  ChevronRightRegular,
  PersonAddRegular,
  DismissRegular,
  CheckmarkRegular
} from '@fluentui/react-icons';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type ProductRecord, type CustomerRecord } from '../db/db';
import { useCartStore } from '../state/cartStore';
import { useAuthStore } from '../state/authStore';
import { usePwaStore } from '../state/pwaStore';
import { formatPeso } from '../utils/currency';
import { normalizePhilippineMobile } from '../utils/philippineMobile';
import { enqueueSync } from '../sync/syncEngine';
import { ReceiptModal, type ReceiptData } from '../components/ReceiptModal';
import { BarcodeScannerModal } from '../components/BarcodeScannerModal';
import { QuickRegisterProductDialog } from '../components/QuickRegisterProductDialog';
import { playScanBeep } from '../utils/sound';
import { useTranslation } from '../state/languageStore';

const useStyles = makeStyles({
  container: {
    ...shorthands.padding(tokens.spacingVerticalM, tokens.spacingHorizontalM),
    maxWidth: '1080px',
    marginLeft: 'auto',
    marginRight: 'auto',
    paddingBottom: '120px' // room for floating cart bar and nav
  },
  searchBarRow: {
    display: 'flex',
    ...shorthands.gap(tokens.spacingHorizontalS),
    marginBottom: tokens.spacingVerticalM
  },
  searchInput: {
    flexGrow: 1
  },
  categoriesWrapper: {
    display: 'flex',
    alignItems: 'center',
    position: 'relative',
    marginBottom: tokens.spacingVerticalM,
    ...shorthands.gap(tokens.spacingHorizontalXS)
  },
  categoriesScroll: {
    display: 'flex',
    ...shorthands.gap(tokens.spacingHorizontalXS),
    overflowX: 'auto',
    scrollBehavior: 'smooth',
    flexGrow: 1,
    paddingTop: '2px',
    paddingBottom: '4px',
    scrollbarWidth: 'none',
    '::-webkit-scrollbar': { display: 'none' }
  },
  categoryChip: {
    flexShrink: 0,
    whiteSpace: 'nowrap',
    fontWeight: 500,
    fontSize: tokens.fontSizeBase200
  },
  scrollNavBtn: {
    minWidth: '28px',
    width: '28px',
    height: '28px',
    flexShrink: 0,
    ...shorthands.padding(0),
    ...shorthands.borderRadius(tokens.borderRadiusCircular),
    boxShadow: tokens.shadow2,
    backgroundColor: tokens.colorNeutralBackground1
  },
  productGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
    ...shorthands.gap(tokens.spacingHorizontalM)
  },
  productCard: {
    ...shorthands.padding(tokens.spacingVerticalS, tokens.spacingHorizontalS),
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    minHeight: '130px',
    transitionProperty: 'transform, border-color',
    transitionDuration: tokens.durationNormal,
    '&:hover': {
      ...shorthands.borderColor(tokens.colorBrandStroke1),
      transform: 'translateY(-2px)'
    }
  },
  productPrice: {
    fontSize: tokens.fontSizeBase400,
    fontWeight: 'bold',
    color: tokens.colorBrandForeground1
  },
  floatingCartBar: {
    position: 'fixed',
    bottom: '62px', // above bottom navigation on mobile
    left: '12px',
    right: '12px',
    maxWidth: '976px',
    marginLeft: 'auto',
    marginRight: 'auto',
    backgroundColor: tokens.colorBrandBackground,
    color: tokens.colorNeutralBackground1,
    ...shorthands.padding(tokens.spacingVerticalS, tokens.spacingHorizontalM),
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    boxShadow: tokens.shadow16,
    zIndex: 85,
    cursor: 'pointer',
    '@media (min-width: 768px)': {
      left: '50%',
      right: 'auto',
      transform: 'translateX(-50%)',
      width: 'calc(100% - 32px)',
      maxWidth: '560px',
      bottom: '84px',
      ...shorthands.borderRadius('24px')
    }
  },
  quickBillsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    ...shorthands.gap(tokens.spacingHorizontalS),
    marginTop: tokens.spacingVerticalS
  },
  cartList: {
    display: 'flex',
    flexDirection: 'column',
    ...shorthands.gap(tokens.spacingVerticalS),
    maxHeight: '260px',
    overflowY: 'auto'
  },
  cartItemRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    ...shorthands.padding(tokens.spacingVerticalXS, '0')
  }
});

const QUICK_PESO_BILLS = [20, 50, 100, 200, 500, 1000];

export const POSPage: React.FC = () => {
  const styles = useStyles();
  const { t, language } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
  const [pendingReceiptData, setPendingReceiptData] = useState<ReceiptData | null>(null);
  const checkoutDialogRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (isCheckoutOpen || !pendingReceiptData) return;

    const timeoutId = window.setTimeout(() => {
      setReceiptData(pendingReceiptData);
      setPendingReceiptData(null);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [isCheckoutOpen, pendingReceiptData]);

  React.useEffect(() => {
    if (receiptData) {
      checkoutDialogRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    }
  }, [receiptData]);

  // Category horizontal scroll controls
  const categoryScrollRef = React.useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = React.useCallback(() => {
    if (categoryScrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = categoryScrollRef.current;
      setCanScrollLeft(scrollLeft > 4);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 4);
    }
  }, []);

  React.useEffect(() => {
    checkScroll();
    const handleResize = () => checkScroll();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [checkScroll]);

  const handleScrollCategories = (direction: 'left' | 'right') => {
    if (categoryScrollRef.current) {
      const offset = direction === 'left' ? -220 : 220;
      categoryScrollRef.current.scrollBy({ left: offset, behavior: 'smooth' });
      setTimeout(checkScroll, 250);
    }
  };

  const handleCategoryWheel = (e: React.WheelEvent) => {
    if (categoryScrollRef.current && Math.abs(e.deltaX) < Math.abs(e.deltaY)) {
      categoryScrollRef.current.scrollLeft += e.deltaY;
      checkScroll();
    }
  };

  // Zustand cart store
  const {
    items: cartItems,
    addItem,
    removeItem,
    updateQty,
    clearCart,
    getTotalAmount,
    getTotalCount,
    customerId,
    setCustomer,
    paymentMethod,
    setPaymentMethod,
    cashReceived,
    setCashReceived,
    splitCashAmount,
    splitGCashAmount,
    setSplitAmounts
  } = useCartStore();

  const tenantId = useAuthStore((s) => s.tenantId);
  const userId = useAuthStore((s) => s.userId);

  // Barcode scanner & quick registration states
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [unrecognizedBarcode, setUnrecognizedBarcode] = useState<string | null>(null);
  const [isQuickRegOpen, setIsQuickRegOpen] = useState(false);
  const [scanToast, setScanToast] = useState<string | null>(null);

  // Quick add debtor states (for Utang checkout)
  const [isAddDebtorOpen, setIsAddDebtorOpen] = useState(false);
  const [newDebtorName, setNewDebtorName] = useState('');
  const [newDebtorPhone, setNewDebtorPhone] = useState('');
  const [newDebtorError, setNewDebtorError] = useState<string | null>(null);

  // Live queries from Dexie
  const products = useLiveQuery(() => db.products.toArray(), []) || [];
  const customers = useLiveQuery(() => db.customers.toArray(), []) || [];

  // Extract unique categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return [t.pos.allCategories, ...Array.from(set)];
  }, [products, t.pos.allCategories]);

  // Filter products by search and category
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.barcode && p.barcode.includes(searchQuery));
      const matchesCategory =
        selectedCategory === t.pos.allCategories ||
        selectedCategory === 'All' ||
        selectedCategory === 'Lahat' ||
        p.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [products, searchQuery, selectedCategory, t.pos.allCategories]);

  const totalAmount = getTotalAmount();
  const totalCount = getTotalCount();

  const handleBarcodeProcess = (rawQuery: string) => {
    const trimmed = rawQuery.trim();
    if (!trimmed) return;

    // 1. Exact Barcode Match
    const exactBarcodeMatch = products.find(
      (p) => p.barcode && p.barcode.trim().toLowerCase() === trimmed.toLowerCase()
    );

    if (exactBarcodeMatch) {
      addItem({ id: exactBarcodeMatch.id, name: exactBarcodeMatch.name, price: exactBarcodeMatch.price });
      playScanBeep();
      setScanToast(`${exactBarcodeMatch.name} - ${t.barcode.addedToCart}`);
      setTimeout(() => setScanToast(null), 2500);
      setSearchQuery('');
      return;
    }

    // 2. Exact Name Match
    const exactNameMatch = products.find(
      (p) => p.name.toLowerCase() === trimmed.toLowerCase()
    );

    if (exactNameMatch) {
      addItem({ id: exactNameMatch.id, name: exactNameMatch.name, price: exactNameMatch.price });
      playScanBeep();
      setScanToast(`${exactNameMatch.name} - ${t.barcode.addedToCart}`);
      setTimeout(() => setScanToast(null), 2500);
      setSearchQuery('');
      return;
    }

    // 3. Single partial name match
    const partialMatches = products.filter((p) =>
      p.name.toLowerCase().includes(trimmed.toLowerCase())
    );

    if (partialMatches.length === 1) {
      const match = partialMatches[0];
      addItem({ id: match.id, name: match.name, price: match.price });
      playScanBeep();
      setScanToast(`${match.name} - ${t.barcode.addedToCart}`);
      setTimeout(() => setScanToast(null), 2500);
      setSearchQuery('');
      return;
    }

    // 4. Barcode not found -> Trigger Quick Registration Prompt
    setUnrecognizedBarcode(trimmed);
    setIsQuickRegOpen(true);
    setSearchQuery('');
  };

  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    handleBarcodeProcess(searchQuery);
  };

  const handleProductRegistered = (newProduct: ProductRecord) => {
    addItem({ id: newProduct.id, name: newProduct.name, price: newProduct.price });
    playScanBeep();
    setScanToast(`${newProduct.name} - ${t.barcode.registeredSuccess}`);
    setTimeout(() => setScanToast(null), 3000);
  };

  const handleQuickBillClick = (billAmount: number) => {
    setCashReceived(billAmount);
  };

  const handleExactCashClick = () => {
    setCashReceived(totalAmount);
  };

  const changeAmount = useMemo(() => {
    if (paymentMethod === 'Cash') {
      return Math.max(0, cashReceived - totalAmount);
    }
    if (paymentMethod === 'Split') {
      const totalPaid = splitCashAmount + splitGCashAmount;
      return Math.max(0, totalPaid - totalAmount);
    }
    return 0;
  }, [paymentMethod, cashReceived, splitCashAmount, splitGCashAmount, totalAmount]);

  // Tender validation in integer centavos
  const { isTenderValid, tenderError } = useMemo(() => {
    const totalC = Math.round(totalAmount * 100);
    const fmt = (c: number) => formatPeso(c / 100);
    const tl = language === 'tl';
    if (paymentMethod === 'Cash') {
      const cashC = Math.round(cashReceived * 100);
      if (cashC < 0) {
        return { isTenderValid: false, tenderError: tl ? 'Hindi puwedeng negatibo ang tinanggap na pera.' : 'Cash tendered cannot be negative.' };
      }
      if (cashC < totalC) {
        return { isTenderValid: false, tenderError: tl ? `Kulang ng ${fmt(totalC - cashC)}` : `Short by ${fmt(totalC - cashC)}` };
      }
    }
    if (paymentMethod === 'Split') {
      const cashC = Math.round(splitCashAmount * 100);
      const gcashC = Math.round(splitGCashAmount * 100);
      if (cashC < 0 || gcashC < 0) {
        return { isTenderValid: false, tenderError: tl ? 'Hindi puwedeng negatibo ang halaga.' : 'Amounts cannot be negative.' };
      }
      if (cashC + gcashC < totalC) {
        return { isTenderValid: false, tenderError: tl ? `Kulang ng ${fmt(totalC - cashC - gcashC)}` : `Short by ${fmt(totalC - cashC - gcashC)}` };
      }
    }
    return { isTenderValid: true, tenderError: '' };
  }, [paymentMethod, cashReceived, splitCashAmount, splitGCashAmount, totalAmount, language]);

  // Quick add new debtor during checkout
  const handleSaveNewDebtor = async () => {
    if (!newDebtorName.trim()) {
      setNewDebtorError(t.pos.debtorNameRequired);
      return;
    }

    const phone = normalizePhilippineMobile(newDebtorPhone);
    if (phone === null) {
      setNewDebtorError(language === 'tl'
        ? 'Maglagay ng wastong Philippine mobile number.'
        : 'Enter a valid Philippine mobile number.');
      return;
    }

    const newCustId = crypto.randomUUID();
    const now = new Date().toISOString();
    const newCust: CustomerRecord = {
      id: newCustId,
      tenantId,
      name: newDebtorName.trim(),
      phone,
      totalUtangBalance: 0,
      updatedAt: now
    };

    await db.customers.add(newCust);
    await enqueueSync('Customer', 'Insert', newCust);

    setCustomer(newCust.id, newCust.name);
    setNewDebtorName('');
    setNewDebtorPhone('');
    setNewDebtorError(null);
    setIsAddDebtorOpen(false);
  };

  // Complete checkout
  const handleCompleteSale = async () => {
    if (cartItems.length === 0) return;
    if (!isTenderValid) return;

    if (paymentMethod === 'Utang' && !customerId) {
      alert(t.pos.customerSelectRequired);
      return;
    }

    usePwaStore.getState().setIsSaleInProgress(true);
    try {
      const saleId = crypto.randomUUID();
      const now = new Date().toISOString();

      const selectedCust =
        customers.find((c) => c.id === customerId) ||
        (customerId ? await db.customers.get(customerId) : undefined);

      const saleRecord = {
        id: saleId,
        tenantId,
        totalAmount,
        paymentMethod,
        date: now,
        userId,
        customerId: customerId || undefined,
        cashReceived: paymentMethod === 'Cash' ? cashReceived : undefined,
        changeGiven: paymentMethod === 'Cash' ? changeAmount : undefined
      };

      const saleItemRecords = cartItems.map((item) => ({
        id: crypto.randomUUID(),
        tenantId,
        saleId,
        productId: item.productId,
        productName: item.name,
        qty: item.qty,
        unitPrice: item.price,
        subtotal: item.subtotal
      }));

      let utangId: string | null = null;
      if (paymentMethod === 'Utang' && customerId) {
        utangId = crypto.randomUUID();
      }

      // Save directly to Dexie
      await db.transaction('rw', db.sales, db.saleItems, db.utangLedger, db.customers, db.products, async () => {
        await db.sales.add(saleRecord);
        await db.saleItems.bulkAdd(saleItemRecords);

        // Deduct stock in Dexie
        for (const item of cartItems) {
          const prod = await db.products.get(item.productId);
          if (prod && prod.stockQty !== undefined) {
            await db.products.update(item.productId, {
              stockQty: Math.max(0, prod.stockQty - item.qty)
            });
          }
        }

        // If Utang, append to UtangLedger and update customer balance
        if (utangId && customerId) {
          await db.utangLedger.add({
            id: utangId,
            tenantId,
            customerId,
            amount: totalAmount,
            type: 'Credit',
            date: now,
            refSaleId: saleId,
            notes: `Benta POS #${saleId.slice(0, 6)}`
          });

          const cust = await db.customers.get(customerId);
          if (cust) {
            const newBal = (cust.totalUtangBalance || 0) + totalAmount;
            await db.customers.update(customerId, {
              totalUtangBalance: newBal,
              updatedAt: now
            });
          }
        }
      });

      // Sync UtangLedger if Utang sale
      if (utangId && customerId) {
        await enqueueSync('UtangLedger', 'Insert', {
          id: utangId,
          customerId,
          amount: totalAmount,
          type: 'Credit',
          date: now,
          refSaleId: saleId,
          notes: `Benta POS #${saleId.slice(0, 6)}`
        });
      }

      // Enqueue Sale into sync queue
      await enqueueSync('Sale', 'Insert', {
        id: saleId,
        totalAmount,
        paymentMethod,
        date: now,
        userId,
        customerId: customerId || undefined,
        cashReceived: paymentMethod === 'Cash' ? cashReceived : undefined,
        changeGiven: paymentMethod === 'Cash' ? changeAmount : undefined,
        items: cartItems.map((i) => ({
          id: crypto.randomUUID(),
          productId: i.productId,
          productName: i.name,
          qty: i.qty,
          unitPrice: i.price,
          subtotal: i.subtotal
        }))
      });

      // Prepare receipt data and mark receipt active
      usePwaStore.getState().setHasActiveReceipt(true);
      setPendingReceiptData({
        saleId,
        date: now,
        items: cartItems.map((i) => ({
          name: i.name,
          qty: i.qty,
          price: i.price,
          subtotal: i.subtotal
        })),
        totalAmount,
        paymentMethod,
        cashReceived: paymentMethod === 'Cash' ? cashReceived : undefined,
        changeGiven: paymentMethod === 'Cash' ? changeAmount : undefined,
        customerName: selectedCust?.name,
        customerUtangBalance: selectedCust ? selectedCust.totalUtangBalance + (paymentMethod === 'Utang' ? totalAmount : 0) : undefined
      });

      clearCart();
      setIsCheckoutOpen(false);
      setIsCartOpen(false);
      setIsAddDebtorOpen(false);
      setNewDebtorName('');
      setNewDebtorPhone('');
      setNewDebtorError(null);
    } finally {
      usePwaStore.getState().setIsSaleInProgress(false);
    }
  };

  return (
    <div className={styles.container}>
      {/* Search and Barcode row */}
      <form onSubmit={handleBarcodeSubmit} className={styles.searchBarRow}>
        <Input
          className={styles.searchInput}
          placeholder={t.pos.searchPlaceholder}
          value={searchQuery}
          onChange={(_, data) => setSearchQuery(data.value)}
          contentBefore={<SearchRegular />}
        />
        <Button
          appearance="primary"
          icon={<BarcodeScannerRegular />}
          type="button"
          onClick={() => setIsScannerOpen(true)}
          title={t.barcode.openCamera}
        >
          {t.barcode.openCamera}
        </Button>
      </form>

      {/* Categories chips with horizontal scroll controls */}
      <div className={styles.categoriesWrapper}>
        {canScrollLeft && (
          <Button
            appearance="subtle"
            size="small"
            icon={<ChevronLeftRegular />}
            className={styles.scrollNavBtn}
            onClick={() => handleScrollCategories('left')}
            aria-label="Scroll left"
          />
        )}

        <div
          ref={categoryScrollRef}
          className={styles.categoriesScroll}
          onScroll={checkScroll}
          onWheel={handleCategoryWheel}
        >
          {categories.map((cat) => (
            <Button
              key={cat}
              size="small"
              className={styles.categoryChip}
              appearance={selectedCategory === cat ? 'primary' : 'secondary'}
              onClick={(e) => {
                setSelectedCategory(cat);
                (e.currentTarget as HTMLElement).scrollIntoView({
                  behavior: 'smooth',
                  block: 'nearest',
                  inline: 'center'
                });
              }}
              shape="circular"
            >
              {cat}
            </Button>
          ))}
        </div>

        {canScrollRight && (
          <Button
            appearance="subtle"
            size="small"
            icon={<ChevronRightRegular />}
            className={styles.scrollNavBtn}
            onClick={() => handleScrollCategories('right')}
            aria-label="Scroll right"
          />
        )}
      </div>

      {/* Product Grid */}
      <div className={styles.productGrid}>
        {filteredProducts.map((p) => (
          <Card
            key={p.id}
            className={styles.productCard}
            onClick={() => addItem({ id: p.id, name: p.name, price: p.price })}
          >
            <div>
              <Text weight="semibold" size={300} style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {p.name}
              </Text>
              <Text size={100} style={{ color: tokens.colorNeutralForeground3, display: 'block', marginTop: '2px' }}>
                {t.pos.stockLabel}: {p.stockQty} {p.stockQty <= 5 && <Badge size="extra-small" color="danger">{t.pos.lowStockBadge}</Badge>}
              </Text>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
              <span className={styles.productPrice}>{formatPeso(p.price)}</span>
              <Button
                size="small"
                appearance="subtle"
                icon={<AddRegular />}
                onClick={(e) => {
                  e.stopPropagation();
                  addItem({ id: p.id, name: p.name, price: p.price });
                }}
              />
            </div>
          </Card>
        ))}
      </div>

      {/* Floating Bottom Cart Bar */}
      {totalCount > 0 && (
        <div className={styles.floatingCartBar} onClick={() => setIsCartOpen(true)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShoppingBagRegular fontSize={24} />
            <div>
              <Text weight="bold" size={300} style={{ color: '#fff' }}>
                {totalCount} {t.pos.itemsInCart}
              </Text>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Text weight="bold" size={500} style={{ color: '#fff' }}>{formatPeso(totalAmount)}</Text>
            <Button
              appearance="secondary"
              size="medium"
              onClick={(e) => {
                e.stopPropagation();
                setIsCheckoutOpen(true);
              }}
            >
              {t.pos.pay}
            </Button>
          </div>
        </div>
      )}

      {/* Cart Drawer / Dialog */}
      <Dialog open={isCartOpen} onOpenChange={(_, data) => setIsCartOpen(data.open)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>{t.pos.itemsList} ({totalCount})</DialogTitle>
            <DialogContent>
              <div className={styles.cartList}>
                {cartItems.map((item) => (
                  <div key={item.productId} className={styles.cartItemRow}>
                    <div style={{ flexGrow: 1, paddingRight: '8px' }}>
                      <Text weight="semibold" size={300}>{item.name}</Text>
                      <Text size={200} style={{ color: tokens.colorNeutralForeground3, display: 'block' }}>
                        {formatPeso(item.price)} {t.pos.each}
                      </Text>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Button
                        size="small"
                        icon={<SubtractRegular />}
                        appearance="subtle"
                        onClick={() => updateQty(item.productId, item.qty - 1)}
                      />
                      <Text weight="bold" size={300} style={{ minWidth: '24px', textAlign: 'center' }}>
                        {item.qty}
                      </Text>
                      <Button
                        size="small"
                        icon={<AddRegular />}
                        appearance="subtle"
                        onClick={() => updateQty(item.productId, item.qty + 1)}
                      />
                      <Button
                        size="small"
                        icon={<DeleteRegular />}
                        appearance="subtle"
                        onClick={() => removeItem(item.productId)}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <Divider style={{ margin: '12px 0' }} />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text size={400}>{t.pos.totalAmount}:</Text>
                <Text weight="bold" size={500} style={{ color: tokens.colorBrandForeground1 }}>
                  {formatPeso(totalAmount)}
                </Text>
              </div>
            </DialogContent>

            <DialogActions>
              <Button appearance="subtle" onClick={clearCart}>
                {t.pos.clearCart}
              </Button>
              <Button
                appearance="primary"
                onClick={() => {
                  setIsCartOpen(false);
                  setIsCheckoutOpen(true);
                }}
              >
                {t.pos.checkoutBtn} ({formatPeso(totalAmount)})
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>

      {/* Checkout Dialog */}
      <Dialog
        open={isCheckoutOpen || Boolean(receiptData)}
        onOpenChange={(_, data) => {
          if (!data.open && (receiptData || pendingReceiptData) && data.type === 'backdropClick') return;
          setIsCheckoutOpen(data.open);
          if (!data.open) {
            setIsAddDebtorOpen(false);
            setNewDebtorName('');
            setNewDebtorPhone('');
            setNewDebtorError(null);
            if (receiptData || pendingReceiptData) {
              setReceiptData(null);
              setPendingReceiptData(null);
              usePwaStore.getState().setHasActiveReceipt(false);
            }
          }
        }}
      >
        <DialogSurface ref={checkoutDialogRef}>
          {receiptData ? (
            <ReceiptModal
              embedded
              open={true}
              onClose={() => {
                setReceiptData(null);
                usePwaStore.getState().setHasActiveReceipt(false);
              }}
              data={receiptData}
            />
          ) : isCheckoutOpen ? (
          <DialogBody>
            <DialogTitle>{t.pos.checkoutConfirm}</DialogTitle>
            <DialogContent>
              <div style={{ textAlign: 'center', margin: '8px 0 16px' }}>
                <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>{t.pos.totalDue}</Text>
                <div style={{ fontSize: '32px', fontWeight: 'bold', color: tokens.colorBrandForeground1 }}>
                  {formatPeso(totalAmount)}
                </div>
              </div>

              {/* Payment Method Selector */}
              <TabList
                selectedValue={paymentMethod}
                onTabSelect={(_, data) => setPaymentMethod(data.value as any)}
                style={{ justifyContent: 'center', marginBottom: '16px' }}
              >
                <Tab value="Cash" icon={<MoneyRegular />}>Cash</Tab>
                <Tab value="GCash" icon={<PhoneRegular />}>GCash</Tab>
                <Tab value="Utang" icon={<NotebookRegular />}>Utang</Tab>
                <Tab value="Split" icon={<ArrowSwapRegular />}>Split</Tab>
              </TabList>

              {/* Cash Payment Mode */}
              {paymentMethod === 'Cash' && (
                <div>
                  <label htmlFor="pos-cash-received">
                    <Text size={200} weight="semibold">{t.pos.cashTendered}</Text>
                  </label>
                  <Input
                    id="pos-cash-received"
                    type="number"
                    aria-label={language === 'tl' ? 'Tinanggap na pera (Cash received)' : 'Cash received (Tinanggap)'}
                    value={cashReceived === 0 ? '' : cashReceived.toString()}
                    onChange={(_, data) => setCashReceived(parseFloat(data.value) || 0)}
                    placeholder="0.00"
                    style={{ width: '100%', marginTop: '4px' }}
                    contentBefore="₱"
                  />

                  {/* Philippine Bills Buttons */}
                  <div className={styles.quickBillsGrid}>
                    {QUICK_PESO_BILLS.map((bill) => (
                      <Button
                        key={bill}
                        size="small"
                        appearance="secondary"
                        onClick={() => handleQuickBillClick(bill)}
                      >
                        {formatPeso(bill)}
                      </Button>
                    ))}
                  </div>

                  <Button
                    size="small"
                    appearance="subtle"
                    style={{ width: '100%', marginTop: '8px' }}
                    onClick={handleExactCashClick}
                  >
                    {t.pos.exactAmount} ({formatPeso(totalAmount)})
                  </Button>

                  <div style={{ marginTop: '16px', padding: '12px', background: tokens.colorNeutralBackground2, borderRadius: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text size={300} weight="bold">{t.pos.changeLabel}</Text>
                      <Text size={500} weight="bold" style={{ color: tokens.colorPaletteGreenForeground1 }}>
                        {formatPeso(changeAmount)}
                      </Text>
                    </div>
                  </div>
                  {!isTenderValid && (
                    <Text size={200} style={{ color: tokens.colorPaletteRedForeground1, display: 'block', marginTop: '4px' }}>
                      {tenderError}
                    </Text>
                  )}
                </div>
              )}

              {/* GCash Payment Mode */}
              {paymentMethod === 'GCash' && (
                <div>
                  <Text size={300}>{t.pos.gcashInstruction}</Text>
                  <div style={{ marginTop: '12px' }}>
                    <Text size={200} weight="semibold">{t.pos.gcashRefOptional}</Text>
                    <Input placeholder="Hal. 901238471201" style={{ width: '100%', marginTop: '4px' }} />
                  </div>
                </div>
              )}

              {/* Utang Mode */}
              {paymentMethod === 'Utang' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <Text size={200} weight="semibold">{t.pos.selectCustomer}</Text>
                    {!isAddDebtorOpen && (
                      <Button
                        size="small"
                        appearance="subtle"
                        icon={<PersonAddRegular />}
                        onClick={() => setIsAddDebtorOpen(true)}
                      >
                        {t.pos.addNewDebtorBtn}
                      </Button>
                    )}
                  </div>

                  {!isAddDebtorOpen ? (
                    <>
                      <Select
                        style={{ width: '100%', marginTop: '4px' }}
                        value={customerId || ''}
                        onChange={(e) => {
                          const selectedId = e.target.value;
                          if (selectedId === '__NEW__') {
                            setIsAddDebtorOpen(true);
                            return;
                          }
                          const cust = customers.find((c) => c.id === selectedId);
                          setCustomer(selectedId || null, cust?.name || null);
                        }}
                      >
                        <option value="">{t.pos.selectCustomerPlaceholder}</option>
                        <option value="__NEW__">➕ {t.pos.addNewDebtorBtn}...</option>
                        {customers.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}{c.phone ? ` (${c.phone})` : ''} - {t.nav.utang}: {formatPeso(c.totalUtangBalance)}
                          </option>
                        ))}
                      </Select>
                      <Text size={200} style={{ color: tokens.colorPaletteRedForeground1, marginTop: '8px', display: 'block' }}>
                        {t.pos.utangNote}
                      </Text>
                    </>
                  ) : (
                    <div
                      style={{
                        marginTop: '8px',
                        padding: '12px',
                        borderRadius: tokens.borderRadiusMedium,
                        border: `1px solid ${tokens.colorBrandStroke1}`,
                        backgroundColor: tokens.colorNeutralBackground2
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <Text weight="semibold" size={300} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <PersonAddRegular />
                          {t.pos.newDebtorTitle}
                        </Text>
                        <Button
                          appearance="subtle"
                          size="small"
                          icon={<DismissRegular />}
                          onClick={() => {
                            setIsAddDebtorOpen(false);
                            setNewDebtorError(null);
                          }}
                          aria-label={t.common.cancel}
                        />
                      </div>

                      <div style={{ marginBottom: '8px' }}>
                        <Text size={200} weight="semibold">{t.utang.customerNameLabel}</Text>
                        <Input
                          value={newDebtorName}
                          onChange={(_, d) => {
                            setNewDebtorName(d.value);
                            if (newDebtorError) setNewDebtorError(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleSaveNewDebtor();
                            }
                          }}
                          placeholder={t.utang.customerNamePlaceholder}
                          style={{ width: '100%', marginTop: '4px' }}
                          autoFocus
                        />
                        {newDebtorError && (
                          <Text size={200} style={{ color: tokens.colorPaletteRedForeground1, marginTop: '2px', display: 'block' }}>
                            {newDebtorError}
                          </Text>
                        )}
                      </div>

                      <div style={{ marginBottom: '12px' }}>
                        <Text size={200} weight="semibold">{t.utang.phoneLabel}</Text>
                        <Input
                          type="tel"
                          inputMode="tel"
                          value={newDebtorPhone}
                          onChange={(_, d) => {
                            setNewDebtorPhone(d.value);
                            if (newDebtorError) setNewDebtorError(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleSaveNewDebtor();
                            }
                          }}
                          placeholder="09123456789"
                          style={{ width: '100%', marginTop: '4px' }}
                        />
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                        <Button
                          size="small"
                          appearance="subtle"
                          onClick={() => {
                            setIsAddDebtorOpen(false);
                            setNewDebtorError(null);
                          }}
                        >
                          {t.common.cancel}
                        </Button>
                        <Button
                          size="small"
                          appearance="primary"
                          icon={<CheckmarkRegular />}
                          onClick={handleSaveNewDebtor}
                        >
                          {t.pos.saveAndSelectDebtor}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Split Payment Mode (Cash + GCash) */}
              {paymentMethod === 'Split' && (
                <div>
                  <div style={{ marginBottom: '8px' }}>
                    <Text size={200} weight="semibold">{t.pos.cashAmount}</Text>
                    <Input
                      type="number"
                      aria-label={t.pos.cashAmount}
                      value={splitCashAmount === 0 ? '' : splitCashAmount.toString()}
                      onChange={(_, data) => setSplitAmounts(parseFloat(data.value) || 0, splitGCashAmount)}
                      placeholder="0.00"
                      style={{ width: '100%', marginTop: '4px' }}
                      contentBefore="₱"
                    />
                  </div>

                  <div>
                    <Text size={200} weight="semibold">{t.pos.gcashAmount}</Text>
                    <Input
                      type="number"
                      aria-label={t.pos.gcashAmount}
                      value={splitGCashAmount === 0 ? '' : splitGCashAmount.toString()}
                      onChange={(_, data) => setSplitAmounts(splitCashAmount, parseFloat(data.value) || 0)}
                      placeholder="0.00"
                      style={{ width: '100%', marginTop: '4px' }}
                      contentBefore="₱"
                    />
                  </div>

                  <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'space-between' }}>
                    <Text size={200}>{t.pos.splitRemaining}</Text>
                    <Text size={200} weight="bold">
                      {formatPeso(splitCashAmount + splitGCashAmount - totalAmount)}
                    </Text>
                  </div>
                  {!isTenderValid && (
                    <Text size={200} style={{ color: tokens.colorPaletteRedForeground1, display: 'block', marginTop: '4px' }}>
                      {tenderError}
                    </Text>
                  )}
                </div>
              )}
            </DialogContent>

            <DialogActions>
              <Button
                appearance="subtle"
                onClick={() => {
                  setIsCheckoutOpen(false);
                  setIsAddDebtorOpen(false);
                  setNewDebtorName('');
                  setNewDebtorPhone('');
                  setNewDebtorError(null);
                }}
              >
                {t.common.cancel}
              </Button>
              <Button appearance="primary" icon={<CheckmarkCircleRegular />} onClick={handleCompleteSale} disabled={!isTenderValid}>
                {t.pos.completeSaleBtn}
              </Button>
            </DialogActions>
          </DialogBody>
          ) : null}
        </DialogSurface>
      </Dialog>

      {/* Phone Camera Barcode Scanner Modal */}
      <BarcodeScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScan={handleBarcodeProcess}
      />

      {/* Quick Register Product Dialog for Unrecognized Barcode */}
      <QuickRegisterProductDialog
        isOpen={isQuickRegOpen}
        unrecognizedBarcode={unrecognizedBarcode}
        onClose={() => setIsQuickRegOpen(false)}
        onProductRegistered={handleProductRegistered}
        addToCartOnSave={true}
      />

      {/* Scan Feedback Toast */}
      {scanToast && (
        <div
          style={{
            position: 'fixed',
            bottom: '90px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 100,
            backgroundColor: tokens.colorNeutralBackground1,
            border: `1px solid ${tokens.colorBrandStroke1}`,
            borderRadius: '24px',
            padding: '8px 20px',
            boxShadow: tokens.shadow16,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontWeight: 600,
            fontSize: '13px'
          }}
        >
          <CheckmarkCircleRegular style={{ color: tokens.colorPaletteGreenForeground1 }} />
          <span>{scanToast}</span>
        </div>
      )}
    </div>
  );
};
