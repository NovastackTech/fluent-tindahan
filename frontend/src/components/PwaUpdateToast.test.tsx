import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { FluentProvider } from '@fluentui/react-components';
import { sariSariLightTheme } from '../theme/theme';
import { PwaUpdateToast } from './PwaUpdateToast';
import { usePwaStore } from '../state/pwaStore';
import { useCartStore } from '../state/cartStore';
import * as pwaRegister from '../pwa/registerServiceWorker';

describe('PwaUpdateToast', () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    usePwaStore.setState({
      needRefresh: false,
      otherTabsHaveCart: false,
      isSaleInProgress: false,
      hasActiveReceipt: false
    });
    useCartStore.getState().clearCart();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const renderToast = () => {
    return render(
      <FluentProvider theme={sariSariLightTheme}>
        <PwaUpdateToast />
      </FluentProvider>
    );
  };

  it('renders nothing when needRefresh is false', () => {
    const { container } = renderToast();
    expect(container.firstChild).toBeEmptyDOMElement();
    expect(screen.queryByText(/May Bagong Bersyon ng App!|New App Version Available!/i)).not.toBeInTheDocument();
  });

  it('renders a mandatory update dialog when reload is safe', () => {
    usePwaStore.setState({ needRefresh: true });
    renderToast();

    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(screen.getByText(/May Bagong Bersyon ng App!|New App Version Available!/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /I-reload para Mag-update|Reload & Update/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Mamaya na|Maybe later/i })).not.toBeInTheDocument();
  });

  it('cannot be dismissed with Escape or an outside click', () => {
    usePwaStore.setState({ needRefresh: true });
    renderToast();

    fireEvent.keyDown(screen.getByRole('alertdialog'), { key: 'Escape' });
    fireEvent.mouseDown(document.body);
    fireEvent.click(document.body);

    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(usePwaStore.getState().needRefresh).toBe(true);
  });

  it('triggers update reload when clicking update button with empty cart', async () => {
    const reloadSpy = vi.spyOn(pwaRegister, 'reloadAppForUpdate').mockResolvedValue(undefined);
    usePwaStore.setState({ needRefresh: true });
    renderToast();

    const updateBtn = screen.getByRole('button', { name: /I-reload para Mag-update|Reload & Update/i });
    expect(updateBtn).not.toBeDisabled();
    await waitFor(() => expect(updateBtn).toHaveFocus());
    expect(screen.queryByText(/Pakisara muna ang benta bago i-update|Please complete or clear the cart before updating/i)).not.toBeInTheDocument();

    fireEvent.click(updateBtn);

    expect(reloadSpy).toHaveBeenCalledTimes(1);
    reloadSpy.mockRestore();
  });

  it('disables update button and shows warning when cart has items', () => {
    const reloadSpy = vi.spyOn(pwaRegister, 'reloadAppForUpdate').mockResolvedValue(undefined);
    usePwaStore.setState({ needRefresh: true });
    useCartStore.setState({
      items: [
        {
          productId: 'item-1',
          name: 'Lucky Me Pancit Canton',
          price: 18,
          qty: 2,
          subtotal: 36
        }
      ]
    });

    renderToast();

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    const updateBtn = screen.getByRole('button', { name: /I-reload para Mag-update|Reload & Update/i });
    expect(updateBtn).toBeDisabled();
    expect(screen.getByText(/Pakisara muna ang benta bago i-update|Please complete or clear the cart before updating/i)).toBeInTheDocument();

    fireEvent.click(updateBtn);

    expect(reloadSpy).not.toHaveBeenCalled();
    reloadSpy.mockRestore();
  });

  it('switches automatically to the mandatory dialog when the cart is cleared', () => {
    usePwaStore.setState({ needRefresh: true });
    useCartStore.setState({
      items: [
        {
          productId: 'item-1',
          name: 'Lucky Me Pancit Canton',
          price: 18,
          qty: 1,
          subtotal: 18
        }
      ]
    });

    renderToast();
    const updateBtn = screen.getByRole('button', { name: /I-reload para Mag-update|Reload & Update/i });
    expect(updateBtn).toBeDisabled();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();

    act(() => {
      useCartStore.setState({ items: [] });
    });

    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /I-reload para Mag-update|Reload & Update/i })).not.toBeDisabled();
    expect(screen.queryByText(/Pakisara muna ang benta bago i-update|Please complete or clear the cart before updating/i)).not.toBeInTheDocument();
  });

  it('disables update button and shows other-tab warning when another tab reports an open cart', () => {
    const reloadSpy = vi.spyOn(pwaRegister, 'reloadAppForUpdate').mockResolvedValue(undefined);
    usePwaStore.setState({
      needRefresh: true,
      otherTabsHaveCart: true
    });
    // Local cart is empty
    useCartStore.getState().clearCart();

    renderToast();

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    const updateBtn = screen.getByRole('button', { name: /I-reload para Mag-update|Reload & Update/i });
    expect(updateBtn).toBeDisabled();
    expect(
      screen.getByText(/May bukas na benta sa isa pang tab|Another open till tab has an active transaction/i)
    ).toBeInTheDocument();

    fireEvent.click(updateBtn);
    expect(reloadSpy).not.toHaveBeenCalled();
    reloadSpy.mockRestore();
  });

  it('disables the update button while a sale receipt is open', () => {
    usePwaStore.setState({
      needRefresh: true,
      hasActiveReceipt: true
    });

    renderToast();

    const updateBtn = screen.getByRole('button', { name: /I-reload para Mag-update|Reload & Update/i });
    expect(updateBtn).toBeDisabled();
    expect(screen.getByText(/Pakisara muna ang benta|Please complete or clear the cart/i)).toBeInTheDocument();
  });

  it('keeps the app usable while a sale is in progress', () => {
    usePwaStore.setState({
      needRefresh: true,
      isSaleInProgress: true
    });

    renderToast();

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /I-reload para Mag-update|Reload & Update/i })).toBeDisabled();
  });

  it('keeps the dialog open and offers retry when navigation does not occur', async () => {
    vi.useFakeTimers();
    vi.spyOn(pwaRegister, 'reloadAppForUpdate').mockResolvedValue(undefined);
    usePwaStore.setState({ needRefresh: true });
    renderToast();

    fireEvent.click(screen.getByRole('button', { name: /I-reload para Mag-update|Reload & Update/i }));
    await act(async () => Promise.resolve());

    expect(screen.getByText(/Ina-update ang Fluent Tindahan|Updating Fluent Tindahan/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /I-reload para Mag-update|Reload & Update/i })).toBeDisabled();

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(screen.getByText(/Hindi natapos ang update|The update did not finish/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /I-reload para Mag-update|Reload & Update/i })).not.toBeDisabled();
    expect(usePwaStore.getState().needRefresh).toBe(true);
  });
});
