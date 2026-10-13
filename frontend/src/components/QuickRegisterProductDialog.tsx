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
  Badge
} from '@fluentui/react-components';
import {
  AddRegular,
  BarcodeScannerRegular,
  DismissRegular,
  QuestionCircleRegular
} from '@fluentui/react-icons';
import { db, type ProductRecord } from '../db/db';
import { enqueueSync } from '../sync/syncEngine';
import { useAuthStore } from '../state/authStore';
import { useTranslation } from '../state/languageStore';
import { useSubscriptionStore } from '../state/subscriptionStore';
import { formatPeso } from '../utils/currency';

interface QuickRegisterProductDialogProps {
  isOpen: boolean;
  unrecognizedBarcode: string | null;
  onClose: () => void;
  onProductRegistered: (product: ProductRecord) => void;
  addToCartOnSave?: boolean;
}

const useStyles = makeStyles({
  surface: {
    maxWidth: '520px',
    width: '92%',
    ...shorthands.padding(tokens.spacingVerticalM),
    backgroundColor: tokens.colorNeutralBackground1,
    ...shorthands.borderRadius(tokens.borderRadiusLarge)
  },
  promptSurface: {
    maxWidth: '440px',
    width: '90%',
    ...shorthands.padding(tokens.spacingVerticalM),
    backgroundColor: tokens.colorNeutralBackground1,
    ...shorthands.borderRadius(tokens.borderRadiusLarge)
  },
  barcodeHighlight: {
    ...shorthands.padding('6px', '12px'),
    ...shorthands.borderRadius('8px'),
    backgroundColor: tokens.colorNeutralBackground3,
    ...shorthands.border('1px', 'dashed', tokens.colorNeutralStroke1),
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    marginTop: tokens.spacingVerticalS,
    marginBottom: tokens.spacingVerticalM
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
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
  }
});

