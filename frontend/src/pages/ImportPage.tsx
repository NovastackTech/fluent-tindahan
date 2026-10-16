import React, { useState } from 'react';
import {
  makeStyles,
  tokens,
  shorthands,
  Text,
  Button,
  Card,
  Badge,
  Divider,
  MessageBar,
  MessageBarTitle,
  MessageBarBody,
  MessageBarActions
} from '@fluentui/react-components';
import {
  ArrowUploadRegular,
  DocumentTableRegular,
  CheckmarkCircleRegular,
  DismissCircleRegular,
  DismissRegular
} from '@fluentui/react-icons';
import { parseProductsCsv, importProductsToDexieAndSync, type ParsedProductPreview } from '../services/csvImporter';
import { useTranslation } from '../state/languageStore';
import { formatPeso } from '../utils/currency';
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
  uploadArea: {
    ...shorthands.border('2px', 'dashed', tokens.colorNeutralStroke1),
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    ...shorthands.padding(tokens.spacingVerticalL, tokens.spacingHorizontalM),
    textAlign: 'center',
    cursor: 'pointer',
    backgroundColor: tokens.colorNeutralBackground2,
    transitionProperty: 'background-color, border-color',
    transitionDuration: tokens.durationNormal,
    '&:hover': {
      backgroundColor: tokens.colorNeutralBackground1Hover,
      ...shorthands.borderColor(tokens.colorBrandStroke1)
    }
  },
  tableWrapper: {
    overflowX: 'auto',
    marginTop: tokens.spacingVerticalM,
    maxHeight: '400px',
    overflowY: 'auto'
  },
  table: {
    width: '100%',
    fontSize: tokens.fontSizeBase200
  },
  th: {
    textAlign: 'left',
    ...shorthands.padding(tokens.spacingVerticalS, tokens.spacingHorizontalS),
    backgroundColor: tokens.colorNeutralBackground3,
    ...shorthands.borderBottom('2px', 'solid', tokens.colorNeutralStroke1),
    position: 'sticky',
    top: 0
  },
  td: {
    ...shorthands.padding(tokens.spacingVerticalS, tokens.spacingHorizontalS),
    ...shorthands.borderBottom('1px', 'solid', tokens.colorNeutralStroke2)
  },
  errorRow: {
    backgroundColor: '#FFF0F0'
  }
});

const SAMPLE_CSV = `name,price,cost,barcode,category,stockQty
Chippy Barbecue 110g,38.00,32.00,4800016111222,Snacks,25
Piattos Cheese 85g,36.00,30.00,4800016111333,Snacks,30
C2 Green Tea Apple 500ml,25.00,20.00,4800016111444,Beverages,20
Tide Detergent Bar with Downy 380g,28.00,23.50,4902430222111,Laundry,40
Surf Powder Sun Fresh 65g,12.00,9.50,4800018333222,Laundry,50
Nissin Cup Noodles Seafood 40g,22.00,18.00,4800016777888,Instant Noodles,30
Maggi Magic Sarap 8g,6.00,4.80,4800361222333,Seasoning,100
Nescafe Classic Stick 2g,5.00,3.80,4800361333444,Beverages,120
Pancit Canton Invalid Test,abc,10,12345,Instant Noodles,10`;

