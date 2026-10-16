import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { FluentProvider } from '@fluentui/react-components';
import { LoginPage } from './LoginPage';
import { sariSariLightTheme } from '../theme/theme';
import { useAuthStore } from '../state/authStore';
import { translations } from '../i18n/translations';
import * as authService from '../services/authService';
import * as seedData from '../db/seedData';
import { db } from '../db/db';

vi.mock('../services/authService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/authService')>();
  return {
    ...actual,
    registerStore: vi.fn().mockResolvedValue({
      tenantId: 'login-test-registered-tenant',
      userId: 'login-test-registered-user',
      email: 'sari@tindahan.ph',
      businessName: 'Bagong Tindahan',
      ownerName: 'Nanay Coring',
      phone: '09171234567',
      role: 'Owner',
      tier: 'Libre',
      planTier: 'Libre',
      subscriptionEndDate: null,
      hasPin: false,
      token: 'mock-token',
      expiresAt: '2028-01-01'
    }),
    loginStore: vi.fn().mockResolvedValue({
      tenantId: 'login-test-login-tenant',
      userId: 'login-test-login-user',
      email: 'owner@tindahan.ph',
      businessName: 'Sari-Sari Store Ni Juan',
      ownerName: 'Juan Dela Cruz',
      phone: '09179876543',
      role: 'Owner',
      tier: 'Libre',
      planTier: 'Libre',
      subscriptionEndDate: null,
      hasPin: false,
      token: 'mock-login-token',
      expiresAt: '2028-01-01'
    }),
    loginPin: vi.fn().mockResolvedValue({
      tenantId: 'login-test-pin-tenant',
      userId: 'login-test-pin-user',
      email: 'pin@tindahan.ph',
      businessName: 'PIN Sari-Sari Store',
      ownerName: 'Maria Santos',
      phone: '09181112233',
      role: 'Owner',
      tier: 'Libre',
      planTier: 'Libre',
      subscriptionEndDate: null,
      hasPin: true,
      token: 'mock-pin-token',
      expiresAt: '2028-01-01'
    })
  };
});

vi.mock('../db/seedData', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../db/seedData')>();
  return {
    ...actual,
    seedDexieDatabaseIfNeeded: vi.fn().mockResolvedValue(true)
  };
});

const renderLoginPage = (onNavigate = vi.fn()) => {
  return {
    onNavigate,
    ...render(
      <FluentProvider theme={sariSariLightTheme}>
        <LoginPage onNavigate={onNavigate} />
      </FluentProvider>
    )
  };
};

