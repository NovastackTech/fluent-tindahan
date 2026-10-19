import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
import { FluentProvider } from '@fluentui/react-components';
import { LoginPage } from './LoginPage';
import { sariSariLightTheme } from '../theme/theme';
import { useAuthStore } from '../state/authStore';
import { useLanguageStore } from '../state/languageStore';
import { translations } from '../i18n/translations';
import * as authService from '../services/authService';
import * as seedData from '../db/seedData';
import { db } from '../db/db';
import { useSubscriptionStore } from '../state/subscriptionStore';

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
    }),
    authenticateWithGoogle: vi.fn().mockResolvedValue({
      tenantId: 'login-test-google-tenant',
      userId: 'login-test-google-user',
      email: 'google@tindahan.ph',
      businessName: 'Google Tindahan',
      ownerName: 'Google User',
      phone: '',
      role: 'Owner',
      tier: 'Libre',
      planTier: 'Libre',
      subscriptionEndDate: null,
      hasPin: false,
      token: 'mock-google-token',
      expiresAt: '2028-01-01',
      isNewUser: false
    })
  };
});

import * as syncEngine from '../sync/syncEngine';

vi.mock('../sync/syncEngine', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../sync/syncEngine')>();
  return {
    ...actual,
    processSyncQueue: vi.fn().mockResolvedValue({ processed: 0, conflicts: 0, errors: 0 }),
    kickSync: vi.fn().mockResolvedValue(undefined),
    pullCatalogFromServer: vi.fn().mockResolvedValue(0),
    restoreTenantDataFromServer: vi.fn().mockResolvedValue(undefined)
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
    window.history.replaceState(null, '', '/');
    vi.spyOn(useSubscriptionStore.getState(), 'refreshSubscription').mockResolvedValue();
    localStorage.clear();
    useLanguageStore.setState({ language: 'tl' });
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
      expect(syncEngine.restoreTenantDataFromServer).toHaveBeenCalled();
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

  it('displays only either TL or EN for bilingual error messages and updates on language toggle', async () => {
    vi.mocked(authService.loginStore).mockRejectedValueOnce({
      response: {
        data: {
          message:
            'Naka-lockout ang iyong IP address dahil sa 5 sunod-sunod na maling pagsubok sa PIN. Maghintay nang 15 minuto. / IP address throttled for 15 minutes due to 5 failed PIN attempts.'
        }
      }
    });

    renderLoginPage();

    const emailInput = screen.getByPlaceholderText(t.landing.emailPlaceholder);
    const passwordInput = screen.getByPlaceholderText(t.landing.passwordPlaceholder);
    const submitBtn = screen.getByTestId('login-submit-btn');

    fireEvent.change(emailInput, { target: { value: 'throttled@tindahan.ph' } });
    fireEvent.change(passwordInput, { target: { value: 'wrongpass' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      const alert = screen.getByRole('alert');
      expect(alert).toHaveTextContent(
        'Naka-lockout ang iyong IP address dahil sa 5 sunod-sunod na maling pagsubok sa PIN. Maghintay nang 15 minuto.'
      );
      expect(alert).not.toHaveTextContent(
        'IP address throttled for 15 minutes due to 5 failed PIN attempts.'
      );
    });

    act(() => {
      useLanguageStore.setState({ language: 'en' });
    });

    await waitFor(() => {
      const alert = screen.getByRole('alert');
      expect(alert).toHaveTextContent(
        'IP address throttled for 15 minutes due to 5 failed PIN attempts.'
      );
      expect(alert).not.toHaveTextContent(
        'Naka-lockout ang iyong IP address dahil sa 5 sunod-sunod na maling pagsubok sa PIN. Maghintay nang 15 minuto.'
      );
    });
  });

  it('allows registering a new store and navigating to pos with starter products enabled by default', async () => {
    const { onNavigate } = renderLoginPage();

    // Switch to Register tab
    const registerTab = screen.getByTestId('login-tab-register');
    fireEvent.click(registerTab);

    // Starter products checkbox should be present and checked by default
    const starterCheckbox = screen.getByTestId('login-reg-starter-products');
    expect(starterCheckbox).toBeInTheDocument();
    const checkboxInput = starterCheckbox.querySelector('input') || starterCheckbox;
    expect(checkboxInput).toBeChecked();

    fireEvent.change(screen.getByPlaceholderText(t.landing.storeNamePlaceholder), { target: { value: 'Tindahan ni Nanay' } });
    fireEvent.change(screen.getByPlaceholderText(t.landing.emailPlaceholder), { target: { value: 'nanay@tindahan.ph' } });
    fireEvent.change(screen.getByPlaceholderText(t.landing.passwordPlaceholder), { target: { value: 'nanay123' } });
    fireEvent.change(screen.getByPlaceholderText(t.landing.confirmPasswordPlaceholder), { target: { value: 'nanay123' } });

    const submitBtn = screen.getByTestId('login-register-submit-btn');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(seedData.seedDexieDatabaseIfNeeded).toHaveBeenCalledWith(
        false,
        expect.any(String),
        false,
        'Tindahan ni Nanay'
      );
      expect(authService.registerStore).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'nanay@tindahan.ph',
          password: 'nanay123',
          businessName: 'Tindahan ni Nanay'
        })
      );
      expect(useAuthStore.getState().isOnboarded).toBe(true);
      expect(syncEngine.kickSync).toHaveBeenCalled();
      expect(onNavigate).toHaveBeenCalledWith('pos');
    });
  });

  it('allows opting out of starter products when registering a new store', async () => {
    const { onNavigate } = renderLoginPage();

    const registerTab = screen.getByTestId('login-tab-register');
    fireEvent.click(registerTab);

    // Uncheck starter products checkbox
    const starterCheckbox = screen.getByTestId('login-reg-starter-products');
    const checkboxInput = starterCheckbox.querySelector('input') || starterCheckbox;
    fireEvent.click(checkboxInput);
    expect(checkboxInput).not.toBeChecked();

    fireEvent.change(screen.getByPlaceholderText(t.landing.storeNamePlaceholder), { target: { value: 'Malinis na Tindahan' } });
    fireEvent.change(screen.getByPlaceholderText(t.landing.emailPlaceholder), { target: { value: 'clean@tindahan.ph' } });
    fireEvent.change(screen.getByPlaceholderText(t.landing.passwordPlaceholder), { target: { value: 'clean123' } });
    fireEvent.change(screen.getByPlaceholderText(t.landing.confirmPasswordPlaceholder), { target: { value: 'clean123' } });

    const submitBtn = screen.getByTestId('login-register-submit-btn');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(seedData.seedDexieDatabaseIfNeeded).toHaveBeenCalledWith(
        false,
        expect.any(String),
        true,
        'Malinis na Tindahan'
      );
      expect(authService.registerStore).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'clean@tindahan.ph',
          password: 'clean123',
          businessName: 'Malinis na Tindahan'
        })
      );
      expect(useAuthStore.getState().isOnboarded).toBe(true);
      expect(syncEngine.kickSync).toHaveBeenCalled();
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
    const firstDialog = await screen.findByRole('dialog', {}, { timeout: 5000 });
    expect(within(firstDialog).getByText(/May Hindi Pa Nai-sync na Datos|Unsynced Data Detected/i)).toBeInTheDocument();
    expect(within(firstDialog).getByText(/1 transaksyon na hindi pa nai-sync/i)).toBeInTheDocument();

    // Should NOT have completed login yet
    expect(onNavigate).not.toHaveBeenCalled();
    expect(useAuthStore.getState().isOnboarded).toBe(false);

    // Clicking cancel closes dialog and preserves unsynced records
    const cancelBtn = within(firstDialog).getByRole('button', { name: /Kanselahin|Cancel/i });
    fireEvent.click(cancelBtn);

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(await db.syncQueue.count()).toBe(1);
    expect(useAuthStore.getState().isOnboarded).toBe(false);

    // Submitting again and choosing force login wipes and completes login
    await waitFor(() => {
      expect(submitBtn).not.toBeDisabled();
    });
    const loginForm = submitBtn.closest('form');
    if (loginForm) {
      fireEvent.submit(loginForm);
    } else {
      fireEvent.click(submitBtn);
    }

    const secondDialog = await screen.findByRole('dialog', {}, { timeout: 5000 });
    const wipeBtn = within(secondDialog).getByRole('button', { name: /I-wipe at Mag-login Pa Rin|Wipe & Log In Anyway/i });
    fireEvent.click(wipeBtn);

    await waitFor(() => {
      expect(useAuthStore.getState().isOnboarded).toBe(true);
      expect(onNavigate).toHaveBeenCalledWith('pos');
    });
    expect(await db.syncQueue.count()).toBe(0);
  }, 15000);

  it('provides a 1-click button to switch to password login when PIN attempt is throttled or fails', async () => {
    vi.mocked(authService.loginPin).mockRejectedValueOnce({
      response: {
        status: 429,
        data: {
          message:
            'Naka-lockout ang iyong IP address dahil sa sunod-sunod na maling pagsubok sa PIN. Mag-login gamit ang Password o maghintay nang 15 minuto. / IP address throttled due to repeated failed PIN attempts. Use password to log in or wait 15 minutes.'
        }
      }
    });

    renderLoginPage();

    // Toggle to PIN mode
    fireEvent.click(screen.getByTestId('login-toggle-mode-btn'));

    const emailInput = screen.getByPlaceholderText(t.landing.emailPlaceholder);
    const pinInput = screen.getByPlaceholderText(t.landing.pinPlaceholder);
    const submitBtn = screen.getByTestId('login-submit-btn');

    fireEvent.change(emailInput, { target: { value: 'pin@tindahan.ph' } });
    fireEvent.change(pinInput, { target: { value: '9999' } });
    fireEvent.click(submitBtn);

    const switchBtn = await screen.findByTestId('login-switch-to-password-btn');
    expect(switchBtn).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Naka-lockout ang iyong IP address dahil sa sunod-sunod na maling pagsubok sa PIN.'
    );

    // Clicking switch to password changes mode and clears error
    fireEvent.click(switchBtn);

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText(t.landing.passwordPlaceholder)).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(t.landing.pinPlaceholder)).not.toBeInTheDocument();
  });

  it('shows all registration errors together with invalid fields highlighted (aria-invalid set)', async () => {
    renderLoginPage();

    const registerTab = screen.getByTestId('login-tab-register');
    fireEvent.click(registerTab);

    const storeInput = screen.getByPlaceholderText(t.landing.storeNamePlaceholder);
    const emailInput = screen.getByPlaceholderText(t.landing.emailPlaceholder);
    const passwordInput = screen.getByPlaceholderText(t.landing.passwordPlaceholder);
    const pinInput = screen.getByPlaceholderText(t.landing.pinPlaceholder);
    const submitBtn = screen.getByTestId('login-register-submit-btn');

    // Fill in multiple invalid inputs: empty store name, invalid email (31234), short password, invalid PIN (< 4 digits)
    fireEvent.change(storeInput, { target: { value: '' } });
    fireEvent.change(emailInput, { target: { value: '31234' } });
    fireEvent.change(passwordInput, { target: { value: '123' } });
    fireEvent.change(pinInput, { target: { value: '12' } });

    fireEvent.click(submitBtn);

    // Verify all 4 errors are displayed together in the error banner
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(t.onboarding.storeNameRequired);
    expect(alert).toHaveTextContent(t.onboarding.emailInvalid);
    expect(alert).toHaveTextContent(t.onboarding.passwordStrengthError);
    expect(alert).toHaveTextContent(t.onboarding.pinInvalid);

    // Verify invalid fields have aria-invalid="true"
    expect(storeInput).toHaveAttribute('aria-invalid', 'true');
    expect(emailInput).toHaveAttribute('aria-invalid', 'true');
    expect(passwordInput).toHaveAttribute('aria-invalid', 'true');
    expect(pinInput).toHaveAttribute('aria-invalid', 'true');

    // Updating a field resets its aria-invalid attribute
    fireEvent.change(storeInput, { target: { value: 'Valid Store' } });
    expect(storeInput).toHaveAttribute('aria-invalid', 'false');
  });

  it('rejects a registration PIN over 6 digits with pinInvalid error and aria-invalid set', async () => {
    renderLoginPage();

    const registerTab = screen.getByTestId('login-tab-register');
    fireEvent.click(registerTab);

    const storeInput = screen.getByPlaceholderText(t.landing.storeNamePlaceholder);
    const emailInput = screen.getByPlaceholderText(t.landing.emailPlaceholder);
    const passwordInput = screen.getByPlaceholderText(t.landing.passwordPlaceholder);
    const pinInput = screen.getByPlaceholderText(t.landing.pinPlaceholder);
    const submitBtn = screen.getByTestId('login-register-submit-btn');

    fireEvent.change(storeInput, { target: { value: 'Valid Store' } });
    fireEvent.change(emailInput, { target: { value: 'valid@store.ph' } });
    fireEvent.change(passwordInput, { target: { value: 'SecurePass123' } });
    fireEvent.change(screen.getByPlaceholderText(t.landing.confirmPasswordPlaceholder), { target: { value: 'SecurePass123' } });
    // 7-digit PIN (over 6 digits)
    fireEvent.change(pinInput, { target: { value: '1234567' } });

    fireEvent.click(submitBtn);

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(t.onboarding.pinInvalid);
    expect(pinInput).toHaveAttribute('aria-invalid', 'true');
    expect(storeInput).toHaveAttribute('aria-invalid', 'false');
    expect(emailInput).toHaveAttribute('aria-invalid', 'false');
    expect(passwordInput).toHaveAttribute('aria-invalid', 'false');
    expect(authService.registerStore).not.toHaveBeenCalled();
  });

  it('rejects a login Quick PIN over 6 digits with pinInvalid error and aria-invalid set', async () => {
    renderLoginPage();

    // Toggle to PIN mode
    fireEvent.click(screen.getByTestId('login-toggle-mode-btn'));

    const emailInput = screen.getByPlaceholderText(t.landing.emailPlaceholder);
    const pinInput = screen.getByPlaceholderText(t.landing.pinPlaceholder);
    const submitBtn = screen.getByTestId('login-submit-btn');

    fireEvent.change(emailInput, { target: { value: 'owner@tindahan.ph' } });
    // 8-digit PIN (over 6 digits)
    fireEvent.change(pinInput, { target: { value: '12345678' } });

    fireEvent.click(submitBtn);

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(t.onboarding.pinInvalid);
    expect(pinInput).toHaveAttribute('aria-invalid', 'true');
    expect(emailInput).toHaveAttribute('aria-invalid', 'false');
    expect(authService.loginPin).not.toHaveBeenCalled();
  });

  it('displays sign-up heading and updates URL to ?tab=signup when switching to register tab', async () => {
    window.history.replaceState(null, '', '/');
    renderLoginPage();

    // Initially on login tab with sign-in heading
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toHaveTextContent(t.login.pageTitle);

    // Click register tab ("New Store")
    const registerTab = screen.getByTestId('login-tab-register');
    fireEvent.click(registerTab);

    // Heading reflects sign up
    expect(heading).toHaveTextContent(t.login.signUpPageTitle);
    expect(window.location.search).toBe('?tab=signup');

    // Click login tab ("Log In")
    const loginTab = screen.getByTestId('login-tab-login');
    fireEvent.click(loginTab);

    // Heading reflects sign in and URL reflects ?tab=login
    expect(heading).toHaveTextContent(t.login.pageTitle);
    expect(window.location.search).toBe('?tab=login');
  });

  it('renders sign-up heading initially when URL contains ?tab=signup', async () => {
    window.history.replaceState(null, '', '/?tab=signup');
    renderLoginPage();

    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toHaveTextContent(t.login.signUpPageTitle);
  });

  it('rejects a registration password that fails the password strength rule and marks aria-invalid', async () => {
    renderLoginPage();

    fireEvent.click(screen.getByTestId('login-tab-register'));

    const storeInput = screen.getByPlaceholderText(t.landing.storeNamePlaceholder);
    const emailInput = screen.getByPlaceholderText(t.landing.emailPlaceholder);
    const passwordInput = screen.getByPlaceholderText(t.landing.passwordPlaceholder);
    const confirmInput = screen.getByPlaceholderText(t.landing.confirmPasswordPlaceholder);
    const submitBtn = screen.getByTestId('login-register-submit-btn');

    fireEvent.change(storeInput, { target: { value: 'Lakas Store' } });
    fireEvent.change(emailInput, { target: { value: 'lakas@store.ph' } });
    // Password with only letters (fails strength rule)
    fireEvent.change(passwordInput, { target: { value: 'weakpassword' } });
    fireEvent.change(confirmInput, { target: { value: 'weakpassword' } });

    fireEvent.click(submitBtn);

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(t.onboarding.passwordStrengthError);
    expect(passwordInput).toHaveAttribute('aria-invalid', 'true');
    expect(authService.registerStore).not.toHaveBeenCalled();
  });

  it('rejects registration when confirm-password does not match password to catch typos', async () => {
    renderLoginPage();

    fireEvent.click(screen.getByTestId('login-tab-register'));

    const storeInput = screen.getByPlaceholderText(t.landing.storeNamePlaceholder);
    const emailInput = screen.getByPlaceholderText(t.landing.emailPlaceholder);
    const passwordInput = screen.getByPlaceholderText(t.landing.passwordPlaceholder);
    const confirmInput = screen.getByPlaceholderText(t.landing.confirmPasswordPlaceholder);
    const submitBtn = screen.getByTestId('login-register-submit-btn');

    fireEvent.change(storeInput, { target: { value: 'Typo Store' } });
    fireEvent.change(emailInput, { target: { value: 'typo@store.ph' } });
    fireEvent.change(passwordInput, { target: { value: 'SecurePass123' } });
    // Typo in confirm password
    fireEvent.change(confirmInput, { target: { value: 'SecurePass999' } });

    fireEvent.click(submitBtn);

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(t.onboarding.passwordMismatch);
    expect(confirmInput).toHaveAttribute('aria-invalid', 'true');
    expect(passwordInput).toHaveAttribute('aria-invalid', 'false');
    expect(authService.registerStore).not.toHaveBeenCalled();
  });

  it('displays real-time password strength indicator when typing password', async () => {
    renderLoginPage();

    fireEvent.click(screen.getByTestId('login-tab-register'));

    const passwordInput = screen.getByPlaceholderText(t.landing.passwordPlaceholder);
    expect(screen.queryByTestId('login-password-strength-indicator')).not.toBeInTheDocument();

    // Type weak password
    fireEvent.change(passwordInput, { target: { value: 'short' } });
    const indicator = screen.getByTestId('login-password-strength-indicator');
    expect(indicator).toBeInTheDocument();
    expect(indicator).toHaveTextContent(t.landing.passwordStrengthWeak);

    // Type strong password
    fireEvent.change(passwordInput, { target: { value: 'VeryStrongPass123!' } });
    expect(indicator).toHaveTextContent(t.landing.passwordStrengthStrong);
  });

  it('renders Google sign-in button on login tab and handles successful sign-in', async () => {
    const { onNavigate } = renderLoginPage();

    const googleBtn = screen.getByTestId('login-google-btn');
    expect(googleBtn).toBeInTheDocument();
    expect(googleBtn).toHaveTextContent(t.login.continueWithGoogle);

    fireEvent.click(googleBtn);

    await waitFor(() => {
      expect(authService.authenticateWithGoogle).toHaveBeenCalledWith(
        expect.objectContaining({
          accessToken: 'mock-google-access-token'
        })
      );
      expect(useAuthStore.getState().isOnboarded).toBe(true);
      expect(onNavigate).toHaveBeenCalledWith('pos');
    });
  });

  it('renders Google sign-up button on register tab and handles successful registration', async () => {
    const { onNavigate } = renderLoginPage();

    const registerTab = screen.getByTestId('login-tab-register');
    fireEvent.click(registerTab);

    const googleBtn = screen.getByTestId('register-google-btn');
    expect(googleBtn).toBeInTheDocument();
    expect(googleBtn).toHaveTextContent(t.login.signUpWithGoogle);

    const storeInput = screen.getByPlaceholderText(t.landing.storeNamePlaceholder);
    const pinInput = screen.getByPlaceholderText(t.landing.pinPlaceholder);

    fireEvent.change(storeInput, { target: { value: 'Google Sari-Sari Store' } });
    fireEvent.change(pinInput, { target: { value: '4321' } });

    fireEvent.click(googleBtn);

    await waitFor(() => {
      expect(authService.authenticateWithGoogle).toHaveBeenCalledWith(
        expect.objectContaining({
          accessToken: 'mock-google-access-token',
          businessName: 'Google Sari-Sari Store',
          pin: '4321'
        })
      );
      expect(useAuthStore.getState().isOnboarded).toBe(true);
      expect(onNavigate).toHaveBeenCalledWith('pos');
    });
  });

  it('displays error in auth banner when store registration throws an error', async () => {
    vi.spyOn(seedData, 'seedDexieDatabaseIfNeeded').mockRejectedValueOnce(
      new Error('Database quota exceeded')
    );

    renderLoginPage();

    const registerTab = screen.getByTestId('login-tab-register');
    fireEvent.click(registerTab);

    const storeInput = screen.getByPlaceholderText(t.landing.storeNamePlaceholder);
    const emailInput = screen.getByPlaceholderText(t.landing.emailPlaceholder);
    const passwordInput = screen.getByPlaceholderText(t.landing.passwordPlaceholder);
    const confirmInput = screen.getByPlaceholderText(t.landing.confirmPasswordPlaceholder);
    const submitBtn = screen.getByTestId('login-register-submit-btn');

    fireEvent.change(storeInput, { target: { value: 'Quota Store' } });
    fireEvent.change(emailInput, { target: { value: 'quota@store.ph' } });
    fireEvent.change(passwordInput, { target: { value: 'Password123' } });
    fireEvent.change(confirmInput, { target: { value: 'Password123' } });

    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Database quota exceeded');
    });
  });

  it('opens ConfirmUnsyncedLoginDialog when switching tenant with pending sync queue items on PIN login, and preserves localPin on Force Wipe & Login', async () => {
    await db.syncQueue.add({
      id: 'unsynced-item-1',
      entity: 'Sale',
      action: 'Insert',
      payload: {},
      timestamp: new Date().toISOString(),
      status: 'Pending',
      retryCount: 0
    });

    const { onNavigate } = renderLoginPage();

    const toggleBtn = screen.getByTestId('login-toggle-mode-btn');
    fireEvent.click(toggleBtn);

    const emailInput = screen.getByPlaceholderText(t.landing.emailPlaceholder);
    const pinInput = screen.getByPlaceholderText(t.landing.pinPlaceholder);
    const submitBtn = screen.getByTestId('login-submit-btn');

    fireEvent.change(emailInput, { target: { value: 'pin@tindahan.ph' } });
    fireEvent.change(pinInput, { target: { value: '9876' } });

    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByTestId('unsynced-dialog-wipe-btn')).toBeInTheDocument();
      expect(screen.getByTestId('unsynced-dialog-sync-btn')).toBeInTheDocument();
    });

    // Should not have switched tenant yet
    expect(useAuthStore.getState().tenantId).toBe('default-store');

    const wipeBtn = screen.getByTestId('unsynced-dialog-wipe-btn');
    fireEvent.click(wipeBtn);

    await waitFor(() => {
      expect(useAuthStore.getState().tenantId).toBe('login-test-pin-tenant');
      expect(useAuthStore.getState().hasPin).toBe(true);
      expect(useAuthStore.getState().localPinVerifier).toBeTruthy();
      expect(onNavigate).toHaveBeenCalledWith('pos');
    });
  });

  it('opens ConfirmUnsyncedLoginDialog on Google sign-up when sync queue has items, and preserves newUserPreferences and localPin on Sync First', async () => {
    await db.syncQueue.add({
      id: 'unsynced-item-2',
      entity: 'Sale',
      action: 'Insert',
      payload: {},
      timestamp: new Date().toISOString(),
      status: 'Pending',
      retryCount: 0
    });

    vi.mocked(authService.authenticateWithGoogle).mockResolvedValueOnce({
      tenantId: 'google-sync-first-tenant',
      userId: 'google-sync-first-user',
      email: 'googlesync@tindahan.ph',
      businessName: 'Google Super Store',
      ownerName: 'Google Owner',
      phone: '',
      role: 'Owner',
      tier: 'Libre',
      planTier: 'Libre',
      subscriptionEndDate: null,
      hasPin: true,
      token: 'mock-google-token',
      expiresAt: '2028-01-01',
      isNewUser: true
    });

    const { onNavigate } = renderLoginPage();

    const registerTab = screen.getByTestId('login-tab-register');
    fireEvent.click(registerTab);

    const storeInput = screen.getByPlaceholderText(t.landing.storeNamePlaceholder);
    const pinInput = screen.getByPlaceholderText(t.landing.pinPlaceholder);

    fireEvent.change(storeInput, { target: { value: 'Google Super Store' } });
    fireEvent.change(pinInput, { target: { value: '4321' } });

    const googleBtn = screen.getByTestId('register-google-btn');
    fireEvent.click(googleBtn);

    await waitFor(() => {
      expect(screen.getByTestId('unsynced-dialog-sync-btn')).toBeInTheDocument();
    });

    expect(useAuthStore.getState().tenantId).toBe('default-store');

    vi.mocked(syncEngine.processSyncQueue).mockImplementationOnce(async () => {
      await db.syncQueue.clear();
      return { processed: 1, conflicts: 0, errors: 0 };
    });

    const syncBtn = screen.getByTestId('unsynced-dialog-sync-btn');
    fireEvent.click(syncBtn);

    await waitFor(() => {
      expect(syncEngine.processSyncQueue).toHaveBeenCalled();
      expect(useAuthStore.getState().tenantId).toBe('google-sync-first-tenant');
      expect(useAuthStore.getState().hasPin).toBe(true);
      expect(useAuthStore.getState().localPinVerifier).toBeTruthy();
      expect(seedData.seedDexieDatabaseIfNeeded).toHaveBeenCalledWith(
        false,
        'google-sync-first-tenant',
        false,
        'Google Super Store'
      );
      expect(onNavigate).toHaveBeenCalledWith('pos');
    });
  });

  it('prompts to restore account when login returns 409 pendingDeletion and restores on confirmation', async () => {
    vi.mocked(authService.loginStore).mockRejectedValueOnce({
      response: {
        status: 409,
        data: {
          message: 'Your account is deactivated and scheduled for deletion.',
          pendingDeletion: true,
          deletionScheduledAt: '2026-11-20T00:00:00Z'
        }
      }
    });

    const { onNavigate } = renderLoginPage();

    const emailInput = screen.getByPlaceholderText(t.landing.emailPlaceholder);
    const passwordInput = screen.getByPlaceholderText(t.landing.passwordPlaceholder);
    const submitBtn = screen.getByTestId('login-submit-btn');

    fireEvent.change(emailInput, { target: { value: 'owner@tindahan.ph' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(submitBtn);

    const banner = await screen.findByTestId('login-pending-deletion-banner');
    expect(banner).toBeInTheDocument();

    const restoreBtn = screen.getByTestId('login-restore-account-btn');
    fireEvent.click(restoreBtn);

    await waitFor(() => {
      expect(authService.loginStore).toHaveBeenLastCalledWith({
        email: 'owner@tindahan.ph',
        password: 'password123',
        restoreAccount: true
      });
      expect(onNavigate).toHaveBeenCalledWith('pos');
    });
  });

  it('routes to settings after sign-in when web delete-account link is activated', async () => {
    const { onNavigate } = renderLoginPage();

    const webDeleteLink = screen.getByTestId('login-web-delete-link');
    fireEvent.click(webDeleteLink);

    expect(screen.getByTestId('login-delete-intent-banner')).toBeInTheDocument();

    const emailInput = screen.getByPlaceholderText(t.landing.emailPlaceholder);
    const passwordInput = screen.getByPlaceholderText(t.landing.passwordPlaceholder);
    const submitBtn = screen.getByTestId('login-submit-btn');

    fireEvent.change(emailInput, { target: { value: 'owner@tindahan.ph' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(onNavigate).toHaveBeenCalledWith('settings');
    });
  });
});

