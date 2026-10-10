import React from 'react';
import {
  makeStyles,
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
  ArrowDownloadRegular
} from '@fluentui/react-icons';
import { useThemeStore } from '../state/themeStore';
import { useSyncStore, processSyncQueue } from '../sync/syncEngine';
import { useAuthStore } from '../state/authStore';
import { useTranslation } from '../state/languageStore';
import { usePwaStore } from '../state/pwaStore';

const useStyles = makeStyles({
  header: {
    backgroundColor: tokens.colorNeutralBackground1,
    ...shorthands.borderBottom('1px', 'solid', tokens.colorNeutralStroke1),
    position: 'sticky',
    top: 0,
    zIndex: 100,
    boxShadow: tokens.shadow2,
    width: '100%',
    ...shorthands.padding(0, tokens.spacingHorizontalM)
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
    ...shorthands.gap(tokens.spacingHorizontalS)
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
    fontSize: tokens.fontSizeBase400
  },
  actionsGroup: {
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap(tokens.spacingHorizontalXS)
  },
  storeName: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
    display: 'block'
  },
  langButton: {
    fontWeight: 600,
    fontSize: tokens.fontSizeBase200
  }
});

export const Header: React.FC = () => {
  const styles = useStyles();
  const { themeMode, cycleThemeMode } = useThemeStore();
  const { isOnline, isSyncing, pendingCount, deadLetterCount } = useSyncStore();
  const businessName = useAuthStore((s) => s.businessName);
  const { t, language, toggleLanguage } = useTranslation();
  const { isInstallable, isStandalone, promptInstall } = usePwaStore();

  const handleManualSync = () => {
    if (isOnline) {
      processSyncQueue();
    }
  };

  return (
    <header className={styles.header}>
      <div className={styles.headerInner}>
        <div className={styles.titleGroup}>
          <div className={styles.logoIcon}>FT</div>
          <div>
            <Text weight="bold" size={400}>{t.common.appTitle}</Text>
            <span className={styles.storeName}>{businessName || t.common.storeSub}</span>
          </div>
        </div>

        <div className={styles.actionsGroup}>
          {/* Connectivity & Sync Status Badge */}
          {isOnline ? (
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
          )}

          {deadLetterCount > 0 && (
            <Tooltip content={`${deadLetterCount} ${t.common.dlqWarning}`} relationship="label">
              <Badge appearance="filled" color="danger" size="small">
                DLQ: {deadLetterCount}
              </Badge>
            </Tooltip>
          )}

          {/* Sync Trigger button */}
          {isOnline && !isSyncing && (
            <Tooltip content={t.common.forceSync} relationship="label">
              <Button
                appearance="subtle"
                size="small"
                icon={<ArrowSyncRegular />}
                onClick={handleManualSync}
              />
            </Tooltip>
          )}

          {/* Language switcher button */}
          <Tooltip content={t.common.languageToggle} relationship="label">
            <Button
              appearance="subtle"
              size="small"
              className={styles.langButton}
              icon={<GlobeRegular />}
              onClick={toggleLanguage}
            >
              {language === 'tl' ? '🇵🇭 TL' : '🇺🇸 EN'}
            </Button>
          </Tooltip>

          {/* PWA Install shortcut button */}
          {isInstallable && !isStandalone && (
            <Tooltip content={t.pwa.installHeaderTooltip} relationship="label">
              <Button
                appearance="subtle"
                size="small"
                icon={<ArrowDownloadRegular primaryFill={tokens.colorPaletteGreenForeground1} />}
                onClick={() => promptInstall()}
              />
            </Tooltip>
          )}

          {/* Theme mode cycle: Light -> Dark -> System -> Light */}
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
              icon={
                themeMode === 'light' ? (
                  <WeatherSunnyRegular />
                ) : themeMode === 'dark' ? (
                  <WeatherMoonRegular />
                ) : (
                  <DesktopRegular />
                )
              }
              aria-label={
                themeMode === 'light'
                  ? t.common.themeModeLight
                  : themeMode === 'dark'
                  ? t.common.themeModeDark
                  : t.common.themeModeSystem
              }
              onClick={cycleThemeMode}
            />
          </Tooltip>
        </div>
      </div>
    </header>
  );
};