export const QuickRegisterProductDialog: React.FC<QuickRegisterProductDialogProps> = ({
  isOpen,
  unrecognizedBarcode,
  onClose,
  onProductRegistered,
  addToCartOnSave = false
}) => {
  const styles = useStyles();
  const { t } = useTranslation();
  const tenantId = useAuthStore((s) => s.tenantId);

  // Two stages:
  // stage 'prompt': "Barcode not found. Would you like to register this as a new product?"
  // stage 'form': Form with pre-filled barcode
  const [stage, setStage] = useState<'prompt' | 'form'>('prompt');

  // Form states
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState('');
  const [category, setCategory] = useState('');
  const [cost, setCost] = useState<number | ''>('');
  const [costError, setCostError] = useState('');
  const [price, setPrice] = useState<number | ''>('');
  const [priceError, setPriceError] = useState('');
  const [stock, setStock] = useState<number | ''>(10);
  const [categories, setCategories] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen) {
      setStage('prompt');
      setName('');
      setNameError('');
      setCategory('');
      setCost('');
      setCostError('');
      setPrice('');
      setPriceError('');
      setStock(10);

      // Load distinct categories for datalist
      db.products.where('tenantId').equals(tenantId).toArray().then((prods) => {
        const unique = Array.from(
          new Set(prods.map((p) => p.category?.trim()).filter(Boolean) as string[])
        ).sort();
        setCategories(unique);
      });
    }
  }, [isOpen, unrecognizedBarcode, tenantId]);

  if (!isOpen || !unrecognizedBarcode) return null;

  const costNum = Number(cost) || 0;
  const priceNum = Number(price) || 0;
  const unitProfit = Math.max(0, priceNum - costNum);
  const marginPct = priceNum > 0 ? ((priceNum - costNum) / priceNum) * 100 : 0;

  const handleSave = async () => {
    setNameError('');
    setCostError('');
    setPriceError('');

    if (!name.trim()) {
      setNameError(t.barcode.productNameRequired);
      return;
    }
    if (costNum < 0) {
      setCostError(t.barcode.costCannotBeNegative);
      return;
    }
    if (priceNum <= 0) {
      setPriceError(t.barcode.priceMustBePositive);
      return;
    }

    const currentCount = await db.products.where('tenantId').equals(tenantId).count();
    const { canAddProduct, openUpgradeModal } = useSubscriptionStore.getState();
    if (!canAddProduct(currentCount)) {
      alert('Limit reached for Libre tier (50 products max). Please upgrade to Tindahan Pro or Negosyo Plus.');
      openUpgradeModal();
      return;
    }

    const now = new Date().toISOString();
    const newProduct: ProductRecord = {
      id: crypto.randomUUID(),
      tenantId,
      name: name.trim(),
      category: category.trim() || 'General',
      barcode: unrecognizedBarcode.trim(),
      cost: costNum,
      price: priceNum,
      stockQty: Math.max(0, Number(stock) || 0),
      updatedAt: now
    };

    try {
      await db.products.add(newProduct);
      await enqueueSync('Product', 'Insert', newProduct);

      onProductRegistered(newProduct);
      onClose();
    } catch (err) {
      console.error('Failed to register product:', err);
    }
  };

  // 1. Stage Prompt: "Barcode not found. Would you like to register this as a new product?"
  if (stage === 'prompt') {
    return (
      <Dialog open={isOpen} onOpenChange={(_, data) => !data.open && onClose()}>
        <DialogSurface className={styles.promptSurface}>
          <DialogBody>
            <DialogTitle
              action={
                <Button
                  appearance="subtle"
                  aria-label="Close"
                  icon={<DismissRegular />}
                  onClick={onClose}
                />
              }
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <QuestionCircleRegular style={{ color: tokens.colorPaletteDarkOrangeForeground1 }} />
                <span>{t.barcode.notFoundTitle}</span>
              </div>
            </DialogTitle>

            <DialogContent style={{ marginTop: tokens.spacingVerticalM }}>
              <Text size={300} style={{ display: 'block', lineHeight: 1.5 }}>
                {t.barcode.notFoundPrompt}
              </Text>

              <div className={styles.barcodeHighlight}>
                <BarcodeScannerRegular fontSize={20} />
                <div>
                  <Text size={100} style={{ color: tokens.colorNeutralForeground3, display: 'block' }}>
                    {t.barcode.barcodeLabel}
                  </Text>
                  <Text weight="bold" size={300} style={{ fontFamily: 'monospace' }}>
                    {unrecognizedBarcode}
                  </Text>
                </div>
              </div>
            </DialogContent>

            <DialogActions style={{ marginTop: tokens.spacingVerticalM }}>
              <Button appearance="secondary" onClick={onClose}>
                {t.common.cancel}
              </Button>
              <Button
                appearance="primary"
                icon={<AddRegular />}
                onClick={() => setStage('form')}
              >
                {t.barcode.registerPromptBtn}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    );
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(_, data) => {
        if (!data.open) {
          setNameError('');
          setCostError('');
          setPriceError('');
          onClose();
        }
      }}
    >
      <DialogSurface className={styles.surface}>
        <DialogBody>
          <DialogTitle
            action={
              <Button
                appearance="subtle"
                aria-label="Close"
                icon={<DismissRegular />}
                onClick={onClose}
              />
            }
          >
            {t.barcode.registerModalTitle}
          </DialogTitle>

          <DialogContent style={{ marginTop: tokens.spacingVerticalM }}>
            <div className={styles.formGrid}>
              {/* Pre-filled Barcode */}
              <div style={{ gridColumn: '1 / -1' }}>
                <Text weight="semibold" size={200} style={{ display: 'block', marginBottom: '4px' }}>
                  {t.barcode.barcodeLabel}
                </Text>
                <Input
                  aria-label={t.barcode.barcodeLabel}
                  style={{ width: '100%', fontFamily: 'monospace' }}
                  value={unrecognizedBarcode}
                  readOnly
                  contentBefore={<BarcodeScannerRegular />}
                />
              </div>

              {/* Product Name */}
              <div style={{ gridColumn: '1 / -1' }}>
                <Text weight="semibold" size={200} style={{ display: 'block', marginBottom: '4px' }}>
                  {t.barcode.productNameLabel}
                </Text>
                <Input
                  aria-label={t.barcode.productNameLabel}
                  aria-invalid={Boolean(nameError)}
                  aria-describedby={nameError ? 'quick-register-product-name-error' : undefined}
                  style={{ width: '100%' }}
                  placeholder="e.g. San Miguel Pale Pilsen 330ml"
                  value={name}
                  onChange={(_, data) => {
                    setName(data.value);
                    if (nameError) setNameError('');
                  }}
                  autoFocus
                />
                {nameError && (
                  <Text
                    id="quick-register-product-name-error"
                    role="alert"
                    size={200}
                    style={{ color: tokens.colorPaletteRedForeground1, marginTop: '2px', display: 'block' }}
                  >
                    {nameError}
                  </Text>
                )}
              </div>

              {/* Category */}
              <div>
                <Text weight="semibold" size={200} style={{ display: 'block', marginBottom: '4px' }}>
                  {t.barcode.categoryLabel}
                </Text>
                <Input
                  aria-label={t.barcode.categoryLabel}
                  style={{ width: '100%' }}
                  placeholder="e.g. Beverages"
                  list="quick-reg-categories"
                  value={category}
                  onChange={(_, data) => setCategory(data.value)}
                />
                <datalist id="quick-reg-categories">
                  {categories.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>

              {/* Initial Stock */}
              <div>
                <Text weight="semibold" size={200} style={{ display: 'block', marginBottom: '4px' }}>
                  {t.barcode.stockLabel}
                </Text>
                <Input
                  type="number"
                  aria-label={t.barcode.stockLabel}
                  min="0"
                  step="1"
                  style={{ width: '100%' }}
                  value={stock === '' ? '' : stock.toString()}
                  onChange={(_, data) => setStock(data.value === '' ? '' : Number(data.value))}
                />
              </div>

              {/* Cost Price */}
              <div>
                <Text weight="semibold" size={200} style={{ display: 'block', marginBottom: '4px' }}>
                  {t.barcode.costLabel}
                </Text>
                <Input
                  type="number"
                  aria-label={t.barcode.costLabel}
                  aria-invalid={Boolean(costError)}
                  aria-describedby={costError ? 'quick-register-cost-error' : undefined}
                  step="0.25"
                  min="0"
                  style={{ width: '100%' }}
                  placeholder="0.00"
                  value={cost === '' ? '' : cost.toString()}
                  onChange={(_, data) => {
                    setCost(data.value === '' ? '' : Number(data.value));
                    if (costError) setCostError('');
                  }}
                />
                {costError && (
                  <Text id="quick-register-cost-error" role="alert" size={200} style={{ color: tokens.colorPaletteRedForeground1, marginTop: '2px', display: 'block' }}>
                    {costError}
                  </Text>
                )}
              </div>

              {/* Selling Price (SRP) */}
              <div>
                <Text weight="semibold" size={200} style={{ display: 'block', marginBottom: '4px' }}>
                  {t.barcode.priceLabel}
                </Text>
                <Input
                  type="number"
                  aria-label={t.barcode.priceLabel}
                  aria-invalid={Boolean(priceError)}
                  aria-describedby={priceError ? 'quick-register-price-error' : undefined}
                  step="0.25"
                  min="0"
                  style={{ width: '100%' }}
                  placeholder="0.00"
                  value={price === '' ? '' : price.toString()}
                  onChange={(_, data) => {
                    setPrice(data.value === '' ? '' : Number(data.value));
                    if (priceError) setPriceError('');
                  }}
                />
                {priceError && (
                  <Text id="quick-register-price-error" role="alert" size={200} style={{ color: tokens.colorPaletteRedForeground1, marginTop: '2px', display: 'block' }}>
                    {priceError}
                  </Text>
                )}
              </div>
            </div>

            {/* Live Margin Preview Box */}
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
                      unitProfit > 0
                        ? tokens.colorPaletteGreenForeground1
                        : priceNum < costNum
                        ? tokens.colorPaletteRedForeground1
                        : tokens.colorNeutralForeground1
                  }}
                >
                  {formatPeso(unitProfit)}
                </Text>
              </div>
              <div className={styles.marginPreviewRow}>
                <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
                  {t.inventory.marginPreview}
                </Text>
                <Badge
                  appearance="filled"
                  color={marginPct >= 20 ? 'success' : marginPct >= 10 ? 'warning' : 'danger'}
                >
                  {marginPct.toFixed(1)}%
                </Badge>
              </div>
            </div>
          </DialogContent>

          <DialogActions style={{ marginTop: tokens.spacingVerticalL }}>
            <Button appearance="secondary" onClick={onClose}>
              {t.common.cancel}
            </Button>
            <Button appearance="primary" onClick={handleSave}>
              {addToCartOnSave ? t.barcode.saveAndAddToCart : t.barcode.saveProduct}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
};
