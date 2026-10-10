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
import { ArrowSyncRegular, ArrowClockwiseRegular } from '@fluentui/react-icons';
import { useSyncStore, processSyncQueue, retryDeadLetterItem } from '../sync/syncEngine';
import { db } from '../db/db';
import { useTranslation } from '../state/languageStore';

const useStyles = makeStyles({
  container: {
    maxWidth: '1080px',
    width: '100%',
    marginLeft: 'auto',
    marginRight: 'auto',
    ...shorthands.padding(tokens.spacingVerticalXS, tokens.spacingHorizontalM),
    display: 'flex',
    flexDirection: 'column',
    ...shorthands.gap(tokens.spacingVerticalXS)
  }
});

export const OfflineSyncBanner: React.FC = () => {
  const styles = useStyles();
  const { isOnline, isSyncing, pendingCount, deadLetterCount, lastErrorMessage } = useSyncStore();
  const { t } = useTranslation();

  if (isOnline && pendingCount === 0 && deadLetterCount === 0 && !lastErrorMessage) {
    return null;
  }

  const handleRetryAllDeadLetter = async () => {
    try {
      const items = await db.deadLetterQueue.toArray();
      for (const item of items) {
        await retryDeadLetterItem(item.id);
      }
    } catch (err) {
      console.error('Failed to retry dead letter items:', err);
    }
  };

  return (
    <div className={styles.container}>
      {!isOnline && (
        <MessageBar intent="warning">
          <MessageBarTitle>{t.banner.offlineTitle}</MessageBarTitle>
          <MessageBarBody>
            {t.banner.offlineDesc}
          </MessageBarBody>
        </MessageBar>
      )}

      {isOnline && pendingCount > 0 && (
        <MessageBar intent="info">
          <MessageBarTitle>{pendingCount} {t.common.queued}</MessageBarTitle>
          <MessageBarBody>
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
        <MessageBar intent="error">
          <MessageBarTitle>Dead Letter Queue ({deadLetterCount})</MessageBarTitle>
          <MessageBarBody>
            {lastErrorMessage || t.common.dlqWarning}
          </MessageBarBody>
          <MessageBarActions
            containerAction={
              <Button
                size="small"
                appearance="subtle"
                icon={<ArrowClockwiseRegular />}
                onClick={handleRetryAllDeadLetter}
              >
                {t.settings.retryBtn || 'Subukang Muli'}
              </Button>
            }
          />
        </MessageBar>
      )}

      {deadLetterCount === 0 && lastErrorMessage && (
        <MessageBar intent="error">
          <MessageBarTitle>Sync Error</MessageBarTitle>
          <MessageBarBody>
            {lastErrorMessage}
          </MessageBarBody>
        </MessageBar>
      )}
    </div>
  );
};
