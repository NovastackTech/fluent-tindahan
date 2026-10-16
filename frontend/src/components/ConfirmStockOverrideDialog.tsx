import React from 'react';
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
  Badge,
  MessageBar,
  MessageBarBody,
  MessageBarTitle
} from '@fluentui/react-components';
import {
  WarningRegular,
  DismissRegular,
  CheckmarkCircleRegular
} from '@fluentui/react-icons';
import { useTranslation } from '../state/languageStore';

export interface InsufficientStockItem {
  name: string;
  qty: number;
  available: number;
}

interface ConfirmStockOverrideDialogProps {
  isOpen: boolean;
  items: InsufficientStockItem[];
  onClose: () => void;
  onConfirm: () => void;
}

const useStyles = makeStyles({
  surface: {
    maxWidth: '500px',
    width: '92%',
    ...shorthands.padding(tokens.spacingVerticalM),
    backgroundColor: tokens.colorNeutralBackground1,
    ...shorthands.borderRadius(tokens.borderRadiusLarge)
  },
  itemsList: {
    ...shorthands.padding(tokens.spacingVerticalS, tokens.spacingHorizontalM),
    backgroundColor: tokens.colorNeutralBackground2,
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    ...shorthands.border('1px', 'solid', tokens.colorNeutralStroke2),
    marginTop: tokens.spacingVerticalS,
    marginBottom: tokens.spacingVerticalM,
    maxHeight: '180px',
    overflowY: 'auto'
  },
  itemRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: tokens.spacingVerticalXXS,
    paddingBottom: tokens.spacingVerticalXXS,
    borderBottom: `1px solid ${tokens.colorNeutralStroke3}`
  }
});

export const ConfirmStockOverrideDialog: React.FC<ConfirmStockOverrideDialogProps> = ({
  isOpen,
  items,
  onClose,
  onConfirm
}) => {
  const styles = useStyles();
  const { t, language } = useTranslation();

  if (!isOpen) return null;

  return (
    <Dialog
      modalType="alert"
      open={isOpen}
      onOpenChange={(_, data) => {
        if (!data.open && data.type === 'escapeKeyDown') onClose();
      }}
    >
      <DialogSurface className={styles.surface}>
        <DialogBody>
          <DialogTitle
            action={
              <Button
                appearance="subtle"
                icon={<DismissRegular />}
                onClick={onClose}
                aria-label={t.common.cancel}
              />
            }
          >
            {t.pos.stockOverrideDialogTitle}
          </DialogTitle>

          <DialogContent>
            <MessageBar intent="warning" style={{ marginBottom: '12px' }}>
              <MessageBarBody>
                <MessageBarTitle>
                  <WarningRegular style={{ marginRight: '6px', verticalAlign: 'text-bottom' }} />
                  {language === 'tl' ? 'Babala sa Stock' : 'Stock Level Notice'}
                </MessageBarTitle>
                <Text size={200} style={{ display: 'block', marginTop: '4px' }}>
                  {t.pos.stockOverrideDialogDesc}
                </Text>
              </MessageBarBody>
            </MessageBar>

            <Text weight="semibold" size={200}>
              {language === 'tl' ? 'Mga Panindang Kulang sa System:' : 'Items with Insufficient System Stock:'}
            </Text>

            <div className={styles.itemsList}>
              {items.map((item, index) => (
                <div key={index} className={styles.itemRow}>
                  <div>
                    <Text weight="semibold" size={200} style={{ display: 'block' }}>{item.name}</Text>
                    <Text size={100} style={{ color: tokens.colorNeutralForeground3 }}>
                      {language === 'tl' ? 'Available sa system' : 'System available'}: {item.available}
                    </Text>
                  </div>
                  <Badge color="danger">
                    {language === 'tl' ? 'Nasa cart' : 'In cart'}: {item.qty}
                  </Badge>
                </div>
              ))}
            </div>
          </DialogContent>

          <DialogActions>
            <Button appearance="secondary" onClick={onClose} data-testid="cancel-stock-override-btn">
              {t.common.cancel}
            </Button>
            <Button
              appearance="primary"
              icon={<CheckmarkCircleRegular />}
              onClick={() => {
                onConfirm();
                onClose();
              }}
              data-testid="confirm-stock-override-btn"
            >
              {t.pos.stockOverrideConfirmBtn}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
};
