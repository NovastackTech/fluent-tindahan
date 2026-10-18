import React, { useState, useEffect, useRef } from 'react';
import {
  makeStyles,
  mergeClasses,
  tokens,
  shorthands,
  Text,
  Badge,
  Button
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
  SettingsFilled,
  ChevronUpRegular,
  ChevronDownRegular
} from '@fluentui/react-icons';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { useCartStore } from '../state/cartStore';
import { useAuthStore } from '../state/authStore';
import { useTranslation } from '../state/languageStore';

export type NavTab = 'dashboard' | 'pos' | 'inventory' | 'utang' | 'gcash' | 'import' | 'settings' | 'landing' | 'login';

export interface NavigationProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  forceCollapsible?: boolean;
}

const useStyles = makeStyles({
  // --- Standard Horizontal Bottom Navigation (when items fit in width) ---
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
  },

  // --- Collapsible Upward Vertical Mode (Phone Vertical / Portrait Narrow View) ---
  collapsibleBar: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 90,
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: tokens.colorNeutralBackground1,
    ...shorthands.borderTop('1px', 'solid', tokens.colorNeutralStroke1),
    boxShadow: tokens.shadow16,
    ...shorthands.padding('6px', '14px'),
    paddingBottom: 'max(8px, env(safe-area-inset-bottom, 8px))',
    userSelect: 'none',
    backdropFilter: 'blur(16px)',
    transitionProperty: 'all',
    transitionDuration: tokens.durationNormal
  },
  collapsedContent: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: '44px',
    cursor: 'pointer'
  },
  handleBar: {
    width: '36px',
    height: '4px',
    backgroundColor: tokens.colorNeutralStroke2,
    ...shorthands.borderRadius('2px'),
    margin: '0 auto 6px auto',
    flexShrink: 0
  },
  activeTabSummary: {
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap('10px'),
    flexGrow: 1
  },
  activeIconCircle: {
    width: '32px',
    height: '32px',
    ...shorthands.borderRadius(tokens.borderRadiusCircular),
    backgroundColor: tokens.colorBrandBackground2,
    color: tokens.colorBrandForeground1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    fontSize: '20px',
    flexShrink: 0
  },
  activeBadgePos: {
    position: 'absolute',
    top: '-4px',
    right: '-4px'
  },
  activeTextCol: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center'
  },
  activeTitle: {
    color: tokens.colorBrandForeground1,
    fontWeight: tokens.fontWeightSemibold,
    fontSize: '13px',
    lineHeight: '16px'
  },
  activeSubtitle: {
    color: tokens.colorNeutralForeground3,
    fontSize: '11px',
    lineHeight: '14px'
  },
  expandAction: {
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap('6px'),
    ...shorthands.padding('6px', '12px'),
    ...shorthands.borderRadius(tokens.borderRadiusCircular),
    backgroundColor: tokens.colorBrandBackground2,
    color: tokens.colorBrandForeground1,
    fontWeight: tokens.fontWeightSemibold,
    fontSize: '12px',
    ...shorthands.border('1px', 'solid', tokens.colorBrandStroke2),
    cursor: 'pointer',
    transitionProperty: 'all',
    transitionDuration: tokens.durationNormal,
    '&:hover': {
      backgroundColor: tokens.colorBrandBackground2Hover,
      transform: 'translateY(-1px)'
    }
  },

  // --- Upward Vertical Expanded Panel ---
  backdrop: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    backdropFilter: 'blur(3px)',
    zIndex: 89,
    transitionProperty: 'opacity',
    transitionDuration: tokens.durationNormal
  },
  expandedVerticalPanel: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 90,
    backgroundColor: tokens.colorNeutralBackground1,
    ...shorthands.borderTop('1px', 'solid', tokens.colorNeutralStroke1),
    ...shorthands.borderRadius('20px', '20px', '0', '0'),
    boxShadow: tokens.shadow28,
    maxHeight: '85vh',
    overflowY: 'auto',
    ...shorthands.padding('10px', '16px'),
    paddingBottom: 'max(20px, env(safe-area-inset-bottom, 20px))',
    display: 'flex',
    flexDirection: 'column',
    transform: 'translateY(0)',
    transitionProperty: 'transform, opacity',
    transitionDuration: tokens.durationNormal,
    transitionTimingFunction: 'cubic-bezier(0.33, 1, 0.68, 1)'
  },
  expandedHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '10px',
    paddingBottom: '8px',
    ...shorthands.borderBottom('1px', 'solid', tokens.colorNeutralStroke2)
  },
  expandedTitle: {
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
    fontSize: '15px'
  },
  collapseBtn: {
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap('4px'),
    ...shorthands.padding('4px', '10px'),
    ...shorthands.borderRadius(tokens.borderRadiusCircular),
    backgroundColor: tokens.colorNeutralBackground3,
    color: tokens.colorNeutralForeground1,
    fontSize: '12px',
    fontWeight: tokens.fontWeightMedium,
    cursor: 'pointer',
    ...shorthands.border('1px', 'solid', tokens.colorNeutralStroke1),
    '&:hover': {
      backgroundColor: tokens.colorNeutralBackground3Hover
    }
  },
  verticalList: {
    display: 'flex',
    flexDirection: 'column',
    ...shorthands.gap('6px')
  },
  verticalNavItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: '48px',
    ...shorthands.padding('8px', '12px'),
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    cursor: 'pointer',
    userSelect: 'none',
    transitionProperty: 'all',
    transitionDuration: tokens.durationNormal,
    '&:hover': {
      backgroundColor: tokens.colorNeutralBackground1Hover,
      transform: 'translateX(2px)'
    }
  },
  verticalActiveNavItem: {
    backgroundColor: tokens.colorBrandBackground2,
    color: tokens.colorBrandForeground1,
    fontWeight: tokens.fontWeightSemibold,
    ...shorthands.border('1px', 'solid', tokens.colorBrandStroke2)
  },
  verticalInactiveNavItem: {
    color: tokens.colorNeutralForeground1,
    ...shorthands.border('1px', 'solid', 'transparent')
  },
  verticalLeftSection: {
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap('12px')
  },
  verticalIconCircle: {
    width: '36px',
    height: '36px',
    ...shorthands.borderRadius(tokens.borderRadiusCircular),
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '20px',
    flexShrink: 0,
    position: 'relative'
  },
  verticalIconActive: {
    backgroundColor: tokens.colorBrandBackground,
    color: tokens.colorNeutralBackground1
  },
  verticalIconInactive: {
    backgroundColor: tokens.colorNeutralBackground3,
    color: tokens.colorNeutralForeground2
  },
  verticalLabel: {
    fontSize: '14px',
    lineHeight: '20px'
  },
  verticalRightSection: {
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap('8px')
  },
  activePillIndicator: {
    width: '6px',
    height: '6px',
    ...shorthands.borderRadius(tokens.borderRadiusCircular),
    backgroundColor: tokens.colorBrandForeground1
  }
});