describe('LoginPage Component', () => {
  const t = translations.tl;

  beforeEach(async () => {
    vi.clearAllMocks();
    localStorage.clear();
    await db.syncQueue.clear();
    useAuthStore.setState({
      isOnboarded: false,
      isOnboardingStatusReady: true,
      businessName: '',
      ownerName: '',
      userPhone: '',
      userEmail: '',
      tenantId: 'default-store',
      userId: 'default-user',
      hasPin: false
    });
  });

  it('renders minimal login header, badge, and tabs', () => {
    renderLoginPage();

    expect(screen.getByText(t.login.pageTitle)).toBeInTheDocument();
    expect(screen.getByText(t.login.badgeText)).toBeInTheDocument();
    expect(screen.getByTestId('login-tab-login')).toBeInTheDocument();
    expect(screen.getByTestId('login-tab-register')).toBeInTheDocument();
    expect(screen.getByTestId('login-demo-btn')).toBeInTheDocument();
    expect(screen.getByTestId('login-back-landing-btn')).toBeInTheDocument();
  });

  it('allows logging in with email and password and navigates to pos', async () => {
    const { onNavigate } = renderLoginPage();

    const emailInput = screen.getByPlaceholderText(t.landing.emailPlaceholder);
    const passwordInput = screen.getByPlaceholderText(t.landing.passwordPlaceholder);
    const submitBtn = screen.getByTestId('login-submit-btn');

    fireEvent.change(emailInput, { target: { value: 'owner@tindahan.ph' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });

    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(authService.loginStore).toHaveBeenCalledWith({
        email: 'owner@tindahan.ph',
        password: 'password123'
      });
      expect(useAuthStore.getState().isOnboarded).toBe(true);
      expect(useAuthStore.getState().userEmail).toBe('owner@tindahan.ph');
      expect(onNavigate).toHaveBeenCalledWith('pos');
    });
  });

  it('allows logging in with Quick PIN when toggled', async () => {
    const { onNavigate } = renderLoginPage();

    // Toggle mode to PIN
    const toggleBtn = screen.getByTestId('login-toggle-mode-btn');
    fireEvent.click(toggleBtn);

    const emailInput = screen.getByPlaceholderText(t.landing.emailPlaceholder);
    const pinInput = screen.getByPlaceholderText(t.landing.pinPlaceholder);
    const submitBtn = screen.getByTestId('login-submit-btn');

    fireEvent.change(emailInput, { target: { value: 'pin@tindahan.ph' } });
    fireEvent.change(pinInput, { target: { value: '1234' } });

    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(authService.loginPin).toHaveBeenCalledWith({
        email: 'pin@tindahan.ph',
        pin: '1234'
      });
      expect(useAuthStore.getState().isOnboarded).toBe(true);
      expect(onNavigate).toHaveBeenCalledWith('pos');
    });
  });

  it('shows error banner when credentials fail', async () => {
    vi.mocked(authService.loginStore).mockRejectedValueOnce({
      response: { data: { message: 'Maling email o password' } }
    });

    renderLoginPage();

    const emailInput = screen.getByPlaceholderText(t.landing.emailPlaceholder);
    const passwordInput = screen.getByPlaceholderText(t.landing.passwordPlaceholder);
    const submitBtn = screen.getByTestId('login-submit-btn');

    fireEvent.change(emailInput, { target: { value: 'wrong@tindahan.ph' } });
    fireEvent.change(passwordInput, { target: { value: 'wrongpass' } });

    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Maling email o password');
    });
  });

  it('allows registering a new store and navigating to pos', async () => {
    const { onNavigate } = renderLoginPage();

    // Switch to Register tab
    const registerTab = screen.getByTestId('login-tab-register');
    fireEvent.click(registerTab);

    fireEvent.change(screen.getByPlaceholderText(t.landing.storeNamePlaceholder), { target: { value: 'Tindahan ni Nanay' } });
    fireEvent.change(screen.getByPlaceholderText(t.landing.emailPlaceholder), { target: { value: 'nanay@tindahan.ph' } });
    fireEvent.change(screen.getByPlaceholderText(t.landing.passwordPlaceholder), { target: { value: 'nanay123' } });

    const submitBtn = screen.getByTestId('login-register-submit-btn');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(authService.registerStore).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'nanay@tindahan.ph',
          password: 'nanay123',
          businessName: 'Tindahan ni Nanay'
        })
      );
      expect(useAuthStore.getState().isOnboarded).toBe(true);
      expect(onNavigate).toHaveBeenCalledWith('pos');
    });
  });

  it('launches 1-Click Demo test drive and navigates to pos', async () => {
    const { onNavigate } = renderLoginPage();

    const demoBtn = screen.getByTestId('login-demo-btn');
    fireEvent.click(demoBtn);

    await waitFor(() => {
      expect(seedData.seedDexieDatabaseIfNeeded).toHaveBeenCalled();
      expect(useAuthStore.getState().isOnboarded).toBe(true);
      expect(onNavigate).toHaveBeenCalledWith('pos');
    });
  });

  it('navigates to landing page when back button is clicked', () => {
    const { onNavigate } = renderLoginPage();

    const backBtn = screen.getByTestId('login-back-landing-btn');
    fireEvent.click(backBtn);

    expect(onNavigate).toHaveBeenCalledWith('landing');
  });

  it('shows unsynced notice banner when db.syncQueue has pending items', async () => {
    await db.syncQueue.add({
      id: 'pending-item-1',
      entity: 'Sale',
      action: 'Insert',
      timestamp: new Date().toISOString(),
      payload: { id: 's1' },
      status: 'Pending',
      retryCount: 0
    });

    renderLoginPage();

    await waitFor(() => {
      expect(screen.getByTestId('login-unsynced-notice')).toBeInTheDocument();
      expect(screen.getByText(/1 transaksyon na hindi pa nai-sync/i)).toBeInTheDocument();
    });
  });

  it('prompts user with ConfirmUnsyncedLoginDialog when logging into a new tenant with unsynced mutations', async () => {
    await db.syncQueue.add({
      id: 'pending-item-2',
      entity: 'Sale',
      action: 'Insert',
      timestamp: new Date().toISOString(),
      payload: { id: 's2' },
      status: 'Pending',
      retryCount: 0
    });

    const { onNavigate } = renderLoginPage();

    const emailInput = screen.getByPlaceholderText(t.landing.emailPlaceholder);
    const passwordInput = screen.getByPlaceholderText(t.landing.passwordPlaceholder);
    const submitBtn = screen.getByTestId('login-submit-btn');

    fireEvent.change(emailInput, { target: { value: 'owner@tindahan.ph' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(submitBtn);

    // Dialog should appear asking user first
    await waitFor(() => {
      const dialog = screen.getByRole('dialog');
      expect(within(dialog).getByText(/May Hindi Pa Nai-sync na Datos|Unsynced Data Detected/i)).toBeInTheDocument();
      expect(within(dialog).getByText(/1 transaksyon na hindi pa nai-sync/i)).toBeInTheDocument();
    });

    // Should NOT have completed login yet
    expect(onNavigate).not.toHaveBeenCalled();
    expect(useAuthStore.getState().isOnboarded).toBe(false);

    // Clicking cancel closes dialog and preserves unsynced records
    const cancelBtn = within(screen.getByRole('dialog')).getByRole('button', { name: /Kanselahin|Cancel/i });
    fireEvent.click(cancelBtn);

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(await db.syncQueue.count()).toBe(1);
    expect(useAuthStore.getState().isOnboarded).toBe(false);

    // Submitting again and choosing force login wipes and completes login
    fireEvent.click(submitBtn);
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    }, { timeout: 3000 });

    const wipeBtn = within(screen.getByRole('dialog')).getByRole('button', { name: /I-wipe at Mag-login Pa Rin|Wipe & Log In Anyway/i });
    fireEvent.click(wipeBtn);

    await waitFor(() => {
      expect(useAuthStore.getState().isOnboarded).toBe(true);
      expect(onNavigate).toHaveBeenCalledWith('pos');
    });
    expect(await db.syncQueue.count()).toBe(0);
  });
});
