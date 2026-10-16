import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FluentProvider } from '@fluentui/react-components';
import { OnboardingModal } from './OnboardingModal';
import { sariSariLightTheme } from '../theme/theme';
import { DEMO_BUSINESS_NAME, DEMO_OWNER, DEMO_PHONE, useAuthStore } from '../state/authStore';
import { useSubscriptionStore } from '../state/subscriptionStore';
import { calculateGCashFee, DEFAULT_GCASH_FEE_TIERS, useGCashFeeStore } from '../state/gcashFeeStore';
import { db } from '../db/db';
import * as authService from '../services/authService';

vi.mock('../services/authService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/authService')>();
  return {
    ...actual,
    registerStore: vi.fn().mockResolvedValue({
      tenantId: 'mock-registered-tenant',
      userId: 'mock-registered-user',
      email: 'test@tindahan.ph',
      businessName: 'Mock Store',
      ownerName: 'Owner',
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
      email: 'login@tindahan.ph',
      businessName: 'Login Store',
      ownerName: 'Owner',
      phone: '09171234567',
      role: 'Owner',
      tier: 'Libre',
      planTier: 'Libre',
      subscriptionEndDate: null,
      hasPin: false,
      token: 'mock-login-token',
      expiresAt: '2028-01-01'
    }),
    loginPin: vi.fn().mockResolvedValue({
      tenantId: 'mock-login-tenant',
      userId: 'mock-login-user',
      email: 'pin@tindahan.ph',
      businessName: 'Pin Store',
      ownerName: 'Owner',
      phone: '09171234567',
      role: 'Owner',
      tier: 'Libre',
      planTier: 'Libre',
      subscriptionEndDate: null,
      hasPin: true,
      token: 'mock-pin-token',
      expiresAt: '2028-01-01'
    }),
    updateProfile: vi.fn().mockImplementation((payload) => Promise.resolve({
      tenantId: useAuthStore.getState().tenantId,
      userId: useAuthStore.getState().userId,
      email: payload.email || useAuthStore.getState().userEmail,
      businessName: payload.businessName,
      ownerName: payload.ownerName || '',
      phone: payload.phone || '',
      role: 'Owner',
      tier: 'Libre',
      planTier: 'Libre',
      subscriptionEndDate: null,
      hasPin: false,
      token: 'mock-token',
      expiresAt: '2028-01-01'
    }))
  };
});

