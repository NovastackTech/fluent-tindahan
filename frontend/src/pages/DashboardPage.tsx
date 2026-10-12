import React from 'react';
import {
  makeStyles,
  tokens,
  shorthands,
  Text,
  Card,
  Button,
  Badge,
  Divider
} from '@fluentui/react-components';
import {
  ShoppingBagRegular,
  NotebookRegular,
  PhoneRegular,
  ArrowUploadRegular,
  ReceiptRegular,
  CloudCheckmarkRegular,
  CloudDismissRegular,
  BoxRegular
} from '@fluentui/react-icons';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, isGCashTxnUnresolved } from '../db/db';
import { useSyncStore } from '../sync/syncEngine';
import type { NavTab } from '../components/Navigation';
import { useTranslation } from '../state/languageStore';
import { formatPeso } from '../utils/currency';
import { toLocalDateKey } from '../utils/date';

interface DashboardPageProps {
  onNavigate: (tab: NavTab) => void;
}

const useStyles = makeStyles({
  container: {
    ...shorthands.padding(tokens.spacingVerticalM, tokens.spacingHorizontalM),
    display: 'flex',
    flexDirection: 'column',
    ...shorthands.gap(tokens.spacingVerticalM),
    maxWidth: '1080px',
    marginLeft: 'auto',
    marginRight: 'auto',
    paddingBottom: '100px' // for navigation dock
  },
  greetingRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  actionGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    ...shorthands.gap(tokens.spacingHorizontalM)
  },
  actionCard: {
    cursor: 'pointer',
    ...shorthands.padding(tokens.spacingVerticalM, tokens.spacingHorizontalM),
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    ...shorthands.gap(tokens.spacingVerticalS),
    transitionProperty: 'transform, box-shadow',
    transitionDuration: tokens.durationNormal,
    '&:hover': {
      transform: 'translateY(-2px)',
      boxShadow: tokens.shadow8
    }
  },
  actionIconWrapper: {
    width: '48px',
    height: '48px',
    ...shorthands.borderRadius(tokens.borderRadiusCircular),
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '24px'
  },
  metricsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    ...shorthands.gap(tokens.spacingHorizontalM)
  },
  metricCard: {
    ...shorthands.padding(tokens.spacingVerticalM, tokens.spacingHorizontalM),
    display: 'flex',
    flexDirection: 'column',
    ...shorthands.gap(tokens.spacingVerticalXS)
  },
  metricValue: {
    fontSize: '26px',
    fontWeight: 'bold',
    color: tokens.colorBrandForeground1
  },
  recentList: {
    display: 'flex',
    flexDirection: 'column',
    ...shorthands.gap(tokens.spacingVerticalS)
  },
  recentRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    ...shorthands.padding(tokens.spacingVerticalXS, '0')
  }
});

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigate }) => {
  const styles = useStyles();
  const { t } = useTranslation();
  const { isOnline, pendingCount } = useSyncStore();

  // Live queries straight from local Dexie database for instant offline UI
  const sales = useLiveQuery(() => db.sales.toArray(), []);
  const customers = useLiveQuery(() => db.customers.toArray(), []);
  const gcashTxns = useLiveQuery(() => db.gcashTxns.toArray(), []);
  const gcashResolutions = useLiveQuery(() => db.gcashTxnResolutions.toArray(), []);
  const products = useLiveQuery(() => db.products.toArray(), []) || [];

  const lowStockProducts = products.filter((p) => (p.stockQty || 0) > 0 && (p.stockQty || 0) <= 5);

  // Today's boundaries
  const todayStr = toLocalDateKey(new Date());

  const todaySales = (sales || []).filter((s) => toLocalDateKey(s.date) === todayStr);
  const totalSalesAmount = todaySales.reduce((sum, s) => sum + s.totalAmount, 0);

  const debtors = (customers || []).filter((c) => c.totalUtangBalance > 0);
  const totalUtangAmount = debtors.reduce((sum, c) => sum + c.totalUtangBalance, 0);

  const resolvedGCashIds = new Set((gcashResolutions || []).map((resolution) => resolution.gcashTxnId));
  const todayGCash = (gcashTxns || []).filter(
    (g) => toLocalDateKey(g.date) === todayStr && !isGCashTxnUnresolved(g) && !resolvedGCashIds.has(g.id)
  );
  const totalGCashVolume = todayGCash.reduce((sum, g) => sum + g.amount, 0);
  const totalGCashFees = todayGCash.reduce((sum, g) => sum + g.fee, 0);

  const recentSales = (sales || []).slice(-5).reverse();

  return (
    <div className={styles.container}>
      {/* Greeting & Quick Status */}
      <div className={styles.greetingRow}>
        <div>
          <Text size={500} weight="bold">{t.dashboard.greeting}</Text>
          <Text size={300} style={{ color: tokens.colorNeutralForeground3, display: 'block' }}>
            {t.dashboard.greetingSub}
          </Text>
        </div>
        <Badge
          appearance="tint"
          color={isOnline ? 'success' : 'warning'}
          icon={isOnline ? <CloudCheckmarkRegular /> : <CloudDismissRegular />}
          size="medium"
        >
          {isOnline ? (pendingCount > 0 ? `${pendingCount} ${t.common.queued}` : t.common.online) : t.common.offline}
        </Badge>
      </div>

      {/* Prominent Quick Actions */}
      <div>
        <Text weight="semibold" size={400} style={{ marginBottom: tokens.spacingVerticalS, display: 'block' }}>
          {t.dashboard.quickActions}
        </Text>
        <div className={styles.actionGrid}>
          <Card
            className={styles.actionCard}
            onClick={() => onNavigate('pos')}
            style={{ backgroundColor: tokens.colorNeutralBackground1 }}
          >
            <div className={styles.actionIconWrapper} style={{ backgroundColor: '#E1F5FE', color: '#0288D1' }}>
              <ShoppingBagRegular />
            </div>
            <Text weight="bold" size={300}>{t.dashboard.posActionTitle}</Text>
            <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>{t.dashboard.posActionSub}</Text>
          </Card>

          <Card
            className={styles.actionCard}
            onClick={() => onNavigate('gcash')}
            style={{ backgroundColor: tokens.colorNeutralBackground1 }}
          >
            <div className={styles.actionIconWrapper} style={{ backgroundColor: '#E8F5E9', color: '#2E7D32' }}>
              <PhoneRegular />
            </div>
            <Text weight="bold" size={300}>{t.dashboard.gcashActionTitle}</Text>
            <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>{t.dashboard.gcashActionSub}</Text>
          </Card>

          <Card
            className={styles.actionCard}
            onClick={() => onNavigate('utang')}
            style={{ backgroundColor: tokens.colorNeutralBackground1 }}
          >
            <div className={styles.actionIconWrapper} style={{ backgroundColor: '#FFF3E0', color: '#E65100' }}>
              <NotebookRegular />
            </div>
            <Text weight="bold" size={300}>{t.dashboard.utangActionTitle}</Text>
            <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>{t.dashboard.utangActionSub} ({debtors.length})</Text>
          </Card>

          <Card
            className={styles.actionCard}
            onClick={() => onNavigate('inventory')}
            style={{ backgroundColor: tokens.colorNeutralBackground1 }}
          >
            <div className={styles.actionIconWrapper} style={{ backgroundColor: '#EDE7F6', color: '#512DA8' }}>
              <BoxRegular />
            </div>
            <Text weight="bold" size={300}>{t.nav.inventory}</Text>
            <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
              {lowStockProducts.length} {t.inventory.lowStockAlerts}
            </Text>
          </Card>

          <Card
            className={styles.actionCard}
            onClick={() => onNavigate('import')}
            style={{ backgroundColor: tokens.colorNeutralBackground1 }}
          >
            <div className={styles.actionIconWrapper} style={{ backgroundColor: '#F3E5F5', color: '#7B1FA2' }}>
              <ArrowUploadRegular />
            </div>
            <Text weight="bold" size={300}>{t.dashboard.importActionTitle}</Text>
            <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>{t.dashboard.importActionSub}</Text>
          </Card>
        </div>
      </div>

      {/* Metrics Section */}
      <div>
        <Text weight="semibold" size={400} style={{ marginBottom: tokens.spacingVerticalS, display: 'block' }}>
          {t.dashboard.todaySummary}
        </Text>
        <div className={styles.metricsGrid}>
          <Card className={styles.metricCard}>
            <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>{t.dashboard.todaySales}</Text>
            <div className={styles.metricValue}>{formatPeso(totalSalesAmount)}</div>
            <Text size={200}>{todaySales.length} {t.dashboard.txnCount.toLowerCase()}</Text>
          </Card>

          <Card className={styles.metricCard}>
            <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>{t.dashboard.totalUtang}</Text>
            <div className={styles.metricValue} style={{ color: tokens.colorPaletteRedForeground1 }}>
              {formatPeso(totalUtangAmount)}
            </div>
            <Text size={200}>{debtors.length} {t.dashboard.debtorsWithBalance}</Text>
          </Card>

          <Card className={styles.metricCard}>
            <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>{t.dashboard.gcashVolume}</Text>
            <div data-testid="today-gcash-volume" className={styles.metricValue} style={{ color: tokens.colorPaletteBlueForeground2 }}>
              {formatPeso(totalGCashVolume)}
            </div>
            <Text size={200}>{t.gcash.todayFees}: <strong data-testid="today-gcash-fees">{formatPeso(totalGCashFees)}</strong> ({todayGCash.length} txns)</Text>
          </Card>

          <Card
            className={styles.metricCard}
            style={{ cursor: 'pointer' }}
            onClick={() => onNavigate('inventory')}
          >
            <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>{t.inventory.lowStockAlerts}</Text>
            <div
              className={styles.metricValue}
              style={{
                color: lowStockProducts.length > 0 ? tokens.colorPaletteRedForeground1 : tokens.colorPaletteGreenForeground1
              }}
            >
              {lowStockProducts.length}
            </div>
            <Text size={200}>
              {products.length} {t.inventory.totalProducts.toLowerCase()} (≤ 5)
            </Text>
          </Card>
        </div>
      </div>

      {/* Recent Transactions */}
      <Card style={{ padding: tokens.spacingVerticalM }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: tokens.spacingVerticalS }}>
          <Text weight="bold" size={400}>{t.dashboard.recentSales}</Text>
          <Button appearance="subtle" size="small" onClick={() => onNavigate('pos')}>
            {t.dashboard.goToPos}
          </Button>
        </div>
        <Divider />
        <div className={styles.recentList} style={{ marginTop: tokens.spacingVerticalS }}>
          {recentSales.length === 0 ? (
            <Text size={300} style={{ color: tokens.colorNeutralForeground3, textAlign: 'center', padding: '16px' }}>
              {t.dashboard.noSalesToday}
            </Text>
          ) : (
            recentSales.map((sale) => (
              <div key={sale.id} className={styles.recentRow}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ReceiptRegular fontSize={20} color={tokens.colorBrandForeground1} />
                  <div>
                    <Text weight="semibold" size={300}>{formatPeso(sale.totalAmount)}</Text>
                    <Text size={100} style={{ color: tokens.colorNeutralForeground3, display: 'block' }}>
                      {new Date(sale.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • Ref #{sale.id.slice(0, 6)}
                    </Text>
                  </div>
                </div>
                <Badge appearance="tint" color={sale.paymentMethod === 'Utang' ? 'warning' : 'brand'}>
                  {sale.paymentMethod}
                </Badge>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
};
