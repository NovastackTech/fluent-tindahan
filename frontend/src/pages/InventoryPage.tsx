import React, { useState, useMemo, useCallback } from 'react';
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
  Select,
  Divider,
  MessageBar,
  MessageBarBody,
  MessageBarActions
} from '@fluentui/react-components';
import {
  SearchRegular,
  AddRegular,
  BoxRegular,
  WarningRegular,
  MoneyRegular,
  ArrowTrendingRegular,
  EditRegular,
  DeleteRegular,
  ArrowUploadRegular,
  CheckmarkCircleRegular,
  DismissRegular,
  BarcodeScannerRegular
} from '@fluentui/react-icons';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type ProductRecord } from '../db/db';
import { enqueueSync } from '../sync/syncEngine';
import { useAuthStore } from '../state/authStore';
import { useTranslation } from '../state/languageStore';
import { BarcodeScannerModal } from '../components/BarcodeScannerModal';
import { QuickRegisterProductDialog } from '../components/QuickRegisterProductDialog';
import { playScanBeep } from '../utils/sound';
import { useSubscriptionStore } from '../state/subscriptionStore';
import type { NavTab } from '../components/Navigation';
import { formatPeso } from '../utils/currency';

interface InventoryPageProps {
  onNavigate?: (tab: NavTab) => void;
}

type StockFilterType = 'all' | 'low' | 'out' | 'in';

import {
  MIN_PRODUCT_PRICE,
  MAX_PRODUCT_PRICE,
  MIN_PRODUCT_COST,
  MAX_PRODUCT_COST,
  MIN_PRODUCT_STOCK,
  MAX_PRODUCT_STOCK
} from '../constants/inventory';

export {
  MIN_PRODUCT_PRICE,
  MAX_PRODUCT_PRICE,
  MIN_PRODUCT_COST,
  MAX_PRODUCT_COST,
  MIN_PRODUCT_STOCK,
  MAX_PRODUCT_STOCK
};

const useStyles = makeStyles({
  container: {
    ...shorthands.padding(tokens.spacingVerticalM, tokens.spacingHorizontalM),
    maxWidth: '1080px',
    marginLeft: 'auto',
    marginRight: 'auto',
    paddingBottom: '110px'
  },
  header: {
    marginBottom: tokens.spacingVerticalM
  },
  headerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: tokens.spacingHorizontalM,
    marginBottom: tokens.spacingVerticalM
  },
  headerActions: {
    display: 'flex',
    gap: tokens.spacingHorizontalS,
    alignItems: 'center',
    flexWrap: 'wrap'
  },
  metricsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
    gap: tokens.spacingHorizontalM,
    marginBottom: tokens.spacingVerticalL
  },
  metricCard: {
    ...shorthands.padding(tokens.spacingVerticalM, tokens.spacingHorizontalM),
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
    ...shorthands.borderRadius(tokens.borderRadiusLarge),
    ...shorthands.border('1px', 'solid', tokens.colorNeutralStroke2),
    backgroundColor: tokens.colorNeutralBackground1,
    boxShadow: tokens.shadow4,
    transitionProperty: 'transform, box-shadow',
    transitionDuration: tokens.durationNormal,
    '&:hover': {
      boxShadow: tokens.shadow8
    }
  },
  metricIconWrapper: {
    width: '38px',
    height: '38px',
    ...shorthands.borderRadius('10px'),
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '20px',
    marginBottom: tokens.spacingVerticalS
  },
  metricValue: {
    fontSize: '22px',
    fontWeight: tokens.fontWeightBold,
    letterSpacing: '-0.5px',
    marginTop: '2px',
    marginBottom: '2px'
  },
  toolbarCard: {
    ...shorthands.padding(tokens.spacingVerticalM, tokens.spacingHorizontalM),
    marginBottom: tokens.spacingVerticalM,
    backgroundColor: tokens.colorNeutralBackground1,
    ...shorthands.borderRadius(tokens.borderRadiusLarge),
    ...shorthands.border('1px', 'solid', tokens.colorNeutralStroke2)
  },
  toolbarRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: tokens.spacingHorizontalM,
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  searchAndFilterGroup: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: tokens.spacingHorizontalS,
    alignItems: 'center',
    flex: 1,
    minWidth: '280px'
  },
  filterPills: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: tokens.spacingHorizontalXS,
    marginTop: tokens.spacingVerticalS
  },
  filterPill: {
    ...shorthands.padding('4px', '12px'),
    ...shorthands.borderRadius('16px'),
    fontSize: '12px',
    cursor: 'pointer',
    ...shorthands.border('1px', 'solid', tokens.colorNeutralStroke2),
    backgroundColor: tokens.colorNeutralBackground2,
    color: tokens.colorNeutralForeground2,
    transitionProperty: 'all',
    transitionDuration: tokens.durationFast,
    userSelect: 'none',
    '&:hover': {
      backgroundColor: tokens.colorNeutralBackground1Hover
    }
  },
  filterPillActive: {
    backgroundColor: tokens.colorBrandBackground,
    color: tokens.colorNeutralForegroundOnBrand,
    ...shorthands.border('1px', 'solid', tokens.colorBrandBackground),
    fontWeight: tokens.fontWeightSemibold
  },
  tableCard: {
    ...shorthands.padding(0),
    backgroundColor: tokens.colorNeutralBackground1,
    ...shorthands.borderRadius(tokens.borderRadiusLarge),
    ...shorthands.border('1px', 'solid', tokens.colorNeutralStroke2),
    overflowX: 'auto',
    boxShadow: tokens.shadow4
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    textAlign: 'left',
    fontSize: '13px'
  },
  th: {
    ...shorthands.padding(tokens.spacingVerticalM, tokens.spacingHorizontalM),
    backgroundColor: tokens.colorNeutralBackground2,
    color: tokens.colorNeutralForeground3,
    fontWeight: tokens.fontWeightSemibold,
    ...shorthands.borderBottom('1px', 'solid', tokens.colorNeutralStroke2),
    whiteSpace: 'nowrap',
    fontSize: '12px',
    textTransform: 'uppercase',
    letterSpacing: '0.4px'
  },
  tr: {
    ...shorthands.borderBottom('1px', 'solid', tokens.colorNeutralStroke3),
    transitionProperty: 'background-color',
    transitionDuration: tokens.durationFast,
    '&:hover': {
      backgroundColor: tokens.colorNeutralBackground1Hover
    }
  },
  td: {
    ...shorthands.padding(tokens.spacingVerticalM, tokens.spacingHorizontalM),
    verticalAlign: 'middle'
  },
  categoryTh: {
    minWidth: '130px',
    whiteSpace: 'nowrap'
  },
  categoryCell: {
    whiteSpace: 'nowrap',
    minWidth: '130px'
  },
  categoryBadge: {
    whiteSpace: 'nowrap',
    maxWidth: '220px',
    textOverflow: 'ellipsis',
    overflowX: 'hidden',
    display: 'inline-flex',
    alignItems: 'center'
  },
  stockBadgeCell: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    alignItems: 'flex-start'
  },
  restockButtonGroup: {
    display: 'flex',
    gap: '4px',
    marginTop: '4px'
  },
  restockBtn: {
    minWidth: '32px',
    height: '24px',
    fontSize: '11px',
    ...shorthands.padding(0, '6px')
  },
  marginBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    ...shorthands.padding('2px', '8px'),
    ...shorthands.borderRadius('12px'),
    fontSize: '11px',
    fontWeight: tokens.fontWeightSemibold
  },
  marginHealthy: {
    backgroundColor: '#E8F5E9',
    color: '#2E7D32'
  },
  marginModerate: {
    backgroundColor: '#FFF3E0',
    color: '#E65100'
  },
  marginLow: {
    backgroundColor: '#FFEBEE',
    color: '#C62828'
  },
  actionBtns: {
    display: 'flex',
    gap: '4px',
    alignItems: 'center'
  },
  toastBanner: {
    position: 'fixed',
    bottom: '84px',
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 100,
    backgroundColor: tokens.colorNeutralBackground1,
    ...shorthands.border('1px', 'solid', tokens.colorBrandStroke1),
    ...shorthands.borderRadius('24px'),
    ...shorthands.padding('8px', '20px'),
    boxShadow: tokens.shadow16,
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    animationName: 'fadeIn',
    animationDuration: '0.2s'
  },
  emptyState: {
    textAlign: 'center',
    ...shorthands.padding(tokens.spacingVerticalXXL, tokens.spacingHorizontalM),
    color: tokens.colorNeutralForeground3
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: tokens.spacingVerticalM
  },
  marginPreviewBox: {
    ...shorthands.padding(tokens.spacingVerticalM, tokens.spacingHorizontalM),
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    backgroundColor: tokens.colorNeutralBackground2,
    ...shorthands.border('1px', 'solid', tokens.colorNeutralStroke2),
    marginTop: tokens.spacingVerticalM
  },
  marginPreviewRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '13px',
    marginBottom: '4px'
  },
  mobileCardsContainer: {
    display: 'none',
    '@media (max-width: 767px)': {
      display: 'flex',
      flexDirection: 'column',
      gap: tokens.spacingVerticalM
    }
  },
  desktopTableContainer: {
    display: 'block',
    '@media (max-width: 767px)': {
      display: 'none'
    }
  },
  mobileCard: {
    ...shorthands.padding(tokens.spacingVerticalM, tokens.spacingHorizontalM),
    backgroundColor: tokens.colorNeutralBackground1,
    ...shorthands.borderRadius(tokens.borderRadiusLarge),
    ...shorthands.border('1px', 'solid', tokens.colorNeutralStroke2),
    boxShadow: tokens.shadow4
  }
});

