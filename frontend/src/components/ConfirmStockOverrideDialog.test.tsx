import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FluentProvider } from '@fluentui/react-components';
import { ConfirmStockOverrideDialog } from './ConfirmStockOverrideDialog';
import { sariSariLightTheme } from '../theme/theme';
import { useLanguageStore } from '../state/languageStore';

describe('ConfirmStockOverrideDialog', () => {
  beforeEach(() => {
    useLanguageStore.setState({ language: 'tl' });
  });

  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <FluentProvider theme={sariSariLightTheme}>
        <ConfirmStockOverrideDialog
          isOpen={false}
          items={[{ name: 'Sardinas', qty: 5, available: 2 }]}
          onClose={() => {}}
          onConfirm={() => {}}
        />
      </FluentProvider>
    );
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('renders items with insufficient stock and calls onConfirm when confirmed', () => {
    const onConfirmMock = vi.fn();
    const onCloseMock = vi.fn();

    render(
      <FluentProvider theme={sariSariLightTheme}>
        <ConfirmStockOverrideDialog
          isOpen={true}
          items={[{ name: 'Sardinas', qty: 5, available: 2 }]}
          onClose={onCloseMock}
          onConfirm={onConfirmMock}
        />
      </FluentProvider>
    );

    expect(screen.getByText('Kumpirmahin ang Pag-override sa Stock')).toBeInTheDocument();
    expect(screen.getByText('Sardinas')).toBeInTheDocument();
    expect(screen.getByText(/Available sa system: 2/i)).toBeInTheDocument();

    const confirmBtn = screen.getByRole('button', { name: /I-override at Ituloy ang Benta/i });
    fireEvent.click(confirmBtn);

    expect(onConfirmMock).toHaveBeenCalledTimes(1);
    expect(onCloseMock).toHaveBeenCalledTimes(1);
  });
});
