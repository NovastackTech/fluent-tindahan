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
    maxWidth: '46vw'
  },
  trigger: {
    minWidth: 'auto',
    maxWidth: '46vw',
    height: 'auto',
    minHeight: '32px',
    ...shorthands.padding('0px', '2px', '0px', '0px'),
    justifyContent: 'flex-start',
    color: tokens.colorNeutralForeground3,
    fontWeight: tokens.fontWeightRegular,
    fontSize: tokens.fontSizeBase200,
    columnGap: '2px'
  },
  storeName: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: '34vw',
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3
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
    <div className={styles.root} onClick={(event) => event.stopPropagation()}>
      <Menu positioning={{ position: 'below', align: 'start' }}>
        <MenuTrigger disableButtonEnhancement>
          <Button
            appearance="subtle"
            size="small"
            className={styles.trigger}
            data-testid="header-account-menu"
            aria-label={storeLabel || t.settings.logoutBtn}
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
              onClick={() => {
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
