import React from 'react';
import {
  Button,
  Menu,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
  makeStyles,
  shorthands,
  tokens
} from '@fluentui/react-components';
import { ChevronDownRegular, PersonRegular, SignOutRegular } from '@fluentui/react-icons';
import { useTranslation } from '../state/languageStore';

const useStyles = makeStyles({
  root: {
    display: 'flex',
    alignItems: 'center',
    minWidth: 0,
    maxWidth: '180px',
    '@media (max-width: 400px)': {
      maxWidth: '140px'
    }
  },
  trigger: {
    minWidth: 0,
    maxWidth: '180px',
    height: 'auto',
    minHeight: '32px',
    ...shorthands.padding('0px', '2px', '0px', '0px'),
    justifyContent: 'flex-start',
    color: tokens.colorNeutralForeground3,
    fontWeight: tokens.fontWeightRegular,
    fontSize: tokens.fontSizeBase200,
    columnGap: '2px',
    '@media (max-width: 400px)': {
      maxWidth: '140px'
    }
  },
  storeName: {
    display: 'block',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: '180px',
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
    '@media (max-width: 400px)': {
      maxWidth: '120px'
    }
  },
  logoutItem: {
    color: tokens.colorPaletteRedForeground1
  }
});

export interface HeaderAccountMenuProps {
  businessName?: string;
  onLogout: () => void;
}

export const HeaderAccountMenu: React.FC<HeaderAccountMenuProps> = ({ businessName, onLogout }) => {
  const styles = useStyles();
  const { t } = useTranslation();
  const storeLabel = businessName?.trim() ?? '';

  return (
    <div className={styles.root}>
      <Menu positioning={{ position: 'below', align: 'start' }}>
        <MenuTrigger disableButtonEnhancement>
          <Button
            appearance="subtle"
            size="small"
            className={styles.trigger}
            data-testid="header-account-menu"
            aria-label={storeLabel || t.settings.logoutBtn}
            onClick={(event) => {
              event.stopPropagation();
            }}
          >
            {storeLabel ? <span className={styles.storeName}>{storeLabel}</span> : <PersonRegular />}
            <ChevronDownRegular />
          </Button>
        </MenuTrigger>
        <MenuPopover>
          <MenuList>
            <MenuItem
              icon={<SignOutRegular />}
              className={styles.logoutItem}
              data-testid="header-logout-item"
              onClick={(event) => {
                event.stopPropagation();
                onLogout();
              }}
            >
              {t.settings.logoutBtn}
            </MenuItem>
          </MenuList>
        </MenuPopover>
      </Menu>
    </div>
  );
};
