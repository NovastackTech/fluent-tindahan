import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FluentProvider } from '@fluentui/react-components';
import { Navigation } from './Navigation';
import { sariSariLightTheme } from '../theme/theme';
import { useCartStore } from '../state/cartStore';

describe('Navigation', () => {
  const renderNav = (activeTab = 'pos' as any, onTabChange = vi.fn()) => {
    return {
      onTabChange,
      ...render(
        <FluentProvider theme={sariSariLightTheme}>
          <Navigation activeTab={activeTab} onTabChange={onTabChange} />
        </FluentProvider>
      )
    };
  };

  it('renders all navigation tabs', () => {
    renderNav();

    expect(screen.getByText(/POS/i)).toBeInTheDocument();
    expect(screen.getByText(/Dashboard/i)).toBeInTheDocument();
    expect(screen.getByText(/Inventory|Imbentaryo/i)).toBeInTheDocument();
    expect(screen.getByText(/Utang/i)).toBeInTheDocument();
    expect(screen.getByText(/GCash/i)).toBeInTheDocument();
    expect(screen.getByText(/Import/i)).toBeInTheDocument();
    expect(screen.getByText(/Settings|Sync/i)).toBeInTheDocument();
  });

  it('calls onTabChange when a tab is clicked', () => {
    const { onTabChange } = renderNav('pos');

    const dashboardTab = screen.getByText(/Dashboard/i).closest('[role="button"]');
    expect(dashboardTab).toBeInTheDocument();
    fireEvent.click(dashboardTab!);

    expect(onTabChange).toHaveBeenCalledWith('dashboard');
  });

  it('displays cart item badge when items exist in cart', () => {
    useCartStore.getState().addItem({ id: 'p1', name: 'Product 1', price: 10 });
    renderNav('pos');

    expect(screen.getByText('1')).toBeInTheDocument();
  });
});
