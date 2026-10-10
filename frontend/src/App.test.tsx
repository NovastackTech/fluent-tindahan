import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { App, getInitialNavTab } from './App';
import { useAuthStore } from './state/authStore';
import { usePwaStore } from './state/pwaStore';

describe('App', () => {
  beforeEach(() => {
    useAuthStore.setState({ consentAccepted: true });
    usePwaStore.setState({
      isInstallable: false,
      isStandalone: false,
      isInstalled: false,
      needRefresh: false,
      isDismissed: false
    });
  });

  it('renders application with header, navigation, and default dashboard view', async () => {
    render(<App />);

    expect(screen.getByText(/Fluent Tindahan/i)).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: /Bottom Navigation/i })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/Bagong Benta|New Sale/i)).toBeInTheDocument();
    });
  });

  it('correctly resolves initial nav tab from shortcut URL parameters and pathnames', () => {
    // Default without query
    window.history.pushState({}, '', '/');
    expect(getInitialNavTab()).toBe('dashboard');

    // Shortcut query params
    window.history.pushState({}, '', '/?tab=pos');
    expect(getInitialNavTab()).toBe('pos');

    window.history.pushState({}, '', '/?tab=gcash');
    expect(getInitialNavTab()).toBe('gcash');

    window.history.pushState({}, '', '/?tab=utang');
    expect(getInitialNavTab()).toBe('utang');

    // Clean up
    window.history.pushState({}, '', '/');
  });

  it('renders PwaInstallBanner in App when installable', async () => {
    usePwaStore.setState({ isInstallable: true, isStandalone: false });
    render(<App />);

    expect(screen.getByText(/I-install ang Fluent Tindahan App|Install Fluent Tindahan App/i)).toBeInTheDocument();
  });

  it('renders PwaUpdateToast in App when service worker update is ready', async () => {
    usePwaStore.setState({ needRefresh: true });
    render(<App />);

    expect(screen.getByText(/May Bagong Bersyon ng App!|New App Version Available!/i)).toBeInTheDocument();
  });
});

