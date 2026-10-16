import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FluentProvider } from '@fluentui/react-components';
import { ConfirmUnsyncedLoginDialog } from './ConfirmUnsyncedLoginDialog';
import { sariSariLightTheme } from '../theme/theme';

describe('ConfirmUnsyncedLoginDialog', () => {
  const renderDialog = (props: Partial<React.ComponentProps<typeof ConfirmUnsyncedLoginDialog>> = {}) => {
    const defaultProps = {
      isOpen: true,
      unsyncedCount: 3,
      onClose: vi.fn(),
      onConfirmWipeAndLogin: vi.fn(),
      onSyncFirst: vi.fn(),
      isSyncing: false,
      ...props
    };

    return {
      ...defaultProps,
      ...render(
        <FluentProvider theme={sariSariLightTheme}>
          <ConfirmUnsyncedLoginDialog {...defaultProps} />
        </FluentProvider>
      )
    };
  };

  it('renders nothing when isOpen is false', () => {
    renderDialog({ isOpen: false });
    expect(screen.queryByText(/May Hindi Pa Nai-sync na Datos|Unsynced Data Detected/i)).not.toBeInTheDocument();
  });

  it('renders title and unsynced count when open', () => {
    renderDialog({ unsyncedCount: 5 });
    expect(screen.getByText(/May Hindi Pa Nai-sync na Datos|Unsynced Data Detected/i)).toBeInTheDocument();
    expect(screen.getByText(/5 transaksyon|5 unsynced/i)).toBeInTheDocument();
  });

  it('calls onClose when clicking cancel', () => {
    const { onClose } = renderDialog();
    const cancelBtn = screen.getByRole('button', { name: /Kanselahin|Cancel/i });
    fireEvent.click(cancelBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onConfirmWipeAndLogin when clicking force login button', () => {
    const { onConfirmWipeAndLogin } = renderDialog();
    const wipeBtn = screen.getByRole('button', { name: /I-wipe at Mag-login Pa Rin|Wipe & Log In Anyway/i });
    fireEvent.click(wipeBtn);
    expect(onConfirmWipeAndLogin).toHaveBeenCalledTimes(1);
  });

  it('calls onSyncFirst when clicking sync first button', () => {
    const { onSyncFirst } = renderDialog();
    const syncBtn = screen.getByRole('button', { name: /I-sync Muna|Sync First/i });
    fireEvent.click(syncBtn);
    expect(onSyncFirst).toHaveBeenCalledTimes(1);
  });
});
