import React, { useState, useEffect, useRef } from 'react';
import {
  makeStyles,
  mergeClasses,
  tokens,
  shorthands,
  Text,
  Badge,
  Button,
  Spinner,
  Tooltip
} from '@fluentui/react-components';
import {
  WeatherSunnyRegular,
  WeatherMoonRegular,
  DesktopRegular,
  CloudCheckmarkRegular,
  CloudDismissRegular,
  ArrowSyncRegular,
  GlobeRegular,
  ArrowDownloadRegular,
  InfoRegular,
  SparkleRegular,
  ShoppingBagRegular,
  KeyRegular,
  ChevronDownRegular,
  ChevronUpRegular
} from '@fluentui/react-icons';
import type { NavTab } from './Navigation';
import { resolveHeaderLogoDestination } from './headerLogoDestination';
import { useThemeStore } from '../state/themeStore';
import { useSyncStore, processSyncQueue } from '../sync/syncEngine';
import { useAuthStore } from '../state/authStore';
import { useTranslation } from '../state/languageStore';
import { usePwaStore } from '../state/pwaStore';
import { useSubscriptionStore } from '../state/subscriptionStore';
import { useDisclaimerStore } from '../state/disclaimerStore';
import { SubscriptionModal } from './SubscriptionModal';
import { HeaderAccountMenu } from './HeaderAccountMenu';
import { SafeLogoutDialog } from './SafeLogoutDialog';
import { useSafeLogout } from './useSafeLogout';

const useStyles = makeStyles({
  header: {
    backgroundColor: tokens.colorNeutralBackground1,
    ...shorthands.borderBottom('1px', 'solid', tokens.colorNeutralStroke1),
    position: 'sticky',
    top: 0,
    zIndex: 100,
    boxShadow: tokens.shadow2,
    width: '100%',
    ...shorthands.padding(0, tokens.spacingHorizontalM),
    '@media (max-width: 480px)': {
      ...shorthands.padding(0, tokens.spacingHorizontalS)
    }
  },
  headerInner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    maxWidth: '1080px',
    width: '100%',
    marginLeft: 'auto',
    marginRight: 'auto',
    ...shorthands.padding(tokens.spacingVerticalS, 0)
  },
  titleGroup: {
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap(tokens.spacingHorizontalS),
    minWidth: 0,
    flexShrink: 1
  },
  logoIcon: {
    width: '32px',
    height: '32px',
    ...shorthands.borderRadius(tokens.borderRadiusCircular),
    backgroundColor: tokens.colorBrandBackground,
    color: tokens.colorNeutralBackground1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 'bold',
    fontSize: tokens.fontSizeBase400,
    flexShrink: 0
  },
  actionsGroup: {
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap(tokens.spacingHorizontalXS),
    flexShrink: 0
  },
  langButton: {
    fontWeight: 600,
    fontSize: tokens.fontSizeBase200
  },
  disclaimerBtn: {
    fontWeight: 600,
    fontSize: tokens.fontSizeBase200
  },
  disclaimerLabel: {
    '@media (max-width: 480px)': {
      display: 'none'
    }
  },
  landingToggleBtn: {
    fontWeight: 600,
    fontSize: tokens.fontSizeBase200
  },
  landingToggleLabel: {
    '@media (max-width: 600px)': {
      display: 'none'
    }
  },

  // --- Collapsible Header Toolbar Elements ---
  toolbarToggleBtn: {
    minWidth: '32px',
    width: '32px',
    height: '32px',
    ...shorthands.padding(0),
    ...shorthands.borderRadius(tokens.borderRadiusCircular),
    backgroundColor: tokens.colorNeutralBackground2,
    color: tokens.colorNeutralForeground1,
    ...shorthands.border('1px', 'solid', tokens.colorNeutralStroke2),
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transitionProperty: 'all',
    transitionDuration: tokens.durationNormal,
    '&:hover': {
      backgroundColor: tokens.colorNeutralBackground2Hover,
      transform: 'scale(1.05)'
    }
  },
  collapsibleTray: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-start',
    flexWrap: 'wrap',
    ...shorthands.gap(tokens.spacingHorizontalS),
    ...shorthands.padding(tokens.spacingVerticalS, 0),
    ...shorthands.borderTop('1px', 'solid', tokens.colorNeutralStroke2),
    backgroundColor: tokens.colorNeutralBackground1,
    transitionProperty: 'all',
    transitionDuration: tokens.durationNormal
  },
  trayActionBtn: {
    fontWeight: 600,
    fontSize: tokens.fontSizeBase200,
    backgroundColor: tokens.colorNeutralBackground2,
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    ...shorthands.border('1px', 'solid', tokens.colorNeutralStroke2),
    '&:hover': {
      backgroundColor: tokens.colorNeutralBackground2Hover
    }
  }
});