export const ImportPage: React.FC = () => {
  const styles = useStyles();
  const { t, language } = useTranslation();
  const { tier, openUpgradeModal } = useSubscriptionStore();
  const isCsvLocked = tier === 'Libre';

  const [previews, setPreviews] = useState<ParsedProductPreview[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleFileUpload = async (file: File) => {
    try {
      setErrorMessage(null);
      const parsed = await parseProductsCsv(file);
      setPreviews(parsed);
      setImportResult(null);
    } catch (err: any) {
      setErrorMessage(`Error reading file: ${err.message}`);
    }
  };

  const handleLoadSample = async () => {
    setErrorMessage(null);
    const parsed = await parseProductsCsv(SAMPLE_CSV);
    setPreviews(parsed);
    setImportResult(null);
  };

  const validCount = previews.filter((p) => p.isValid).length;
  const errorCount = previews.filter((p) => !p.isValid).length;

  const handleImport = async () => {
    setErrorMessage(null);
    if (validCount === 0) return;
    if (isCsvLocked) {
      openUpgradeModal();
      setErrorMessage(
        language === 'tl'
          ? 'Kailangan ng Tindahan Pro o Negosyo Plus para ma-import ang mga produkto gamit ang CSV.'
          : 'Tindahan Pro or Negosyo Plus is required to import products via CSV.'
      );
      return;
    }
    setIsImporting(true);

    try {
      const imported = await importProductsToDexieAndSync(previews);
      setImportResult(
        language === 'tl'
          ? `Matagumpay na na-import ang ${imported} produkto sa iyong offline store at nakapila para i-sync.`
          : `Successfully imported ${imported} products to your offline store and queued for sync.`
      );
      setPreviews([]);
    } catch (err: any) {
      setErrorMessage(`Import failed: ${err.message}`);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className={styles.container}>
      <div style={{ marginBottom: tokens.spacingVerticalM }}>
        <Text size={500} weight="bold">{t.importPage.title}</Text>
        <Text size={300} style={{ color: tokens.colorNeutralForeground3, display: 'block' }}>
          {t.importPage.subtitle}
        </Text>
      </div>

      {isCsvLocked && (
        <MessageBar intent="warning" layout="multiline" style={{ marginBottom: '16px' }}>
          <MessageBarBody>
            <MessageBarTitle>
              {language === 'tl' ? 'Pro Feature: CSV Bulk Import' : 'Pro Feature: CSV Bulk Import'}
            </MessageBarTitle>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <span>
                {language === 'tl'
                  ? 'Ang CSV Bulk Import ay eksklusibo sa mga naka-Tindahan Pro o Negosyo Plus. Mag-upgrade upang ma-import agad ang buong imbentaryo.'
                  : 'CSV Bulk Import is exclusive to Tindahan Pro and Negosyo Plus plans. Upgrade to quickly import your full product catalog.'}
              </span>
              <Button size="small" appearance="primary" onClick={openUpgradeModal}>
                {language === 'tl' ? 'Mag-upgrade sa Pro' : 'Upgrade to Pro'}
              </Button>
            </div>
          </MessageBarBody>
        </MessageBar>
      )}

      {errorMessage && (
        <div role="alert" style={{ marginBottom: '16px' }}>
          <MessageBar intent="error" layout="multiline">
            <MessageBarBody>
              <MessageBarTitle>{language === 'tl' ? 'May Problema sa Pag-import' : 'Import Error'}</MessageBarTitle>
              {errorMessage}
            </MessageBarBody>
            <MessageBarActions
              containerAction={
                <Button
                  appearance="subtle"
                  aria-label="Dismiss"
                  icon={<DismissRegular />}
                  onClick={() => setErrorMessage(null)}
                />
              }
            />
          </MessageBar>
        </div>
      )}

      {importResult && (
        <MessageBar intent="success" layout="multiline" style={{ marginBottom: '16px' }}>
          <MessageBarBody>
            <MessageBarTitle>{language === 'tl' ? 'Import Tagumpay!' : 'Import Succeeded!'}</MessageBarTitle>
            {importResult}
          </MessageBarBody>
        </MessageBar>
      )}

      {/* Upload Box */}
      <Card className={styles.card}>
        <div
          className={styles.uploadArea}
          onClick={() => document.getElementById('csvFileInput')?.click()}
        >
          <input
            id="csvFileInput"
            type="file"
            accept=".csv,text/csv"
            style={{ display: 'none' }}
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handleFileUpload(e.target.files[0]);
              }
            }}
          />
          <ArrowUploadRegular fontSize={40} color={tokens.colorBrandForeground1} />
          <Text weight="bold" size={400} style={{ display: 'block', marginTop: '8px' }}>
            {t.importPage.uploadPrompt}
          </Text>
          <Text size={200} style={{ color: tokens.colorNeutralForeground3, display: 'block' }}>
            {t.importPage.formatHint}
          </Text>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '12px' }}>
          <Button
            appearance="subtle"
            size="small"
            icon={<DocumentTableRegular />}
            onClick={handleLoadSample}
          >
            {t.importPage.trySample}
          </Button>
        </div>
      </Card>

      {/* Preview Grid */}
      {previews.length > 0 && (
        <Card className={styles.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <Text weight="bold" size={400}>{t.importPage.previewTitle} ({previews.length})</Text>
              <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                <Badge appearance="tint" color="success">
                  {validCount} {t.importPage.validBadge}
                </Badge>
                {errorCount > 0 && (
                  <Badge appearance="tint" color="danger">
                    {errorCount} {t.importPage.errorBadge}
                  </Badge>
                )}
              </div>
            </div>

            <Button
              appearance="primary"
              icon={<CheckmarkCircleRegular />}
              disabled={validCount === 0 || isImporting}
              onClick={handleImport}
            >
              {isImporting ? t.importPage.importing : `${t.importPage.importProductsBtn} (${validCount})`}
            </Button>
          </div>

          <Divider style={{ margin: '12px 0' }} />

          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.th}>{t.importPage.statusCol}</th>
                  <th className={styles.th}>{t.importPage.nameCol}</th>
                  <th className={styles.th}>{t.importPage.priceCol}</th>
                  <th className={styles.th}>{t.importPage.costCol}</th>
                  <th className={styles.th}>{t.importPage.barcodeCol}</th>
                  <th className={styles.th}>{t.importPage.categoryCol}</th>
                  <th className={styles.th}>{t.importPage.stockCol}</th>
                  <th className={styles.th}>{t.importPage.notesCol}</th>
                </tr>
              </thead>
              <tbody>
                {previews.map((item, idx) => (
                  <tr key={idx} className={item.isValid ? undefined : styles.errorRow}>
                    <td className={styles.td}>
                      {item.isValid ? (
                        <CheckmarkCircleRegular color={tokens.colorPaletteGreenForeground1} />
                      ) : (
                        <DismissCircleRegular color={tokens.colorPaletteRedForeground1} />
                      )}
                    </td>
                    <td className={styles.td}>
                      <strong>{item.name || t.importPage.unnamed}</strong>
                    </td>
                    <td className={styles.td}>{formatPeso(item.price)}</td>
                    <td className={styles.td}>{formatPeso(item.cost)}</td>
                    <td className={styles.td}>{item.barcode || '-'}</td>
                    <td className={styles.td}>{item.category}</td>
                    <td className={styles.td}>{item.stockQty}</td>
                    <td className={styles.td} style={{ color: item.isValid ? 'inherit' : tokens.colorPaletteRedForeground1 }}>
                      {item.errors.join(', ') || 'OK'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
};
