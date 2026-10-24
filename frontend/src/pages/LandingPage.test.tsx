import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FluentProvider } from '@fluentui/react-components';
import { LandingPage } from './LandingPage';
import { sariSariLightTheme } from '../theme/theme';
import { useAuthStore } from '../state/authStore';
import { useLanguageStore } from '../state/languageStore';
import { translations } from '../i18n/translations';
import * as authService from '../services/authService';
import * as seedData from '../db/seedData';

vi.mock('../services/authService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/authService')>();
  return {
    ...actual,
    registerStore: vi.fn().mockResolvedValue({
      tenantId: 'mock-registered-tenant',
      userId: 'mock-registered-user',
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
      tenantId: 'mock-login-tenant',
      userId: 'mock-login-user',
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
      tenantId: 'mock-pin-tenant',
      userId: 'mock-pin-user',
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

const renderLandingPage = (onNavigate = vi.fn()) => {
  return {
    onNavigate,
    ...render(
      <FluentProvider theme={sariSariLightTheme}>
        <LandingPage onNavigate={onNavigate} />
      </FluentProvider>
    )
  };
};

describe('LandingPage Component', () => {
  const t = translations.tl.landing;

  beforeEach(() => {
    vi.clearAllMocks();
    useLanguageStore.setState({ language: 'tl' });
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

  it('renders hero title, badges, and primary sections', () => {
    renderLandingPage();

    // Check Hero title / badge
    expect(screen.getByText(/Ang Makabagong Kaha at POS ng Sari-Sari Store/i)).toBeInTheDocument();
    expect(screen.getByText(t.heroBadge)).toBeInTheDocument();

    // Check Features section
    expect(screen.getByText(t.featuresTitle)).toBeInTheDocument();

    // Check Calculator section
    expect(screen.getByText(t.calcTitle)).toBeInTheDocument();

    // Check Comparison section
    expect(screen.getByText(t.compareTitle)).toBeInTheDocument();

    // Check Pricing section
    expect(screen.getByText(t.pricingTitle)).toBeInTheDocument();

    // Check Testimonials
    expect(screen.getByText(t.testimonialsTitle)).toBeInTheDocument();

    // Check FAQ
    expect(screen.getByText(t.faqTitle)).toBeInTheDocument();
  });

  it('renders interactive ROI calculator and dynamically updates monthly profit', () => {
    renderLandingPage();

    const salesSlider = screen.getByLabelText(t.calcDailySales);
    expect(salesSlider).toBeInTheDocument();

    // Default daily sales is 3500 -> computed savings displayed
    expect(screen.getByText(t.calcMonthlyProfit)).toBeInTheDocument();

    // Change daily sales slider to 8000
    fireEvent.change(salesSlider, { target: { value: '8000' } });

    // The text displays updated daily sales (₱8,000 / araw)
    expect(screen.getByText(/₱8,000/)).toBeInTheDocument();
  });

  it('handles 1-Click Demo test drive correctly and navigates to POS', async () => {
    const { onNavigate } = renderLandingPage();

    const demoBtn = screen.getByTestId('hero-explore-demo-btn');
    expect(demoBtn).toBeInTheDocument();

    fireEvent.click(demoBtn);

    await waitFor(() => {
      expect(seedData.seedDexieDatabaseIfNeeded).toHaveBeenCalled();
      expect(useAuthStore.getState().isOnboarded).toBe(true);
      expect(onNavigate).toHaveBeenCalledWith('pos');
    });
  });

  it('allows logging in with email and password and navigates to POS', async () => {
    const { onNavigate } = renderLandingPage();

    const emailInput = screen.getByPlaceholderText(t.emailPlaceholder);
    const passwordInput = screen.getByPlaceholderText(t.passwordPlaceholder);
    const submitBtn = screen.getByTestId('landing-login-submit-btn');

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

  it('allows logging in with Quick PIN when switched to PIN mode', async () => {
    const { onNavigate } = renderLandingPage();

    // Click PIN toggle button
    const pinToggleBtn = screen.getByTestId('landing-toggle-pin-btn');
    fireEvent.click(pinToggleBtn);

    const emailInput = screen.getByPlaceholderText(t.emailPlaceholder);
    const pinInput = screen.getByPlaceholderText(t.pinPlaceholder);
    const submitBtn = screen.getByTestId('landing-login-submit-btn');

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

  it('displays error message if login credentials fail', async () => {
    vi.mocked(authService.loginStore).mockRejectedValueOnce({
      response: { data: { message: 'Maling email o password' } }
    });

    renderLandingPage();

    const emailInput = screen.getByPlaceholderText(t.emailPlaceholder);
    const passwordInput = screen.getByPlaceholderText(t.passwordPlaceholder);
    const submitBtn = screen.getByTestId('landing-login-submit-btn');

    fireEvent.change(emailInput, { target: { value: 'wrong@tindahan.ph' } });
    fireEvent.change(passwordInput, { target: { value: 'wrongpass' } });

    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('Maling email o password')).toBeInTheDocument();
    });
  });

  it('allows registering a new store and navigating', async () => {
    const { onNavigate } = renderLandingPage();

    // Switch to Register tab
    const registerTab = screen.getByTestId('tab-register-btn');
    fireEvent.click(registerTab);

    fireEvent.change(screen.getByPlaceholderText(t.storeNamePlaceholder), { target: { value: 'Bagong Tindahan' } });
    fireEvent.change(screen.getByPlaceholderText(t.emailPlaceholder), { target: { value: 'sari@tindahan.ph' } });
    fireEvent.change(screen.getByPlaceholderText(t.passwordPlaceholder), { target: { value: 'secret123' } });
    fireEvent.change(screen.getByPlaceholderText(t.confirmPasswordPlaceholder), { target: { value: 'secret123' } });

    const submitBtn = screen.getByTestId('landing-register-submit-btn');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(authService.registerStore).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'sari@tindahan.ph',
          password: 'secret123',
          businessName: 'Bagong Tindahan'
        })
      );
      expect(onNavigate).toHaveBeenCalledWith('pos');
    });
  });

  it('displays error message when store registration throws an error', async () => {
    vi.spyOn(seedData, 'seedDexieDatabaseIfNeeded').mockRejectedValueOnce(
      new Error('Disk write failed')
    );

    renderLandingPage();

    const registerTab = screen.getByTestId('tab-register-btn');
    fireEvent.click(registerTab);

    fireEvent.change(screen.getByPlaceholderText(t.storeNamePlaceholder), { target: { value: 'Error Store' } });
    fireEvent.change(screen.getByPlaceholderText(t.emailPlaceholder), { target: { value: 'error@store.ph' } });
    fireEvent.change(screen.getByPlaceholderText(t.passwordPlaceholder), { target: { value: 'secret123' } });
    fireEvent.change(screen.getByPlaceholderText(t.confirmPasswordPlaceholder), { target: { value: 'secret123' } });

    const submitBtn = screen.getByTestId('landing-register-submit-btn');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('Disk write failed')).toBeInTheDocument();
    });
  });

  it('renders logged-in banner when store is already authenticated', () => {
    useAuthStore.setState({
      isOnboarded: true,
      businessName: 'Ate Joy Sari-Sari',
      ownerName: 'Ate Joy',
      userEmail: 'atejoy@tindahan.ph'
    });

    const { onNavigate } = renderLandingPage();

    expect(screen.getByText(new RegExp(t.loggedInStatus, 'i'))).toBeInTheDocument();
    expect(screen.getByText(/Ate Joy Sari-Sari/i)).toBeInTheDocument();

    const openPosBtn = screen.getByTestId('landing-authenticated-pos-btn');
    fireEvent.click(openPosBtn);
    expect(onNavigate).toHaveBeenCalledWith('pos');
  });

  it('toggles FAQ accordions when clicked', () => {
    renderLandingPage();

    const faqQuestion = screen.getByText(t.faq1Q);
    expect(faqQuestion).toBeInTheDocument();

    // FAQ 1 answer should be visible (since defaultOpenItems includes faq-1)
    expect(screen.getByText(t.faq1A)).toBeInTheDocument();

    // Toggle FAQ 3
    const faq3Question = screen.getByText(t.faq3Q);
    fireEvent.click(faq3Question);
    expect(screen.getByText(t.faq3A)).toBeInTheDocument();
  });

  it('renders popular badge on Tindahan Pro pricing card', () => {
    renderLandingPage();

    expect(screen.getByText(translations.tl.subscription.popularBadge)).toBeInTheDocument();
  });

  it('renders translated plan prices and toggles between Monthly and Weekly', () => {
    renderLandingPage();

    // Default Monthly pricing: ₱129 for Pro, ₱349 for Plus
    expect(screen.getByText(`₱129 / ${t.perMonth}`)).toBeInTheDocument();
    expect(screen.getByText(`₱349 / ${t.perMonth}`)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.pricingToggleWeekly })).toBeInTheDocument();

    // Toggle to Weekly
    fireEvent.click(screen.getByRole('button', { name: t.pricingToggleWeekly }));
    expect(screen.getByText(`₱35 / ${t.perWeek}`)).toBeInTheDocument();
    expect(screen.getByText(`₱89 / ${t.perWeek}`)).toBeInTheDocument();

    // Toggle back to Monthly
    fireEvent.click(screen.getByRole('button', { name: t.pricingToggleMonthly }));
    expect(screen.getByText(`₱129 / ${t.perMonth}`)).toBeInTheDocument();
    expect(screen.getByText(`₱349 / ${t.perMonth}`)).toBeInTheDocument();
  });

  it('uses English translations for pricing labels and features', () => {
    useLanguageStore.setState({ language: 'en' });
    renderLandingPage();

    const englishLanding = translations.en.landing;
    expect(screen.getByText(`₱129 / ${englishLanding.perMonth}`)).toBeInTheDocument();
    expect(screen.getByText(englishLanding.planFreeFeature1)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: englishLanding.pricingToggleWeekly })).toBeInTheDocument();
  });
});
