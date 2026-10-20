import React, { useState, useEffect } from 'react';
import {
  makeStyles,
  tokens,
  shorthands,
  Dialog,
  DialogSurface,
  DialogTitle,
  DialogBody,
  DialogContent,
  DialogActions,
  Button,
  Text,
  Input,
  Badge,
  MessageBar,
  MessageBarBody,
  MessageBarTitle
} from '@fluentui/react-components';
import {
  DismissRegular,
  SaveRegular,
  MoneyRegular,
  BoxRegular
} from '@fluentui/react-icons';
import { db, type ProductRecord, type DeadLetterRecord } from '../db/db';
import { retryDeadLetterItem } from '../sync/syncEngine';
import {
  MIN_PRODUCT_PRICE,
  MAX_PRODUCT_PRICE,
  MIN_PRODUCT_COST,
  MAX_PRODUCT_COST,
  MIN_PRODUCT_STOCK,
  MAX_PRODUCT_STOCK
} from '../constants/inventory';
import { useTranslation } from '../state/languageStore';
import { formatPeso } from '../utils/currency';

interface FixDlqProductDialogProps {
  isOpen: boolean;
  item: DeadLetterRecord | null;
  onClose: () => void;
  onSuccess?: () => void;
}

const useStyles = makeStyles({
  surface: {
    maxWidth: '540px',
    width: '92%',
    ...shorthands.padding(tokens.spacingVerticalM),
    backgroundColor: tokens.colorNeutralBackground1,
    ...shorthands.borderRadius(tokens.borderRadiusLarge)
  },
  errorBanner: {
    marginBottom: tokens.spacingVerticalM
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: tokens.spacingVerticalM,
    marginBottom: tokens.spacingVerticalM
  },
  marginPreviewBox: {
    ...shorthands.padding(tokens.spacingVerticalS, tokens.spacingHorizontalM),
    backgroundColor: tokens.colorNeutralBackground3,
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    ...shorthands.border('1px', 'solid', tokens.colorNeutralStroke2),
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: tokens.spacingVerticalM
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXXS
  },
  fieldError: {
    color: tokens.colorPaletteRedForeground1,
    fontSize: '12px'
  }
});