export const Navigation: React.FC<NavigationProps> = ({ activeTab, onTabChange, forceCollapsible }) => {
  const styles = useStyles();
  const cartItemCount = useCartStore((s) => s.getTotalCount());
  const tenantId = useAuthStore((state) => state.tenantId);
  const lowStockCount = useLiveQuery(
    () => db.products.where('tenantId').equals(tenantId).filter((product) => product.stockQty <= 5).count(),
    [tenantId]
  ) || 0;
  const { t } = useTranslation();

  const containerRef = useRef<HTMLElement>(null);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [autoCollapsible, setAutoCollapsible] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const isPortrait = window.matchMedia('(orientation: portrait)').matches || window.innerHeight >= window.innerWidth;
    const isNarrow = window.innerWidth < 520;
    return isPortrait && isNarrow;
  });

  const isCollapsible = forceCollapsible !== undefined ? forceCollapsible : autoCollapsible;

  // Evaluate phone vertical view and screen width fit
  useEffect(() => {
    if (forceCollapsible !== undefined) {
      return;
    }

    const checkCollapsibility = () => {
      if (typeof window === 'undefined') return;

      const isPortrait = window.matchMedia('(orientation: portrait)').matches || window.innerHeight >= window.innerWidth;
      let doesNotFit = window.innerWidth < 520;

      if (containerRef.current) {
        const hasOverflow = containerRef.current.scrollWidth > containerRef.current.clientWidth;
        if (hasOverflow) {
          doesNotFit = true;
        }
      }

      setAutoCollapsible(isPortrait && doesNotFit);
    };

    checkCollapsibility();

    window.addEventListener('resize', checkCollapsibility);
    window.addEventListener('orientationchange', checkCollapsibility);

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && containerRef.current) {
      resizeObserver = new ResizeObserver(checkCollapsibility);
      resizeObserver.observe(containerRef.current);
      if (document.body) {
        resizeObserver.observe(document.body);
      }
    }

    return () => {
      window.removeEventListener('resize', checkCollapsibility);
      window.removeEventListener('orientationchange', checkCollapsibility);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, [forceCollapsible]);

  // Close expanded panel on Escape key
  useEffect(() => {
    if (!isExpanded) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsExpanded(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isExpanded]);

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

  const activeTabItem = tabs.find((tab) => tab.id === activeTab) || tabs[0];

  // Collapsible Upward Vertical Mode (Phone Vertical View where items do not fit in width)
  if (isCollapsible) {
    return (
      <>
        {/* Backdrop overlay when expanded */}
        {isExpanded && (
          <div
            className={styles.backdrop}
            onClick={() => setIsExpanded(false)}
            data-testid="nav-backdrop"
            aria-hidden="true"
          />
        )}

        {/* Expanded Upward Vertical Panel */}
        {isExpanded ? (
          <nav
            className={styles.expandedVerticalPanel}
            aria-label="Bottom Navigation Menu"
            data-collapsible="true"
            data-expanded="true"
          >
            <div className={styles.handleBar} aria-hidden="true" />
            <div className={styles.expandedHeader}>
              <Text className={styles.expandedTitle}>{t.nav.menuTitle}</Text>
              <Button
                appearance="subtle"
                size="small"
                className={styles.collapseBtn}
                icon={<ChevronDownRegular />}
                onClick={() => setIsExpanded(false)}
                aria-label={t.nav.collapseMenu}
                aria-expanded={true}
                data-testid="nav-collapse-toggle"
              >
                {t.nav.collapseMenu}
              </Button>
            </div>

            <div className={styles.verticalList} role="menubar" aria-orientation="vertical">
              {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <div
                    key={tab.id}
                    role="button"
                    tabIndex={0}
                    className={mergeClasses(styles.verticalNavItem, isActive ? styles.verticalActiveNavItem : styles.verticalInactiveNavItem)}
                    onClick={() => {
                      onTabChange(tab.id);
                      setIsExpanded(false);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        onTabChange(tab.id);
                        setIsExpanded(false);
                      }
                    }}
                    aria-label={tab.label}
                    data-testid={`nav-tab-${tab.id}`}
                  >
                    <div className={styles.verticalLeftSection}>
                      <div className={mergeClasses(styles.verticalIconCircle, isActive ? styles.verticalIconActive : styles.verticalIconInactive)}>
                        {isActive ? tab.activeIcon : tab.icon}
                      </div>
                      <Text className={styles.verticalLabel}>{tab.label}</Text>
                    </div>

                    <div className={styles.verticalRightSection}>
                      {tab.badge !== undefined && tab.badge > 0 && (
                        <Badge color={tab.badgeColor || 'brand'} shape="circular" size="medium">
                          {tab.badge}
                        </Badge>
                      )}
                      {isActive && <div className={styles.activePillIndicator} aria-hidden="true" />}
                    </div>
                  </div>
                );
              })}
            </div>
          </nav>
        ) : (
          /* Collapsed Bottom Toolbar */
          <nav
            className={styles.collapsibleBar}
            aria-label="Bottom Navigation (Collapsed)"
            data-collapsible="true"
            data-expanded="false"
          >
            <div className={styles.handleBar} aria-hidden="true" />
            <div
              className={styles.collapsedContent}
              onClick={() => setIsExpanded(true)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setIsExpanded(true)}
              aria-label={`${activeTabItem.label} - ${t.nav.expandMenu}`}
              data-testid="nav-collapsed-bar"
            >
              <div className={styles.activeTabSummary}>
                <div className={styles.activeIconCircle}>
                  {activeTabItem.activeIcon}
                  {activeTabItem.badge !== undefined && activeTabItem.badge > 0 && (
                    <div className={styles.activeBadgePos}>
                      <Badge color={activeTabItem.badgeColor || 'brand'} shape="circular" size="small">
                        {activeTabItem.badge}
                      </Badge>
                    </div>
                  )}
                </div>
                <div className={styles.activeTextCol}>
                  <Text className={styles.activeTitle}>{activeTabItem.label}</Text>
                  <Text className={styles.activeSubtitle}>{t.nav.expandMenu}</Text>
                </div>
              </div>

              <div className={styles.expandAction} data-testid="nav-collapse-toggle">
                <Text>{t.nav.menuTitle}</Text>
                <ChevronUpRegular />
                {/* Secondary badge indicator if unread badges exist on other tabs */}
                {activeTabItem.id !== 'pos' && cartItemCount > 0 && (
                  <Badge color="brand" shape="circular" size="small">
                    {cartItemCount}
                  </Badge>
                )}
                {activeTabItem.id !== 'inventory' && lowStockCount > 0 && (
                  <Badge color="warning" shape="circular" size="small">
                    {lowStockCount}
                  </Badge>
                )}
              </div>
            </div>
          </nav>
        )}
      </>
    );
  }

  // --- Standard Horizontal Bottom Navigation (when items fit in width) ---
  return (
    <nav
      ref={containerRef}
      className={styles.navBar}
      aria-label="Bottom Navigation"
      data-collapsible="false"
      data-expanded="false"
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <div
            key={tab.id}
            role="button"
            tabIndex={0}
            className={mergeClasses(styles.navItem, isActive ? styles.activeNavItem : styles.inactiveNavItem)}
            onClick={() => onTabChange(tab.id)}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onTabChange(tab.id)}
            aria-label={tab.label}
            data-testid={`nav-tab-${tab.id}`}
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