describe('OnboardingModal', () => {
  beforeEach(async () => {
    localStorage.clear();
    await db.tenants.clear();
    await db.products.clear();
    useGCashFeeStore.setState({ feesByTenant: {} });
    useAuthStore.setState({
      consentAccepted: true,
      isOnboarded: false,
      isOnboardingStatusReady: true,
      isOnboardingOpen: true,
      onboardingMode: 'initial',
      businessName: DEMO_BUSINESS_NAME,
      ownerName: DEMO_OWNER,
      userPhone: DEMO_PHONE,
      userEmail: ''
    });
    useSubscriptionStore.setState({
      tier: 'Libre',
      subscriptionEndDate: null,
      isActive: false,
      daysRemaining: null
    });
    vi.clearAllMocks();
  });

  const renderModal = () => {
    return render(
      <FluentProvider theme={sariSariLightTheme}>
        <OnboardingModal />
      </FluentProvider>
    );
  };

  const fillRegistrationCredentials = (email = 'test.owner@gmail.com', password = 'Password123!', pin = '') => {
    const emailInput = screen.getByPlaceholderText(/Hal. nena.store@gmail.com|e.g. nena.store@gmail.com/i);
    fireEvent.change(emailInput, { target: { value: email } });
    const passwordInput = screen.getByPlaceholderText(/Minimum 6 characters/i);
    fireEvent.change(passwordInput, { target: { value: password } });
    if (pin) {
      const pinInput = screen.getByPlaceholderText(/4 hanggang 6 na numero|4 to 6 digits/i);
      fireEvent.change(pinInput, { target: { value: pin } });
    }
  };

  it('does not render if consent has not been accepted', () => {
    useAuthStore.setState({ consentAccepted: false, isOnboarded: false, isOnboardingOpen: true });
    renderModal();

    expect(screen.queryByText(/Maligayang Pagdating sa Fluent Tindahan/i)).not.toBeInTheDocument();
  });

  it('does not render if isOnboardingOpen is false, even when not onboarded (logout session)', () => {
    useAuthStore.setState({ consentAccepted: true, isOnboarded: false, isOnboardingOpen: false });
    renderModal();

    expect(screen.queryByText(/Maligayang Pagdating sa Fluent Tindahan/i)).not.toBeInTheDocument();
  });

  it('renders initial onboarding modal with tabs when consent is accepted and isOnboardingOpen is true', () => {
    renderModal();

    expect(screen.getByText(/Maligayang Pagdating sa Fluent Tindahan/i)).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Bagong Tindahan|New Store/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Mag-login|Log In/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Simulan ang Aking Tindahan|Launch My Store/i })).toBeInTheDocument();
  });

  it('displays validation error if store name is empty upon submission', async () => {
    renderModal();
    fillRegistrationCredentials();

    const submitBtn = screen.getByRole('button', { name: /Simulan ang Aking Tindahan|Launch My Store/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/Kailangan ang pangalan ng tindahan/i)).toBeInTheDocument();
    });
    expect(useAuthStore.getState().isOnboarded).toBe(false);
  });

  it('displays validation error if email address is missing or invalid', async () => {
    renderModal();

    const storeInput = screen.getByPlaceholderText(/Hal. Tindahan ni Aling Maria|e.g. Maria's Sari-Sari Store/i);
    fireEvent.change(storeInput, { target: { value: 'Tindahan ni Maria' } });

    const passwordInput = screen.getByPlaceholderText(/Minimum 6 characters/i);
    fireEvent.change(passwordInput, { target: { value: 'Password123!' } });

    const submitBtn = screen.getByRole('button', { name: /Simulan ang Aking Tindahan|Launch My Store/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/Kailangan ang wastong email address|Valid email address is required/i)).toBeInTheDocument();
    });

    const emailInput = screen.getByPlaceholderText(/Hal. nena.store@gmail.com|e.g. nena.store@gmail.com/i);
    fireEvent.change(emailInput, { target: { value: 'invalid-email' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/Maling format ng email address|Invalid email address format/i)).toBeInTheDocument();
    });
    expect(useAuthStore.getState().isOnboarded).toBe(false);
  });

  it('displays validation error if password is less than 6 characters', async () => {
    renderModal();

    const storeInput = screen.getByPlaceholderText(/Hal. Tindahan ni Aling Maria|e.g. Maria's Sari-Sari Store/i);
    fireEvent.change(storeInput, { target: { value: 'Tindahan ni Maria' } });

    fillRegistrationCredentials('test@example.com', '12345');

    const submitBtn = screen.getByRole('button', { name: /Simulan ang Aking Tindahan|Launch My Store/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/Dapat mayroong 6 o higit pang characters|Password must be at least 6 characters/i)).toBeInTheDocument();
    });
  });

  it('displays validation error if phone number format is invalid', async () => {
    renderModal();

    const storeInput = screen.getByPlaceholderText(/Hal. Tindahan ni Aling Maria|e.g. Maria's Sari-Sari Store/i);
    fireEvent.change(storeInput, { target: { value: 'Tindahan ni Maria' } });
    fillRegistrationCredentials();

    const phoneInput = screen.getByPlaceholderText(/09171234567/i);
    fireEvent.change(phoneInput, { target: { value: '12345' } });

    const submitBtn = screen.getByRole('button', { name: /Simulan ang Aking Tindahan|Launch My Store/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/Dapat ay wastong 11-digit Philippine mobile number/i)).toBeInTheDocument();
    });
    expect(useAuthStore.getState().isOnboarded).toBe(false);
  });

  it('successfully completes onboarding and updates authStore with email and custom profile', async () => {
    useAuthStore.setState({ tier: 'TindahanPro', subscriptionEndDate: '2030-01-01T00:00:00.000Z' });
    useSubscriptionStore.setState({
      tier: 'TindahanPro',
      subscriptionEndDate: '2030-01-01T00:00:00.000Z',
      isActive: true,
      daysRemaining: 30
    });
    const refreshSpy = vi.spyOn(useSubscriptionStore.getState(), 'refreshSubscription').mockResolvedValue();

    renderModal();

    const storeInput = screen.getByPlaceholderText(/Hal. Tindahan ni Aling Maria|e.g. Maria's Sari-Sari Store/i);
    fireEvent.change(storeInput, { target: { value: 'Maria Sari-Sari Store' } });
    fillRegistrationCredentials('maria@gmail.com', 'Secret123!', '1234');

    const ownerInput = screen.getByPlaceholderText(/Hal. Maria Santos|e.g. Maria Santos/i);
    fireEvent.change(ownerInput, { target: { value: 'Maria Santos' } });

    const phoneInput = screen.getByPlaceholderText(/09171234567/i);
    fireEvent.change(phoneInput, { target: { value: '09181234567' } });

    const submitBtn = screen.getByRole('button', { name: /Simulan ang Aking Tindahan|Launch My Store/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(refreshSpy).toHaveBeenCalledOnce();
      expect(useAuthStore.getState().isOnboarded).toBe(true);
      expect(useAuthStore.getState().businessName).toBe('Maria Sari-Sari Store');
      expect(useAuthStore.getState().ownerName).toBe('Maria Santos');
      expect(useAuthStore.getState().userPhone).toBe('09181234567');
      expect(useAuthStore.getState().userEmail).toBe('maria@gmail.com');
      expect(useAuthStore.getState().tier).toBe('Libre');
      expect(useAuthStore.getState().subscriptionEndDate).toBeNull();
      expect(useSubscriptionStore.getState().tier).toBe('Libre');
      expect(useSubscriptionStore.getState().isActive).toBe(false);
    });

    const tenantId = useAuthStore.getState().tenantId;
    expect(tenantId).toBeDefined();
    const localTenant = await db.tenants.get(tenantId);
    expect(localTenant).toBeDefined();
    expect(localTenant?.businessName).toBe('Maria Sari-Sari Store');
    expect(useGCashFeeStore.getState().feesByTenant[tenantId]).toEqual(DEFAULT_GCASH_FEE_TIERS);
    refreshSpy.mockRestore();
  });

  it('completes onboarding with a blank catalog when selected', async () => {
    renderModal();
    fireEvent.change(
      screen.getByPlaceholderText(/Hal. Tindahan ni Aling Maria|e.g. Maria's Sari-Sari Store/i),
      { target: { value: 'Blank Catalog Store' } }
    );
    fillRegistrationCredentials();
    fireEvent.click(screen.getByRole('radio', { name: /Start with Blank Store|Magsimula sa Malinis na Tindahan/i }));
    fireEvent.click(screen.getByRole('button', { name: /Simulan ang Aking Tindahan|Launch My Store/i }));

    await waitFor(() => expect(useAuthStore.getState().isOnboarded).toBe(true));

    const tenantId = useAuthStore.getState().tenantId;
    expect(await db.tenants.get(tenantId)).toMatchObject({
      id: tenantId,
      businessName: 'Blank Catalog Store'
    });
    expect(await db.products.where('tenantId').equals(tenantId).count()).toBe(0);
  });

  it('sets zero GCash fees when the option is unchecked', async () => {
    renderModal();
    fireEvent.change(
      screen.getByPlaceholderText(/Hal. Tindahan ni Aling Maria|e.g. Maria's Sari-Sari Store/i),
      { target: { value: 'No GCash Store' } }
    );
    fillRegistrationCredentials();
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: /Simulan ang Aking Tindahan|Launch My Store/i }));

    await waitFor(() => expect(useAuthStore.getState().isOnboarded).toBe(true));

    const tenantId = useAuthStore.getState().tenantId;
    const fees = useGCashFeeStore.getState().feesByTenant[tenantId];
    expect(fees).toEqual(DEFAULT_GCASH_FEE_TIERS.map(() => 0));
    expect(calculateGCashFee(500, fees)).toBe(0);
    expect(calculateGCashFee(6000, fees)).toBe(0);
  });

  it('completes onboarding with empty optional owner and phone fields', async () => {
    renderModal();
    fireEvent.change(
      screen.getByPlaceholderText(/Hal. Tindahan ni Aling Maria|e.g. Maria's Sari-Sari Store/i),
      { target: { value: 'Tindahan ni Maria' } }
    );
    fillRegistrationCredentials();
    fireEvent.click(screen.getByRole('button', { name: /Simulan ang Aking Tindahan|Launch My Store/i }));

    await waitFor(() => expect(useAuthStore.getState().isOnboarded).toBe(true));
    expect(useAuthStore.getState().ownerName).toBe('');
    expect(useAuthStore.getState().userPhone).toBe('');
  });

  it('switches between Register and Login tabs and logs in with password', async () => {
    renderModal();

    // Click Login Tab
    const loginTab = screen.getByRole('tab', { name: /Mag-login|Log In/i });
    fireEvent.click(loginTab);

    expect(screen.getByText(/Ipasok ang iyong email at password o PIN/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Pumasok sa Tindahan|Log In to Store/i })).toBeInTheDocument();

    const emailInput = screen.getByPlaceholderText(/Hal. nena.store@gmail.com|e.g. nena.store@gmail.com/i);
    fireEvent.change(emailInput, { target: { value: 'suki@tindahan.ph' } });

    const passwordInput = screen.getByPlaceholderText(/Minimum 6 characters/i);
    fireEvent.change(passwordInput, { target: { value: 'Password123!' } });

    const loginBtn = screen.getByRole('button', { name: /Pumasok sa Tindahan|Log In to Store/i });
    fireEvent.click(loginBtn);

    await waitFor(() => {
      expect(authService.loginStore).toHaveBeenCalledWith({
        email: 'suki@tindahan.ph',
        password: 'Password123!'
      });
      expect(useAuthStore.getState().isOnboarded).toBe(true);
    });
  });

  it('allows logging in with Quick PIN', async () => {
    renderModal();

    // Switch to Login Tab
    fireEvent.click(screen.getByRole('tab', { name: /Mag-login|Log In/i }));

    // Switch mode to PIN
    const pinRadio = screen.getByRole('radio', { name: /Gamit ang Quick PIN|Use Quick PIN/i });
    fireEvent.click(pinRadio);

    const emailInput = screen.getByPlaceholderText(/Hal. nena.store@gmail.com|e.g. nena.store@gmail.com/i);
    fireEvent.change(emailInput, { target: { value: 'pin.owner@tindahan.ph' } });

    const pinInput = screen.getByPlaceholderText(/4 hanggang 6 na numero|4 to 6 digits/i);
    fireEvent.change(pinInput, { target: { value: '4321' } });

    const loginBtn = screen.getByRole('button', { name: /Pumasok sa Tindahan|Log In to Store/i });
    fireEvent.click(loginBtn);

    await waitFor(() => {
      expect(authService.loginPin).toHaveBeenCalledWith({
        email: 'pin.owner@tindahan.ph',
        pin: '4321'
      });
      expect(useAuthStore.getState().isOnboarded).toBe(true);
    });
  });

  it('renders in edit mode and allows updating store profile without re-seeding', async () => {
    const tenantId = crypto.randomUUID();
    useAuthStore.setState({
      tenantId,
      isOnboarded: true,
      isOnboardingOpen: true,
      onboardingMode: 'edit',
      businessName: 'Original Store',
      ownerName: 'Juan Dela Cruz',
      userPhone: '09191234567',
      userEmail: 'owner@tindahan.ph'
    });
    await db.tenants.put({
      id: tenantId,
      businessName: 'Original Store',
      tier: 'Libre',
      updatedAt: '2026-01-01T00:00:00.000Z'
    });

    renderModal();

    expect(screen.getByText(/I-edit ang Profile ng Tindahan|Edit Store Profile/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Kanselahin|Cancel/i })).toBeInTheDocument();

    const storeInput = screen.getByPlaceholderText(/Hal. Tindahan ni Aling Maria|e.g. Maria's Sari-Sari Store/i);
    expect((storeInput as HTMLInputElement).value).toBe('Original Store');

    fireEvent.change(storeInput, { target: { value: 'Updated Store Name' } });

    const saveBtn = screen.getByRole('button', { name: /I-save ang Profile|Save Profile/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(useAuthStore.getState().businessName).toBe('Updated Store Name');
      expect(useAuthStore.getState().isOnboardingOpen).toBe(false);
    });
    expect(authService.updateProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        businessName: 'Updated Store Name',
        ownerName: 'Juan Dela Cruz',
        email: 'owner@tindahan.ph'
      })
    );
    expect(await db.tenants.get(tenantId)).toMatchObject({
      id: tenantId,
      businessName: 'Updated Store Name'
    });
  });

  it('allows clearing owner and phone in edit mode', async () => {
    useAuthStore.setState({
      isOnboarded: true,
      isOnboardingOpen: true,
      onboardingMode: 'edit',
      businessName: 'Original Store',
      ownerName: 'Juan Dela Cruz',
      userPhone: '09191234567',
      userEmail: 'owner@tindahan.ph'
    });

    renderModal();
    fireEvent.change(
      screen.getByPlaceholderText(/Hal. Maria Santos|e.g. Maria Santos/i),
      { target: { value: '' } }
    );
    fireEvent.change(
      screen.getByPlaceholderText(/Hal. 09171234567|e.g. 09171234567/i),
      { target: { value: '' } }
    );
    fireEvent.click(screen.getByRole('button', { name: /I-save ang Profile|Save Profile/i }));

    await waitFor(() => expect(useAuthStore.getState().isOnboardingOpen).toBe(false));
    expect(authService.updateProfile).toHaveBeenCalled();
    expect(useAuthStore.getState().ownerName).toBe('');
    expect(useAuthStore.getState().userPhone).toBe('');
  });

  it('displays error when updateProfile returns 409 email conflict in edit mode', async () => {
    vi.mocked(authService.updateProfile).mockRejectedValueOnce({
      response: {
        status: 409,
        data: { message: 'May account nang nakarehistro gamit ang email na ito.' }
      }
    });

    useAuthStore.setState({
      isOnboarded: true,
      isOnboardingOpen: true,
      onboardingMode: 'edit',
      businessName: 'Original Store',
      userEmail: 'duplicate@tindahan.ph'
    });

    renderModal();
    fireEvent.click(screen.getByRole('button', { name: /I-save ang Profile|Save Profile/i }));

    await waitFor(() => {
      expect(
        screen.getByText('May account nang nakarehistro gamit ang email na ito.')
      ).toBeInTheDocument();
    });
    expect(useAuthStore.getState().isOnboardingOpen).toBe(true);
  });

  it('falls back gracefully to local store update on network failure in edit mode', async () => {
    vi.mocked(authService.updateProfile).mockRejectedValueOnce(new Error('Network error'));

    const tenantId = crypto.randomUUID();
    useAuthStore.setState({
      tenantId,
      isOnboarded: true,
      isOnboardingOpen: true,
      onboardingMode: 'edit',
      businessName: 'Original Store',
      userEmail: 'offline@tindahan.ph'
    });

    renderModal();
    const storeInput = screen.getByPlaceholderText(/Hal. Tindahan ni Aling Maria|e.g. Maria's Sari-Sari Store/i);
    fireEvent.change(storeInput, { target: { value: 'Offline Store Update' } });
    fireEvent.click(screen.getByRole('button', { name: /I-save ang Profile|Save Profile/i }));

    await waitFor(() => {
      expect(useAuthStore.getState().isOnboardingOpen).toBe(false);
      expect(useAuthStore.getState().businessName).toBe('Offline Store Update');
    });
  });
});