export const FixDlqProductDialog: React.FC<FixDlqProductDialogProps> = ({
  isOpen,
  item,
  onClose,
  onSuccess
}) => {
  const styles = useStyles();
  const { t, language } = useTranslation();

  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [barcode, setBarcode] = useState('');
  const [cost, setCost] = useState<string | number>('');
  const [price, setPrice] = useState<string | number>('');
  const [stock, setStock] = useState<string | number>('');

  const [nameError, setNameError] = useState('');
  const [costError, setCostError] = useState('');
  const [priceError, setPriceError] = useState('');
  const [stockError, setStockError] = useState('');
  const [generalError, setGeneralError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen || !item) return;

    let isMounted = true;

    const loadData = async () => {
      setGeneralError('');
      setNameError('');
      setCostError('');
      setPriceError('');
      setStockError('');

      const payload = item.payload || {};
      let localProd: ProductRecord | undefined;
      if (payload.id) {
        localProd = await db.products.get(payload.id);
      }

      if (!isMounted) return;

      const currentName = localProd?.name ?? payload.name ?? '';
      const currentCategory = localProd?.category ?? payload.category ?? 'General';
      const currentBarcode = localProd?.barcode ?? payload.barcode ?? '';
      const currentCost = localProd?.cost ?? payload.cost ?? 0;
      const currentPrice = localProd?.price ?? payload.price ?? 0;
      const currentStock = localProd?.stockQty ?? payload.stockQty ?? 0;

      setName(currentName);
      setCategory(currentCategory);
      setBarcode(currentBarcode);
      setCost(currentCost);
      setPrice(currentPrice);
      setStock(currentStock);

      const priceNum = Number(currentPrice);
      const costNum = Number(currentCost);
      const stockNum = Number(currentStock);

      if (isNaN(priceNum) || priceNum < MIN_PRODUCT_PRICE) {
        setPriceError(t.inventory.priceMustBePositive);
      } else if (priceNum > MAX_PRODUCT_PRICE) {
        setPriceError(t.inventory.priceExceedsMax);
      }

      if (isNaN(costNum) || costNum < MIN_PRODUCT_COST) {
        setCostError(t.inventory.costCannotBeNegative);
      } else if (costNum > MAX_PRODUCT_COST) {
        setCostError(t.inventory.costExceedsMax);
      }

      if (isNaN(stockNum) || stockNum < MIN_PRODUCT_STOCK) {
        setStockError(language === 'tl' ? 'Hindi maaaring negatibo ang stock.' : 'Stock cannot be negative.');
      } else if (stockNum > MAX_PRODUCT_STOCK) {
        setStockError(t.inventory.stockExceedsMax);
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, [isOpen, item, t, language]);

  if (!isOpen || !item) return null;

  const costClean = String(cost).replace(/,/g, '').trim();
  const priceClean = String(price).replace(/,/g, '').trim();
  const rawCost = costClean === '' ? 0 : Number(costClean);
  const rawPrice = priceClean === '' ? 0 : Number(priceClean);
  const isCostValid = !Number.isNaN(rawCost) && rawCost >= 0;
  const isPriceValid = !Number.isNaN(rawPrice) && rawPrice > 0;
  const isLiveMarginValid = isCostValid && isPriceValid;
  const profit = isLiveMarginValid ? Math.max(0, rawPrice - rawCost) : 0;
  const marginPct = isLiveMarginValid ? Math.round(((rawPrice - rawCost) / rawPrice) * 100) : null;

  const handleSaveAndRetry = async () => {
    setNameError('');
    setCostError('');
    setPriceError('');
    setStockError('');
    setGeneralError('');

    if (!name.trim()) {
      setNameError(t.inventory.productNameRequired);
      return;
    }

    const costClean = typeof cost === 'string' ? cost.replace(/,/g, '').trim() : cost;
    const priceClean = typeof price === 'string' ? price.replace(/,/g, '').trim() : price;
    const stockClean = typeof stock === 'string' ? stock.replace(/,/g, '').trim() : stock;

    const parsedCost = Number(costClean);
    const parsedPrice = Number(priceClean);
    const parsedStock = Number(stockClean);

    let hasError = false;

    if (isNaN(parsedPrice) || parsedPrice < MIN_PRODUCT_PRICE) {
      setPriceError(t.inventory.priceMustBePositive);
      hasError = true;
    } else if (parsedPrice > MAX_PRODUCT_PRICE) {
      setPriceError(t.inventory.priceExceedsMax);
      hasError = true;
    }

    if (isNaN(parsedCost) || parsedCost < MIN_PRODUCT_COST) {
      setCostError(t.inventory.costCannotBeNegative);
      hasError = true;
    } else if (parsedCost > MAX_PRODUCT_COST) {
      setCostError(t.inventory.costExceedsMax);
      hasError = true;
    }

    if (isNaN(parsedStock) || parsedStock < MIN_PRODUCT_STOCK) {
      setStockError(language === 'tl' ? 'Hindi maaaring negatibo ang stock.' : 'Stock cannot be negative.');
      hasError = true;
    } else if (parsedStock > MAX_PRODUCT_STOCK) {
      setStockError(t.inventory.stockExceedsMax);
      hasError = true;
    }

    if (hasError) return;

    setIsSubmitting(true);
    try {
      const correctedPayload: Partial<ProductRecord> = {
        name: name.trim(),
        category: category.trim() || 'General',
        barcode: barcode.trim() || undefined,
        cost: parsedCost,
        price: parsedPrice,
        stockQty: parsedStock
      };

      const result = await retryDeadLetterItem(item.id, correctedPayload);
      if (!result.success) {
        setGeneralError(result.error || t.settings.dlqRequiresCorrectionAlert);
        return;
      }

      onSuccess?.();
      onClose();
    } catch (err: any) {
      setGeneralError(err.message || 'Failed to retry item');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(_, data) => !data.open && onClose()}>
      <DialogSurface className={styles.surface}>
        <DialogTitle
          action={
            <Button
              appearance="subtle"
              aria-label={t.common.close}
              icon={<DismissRegular />}
              onClick={onClose}
            />
          }
        >
          {t.settings.dlqEditDialogTitle}
        </DialogTitle>

        <DialogBody>
          <DialogContent>
            {/* Server / Sync Error Banner */}
            <MessageBar intent="error" layout="multiline" className={styles.errorBanner}>
              <MessageBarBody>
                <MessageBarTitle>
                  {language === 'tl' ? 'Dahilan ng Pagbagsak sa Pag-sync' : 'Sync Rejection Reason'}
                </MessageBarTitle>
                {item.errorMessage || t.settings.dlqEditDialogDesc}
              </MessageBarBody>
            </MessageBar>

            {generalError && (
              <MessageBar intent="warning" layout="multiline" className={styles.errorBanner}>
                <MessageBarBody>{generalError}</MessageBarBody>
              </MessageBar>
            )}

            <Text size={200} style={{ color: tokens.colorNeutralForeground3, display: 'block', marginBottom: '12px' }}>
              {t.settings.dlqEditDialogDesc}
            </Text>

            <div className={styles.inputGroup} style={{ marginBottom: tokens.spacingVerticalM }}>
              <Text weight="semibold" size={200}>
                {t.inventory.productNameLabel}
              </Text>
              <Input
                data-testid="dlq-product-name-input"
                aria-label={t.inventory.productNameLabel}
                value={name}
                onChange={(e, d) => {
                  const val = d.value !== undefined ? d.value : e.target.value;
                  setName(val);
                  if (nameError) setNameError('');
                }}
                placeholder={language === 'tl' ? 'Pangalan ng paninda' : 'Product name'}
              />
              {nameError && <span className={styles.fieldError}>{nameError}</span>}
            </div>

            <div className={styles.formGrid}>
              <div className={styles.inputGroup}>
                <Text weight="semibold" size={200}>
                  {t.inventory.priceLabel}
                </Text>
                <Input
                  data-testid="dlq-product-price-input"
                  aria-label={t.inventory.priceLabel}
                  type="number"
                  step="0.01"
                  min={MIN_PRODUCT_PRICE.toString()}
                  max={MAX_PRODUCT_PRICE.toString()}
                  value={price.toString()}
                  onChange={(e, d) => {
                    const val = d.value !== undefined ? d.value : e.target.value;
                    setPrice(val);
                    if (priceError) setPriceError('');
                  }}
                  contentBefore="₱"
                />
                {priceError && <span className={styles.fieldError}>{priceError}</span>}
              </div>

              <div className={styles.inputGroup}>
                <Text weight="semibold" size={200}>
                  {t.inventory.costLabel}
                </Text>
                <Input
                  data-testid="dlq-product-cost-input"
                  aria-label={t.inventory.costLabel}
                  type="number"
                  step="0.01"
                  min={MIN_PRODUCT_COST.toString()}
                  max={MAX_PRODUCT_COST.toString()}
                  value={cost.toString()}
                  onChange={(e, d) => {
                    const val = d.value !== undefined ? d.value : e.target.value;
                    setCost(val);
                    if (costError) setCostError('');
                  }}
                  contentBefore="₱"
                />
                {costError && <span className={styles.fieldError}>{costError}</span>}
              </div>
            </div>

            <div className={styles.marginPreviewBox}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <MoneyRegular />
                <Text size={200} weight="semibold">
                  {t.inventory.colProfit}:
                </Text>
                <Text size={200} weight="bold" style={{ color: isLiveMarginValid ? tokens.colorPaletteGreenForeground1 : tokens.colorNeutralForeground3 }}>
                  {isLiveMarginValid ? formatPeso(profit) : '—'}
                </Text>
              </div>
              {marginPct !== null ? (
                <Badge appearance="filled" color={marginPct >= 20 ? 'success' : marginPct > 0 ? 'warning' : 'danger'}>
                  {marginPct}% {t.inventory.colMargin}
                </Badge>
              ) : (
                <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
                  —
                </Text>
              )}
            </div>

            <div className={styles.formGrid}>
              <div className={styles.inputGroup}>
                <Text weight="semibold" size={200}>
                  {t.inventory.colStock}
                </Text>
                <Input
                  data-testid="dlq-product-stock-input"
                  aria-label={t.inventory.colStock}
                  type="number"
                  step="1"
                  min={MIN_PRODUCT_STOCK.toString()}
                  max={MAX_PRODUCT_STOCK.toString()}
                  value={stock.toString()}
                  onChange={(e, d) => {
                    const val = d.value !== undefined ? d.value : e.target.value;
                    setStock(val);
                    if (stockError) setStockError('');
                  }}
                  contentBefore={<BoxRegular />}
                />
                {stockError && <span className={styles.fieldError}>{stockError}</span>}
              </div>

              <div className={styles.inputGroup}>
                <Text weight="semibold" size={200}>
                  {t.inventory.categoryLabel}
                </Text>
                <Input
                  data-testid="dlq-product-category-input"
                  aria-label={t.inventory.categoryLabel}
                  value={category}
                  onChange={(e, d) => {
                    const val = d.value !== undefined ? d.value : e.target.value;
                    setCategory(val);
                  }}
                  placeholder="General"
                />
              </div>
            </div>

            <div className={styles.inputGroup}>
              <Text weight="semibold" size={200}>
                {t.inventory.barcodeLabel}
              </Text>
              <Input
                data-testid="dlq-product-barcode-input"
                aria-label={t.inventory.barcodeLabel}
                value={barcode}
                onChange={(e, d) => {
                  const val = d.value !== undefined ? d.value : e.target.value;
                  setBarcode(val);
                }}
                placeholder={language === 'tl' ? 'Opsyonal na barcode' : 'Optional barcode'}
              />
            </div>
          </DialogContent>

          <DialogActions>
            <Button appearance="secondary" onClick={onClose} disabled={isSubmitting}>
              {t.common.cancel}
            </Button>
            <Button
              appearance="primary"
              icon={<SaveRegular />}
              onClick={handleSaveAndRetry}
              disabled={isSubmitting}
            >
              {isSubmitting ? (language === 'tl' ? 'Sine-save...' : 'Saving...') : t.settings.dlqSaveAndRetryBtn}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
};
