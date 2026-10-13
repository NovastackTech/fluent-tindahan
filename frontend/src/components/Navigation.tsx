import React from 'react';
import {
  makeStyles,
  tokens,
  shorthands,
  Text,
  Badge
} from '@fluentui/react-components';
import {
  HomeRegular,
  HomeFilled,
  ShoppingBagRegular,
  ShoppingBagFilled,
  NotebookRegular,
  NotebookFilled,
  PhoneRegular,
  PhoneFilled,
  ArrowUploadRegular,
  ArrowUploadFilled,
  BoxRegular,
  BoxFilled,
  SettingsRegular,
  SettingsFilled
} from '@fluentui/react-icons';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { useCartStore } from '../state/cartStore';
import { useAuthStore } from '../state/authStore';
import { useTranslation } from '../state/languageStore';

export type NavTab = 'dashboard' | 'pos' | 'inventory' | 'utang' | 'gcash' | 'import' | 'settings';

interface NavigationProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
}

const useStyles = makeStyles({
  navBar: {
    display: 'flex',
    justifyContent: 'space-around',
    alignItems: 'center',
    ...shorthands.padding(tokens.spacingVerticalXS, '4px'),
    backgroundColor: tokens.colorNeutralBackground1,
    ...shorthands.borderTop('1px', 'solid', tokens.colorNeutralStroke1),
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 90,
    boxShadow: tokens.shadow8,
    transitionProperty: 'all',
    transitionDuration: tokens.durationNormal,
    '@media (min-width: 768px)': {
      left: '50%',
      right: 'auto',
      transform: 'translateX(-50%)',
      width: 'calc(100% - 32px)',
      maxWidth: '680px',
      bottom: '16px',
      ...shorthands.borderRadius('30px'),
      ...shorthands.border('1px', 'solid', tokens.colorNeutralStroke1),
      boxShadow: tokens.shadow16,
      ...shorthands.padding(tokens.spacingVerticalXS, tokens.spacingHorizontalM),
      backdropFilter: 'blur(12px)'
    }
  },
  navItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    ...shorthands.padding(tokens.spacingVerticalXS, '2px'),
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    cursor: 'pointer',
    minWidth: '44px',
    userSelect: 'none',
    position: 'relative',
    transitionProperty: 'all',
    transitionDuration: tokens.durationNormal,
    '&:hover': {
      backgroundColor: tokens.colorNeutralBackground1Hover,
      transform: 'translateY(-1px)'
    },
    '@media (min-width: 768px)': {
      minWidth: '70px',
      ...shorthands.padding(tokens.spacingVerticalXS, tokens.spacingHorizontalS)
    }
  },
  activeNavItem: {
    color: tokens.colorBrandForeground1,
    fontWeight: tokens.fontWeightSemibold
  },
  inactiveNavItem: {
    color: tokens.colorNeutralForeground3
  },
  iconWrapper: {
    fontSize: '22px',
    height: '24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative'
  },
  badgePos: {
    position: 'absolute',
    top: '-4px',
    right: '-12px'
  },
  label: {
    fontSize: '10.5px',
    marginTop: '2px',
    textAlign: 'center',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  }
});

export const Navigation: React.FC<NavigationProps> = ({ activeTab, onTabChange }) => {
  const styles = useStyles();
  const cartItemCount = useCartStore((s) => s.getTotalCount());
  const tenantId = useAuthStore((state) => state.tenantId);
  const lowStockCount = useLiveQuery(
    () => db.products.where('tenantId').equals(tenantId).filter((product) => product.stockQty <= 5).count(),
    [tenantId]
  ) || 0;
  const { t } = useTranslation();

  const tabs: Array<{
    id: NavTab;
    label: string;
    icon: React.ReactNode;
    activeIcon: React.ReactNode;
    badge?: number;
    badgeColor?: 'brand' | 'danger' | 'severe' | 'warning' | 'success' | 'informative';
  }> = [
    {
      id: 'dashboard',
      label: t.nav.dashboard,
      icon: <HomeRegular />,
      activeIcon: <HomeFilled />
    },
    {
      id: 'pos',
      label: t.nav.pos,
      icon: <ShoppingBagRegular />,
      activeIcon: <ShoppingBagFilled />,
      badge: cartItemCount,
      badgeColor: 'brand'
    },
    {
      id: 'inventory',
      label: t.nav.inventory,
      icon: <BoxRegular />,
      activeIcon: <BoxFilled />,
      badge: lowStockCount,
      badgeColor: 'warning'
    },
    {
      id: 'utang',
      label: t.nav.utang,
      icon: <NotebookRegular />,
      activeIcon: <NotebookFilled />
    },
    {
      id: 'gcash',
      label: t.nav.gcash,
      icon: <PhoneRegular />,
      activeIcon: <PhoneFilled />
    },
    {
      id: 'import',
      label: t.nav.import,
      icon: <ArrowUploadRegular />,
      activeIcon: <ArrowUploadFilled />
    },
    {
      id: 'settings',
      label: t.nav.settings,
      icon: <SettingsRegular />,
      activeIcon: <SettingsFilled />
    }
  ];

  return (
    <nav className={styles.navBar} aria-label="Bottom Navigation">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <div
            key={tab.id}
            role="button"
            tabIndex={0}
            className={`${styles.navItem} ${isActive ? styles.activeNavItem : styles.inactiveNavItem}`}
            onClick={() => onTabChange(tab.id)}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onTabChange(tab.id)}
          >
            <div className={styles.iconWrapper}>
              {isActive ? tab.activeIcon : tab.icon}
              {tab.badge !== undefined && tab.badge > 0 && (
                <div className={styles.badgePos}>
                  <Badge color={tab.badgeColor || 'brand'} shape="circular" size="small">
                    {tab.badge}
                  </Badge>
                </div>
              )}
            </div>
            <Text className={styles.label}>{tab.label}</Text>
          </div>
        );
      })}
    </nav>
  );
};