const EMPTY_PRODUCTS: ProductRecord[] = [];

export const InventoryPage: React.FC<InventoryPageProps> = ({ onNavigate }) => {
  const styles = useStyles();
  const { t, language } = useTranslation();
  const tenantId = useAuthStore((s) => s.tenantId);
  const { tier, canAddProduct, openUpgradeModal } = useSubscriptionStore();

  // Live Query from local Dexie database
  const productsResult = useLiveQuery(
    () => db.products.where('tenantId').equals(tenantId).toArray(),
    [tenantId]
  );
  const products = productsResult || EMPTY_PRODUCTS;

  // Filtering states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [stockFilter, setStockFilter] = useState<StockFilterType>('all');

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [editingProduct, setEditingProduct] = useState<ProductRecord | null>(null);

  // Form states
  const [formName, setFormName] = useState('');
  const [formNameError, setFormNameError] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formBarcode, setFormBarcode] = useState('');
  const [formCost, setFormCost] = useState<number | ''>('');
  const [formCostError, setFormCostError] = useState('');
  const [formPrice, setFormPrice] = useState<number | ''>('');
  const [formPriceError, setFormPriceError] = useState('');
  const [formStock, setFormStock] = useState<number | ''>('');
  const [formStockError, setFormStockError] = useState('');

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<ProductRecord | null>(null);

  // Barcode scanner states
  const [isSearchScannerOpen, setIsSearchScannerOpen] = useState(false);
  const [isModalScannerOpen, setIsModalScannerOpen] = useState(false);
  const [unrecognizedBarcode, setUnrecognizedBarcode] = useState<string | null>(null);
  const [isQuickRegOpen, setIsQuickRegOpen] = useState(false);

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [limitBanner, setLimitBanner] = useState<string | null>(null);
  const [modalGeneralError, setModalGeneralError] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3200);
  };

  const handleSearchBarcodeScan = (scannedCode: string) => {
    const trimmed = scannedCode.trim();
    if (!trimmed) return;

    const match = products.find(
      (p) => p.barcode && p.barcode.trim().toLowerCase() === trimmed.toLowerCase()
    );

    if (match) {
      setSearchQuery(trimmed);
      playScanBeep();
      showToast(`${match.name} (${match.stockQty} in stock)`);
    } else {
      setUnrecognizedBarcode(trimmed);
      setIsQuickRegOpen(true);
    }
  };

  const handleProductQuickRegistered = (newProduct: ProductRecord) => {
    setSearchQuery(newProduct.barcode || newProduct.name);
    playScanBeep();
    showToast(`${t.barcode.registeredSuccess} (${newProduct.name})`);
  };

  const handleModalBarcodeScan = (scannedCode: string) => {
    setFormBarcode(scannedCode.trim());
    playScanBeep();
    showToast(`Barcode: ${scannedCode.trim()}`);
  };

  // Distinct categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.category && p.category.trim().length > 0) {
        set.add(p.category.trim());
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [products]);

  // Overall Inventory KPI Metrics
  const metrics = useMemo(() => {
    let totalCostVal = 0;
    let totalRetailVal = 0;
    let lowCount = 0;
    let outCount = 0;
    let inCount = 0;

    products.forEach((p) => {
      const stock = Math.max(0, p.stockQty || 0);
      totalCostVal += (p.cost || 0) * stock;
      totalRetailVal += (p.price || 0) * stock;

      if (stock === 0) {
        outCount++;
      } else if (stock <= 5) {
        lowCount++;
      } else {
        inCount++;
      }
    });

    const projectedProfit = Math.max(0, totalRetailVal - totalCostVal);
    const avgMargin = totalRetailVal > 0 ? (projectedProfit / totalRetailVal) * 100 : 0;

    return {
      totalProducts: products.length,
      lowStockCount: lowCount + outCount,
      outOfStockCount: outCount,
      inStockCount: inCount,
      totalCostValue: totalCostVal,
      totalRetailValue: totalRetailVal,
      projectedGrossProfit: projectedProfit,
      avgMarginPercent: avgMargin
    };
  }, [products]);

  // Filtered products list
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      // 1. Search Query filter
      if (searchQuery.trim().length > 0) {
        const query = searchQuery.toLowerCase().trim();
        const nameMatch = p.name.toLowerCase().includes(query);
        const barcodeMatch = p.barcode ? p.barcode.toLowerCase().includes(query) : false;
        const categoryMatch = p.category ? p.category.toLowerCase().includes(query) : false;
        if (!nameMatch && !barcodeMatch && !categoryMatch) {
          return false;
        }
      }

      // 2. Category filter
      if (selectedCategory !== 'ALL') {
        if ((p.category || '').toLowerCase() !== selectedCategory.toLowerCase()) {
          return false;
        }
      }

      // 3. Stock Level filter
      const stock = p.stockQty || 0;
      if (stockFilter === 'low') {
        return stock > 0 && stock <= 5;
      }
      if (stockFilter === 'out') {
        return stock === 0;
      }
      if (stockFilter === 'in') {
        return stock > 5;
      }

      return true;
    });
  }, [products, searchQuery, selectedCategory, stockFilter]);

  // Quick Restock Handler (+6, +12, +24)
  const handleQuickRestock = useCallback(async (product: ProductRecord, increment: number) => {
    try {
      const newStock = Math.max(0, (product.stockQty || 0) + increment);
      const nowIso = new Date().toISOString();
      const updatedProduct: ProductRecord = {
        ...product,
        stockQty: newStock,
        updatedAt: nowIso
      };

      await db.products.put(updatedProduct);
      await enqueueSync('Product', 'Update', updatedProduct);

      showToast(
        `${t.inventory.restockSuccess} ${product.name}: ${product.stockQty} ➔ ${newStock} (+${increment})`
      );
    } catch (err) {
      console.error('Failed to quick restock:', err);
    }
  }, [t.inventory.restockSuccess]);

  // Open Add Product Modal
  const openAddModal = () => {
    if (!canAddProduct(products.length)) {
      setLimitBanner(
        language === 'tl'
          ? 'Naabot na ang limitasyon ng Libreng plano (50 produkto). Mag-upgrade sa Tindahan Pro o Negosyo Plus upang magdagdag pa.'
          : 'Limit reached for Libre plan (50 products maximum). Please upgrade to Tindahan Pro or Negosyo Plus to add more products.'
      );
      openUpgradeModal();
      return;
    }
    setLimitBanner(null);
    setModalGeneralError(null);
    setModalMode('add');
    setEditingProduct(null);
    setFormName('');
    setFormNameError('');
    setFormCategory('');
    setFormBarcode('');
    setFormCost('');
    setFormCostError('');
    setFormPrice('');
    setFormPriceError('');
    setFormStock(10);
    setFormStockError('');
    setIsModalOpen(true);
  };

  // Open Edit Product Modal
  const openEditModal = (product: ProductRecord) => {
    setModalMode('edit');
    setEditingProduct(product);
    setFormName(product.name);
    setFormNameError('');
    setFormCategory(product.category || '');
    setFormBarcode(product.barcode || '');
    setFormCost(product.cost);
    setFormCostError('');
    setFormPrice(product.price);
    setFormPriceError('');
    setFormStock(product.stockQty);
    setFormStockError('');
    setIsModalOpen(true);
  };

  // Save Add/Edit Product
  const handleSaveProduct = async () => {
    setFormNameError('');
    setFormCostError('');
    setFormPriceError('');
    setFormStockError('');

    if (!formName.trim()) {
      setFormNameError(t.inventory.productNameRequired);
      return;
    }
    const costClean = typeof formCost === 'string' ? formCost.replace(/,/g, '').trim() : formCost;
    const priceClean = typeof formPrice === 'string' ? formPrice.replace(/,/g, '').trim() : formPrice;
    const stockClean = typeof formStock === 'string' ? formStock.replace(/,/g, '').trim() : formStock;
    const costNum = Number(costClean) || 0;
    const priceNum = Number(priceClean) || 0;
    const stockNum = Number(stockClean) || 0;

    if (costNum < 0) {
      setFormCostError(t.inventory.costCannotBeNegative);
      return;
    }
    if (costNum > MAX_PRODUCT_COST) {
      setFormCostError(t.inventory.costExceedsMax);
      return;
    }

    if (priceNum <= 0) {
      setFormPriceError(t.inventory.priceMustBePositive);
      return;
    }
    if (priceNum > MAX_PRODUCT_PRICE) {
      setFormPriceError(t.inventory.priceExceedsMax);
      return;
    }

    if (stockNum < 0) {
      setFormStockError(language === 'tl' ? 'Hindi maaaring negatibo ang stock.' : 'Stock quantity cannot be negative.');
      return;
    }
    if (stockNum > MAX_PRODUCT_STOCK) {
      setFormStockError(t.inventory.stockExceedsMax);
      return;
    }

    const nowIso = new Date().toISOString();

    try {
      if (modalMode === 'add') {
        if (!canAddProduct(products.length)) {
          setModalGeneralError(
            language === 'tl'
              ? 'Naabot na ang limitasyon ng Libreng plano (50 produkto). Mag-upgrade sa Tindahan Pro o Negosyo Plus upang magdagdag pa.'
              : 'Limit reached for Libre plan (50 products maximum). Please upgrade to Tindahan Pro or Negosyo Plus to add more products.'
          );
          openUpgradeModal();
          return;
        }
        setModalGeneralError(null);
        const newProduct: ProductRecord = {
          id: crypto.randomUUID(),
          tenantId,
          name: formName.trim(),
          category: formCategory.trim() || 'General',
          barcode: formBarcode.trim() || undefined,
          cost: costNum,
          price: priceNum,
          stockQty: Math.max(0, stockNum),
          updatedAt: nowIso
        };

        await db.products.add(newProduct);
        await enqueueSync('Product', 'Insert', newProduct);
        showToast(`${t.inventory.saveSuccess} (${newProduct.name})`);
      } else if (editingProduct) {
        const updatedProduct: ProductRecord = {
          ...editingProduct,
          name: formName.trim(),
          category: formCategory.trim() || 'General',
          barcode: formBarcode.trim() || undefined,
          cost: costNum,
          price: priceNum,
          stockQty: Math.max(0, stockNum),
          updatedAt: nowIso
        };

        await db.products.put(updatedProduct);
        await enqueueSync('Product', 'Update', updatedProduct);
        showToast(`${t.inventory.saveSuccess} (${updatedProduct.name})`);
      }

      setIsModalOpen(false);
    } catch (err) {
      console.error('Failed to save product:', err);
    }
  };

  // Open Delete Confirmation
  const openDeleteDialog = (product: ProductRecord) => {
    setProductToDelete(product);
    setDeleteDialogOpen(true);
  };

  // Confirm Delete Product
  const handleConfirmDelete = async () => {
    if (!productToDelete) return;
    try {
      await db.products.delete(productToDelete.id);
      await enqueueSync('Product', 'Delete', { id: productToDelete.id, tenantId });
      showToast(`${t.inventory.deleteSuccess} (${productToDelete.name})`);
      setDeleteDialogOpen(false);
      setProductToDelete(null);
    } catch (err) {
      console.error('Failed to delete product:', err);
    }
  };

  // Modal live margin preview
  const liveCost = Number(formCost) || 0;
  const livePrice = Number(formPrice) || 0;
  const liveProfit = Math.max(0, livePrice - liveCost);
  const liveMarginPct = livePrice > 0 ? ((livePrice - liveCost) / livePrice) * 100 : 0;

  return (
    <div className={styles.container}>
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className={styles.toastBanner}>
          <CheckmarkCircleRegular style={{ color: tokens.colorPaletteGreenForeground1 }} />
          <Text weight="semibold" size={300}>
            {toastMessage}
          </Text>
        </div>
      )}

      {/* Limit Warning Banner */}
      {limitBanner && (
        <div role="alert" style={{ marginBottom: tokens.spacingVerticalM }}>
          <MessageBar intent="warning" layout="multiline">
            <MessageBarBody>{limitBanner}</MessageBarBody>
            <MessageBarActions
              containerAction={
                <Button
                  appearance="subtle"
                  aria-label="Dismiss"
                  icon={<DismissRegular />}
                  onClick={() => setLimitBanner(null)}
                />
              }
            />
          </MessageBar>
        </div>
      )}

      {/* Header and Title */}
      <div className={styles.header}>
        <div className={styles.headerRow}>
          <div>
            <Text size={600} weight="bold">
              {t.inventory.title}
            </Text>
            <Text size={300} style={{ color: tokens.colorNeutralForeground3, display: 'block', marginTop: '2px' }}>
              {t.inventory.subtitle}
            </Text>
          </div>

          <div className={styles.headerActions}>
            {onNavigate && (
              <Button
                appearance="secondary"
                icon={<ArrowUploadRegular />}
                onClick={() => onNavigate('import')}
              >
                {t.inventory.importCsvBtn}
              </Button>
            )}
            <Button
              appearance="primary"
              icon={<AddRegular />}
              onClick={openAddModal}
            >
              {t.inventory.addProductBtn}
            </Button>
          </div>
        </div>

        {/* 4 KPI Summary Cards */}
        <div className={styles.metricsGrid}>
          {/* Card 1: Total Products */}
          <Card className={styles.metricCard}>
            <div className={styles.metricIconWrapper} style={{ backgroundColor: '#E1F5FE', color: '#0288D1' }}>
              <BoxRegular />
            </div>
            <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
              {t.inventory.totalProducts}
            </Text>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div className={styles.metricValue}>
                {metrics.totalProducts}
                {tier === 'Libre' && (
                  <span style={{ fontSize: '14px', fontWeight: 'normal', color: tokens.colorNeutralForeground3 }}> / 50</span>
                )}
              </div>
              {tier === 'Libre' && metrics.totalProducts >= 45 && (
                <Badge appearance="tint" color="warning" size="small" data-testid="product-cap-badge">
                  {metrics.totalProducts >= 50 ? t.inventory.fullCapacityBadge : t.inventory.nearCapacityBadge}
                </Badge>
              )}
            </div>
            <Text size={100} style={{ color: tokens.colorNeutralForeground3 }}>
              {metrics.inStockCount} {t.inventory.inStockBadge.toLowerCase()} • {metrics.outOfStockCount} {t.inventory.outOfStockBadge.toLowerCase()}
            </Text>
          </Card>

          {/* Card 2: Low Stock Alerts */}
          <Card
            className={styles.metricCard}
            style={{ cursor: 'pointer' }}
            onClick={() => setStockFilter(stockFilter === 'low' ? 'all' : 'low')}
          >
            <div className={styles.metricIconWrapper} style={{ backgroundColor: '#FFF3E0', color: '#E65100' }}>
              <WarningRegular />
            </div>
            <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
              {t.inventory.lowStockAlerts}
            </Text>
            <div
              className={styles.metricValue}
              style={{
                color: metrics.lowStockCount > 0 ? tokens.colorPaletteRedForeground1 : tokens.colorPaletteGreenForeground1
              }}
            >
              {metrics.lowStockCount}
            </div>
            <Text size={100} style={{ color: tokens.colorNeutralForeground3 }}>
              {stockFilter === 'low' ? t.inventory.filteringLowStockHint : t.inventory.lowStockRemainingHint}
            </Text>
          </Card>

          {/* Card 3: Total Cost & Retail Value */}
          <Card className={styles.metricCard}>
            <div className={styles.metricIconWrapper} style={{ backgroundColor: '#E8F5E9', color: '#2E7D32' }}>
              <MoneyRegular />
            </div>
            <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
              {t.inventory.retailValue}
            </Text>
            <div className={styles.metricValue}>
              {formatPeso(metrics.totalRetailValue)}
            </div>
            <Text size={100} style={{ color: tokens.colorNeutralForeground3 }}>
              {t.inventory.colCost}: {formatPeso(metrics.totalCostValue)}
            </Text>
          </Card>

          {/* Card 4: Projected Profit & Margin */}
          <Card className={styles.metricCard}>
            <div className={styles.metricIconWrapper} style={{ backgroundColor: '#F3E5F5', color: '#7B1FA2' }}>
              <ArrowTrendingRegular />
            </div>
            <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
              {t.inventory.potentialProfit}
            </Text>
            <div className={styles.metricValue} style={{ color: tokens.colorPaletteGreenForeground1 }}>
              {formatPeso(metrics.projectedGrossProfit)}
            </div>
            <Text size={100} style={{ color: tokens.colorNeutralForeground3 }}>
              {t.inventory.avgMargin}: <strong>{metrics.avgMarginPercent.toFixed(1)}%</strong>
            </Text>
          </Card>
        </div>
      </div>

      {/* Toolbar & Filter Bar */}
      <Card className={styles.toolbarCard}>
        <div className={styles.toolbarRow}>
          <div className={styles.searchAndFilterGroup}>
            <Input
              style={{ flex: 1, minWidth: '220px' }}
              contentBefore={<SearchRegular />}
              placeholder={t.inventory.searchPlaceholder}
              value={searchQuery}
              onChange={(_, data) => setSearchQuery(data.value)}
              contentAfter={
                searchQuery ? (
                  <Button
                    size="small"
                    appearance="subtle"
                    icon={<DismissRegular />}
                    onClick={() => setSearchQuery('')}
                  />
                ) : undefined
              }
            />

            <Button
              appearance="subtle"
              icon={<BarcodeScannerRegular />}
              onClick={() => setIsSearchScannerOpen(true)}
              title={t.barcode.openCamera}
            />

            {/* Category Dropdown */}
            <Select
              style={{ minWidth: '160px' }}
              value={selectedCategory}
              onChange={(_, data) => setSelectedCategory(data.value)}
            >
              <option value="ALL">{t.inventory.allCategories}</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </Select>
          </div>

          <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
            {filteredProducts.length} {t.inventory.totalProducts.toLowerCase()}
          </Text>
        </div>

        {/* Stock Status Pills */}
        <div className={styles.filterPills}>
          <div
            className={`${styles.filterPill} ${stockFilter === 'all' ? styles.filterPillActive : ''}`}
            onClick={() => setStockFilter('all')}
          >
            {t.inventory.filterAll} ({products.length})
          </div>
          <div
            className={`${styles.filterPill} ${stockFilter === 'low' ? styles.filterPillActive : ''}`}
            onClick={() => setStockFilter('low')}
          >
            {t.inventory.filterLowStock} ({products.filter((p) => p.stockQty > 0 && p.stockQty <= 5).length})
          </div>
          <div
            className={`${styles.filterPill} ${stockFilter === 'out' ? styles.filterPillActive : ''}`}
            onClick={() => setStockFilter('out')}
          >
            {t.inventory.filterOutOfStock} ({products.filter((p) => p.stockQty === 0).length})
          </div>
          <div
            className={`${styles.filterPill} ${stockFilter === 'in' ? styles.filterPillActive : ''}`}
            onClick={() => setStockFilter('in')}
          >
            {t.inventory.filterInStock} ({products.filter((p) => p.stockQty > 5).length})
          </div>
        </div>
      </Card>

      {/* DESKTOP TABLE VIEW (>= 768px) */}
      <div className={styles.desktopTableContainer}>
        <Card className={styles.tableCard}>
          {filteredProducts.length === 0 ? (
            <div className={styles.emptyState}>
              <BoxRegular style={{ fontSize: '48px', opacity: 0.5, marginBottom: '8px' }} />
              <Text weight="semibold" size={400} style={{ display: 'block' }}>
                {t.inventory.noProductsFound}
              </Text>
              <Button
                appearance="secondary"
                size="small"
                style={{ marginTop: '12px' }}
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('ALL');
                  setStockFilter('all');
                }}
              >
                Reset Filters
              </Button>
            </div>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.th}>{t.inventory.colProduct}</th>
                  <th className={`${styles.th} ${styles.categoryTh}`}>{t.inventory.colCategory}</th>
                  <th className={styles.th}>{t.inventory.colStock}</th>
                  <th className={styles.th}>{t.inventory.colCost}</th>
                  <th className={styles.th}>{t.inventory.colPrice}</th>
                  <th className={styles.th}>{t.inventory.colMargin}</th>
                  <th className={styles.th} style={{ textAlign: 'right' }}>
                    {t.inventory.colActions}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((p) => {
                  const stock = p.stockQty || 0;
                  const profit = p.price - p.cost;
                  const marginPct = p.price > 0 ? (profit / p.price) * 100 : 0;

                  const marginClass =
                    marginPct >= 20
                      ? styles.marginHealthy
                      : marginPct >= 10
                      ? styles.marginModerate
                      : styles.marginLow;

                  return (
                    <tr key={p.id} className={styles.tr}>
                      {/* Product Name & Barcode */}
                      <td className={styles.td}>
                        <Text weight="semibold" size={300} style={{ display: 'block' }}>
                          {p.name}
                        </Text>
                        {p.barcode && (
                          <Text size={100} style={{ color: tokens.colorNeutralForeground4 }}>
                            🏷️ {p.barcode}
                          </Text>
                        )}
                      </td>

                      {/* Category */}
                      <td className={`${styles.td} ${styles.categoryCell}`}>
                        <Badge
                          appearance="tint"
                          color="informative"
                          size="small"
                          className={styles.categoryBadge}
                          title={p.category || 'General'}
                        >
                          {p.category || 'General'}
                        </Badge>
                      </td>

                      {/* Stock Level & Quick Restock */}
                      <td className={styles.td}>
                        <div className={styles.stockBadgeCell}>
                          <Badge
                            appearance="filled"
                            color={stock === 0 ? 'danger' : stock <= 5 ? 'warning' : 'success'}
                            size="medium"
                          >
                            {stock === 0
                              ? t.inventory.outOfStockBadge
                              : stock <= 5
                              ? `${stock} - ${t.inventory.lowStockBadge}`
                              : `${stock} ${t.inventory.inStockBadge}`}
                          </Badge>

                          {/* Quick Restock Buttons */}
                          <div className={styles.restockButtonGroup}>
                            <Button
                              size="small"
                              appearance="subtle"
                              className={styles.restockBtn}
                              title="Restock +6"
                              onClick={() => handleQuickRestock(p, 6)}
                            >
                              +6
                            </Button>
                            <Button
                              size="small"
                              appearance="subtle"
                              className={styles.restockBtn}
                              title="Restock +12"
                              onClick={() => handleQuickRestock(p, 12)}
                            >
                              +12
                            </Button>
                            <Button
                              size="small"
                              appearance="subtle"
                              className={styles.restockBtn}
                              title="Restock +24"
                              onClick={() => handleQuickRestock(p, 24)}
                            >
                              +24
                            </Button>
                          </div>
                        </div>
                      </td>

                      {/* Cost (Puhunan) */}
                      <td className={styles.td}>
                        <Text size={300} style={{ color: tokens.colorNeutralForeground2 }}>
                          {formatPeso(p.cost)}
                        </Text>
                      </td>

                      {/* SRP (Tinda) */}
                      <td className={styles.td}>
                        <Text size={300} weight="bold">
                          {formatPeso(p.price)}
                        </Text>
                      </td>

                      {/* Margin % & Profit */}
                      <td className={styles.td}>
                        <div>
                          <span className={`${styles.marginBadge} ${marginClass}`}>
                            {marginPct.toFixed(1)}%
                          </span>
                          <Text
                            size={100}
                            style={{
                              color: profit >= 0 ? tokens.colorPaletteGreenForeground1 : tokens.colorPaletteRedForeground1,
                              display: 'block',
                              marginTop: '2px'
                            }}
                          >
                            {formatPeso(profit)} / pc
                          </Text>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className={styles.td} style={{ textAlign: 'right' }}>
                        <div className={styles.actionBtns} style={{ justifyContent: 'flex-end' }}>
                          <Button
                            size="small"
                            appearance="subtle"
                            icon={<EditRegular />}
                            title={t.inventory.editProduct}
                            onClick={() => openEditModal(p)}
                          />
                          <Button
                            size="small"
                            appearance="subtle"
                            icon={<DeleteRegular style={{ color: tokens.colorPaletteRedForeground1 }} />}
                            title={t.inventory.deleteProduct}
                            onClick={() => openDeleteDialog(p)}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      {/* MOBILE CARD VIEW (< 768px) */}
      <div className={styles.mobileCardsContainer}>
        {filteredProducts.length === 0 ? (
          <Card className={styles.emptyState}>
            <BoxRegular style={{ fontSize: '40px', opacity: 0.5, marginBottom: '8px' }} />
            <Text weight="semibold" size={300}>
              {t.inventory.noProductsFound}
            </Text>
          </Card>
        ) : (
          filteredProducts.map((p) => {
            const stock = p.stockQty || 0;
            const profit = p.price - p.cost;
            const marginPct = p.price > 0 ? (profit / p.price) * 100 : 0;
            const marginClass =
              marginPct >= 20 ? styles.marginHealthy : marginPct >= 10 ? styles.marginModerate : styles.marginLow;

            return (
              <Card key={p.id} className={styles.mobileCard}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <Text weight="bold" size={400} style={{ display: 'block' }}>
                      {p.name}
                    </Text>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '4px' }}>
                      <Badge
                        appearance="tint"
                        color="informative"
                        size="small"
                        className={styles.categoryBadge}
                        title={p.category || 'General'}
                      >
                        {p.category || 'General'}
                      </Badge>
                      {p.barcode && (
                        <Text size={100} style={{ color: tokens.colorNeutralForeground4 }}>
                          {p.barcode}
                        </Text>
                      )}
                    </div>
                  </div>

                  <Badge
                    appearance="filled"
                    color={stock === 0 ? 'danger' : stock <= 5 ? 'warning' : 'success'}
                    size="medium"
                  >
                    {stock === 0
                      ? t.inventory.outOfStockBadge
                      : stock <= 5
                      ? `${stock} - ${t.inventory.lowStockBadge}`
                      : `${stock} pcs`}
                  </Badge>
                </div>

                <Divider style={{ margin: `${tokens.spacingVerticalS} 0` }} />

                {/* Price, Cost, and Margin Info */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                  <div>
                    <Text size={100} style={{ color: tokens.colorNeutralForeground3, display: 'block' }}>
                      {t.inventory.colCost}
                    </Text>
                    <Text size={300}>{formatPeso(p.cost)}</Text>
                  </div>
                  <div>
                    <Text size={100} style={{ color: tokens.colorNeutralForeground3, display: 'block' }}>
                      {t.inventory.colPrice}
                    </Text>
                    <Text size={300} weight="bold">
                      {formatPeso(p.price)}
                    </Text>
                  </div>
                  <div>
                    <Text size={100} style={{ color: tokens.colorNeutralForeground3, display: 'block' }}>
                      {t.inventory.colMargin}
                    </Text>
                    <span className={`${styles.marginBadge} ${marginClass}`}>{marginPct.toFixed(1)}%</span>
                  </div>
                </div>

                {/* Quick Restock & Actions */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginTop: tokens.spacingVerticalS,
                    paddingTop: tokens.spacingVerticalXS,
                    borderTop: `1px dashed ${tokens.colorNeutralStroke3}`
                  }}
                >
                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                    <Text size={100} style={{ color: tokens.colorNeutralForeground3 }}>
                      Restock:
                    </Text>
                    <Button
                      size="small"
                      appearance="subtle"
                      className={styles.restockBtn}
                      onClick={() => handleQuickRestock(p, 6)}
                    >
                      +6
                    </Button>
                    <Button
                      size="small"
                      appearance="subtle"
                      className={styles.restockBtn}
                      onClick={() => handleQuickRestock(p, 12)}
                    >
                      +12
                    </Button>
                    <Button
                      size="small"
                      appearance="subtle"
                      className={styles.restockBtn}
                      onClick={() => handleQuickRestock(p, 24)}
                    >
                      +24
                    </Button>
                  </div>

                  <div className={styles.actionBtns}>
                    <Button
                      size="small"
                      appearance="subtle"
                      icon={<EditRegular />}
                      title={t.inventory.editProduct}
                      aria-label={t.inventory.editProduct}
                      onClick={() => openEditModal(p)}
                    />
                    <Button
                      size="small"
                      appearance="subtle"
                      icon={<DeleteRegular style={{ color: tokens.colorPaletteRedForeground1 }} />}
                      title={t.inventory.deleteProduct}
                      aria-label={t.inventory.deleteProduct}
                      onClick={() => openDeleteDialog(p)}
                    />
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>

      {/* ADD / EDIT PRODUCT MODAL */}
      <Dialog
        open={isModalOpen}
        onOpenChange={(_, data) => {
          setIsModalOpen(data.open);
          if (!data.open) {
            setFormNameError('');
            setFormCostError('');
            setFormPriceError('');
            setModalGeneralError(null);
          }
        }}
      >
        <DialogSurface style={{ maxWidth: '520px', width: '92%' }}>
          <DialogBody>
            <DialogTitle>
              {modalMode === 'add' ? t.inventory.addModalTitle : t.inventory.editModalTitle}
            </DialogTitle>
            <DialogContent style={{ marginTop: tokens.spacingVerticalM }}>
              {modalGeneralError && (
                <div role="alert" style={{ marginBottom: tokens.spacingVerticalM }}>
                  <MessageBar intent="warning" layout="multiline">
                    <MessageBarBody>{modalGeneralError}</MessageBarBody>
                  </MessageBar>
                </div>
              )}
              <div className={styles.formGrid}>
                {/* Product Name */}
                <div style={{ gridColumn: '1 / -1' }}>
                  <Text weight="semibold" size={200} style={{ display: 'block', marginBottom: '4px' }}>
                    {t.inventory.productNameLabel}
                  </Text>
                  <Input
                    aria-label={t.inventory.productNameLabel}
                    aria-invalid={Boolean(formNameError)}
                    aria-describedby={formNameError ? 'inventory-product-name-error' : undefined}
                    style={{ width: '100%' }}
                    placeholder="e.g. Lucky Me Pancit Canton Kalamansi"
                    value={formName}
                    onChange={(_, data) => {
                      setFormName(data.value);
                      if (formNameError) setFormNameError('');
                    }}
                  />
                  {formNameError && (
                    <Text
                      id="inventory-product-name-error"
                      role="alert"
                      size={200}
                      style={{ color: tokens.colorPaletteRedForeground1, marginTop: '2px', display: 'block' }}
                    >
                      {formNameError}
                    </Text>
                  )}
                </div>

                {/* Category */}
                <div>
                  <Text weight="semibold" size={200} style={{ display: 'block', marginBottom: '4px' }}>
                    {t.inventory.categoryLabel}
                  </Text>
                  <Input
                    aria-label={t.inventory.categoryLabel}
                    style={{ width: '100%' }}
                    placeholder="e.g. Noodles & Instant Food"
                    list="categories-list"
                    value={formCategory}
                    onChange={(_, data) => setFormCategory(data.value)}
                  />
                  <datalist id="categories-list">
                    {categories.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>

                {/* Barcode */}
                <div>
                  <Text weight="semibold" size={200} style={{ display: 'block', marginBottom: '4px' }}>
                    {t.inventory.barcodeLabel}
                  </Text>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <Input
                      aria-label={t.inventory.barcodeLabel}
                      style={{ flex: 1 }}
                      placeholder="e.g. 4800016644810"
                      value={formBarcode}
                      onChange={(_, data) => setFormBarcode(data.value)}
                    />
                    <Button
                      appearance="subtle"
                      icon={<BarcodeScannerRegular />}
                      title={t.barcode.openCamera}
                      onClick={() => setIsModalScannerOpen(true)}
                    />
                  </div>
                </div>

                {/* Cost (Puhunan) */}
                <div>
                  <Text weight="semibold" size={200} style={{ display: 'block', marginBottom: '4px' }}>
                    {t.inventory.costLabel}
                  </Text>
                  <Input
                    type="number"
                    aria-label={t.inventory.costLabel}
                    aria-invalid={Boolean(formCostError)}
                    aria-describedby={formCostError ? 'inventory-product-cost-error' : undefined}
                    step="0.25"
                    min="0"
                    max={MAX_PRODUCT_COST.toString()}
                    style={{ width: '100%' }}
                    value={formCost === '' ? '' : formCost.toString()}
                    onChange={(_, data) => {
                      const clean = data.value.replace(/,/g, '').trim();
                      setFormCost(clean === '' ? '' : Number(clean));
                      if (formCostError) setFormCostError('');
                    }}
                  />
                  {formCostError && (
                    <Text id="inventory-product-cost-error" role="alert" size={200} style={{ color: tokens.colorPaletteRedForeground1, marginTop: '2px', display: 'block' }}>
                      {formCostError}
                    </Text>
                  )}
                </div>

                {/* Retail Price (SRP) */}
                <div>
                  <Text weight="semibold" size={200} style={{ display: 'block', marginBottom: '4px' }}>
                    {t.inventory.priceLabel}
                  </Text>
                  <Input
                    type="number"
                    aria-label={t.inventory.priceLabel}
                    aria-invalid={Boolean(formPriceError)}
                    aria-describedby={formPriceError ? 'inventory-product-price-error' : undefined}
                    step="0.25"
                    min="0"
                    max={MAX_PRODUCT_PRICE.toString()}
                    style={{ width: '100%' }}
                    value={formPrice === '' ? '' : formPrice.toString()}
                    onChange={(_, data) => {
                      const clean = data.value.replace(/,/g, '').trim();
                      setFormPrice(clean === '' ? '' : Number(clean));
                      if (formPriceError) setFormPriceError('');
                    }}
                  />
                  {formPriceError && (
                    <Text id="inventory-product-price-error" role="alert" size={200} style={{ color: tokens.colorPaletteRedForeground1, marginTop: '2px', display: 'block' }}>
                      {formPriceError}
                    </Text>
                  )}
                </div>

                {/* Stock Qty */}
                <div style={{ gridColumn: '1 / -1' }}>
                  <Text weight="semibold" size={200} style={{ display: 'block', marginBottom: '4px' }}>
                    {t.inventory.stockLabel}
                  </Text>
                  <Input
                    type="number"
                    aria-label={t.inventory.stockLabel}
                    aria-invalid={Boolean(formStockError)}
                    aria-describedby={formStockError ? 'inventory-product-stock-error' : undefined}
                    min="0"
                    max={MAX_PRODUCT_STOCK.toString()}
                    step="1"
                    style={{ width: '100%' }}
                    value={formStock === '' ? '' : formStock.toString()}
                    onChange={(_, data) => {
                      setFormStock(data.value === '' ? '' : Number(data.value));
                      if (formStockError) setFormStockError('');
                    }}
                  />
                  {formStockError && (
                    <Text id="inventory-product-stock-error" role="alert" size={200} style={{ color: tokens.colorPaletteRedForeground1, marginTop: '2px', display: 'block' }}>
                      {formStockError}
                    </Text>
                  )}
                </div>
              </div>

              {/* Live Margin & Profit Preview Box */}
              <div className={styles.marginPreviewBox}>
                <div className={styles.marginPreviewRow}>
                  <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
                    {t.inventory.profitPreview}
                  </Text>
                  <Text
                    weight="bold"
                    size={300}
                    style={{
                      color:
                        liveProfit > 0
                          ? tokens.colorPaletteGreenForeground1
                          : livePrice < liveCost
                          ? tokens.colorPaletteRedForeground1
                          : tokens.colorNeutralForeground1
                    }}
                  >
                    {formatPeso(liveProfit)}
                  </Text>
                </div>
                <div className={styles.marginPreviewRow}>
                  <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
                    {t.inventory.marginPreview}
                  </Text>
                  <Badge
                    appearance="filled"
                    color={liveMarginPct >= 20 ? 'success' : liveMarginPct >= 10 ? 'warning' : 'danger'}
                  >
                    {liveMarginPct.toFixed(1)}%
                  </Badge>
                </div>
              </div>
            </DialogContent>
            <DialogActions style={{ marginTop: tokens.spacingVerticalL }}>
              <Button appearance="secondary" onClick={() => setIsModalOpen(false)}>
                {t.common.cancel}
              </Button>
              <Button appearance="primary" onClick={handleSaveProduct}>
                {t.common.save}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>

      {/* DELETE CONFIRMATION DIALOG */}
      <Dialog open={deleteDialogOpen} onOpenChange={(_, data) => setDeleteDialogOpen(data.open)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>{t.inventory.deleteProduct}</DialogTitle>
            <DialogContent style={{ marginTop: tokens.spacingVerticalM }}>
              <Text size={300} style={{ display: 'block', marginBottom: tokens.spacingVerticalS }}>
                {t.inventory.deleteConfirm}
              </Text>
              {productToDelete && (
                <div
                  style={{
                    backgroundColor: tokens.colorNeutralBackground2,
                    padding: '12px 16px',
                    borderRadius: '8px',
                    marginTop: tokens.spacingVerticalS
                  }}
                >
                  <Text weight="bold" size={300} style={{ display: 'block' }}>
                    {productToDelete.name}
                  </Text>
                  <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
                    {productToDelete.category || 'General'} • {productToDelete.stockQty} in stock • {formatPeso(productToDelete.price)} SRP
                  </Text>
                </div>
              )}
            </DialogContent>
            <DialogActions style={{ marginTop: tokens.spacingVerticalL }}>
              <Button appearance="secondary" onClick={() => setDeleteDialogOpen(false)}>
                {t.common.cancel}
              </Button>
              <Button
                appearance="primary"
                style={{ backgroundColor: tokens.colorPaletteRedBackground3, color: '#fff' }}
                onClick={handleConfirmDelete}
              >
                {t.common.delete}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>

      {/* Camera Barcode Scanner for Search Bar */}
      <BarcodeScannerModal
        isOpen={isSearchScannerOpen}
        onClose={() => setIsSearchScannerOpen(false)}
        onScan={handleSearchBarcodeScan}
      />

      {/* Camera Barcode Scanner for Add/Edit Modal */}
      <BarcodeScannerModal
        isOpen={isModalScannerOpen}
        onClose={() => setIsModalScannerOpen(false)}
        onScan={handleModalBarcodeScan}
      />

      {/* Quick Register Product Dialog for Unrecognized Barcode */}
      <QuickRegisterProductDialog
        isOpen={isQuickRegOpen}
        unrecognizedBarcode={unrecognizedBarcode}
        onClose={() => setIsQuickRegOpen(false)}
        onProductRegistered={handleProductQuickRegistered}
      />
    </div>
  );
};
