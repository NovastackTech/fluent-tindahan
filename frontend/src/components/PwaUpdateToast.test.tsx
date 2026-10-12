import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { FluentProvider } from '@fluentui/react-components';
import { sariSariLightTheme } from '../theme/theme';
import { PwaUpdateToast } from './PwaUpdateToast';
import { usePwaStore } from '../state/pwaStore';
import { useCartStore } from '../state/cartStore';
import * as pwaRegister from '../pwa/registerServiceWorker';

describe('PwaUpdateToast', () => {
  beforeEach(() => {
    usePwaStore.setState({
      needRefresh: false,
      otherTabsHaveCart: false,
      isSaleInProgress: false,
      hasActiveReceipt: false
    });
    useCartStore.getState().clearCart();
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

  it('renders update banner when needRefresh is true', () => {
    usePwaStore.setState({ needRefresh: true });
    renderToast();

    expect(screen.getByText(/May Bagong Bersyon ng App!|New App Version Available!/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /I-reload para Mag-update|Reload & Update/i })).toBeInTheDocument();
  });

  it('triggers update reload when clicking update button with empty cart', () => {
    const reloadSpy = vi.spyOn(pwaRegister, 'reloadAppForUpdate').mockResolvedValue(undefined);
    usePwaStore.setState({ needRefresh: true });
    renderToast();

    const updateBtn = screen.getByRole('button', { name: /I-reload para Mag-update|Reload & Update/i });
    expect(updateBtn).not.toBeDisabled();
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

    const updateBtn = screen.getByRole('button', { name: /I-reload para Mag-update|Reload & Update/i });
    expect(updateBtn).toBeDisabled();
    expect(screen.getByText(/Pakisara muna ang benta bago i-update|Please complete or clear the cart before updating/i)).toBeInTheDocument();

    fireEvent.click(updateBtn);

    expect(reloadSpy).not.toHaveBeenCalled();
    reloadSpy.mockRestore();
  });

  it('re-enables update button when cart is cleared', () => {
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

    const { rerender } = renderToast();
    const updateBtn = screen.getByRole('button', { name: /I-reload para Mag-update|Reload & Update/i });
    expect(updateBtn).toBeDisabled();

    // Clear cart
    act(() => {
      useCartStore.setState({ items: [] });
    });
    rerender(
      <FluentProvider theme={sariSariLightTheme}>
        <PwaUpdateToast />
      </FluentProvider>
    );

    expect(updateBtn).not.toBeDisabled();
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

  it('dismisses toast when clicking dismiss button', () => {
    usePwaStore.setState({ needRefresh: true });
    renderToast();

    const dismissBtn = screen.getByRole('button', { name: /Mamaya na|Maybe later/i });
    fireEvent.click(dismissBtn);

    expect(usePwaStore.getState().needRefresh).toBe(false);
  });
});