export interface HeaderProps {
  onNavigate?: (tab: NavTab) => void;
  activeTab?: NavTab;
  forceCollapsible?: boolean;
}

export const Header: React.FC<HeaderProps> = ({ onNavigate, activeTab, forceCollapsible }) => {
  const styles = useStyles();
  const { themeMode, cycleThemeMode } = useThemeStore();
  const { isOnline, isSyncing, pendingCount, deadLetterCount } = useSyncStore();
  const businessName = useAuthStore((s) => s.businessName);
  const isOnboarded = useAuthStore((s) => s.isOnboarded);
  const { t, language, toggleLanguage } = useTranslation();
  const { isInstallable, isStandalone, isInstalled, promptInstall } = usePwaStore();
  const { tier, openUpgradeModal } = useSubscriptionStore();
  const openDisclaimer = useDisclaimerStore((s) => s.openDisclaimer);
  const safeLogout = useSafeLogout({
    onLoggedOut: () => {
      if (onNavigate) {
        onNavigate('login');
      }
    }
  });

  const headerRef = useRef<HTMLElement>(null);
  const headerInnerRef = useRef<HTMLDivElement>(null);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [autoCollapsible, setAutoCollapsible] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const isPortrait = window.matchMedia('(orientation: portrait)').matches || window.innerHeight >= window.innerWidth;
    const isNarrow = window.innerWidth < 640;
    return isPortrait && isNarrow;
  });

  const isCollapsible = forceCollapsible !== undefined ? forceCollapsible : autoCollapsible;

  // Evaluate phone view and header toolbar width fit
  useEffect(() => {
    if (forceCollapsible !== undefined) return;

    const checkCollapsibility = () => {
      if (typeof window === 'undefined') return;

      const isPortrait = window.matchMedia('(orientation: portrait)').matches || window.innerHeight >= window.innerWidth;
      let doesNotFit = window.innerWidth < 640;

      if (headerInnerRef.current) {
        const hasOverflow = headerInnerRef.current.scrollWidth > headerInnerRef.current.clientWidth;
        if (hasOverflow) {
          doesNotFit = true;
        }
      }

      setAutoCollapsible((isPortrait && window.innerWidth < 640) || doesNotFit);
    };

    checkCollapsibility();

    window.addEventListener('resize', checkCollapsibility);
    window.addEventListener('orientationchange', checkCollapsibility);

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && headerInnerRef.current) {
      resizeObserver = new ResizeObserver(checkCollapsibility);
      resizeObserver.observe(headerInnerRef.current);
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

  // Dismiss expanded tray on Escape key or clicking outside
  useEffect(() => {
    if (!isExpanded) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsExpanded(false);
      }
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) {
        setIsExpanded(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isExpanded]);

  const handleManualSync = () => {
    if (isOnline) {
      void processSyncQueue({ force: true }).catch(console.error);
    }
  };

  const isLoggedOut = !isOnboarded || activeTab === 'login';
  const showStoreInfo = !isLoggedOut && Boolean(businessName);
  const showSyncIndicators = !isLoggedOut;
  const logoDestination = resolveHeaderLogoDestination(activeTab, isOnboarded);
  let logoTitle = t.landing.exploreTitle;
  if (logoDestination === 'dashboard') {
    logoTitle = t.nav.dashboard;
  } else if (logoDestination === 'login') {
    logoTitle = t.landing.tabLogin;
  }

  const handleLogoClick = () => {
    if (onNavigate) {
      onNavigate(logoDestination);
    }
  };

  // Reusable action components
  const handleToggleLanding = () => {
    if (!onNavigate) return;
    if (activeTab === 'landing') {
      onNavigate(isOnboarded ? 'pos' : 'login');
    } else {
      onNavigate('landing');
    }
  };

  const renderSyncBadge = () => {
    if (!showSyncIndicators) return null;
    return isOnline ? (
      <Tooltip
        content={
          isSyncing
            ? t.common.syncing
            : pendingCount > 0
            ? `${pendingCount} ${t.common.queued}`
            : t.common.allSynced
        }
        relationship="label"
      >
        <Button
          appearance="subtle"
          size="small"
          onClick={handleManualSync}
          aria-label={isSyncing ? t.common.syncing : pendingCount > 0 ? `${pendingCount} ${t.common.queued}` : t.common.online}
          icon={
            isSyncing ? (
              <Spinner size="extra-tiny" />
            ) : (
              <CloudCheckmarkRegular primaryFill={tokens.colorPaletteGreenForeground1} />
            )
          }
        >
          <Badge
            appearance="filled"
            color={pendingCount > 0 ? 'warning' : 'success'}
            size="small"
          >
            {isSyncing ? t.common.syncing : pendingCount > 0 ? `${pendingCount} ${t.common.queued}` : t.common.online}
          </Badge>
        </Button>
      </Tooltip>
    ) : (
      <Tooltip content={t.banner.offlineDesc} relationship="label">
        <Badge appearance="filled" color="danger" icon={<CloudDismissRegular />} size="small">
          {t.common.offline} ({pendingCount})
        </Badge>
      </Tooltip>
    );
  };

  const renderForceSyncButton = (inTray = false) => {
    if (!showSyncIndicators || !isOnline || isSyncing) return null;
    return (
      <Tooltip content={t.common.forceSync} relationship="label">
        <Button
          appearance="subtle"
          size="small"
          className={inTray ? styles.trayActionBtn : undefined}
          icon={<ArrowSyncRegular />}
          onClick={handleManualSync}
          aria-label={t.common.forceSync}
        >
          {inTray && <span>{t.common.forceSync}</span>}
        </Button>
      </Tooltip>
    );
  };

  const renderSyncAction = () => {
    if (!showSyncIndicators) return null;
    return (
      <>
        {renderSyncBadge()}

        {deadLetterCount > 0 && (
          <Tooltip content={`${deadLetterCount} ${t.common.dlqWarning}`} relationship="label">
            <Badge appearance="filled" color="danger" size="small">
              DLQ: {deadLetterCount}
            </Badge>
          </Tooltip>
        )}

        {renderForceSyncButton(false)}
      </>
    );
  };

  const renderLanguageAction = (inTray = false) => (
    <Tooltip content={t.common.languageToggle} relationship="label">
      <Button
        appearance="subtle"
        size="small"
        className={mergeClasses(styles.langButton, inTray && styles.trayActionBtn)}
        icon={<GlobeRegular />}
        onClick={toggleLanguage}
        aria-label={t.common.languageToggle}
        title={t.common.languageToggle}
        data-testid="language-toggle-btn"
        id="tl-en-toggle"
      >
        <span>{language === 'tl' ? '🇵🇭 TL' : '🇺🇸 EN'}</span>
        <span style={{ position: 'absolute', width: '1px', height: '1px', padding: 0, margin: '-1px', overflow: 'hidden', clip: 'rect(0, 0, 0, 0)', whiteSpace: 'nowrap', border: 0 }}>
          TL/EN toggle
        </span>
      </Button>
    </Tooltip>
  );

  const renderPwaInstallAction = (inTray = false) => {
    if (!isInstallable || isStandalone || isInstalled) return null;
    return (
      <Tooltip content={t.pwa.installHeaderTooltip} relationship="label">
        <Button
          appearance="subtle"
          size="small"
          className={inTray ? styles.trayActionBtn : undefined}
          icon={<ArrowDownloadRegular primaryFill={tokens.colorPaletteGreenForeground1} />}
          onClick={() => promptInstall()}
          aria-label={t.pwa.installHeaderTooltip || t.pwa.installBtn || 'Install App'}
        >
          {inTray && <span>{t.pwa.installBtn}</span>}
        </Button>
      </Tooltip>
    );
  };

  const renderDisclaimerAction = (inTray = false) => (
    <Tooltip content={t.disclaimer.buttonLabel} relationship="label">
      <Button
        appearance="subtle"
        size="small"
        className={mergeClasses(styles.disclaimerBtn, inTray && styles.trayActionBtn)}
        icon={<InfoRegular />}
        onClick={openDisclaimer}
        aria-label={t.disclaimer.buttonLabel}
        data-testid="header-disclaimer-btn"
      >
        <span className={inTray ? undefined : styles.disclaimerLabel}>{t.disclaimer.buttonLabel}</span>
      </Button>
    </Tooltip>
  );

  const renderLandingToggleAction = (inTray = false) => {
    if (!onNavigate) return null;
    const isLanding = activeTab === 'landing';
    const returnLabel = isOnboarded ? t.landing.openPosBtn : t.landing.tabLogin;
    return (
      <Tooltip
        content={isLanding ? returnLabel : t.landing.exploreTooltip}
        relationship="label"
      >
        <Button
          appearance="subtle"
          size="small"
          className={mergeClasses(styles.landingToggleBtn, inTray && styles.trayActionBtn)}
          icon={
            isLanding
              ? (isOnboarded ? <ShoppingBagRegular /> : <KeyRegular />)
              : <SparkleRegular />
          }
          onClick={handleToggleLanding}
          data-testid="header-landing-toggle-btn"
          aria-label={isLanding ? returnLabel : t.landing.exploreTitle}
        >
          <span className={inTray ? undefined : styles.landingToggleLabel}>
            {isLanding ? returnLabel : t.landing.exploreNavBtn}
          </span>
        </Button>
      </Tooltip>
    );
  };

  const getThemeModeLabel = () => {
    if (themeMode === 'light') return t.common.themeModeLight;
    if (themeMode === 'dark') return t.common.themeModeDark;
    return t.common.themeModeSystem;
  };

  const renderThemeAction = (inTray = false) => (
    <Tooltip
      content={
        themeMode === 'light'
          ? t.common.themeToggleDark
          : themeMode === 'dark'
          ? t.common.themeToggleSystem
          : t.common.themeToggleLight
      }
      relationship="label"
    >
      <Button
        appearance="subtle"
        size="small"
        className={inTray ? styles.trayActionBtn : undefined}
        icon={
          themeMode === 'light' ? (
            <WeatherSunnyRegular />
          ) : themeMode === 'dark' ? (
            <WeatherMoonRegular />
          ) : (
            <DesktopRegular />
          )
        }
        aria-label={getThemeModeLabel()}
        onClick={cycleThemeMode}
      >
        {inTray && <span>{getThemeModeLabel()}</span>}
      </Button>
    </Tooltip>
  );

  return (
    <header className={styles.header} ref={headerRef} data-collapsible={isCollapsible}>
      <div className={styles.headerInner} ref={headerInnerRef}>
        <div
          className={styles.titleGroup}
          onClick={handleLogoClick}
          style={{ cursor: onNavigate ? 'pointer' : 'default' }}
          title={logoTitle}
          data-testid="header-logo"
        >
          <div className={styles.logoIcon}>FT</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Text weight="bold" size={400}>{t.common.appTitle}</Text>
              {!isLoggedOut && (
                <Button
                  appearance="subtle"
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    openUpgradeModal();
                  }}
                  style={{ padding: '0px 4px', height: '22px', minWidth: 'auto' }}
                  title="View Subscription Plans"
                  aria-label={tier === 'NegosyoPlus' ? 'Negosyo Plus Plan' : tier === 'TindahanPro' ? 'Tindahan Pro Plan' : 'Libre Plan'}
                >
                  <Badge
                    color={tier === 'NegosyoPlus' ? 'important' : tier === 'TindahanPro' ? 'warning' : 'informative'}
                    appearance="filled"
                    size="small"
                  >
                    {tier === 'NegosyoPlus' ? 'NEGOSYO+' : tier === 'TindahanPro' ? 'PRO' : 'LIBRE'}
                  </Badge>
                </Button>
              )}
            </div>
            {!isLoggedOut && (
              <HeaderAccountMenu
                businessName={showStoreInfo ? businessName ?? '' : ''}
                onLogout={() => {
                  void safeLogout.initiateLogout();
                }}
              />
            )}
          </div>
        </div>

        {/* Collapsible Mode Header Toolbar vs Standard Header Toolbar */}
        {isCollapsible ? (
          <div className={styles.actionsGroup}>
            {/* Primary Connectivity Status Badge */}
            {renderSyncBadge()}

            {/* Collapsible Toolbar Toggle Button */}
            <Tooltip
              content={isExpanded ? (t.nav.collapseMenu || 'Collapse tools') : (t.nav.expandMenu || 'More tools')}
              relationship="label"
            >
              <Button
                appearance="subtle"
                size="small"
                className={styles.toolbarToggleBtn}
                icon={isExpanded ? <ChevronUpRegular /> : <ChevronDownRegular />}
                onClick={() => setIsExpanded(!isExpanded)}
                aria-expanded={isExpanded}
                aria-label={isExpanded ? (t.nav.collapseMenu || 'Collapse tools') : (t.nav.expandMenu || 'Expand tools')}
                data-testid="header-toolbar-toggle"
              />
            </Tooltip>
          </div>
        ) : (
          /* Standard Horizontal Toolbar on Wide Screens */
          <div className={styles.actionsGroup}>
            {renderSyncAction()}
            {renderLanguageAction(false)}
            {renderPwaInstallAction(false)}
            {renderDisclaimerAction(false)}
            {renderLandingToggleAction(false)}
            {renderThemeAction(false)}
          </div>
        )}
      </div>

      {/* Expanded Collapsible Toolbar Tray */}
      {isCollapsible && isExpanded && (
        <div className={styles.collapsibleTray} data-testid="header-collapsible-tray">
          {renderForceSyncButton(true)}
          {renderLanguageAction(true)}
          {renderThemeAction(true)}
          {renderDisclaimerAction(true)}
          {renderLandingToggleAction(true)}
          {renderPwaInstallAction(true)}
        </div>
      )}

      <SubscriptionModal />
      <SafeLogoutDialog
        open={safeLogout.isLogoutConfirmOpen}
        unsyncedCount={safeLogout.logoutUnsyncedCount}
        onDismiss={safeLogout.cancelLogout}
        onSyncFirst={safeLogout.syncFirst}
        onConfirmLogout={safeLogout.confirmLogout}
      />
    </header>
  );
};
