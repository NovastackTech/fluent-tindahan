import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FluentProvider } from '@fluentui/react-components';
import { Navigation, type NavTab } from './Navigation';
import { sariSariLightTheme } from '../theme/theme';
import { useCartStore } from '../state/cartStore';

describe('Navigation', () => {
  beforeEach(() => {
    useCartStore.setState({ items: [] });
  });

  const renderNav = (
    activeTab: NavTab = 'pos',
    onTabChange = vi.fn(),
    forceCollapsible?: boolean
  ) => {
    return {
      onTabChange,
      ...render(
        <FluentProvider theme={sariSariLightTheme}>
          <Navigation
            activeTab={activeTab}
            onTabChange={onTabChange}
            forceCollapsible={forceCollapsible}
          />
        </FluentProvider>
      )
    };
  };

  describe('Standard Horizontal Navigation (Wide / Landscape View)', () => {
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

  describe('Collapsible Upward Vertical Navigation (Phone Vertical / Narrow View)', () => {
    it('renders in collapsed state initially with active tab summary and expand trigger', () => {
      renderNav('pos', vi.fn(), true);

      // Collapsed toolbar should be present
      const collapsedBar = screen.getByTestId('nav-collapsed-bar');
      expect(collapsedBar).toBeInTheDocument();
      expect(screen.getByText(/POS/i)).toBeInTheDocument();
      expect(screen.getByTestId('nav-collapse-toggle')).toBeInTheDocument();

      // Expanded panel and backdrop should not be in the DOM
      expect(screen.queryByTestId('nav-backdrop')).not.toBeInTheDocument();
    });

    it('displays cart item count badge on active tab in collapsed bar', () => {
      useCartStore.getState().addItem({ id: 'p1', name: 'Product 1', price: 10 });
      renderNav('pos', vi.fn(), true);

      expect(screen.getByText('1')).toBeInTheDocument();
    });

    it('displays cart notification badge on expand button when cart has items and active tab is not POS', () => {
      useCartStore.getState().addItem({ id: 'p1', name: 'Product 1', price: 10 });
      renderNav('dashboard', vi.fn(), true);

      // The badge should appear in the expand toggle area
      expect(screen.getByText('1')).toBeInTheDocument();
    });

    it('expands upward vertically when clicking the collapsed bar', () => {
      renderNav('pos', vi.fn(), true);

      const collapsedBar = screen.getByTestId('nav-collapsed-bar');
      fireEvent.click(collapsedBar);

      // Panel should now be expanded
      expect(screen.getByTestId('nav-backdrop')).toBeInTheDocument();
      expect(screen.getByText(/Menu ng Tindahan|Store Menu/i)).toBeInTheDocument();

      // All 7 tabs should now be rendered vertically
      expect(screen.getByTestId('nav-tab-dashboard')).toBeInTheDocument();
      expect(screen.getByTestId('nav-tab-pos')).toBeInTheDocument();
      expect(screen.getByTestId('nav-tab-inventory')).toBeInTheDocument();
      expect(screen.getByTestId('nav-tab-utang')).toBeInTheDocument();
      expect(screen.getByTestId('nav-tab-gcash')).toBeInTheDocument();
      expect(screen.getByTestId('nav-tab-import')).toBeInTheDocument();
      expect(screen.getByTestId('nav-tab-settings')).toBeInTheDocument();
    });

    it('calls onTabChange and collapses back down when a vertical tab item is selected', () => {
      const { onTabChange } = renderNav('pos', vi.fn(), true);

      // Open the upward vertical menu
      fireEvent.click(screen.getByTestId('nav-collapsed-bar'));
      expect(screen.getByTestId('nav-backdrop')).toBeInTheDocument();

      // Click on Dashboard item
      const dashboardItem = screen.getByTestId('nav-tab-dashboard');
      fireEvent.click(dashboardItem);

      expect(onTabChange).toHaveBeenCalledWith('dashboard');
      // Should automatically collapse
      expect(screen.queryByTestId('nav-backdrop')).not.toBeInTheDocument();
      expect(screen.getByTestId('nav-collapsed-bar')).toBeInTheDocument();
    });

    it('collapses back down when clicking the collapse toggle button in expanded header', () => {
      renderNav('pos', vi.fn(), true);

      // Open menu
      fireEvent.click(screen.getByTestId('nav-collapsed-bar'));
      expect(screen.getByTestId('nav-backdrop')).toBeInTheDocument();

      // Click collapse toggle in expanded header
      const collapseToggle = screen.getByTestId('nav-collapse-toggle');
      fireEvent.click(collapseToggle);

      // Should be collapsed
      expect(screen.queryByTestId('nav-backdrop')).not.toBeInTheDocument();
      expect(screen.getByTestId('nav-collapsed-bar')).toBeInTheDocument();
    });

    it('collapses back down when clicking the backdrop overlay', () => {
      renderNav('pos', vi.fn(), true);

      // Open menu
      fireEvent.click(screen.getByTestId('nav-collapsed-bar'));
      const backdrop = screen.getByTestId('nav-backdrop');
      expect(backdrop).toBeInTheDocument();

      // Click backdrop
      fireEvent.click(backdrop);

      // Should be collapsed
      expect(screen.queryByTestId('nav-backdrop')).not.toBeInTheDocument();
      expect(screen.getByTestId('nav-collapsed-bar')).toBeInTheDocument();
    });

    it('collapses back down when pressing the Escape key', () => {
      renderNav('pos', vi.fn(), true);

      // Open menu
      fireEvent.click(screen.getByTestId('nav-collapsed-bar'));
      expect(screen.getByTestId('nav-backdrop')).toBeInTheDocument();

      // Press Escape
      fireEvent.keyDown(window, { key: 'Escape' });

      // Should be collapsed
      expect(screen.queryByTestId('nav-backdrop')).not.toBeInTheDocument();
      expect(screen.getByTestId('nav-collapsed-bar')).toBeInTheDocument();
    });
  });

  describe('Automatic Screen Fit & Phone Vertical Detection', () => {
    it('automatically activates collapsibility when in portrait view and width does not fit (< 520px)', () => {
      // Simulate phone vertical / portrait dimensions (e.g. 390x844 iPhone 14)
      vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(390);
      vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(844);

      renderNav('pos');

      // Collapsed bar should be activated automatically
      expect(screen.getByTestId('nav-collapsed-bar')).toBeInTheDocument();
    });

    it('remains horizontal standard navbar when screen is wide (>= 520px)', () => {
      // Simulate desktop or landscape tablet (e.g. 1024x768)
      vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(1024);
      vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(768);

      renderNav('pos');

      // Collapsed bar should NOT be present
      expect(screen.queryByTestId('nav-collapsed-bar')).not.toBeInTheDocument();
      // All horizontal tabs are visible
      expect(screen.getByTestId('nav-tab-pos')).toBeInTheDocument();
      expect(screen.getByTestId('nav-tab-dashboard')).toBeInTheDocument();
    });
  });
});
