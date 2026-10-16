import React from 'react';
import {
  makeStyles,
  tokens,
  shorthands,
  MessageBar,
  MessageBarTitle,
  MessageBarBody,
  MessageBarActions,
  Button
} from '@fluentui/react-components';
import { ArrowSyncRegular, ArrowClockwiseRegular, DismissRegular } from '@fluentui/react-icons';
import { useSyncStore, processSyncQueue, retryDeadLetterItem } from '../sync/syncEngine';
import { db } from '../db/db';
import { useTranslation } from '../state/languageStore';
import { hasPendingProfileUpdate } from '../services/profileSync';
import { getLocalizedSyncErrorMessage } from '../utils/syncErrors';

const useStyles = makeStyles({
  container: {
    maxWidth: '1080px',
    width: '100%',
    marginLeft: 'auto',
    marginRight: 'auto',
    boxSizing: 'border-box',
    ...shorthands.padding(tokens.spacingVerticalXS, tokens.spacingHorizontalM),
    display: 'flex',
    flexDirection: 'column',
    ...shorthands.gap(tokens.spacingVerticalXS)
  }
});

export const OfflineSyncBanner: React.FC = () => {
  const styles = useStyles();
  const { isOnline, isSyncing, pendingCount, deadLetterCount, lastErrorMessage } = useSyncStore();
  const { t, language } = useTranslation();
  const displayedErrorMessage = getLocalizedSyncErrorMessage(lastErrorMessage, language) || lastErrorMessage;

  const [isRetrying, setIsRetrying] = React.useState(false);
  const pendingProfile = hasPendingProfileUpdate();

  if (isOnline && pendingCount === 0 && deadLetterCount === 0 && !lastErrorMessage && !pendingProfile) {
    return null;
  }

  const handleRetryAllDeadLetter = async () => {
    if (isRetrying) return;
    setIsRetrying(true);
    try {
      const items = await db.deadLetterQueue.toArray();
      let hasItemNeedingEdit = false;
      for (const item of items) {
        try {
          const res = await retryDeadLetterItem(item.id);
          if (res && !res.success && res.requiresEdit) {
            hasItemNeedingEdit = true;
          }
        } catch (itemErr) {
          console.error(`Failed to retry dead letter item ${item.id}:`, itemErr);
        }
      }
      if (hasItemNeedingEdit) {
        useSyncStore.getState().setLastErrorMessage(
          language === 'tl'
            ? 'May mga produkto sa Dead Letter Queue na kailangang ayusin sa Settings bago ma-sync.'
            : 'Some products in the Dead Letter Queue require editing in Settings before syncing.'
        );
      }
    } catch (err) {
      console.error('Failed to load dead letter items for retry:', err);
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <div className={styles.container}>
      {!isOnline && (
        <MessageBar intent="warning" layout="multiline">
          <MessageBarBody>
            <MessageBarTitle>{t.banner.offlineTitle}</MessageBarTitle>
            {t.banner.offlineDesc}
          </MessageBarBody>
        </MessageBar>
      )}

      {pendingProfile && (
        <MessageBar intent="info" layout="multiline">
          <MessageBarBody>
            <MessageBarTitle>{t.onboarding.pendingProfileSync}</MessageBarTitle>
            {t.onboarding.savedLocallyNotice}
          </MessageBarBody>
          {isOnline && (
            <MessageBarActions
              containerAction={
                <Button
                  size="small"
                  appearance="subtle"
                  icon={<ArrowSyncRegular />}
                  disabled={isSyncing}
                  onClick={() => processSyncQueue()}
                >
                  {isSyncing ? t.common.syncing : t.common.forceSync}
                </Button>
              }
            />
          )}
        </MessageBar>
      )}

      {isOnline && pendingCount > 0 && !pendingProfile && (
        <MessageBar intent="info" layout="multiline">
          <MessageBarBody>
            <MessageBarTitle>{pendingCount} {t.common.queued}</MessageBarTitle>
            {t.common.syncing}
          </MessageBarBody>
          <MessageBarActions
            containerAction={
              <Button
                size="small"
                appearance="subtle"
                icon={<ArrowSyncRegular />}
                disabled={isSyncing}
                onClick={() => processSyncQueue()}
              >
                {isSyncing ? t.common.syncing : t.common.forceSync}
              </Button>
            }
          />
        </MessageBar>
      )}

      {deadLetterCount > 0 && (
        <MessageBar intent="error" layout="multiline">
          <MessageBarBody>
            <MessageBarTitle>Dead Letter Queue ({deadLetterCount})</MessageBarTitle>
            {displayedErrorMessage || t.common.dlqWarning}
          </MessageBarBody>
          <MessageBarActions
            containerAction={
              <Button
                size="small"
                appearance="subtle"
                icon={<ArrowClockwiseRegular />}
                disabled={isRetrying}
                onClick={handleRetryAllDeadLetter}
              >
                {isRetrying ? (t.common.syncing || 'Sumusubok...') : (t.settings.retryBtn || 'Subukang Muli')}
              </Button>
            }
          />
        </MessageBar>
      )}

      {deadLetterCount === 0 && lastErrorMessage && (
        <MessageBar intent="error" layout="multiline">
          <MessageBarBody>
            <MessageBarTitle>{language === 'tl' ? 'Problema sa Pag-sync' : 'Sync Error'}</MessageBarTitle>
            {displayedErrorMessage}
          </MessageBarBody>
          <MessageBarActions
            containerAction={
              <Button
                size="small"
                appearance="subtle"
                aria-label={t.common.close || 'Isara'}
                icon={<DismissRegular />}
                onClick={() => useSyncStore.getState().setLastErrorMessage(null)}
              />
            }
          />
        </MessageBar>
      )}
    </div>
  );
};
