import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FluentProvider } from '@fluentui/react-components';
import { OnboardingModal } from './OnboardingModal';
import { sariSariLightTheme } from '../theme/theme';
import { DEMO_BUSINESS_NAME, DEMO_OWNER, DEMO_PHONE, useAuthStore } from '../state/authStore';
import { useSubscriptionStore } from '../state/subscriptionStore';
import { db } from '../db/db';

describe('OnboardingModal', () => {
  beforeEach(async () => {
    localStorage.clear();
    await db.tenants.clear();
    await db.products.clear();
    await db.products.clear();
    useAuthStore.setState({
      consentAccepted: true,
      isOnboarded: false,
      isOnboardingStatusReady: true,
      isOnboardingOpen: false,
      onboardingMode: 'initial',
      businessName: DEMO_BUSINESS_NAME,
      ownerName: DEMO_OWNER,
      userPhone: DEMO_PHONE
    });
    useSubscriptionStore.setState({
      tier: 'Libre',
      subscriptionEndDate: null,
      isActive: false,
      daysRemaining: null
    });
  });

  const renderModal = () => {
    return render(
      <FluentProvider theme={sariSariLightTheme}>
        <OnboardingModal />
      </FluentProvider>
    );
  };

  it('does not render if consent has not been accepted', () => {
    useAuthStore.setState({ consentAccepted: false, isOnboarded: false });
    renderModal();

    expect(screen.queryByText(/Maligayang Pagdating sa Fluent Tindahan/i)).not.toBeInTheDocument();
  });

  it('renders initial onboarding modal when consent is accepted and user is not onboarded', () => {
    renderModal();

    expect(screen.getByText(/Maligayang Pagdating sa Fluent Tindahan/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Simulan ang Aking Tindahan|Launch My Store/i })).toBeInTheDocument();
  });

  it('displays validation error if store name is empty upon submission', async () => {
    renderModal();

    const submitBtn = screen.getByRole('button', { name: /Simulan ang Aking Tindahan|Launch My Store/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/Kailangan ang pangalan ng tindahan/i)).toBeInTheDocument();
    });
    expect(useAuthStore.getState().isOnboarded).toBe(false);
  });

  it('displays validation error if phone number format is invalid', async () => {
    renderModal();

    const storeInput = screen.getByPlaceholderText(/Hal. Tindahan ni Aling Maria|e.g. Maria's Sari-Sari Store/i);
    fireEvent.change(storeInput, { target: { value: 'Tindahan ni Maria' } });

    const phoneInput = screen.getByPlaceholderText(/09171234567/i);
    fireEvent.change(phoneInput, { target: { value: '12345' } });

    const submitBtn = screen.getByRole('button', { name: /Simulan ang Aking Tindahan|Launch My Store/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/Dapat ay wastong 11-digit Philippine mobile number/i)).toBeInTheDocument();
    });
    expect(useAuthStore.getState().isOnboarded).toBe(false);
  });

  it('successfully completes onboarding and updates authStore with custom profile and new tenantId', async () => {
    useAuthStore.setState({ tier: 'TindahanPro', subscriptionEndDate: '2030-01-01T00:00:00.000Z' });
    useSubscriptionStore.setState({
      tier: 'TindahanPro',
      subscriptionEndDate: '2030-01-01T00:00:00.000Z',
      isActive: true,
      daysRemaining: 30
    });

    renderModal();

    const storeInput = screen.getByPlaceholderText(/Hal. Tindahan ni Aling Maria|e.g. Maria's Sari-Sari Store/i);
    fireEvent.change(storeInput, { target: { value: 'Maria Sari-Sari Store' } });

    const ownerInput = screen.getByPlaceholderText(/Hal. Maria Santos|e.g. Maria Santos/i);
    fireEvent.change(ownerInput, { target: { value: 'Maria Santos' } });

    const phoneInput = screen.getByPlaceholderText(/09171234567/i);
    fireEvent.change(phoneInput, { target: { value: '09181234567' } });

    const submitBtn = screen.getByRole('button', { name: /Simulan ang Aking Tindahan|Launch My Store/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(useAuthStore.getState().isOnboarded).toBe(true);
      expect(useAuthStore.getState().businessName).toBe('Maria Sari-Sari Store');
      expect(useAuthStore.getState().ownerName).toBe('Maria Santos');
      expect(useAuthStore.getState().userPhone).toBe('09181234567');
      expect(useAuthStore.getState().tier).toBe('TindahanPro');
      expect(useAuthStore.getState().subscriptionEndDate).toBe('2030-01-01T00:00:00.000Z');
      expect(useSubscriptionStore.getState().tier).toBe('TindahanPro');
      expect(useSubscriptionStore.getState().isActive).toBe(true);
    });

    const tenantId = useAuthStore.getState().tenantId;
    expect(tenantId).toBeDefined();
    const localTenant = await db.tenants.get(tenantId);
    expect(localTenant).toBeDefined();
    expect(localTenant?.businessName).toBe('Maria Sari-Sari Store');
  });

  it('completes onboarding with empty optional owner and phone fields', async () => {
    renderModal();
    fireEvent.change(
      screen.getByPlaceholderText(/Hal. Tindahan ni Aling Maria|e.g. Maria's Sari-Sari Store/i),
      { target: { value: 'Tindahan ni Maria' } }
    );
    fireEvent.click(screen.getByRole('button', { name: /Simulan ang Aking Tindahan|Launch My Store/i }));

    await waitFor(() => expect(useAuthStore.getState().isOnboarded).toBe(true));
    expect(useAuthStore.getState().ownerName).toBe('');
    expect(useAuthStore.getState().userPhone).toBe('');
  });

  it('does not duplicate the starter catalog when the form is submitted twice immediately', async () => {
    renderModal();
    fireEvent.change(
      screen.getByPlaceholderText(/Hal. Tindahan ni Aling Maria|e.g. Maria's Sari-Sari Store/i),
      { target: { value: 'Double Submit Store' } }
    );
    const form = document.getElementById('onboarding-form');
    expect(form).not.toBeNull();

    fireEvent.submit(form!);
    fireEvent.submit(form!);

    await waitFor(() => expect(useAuthStore.getState().isOnboarded).toBe(true));
    const tenantId = useAuthStore.getState().tenantId;
    expect(await db.products.where('tenantId').equals(tenantId).count()).toBe(50);
  });

  it('keeps onboarding open and retryable when catalog seeding fails', async () => {
    const originalTenantId = useAuthStore.getState().tenantId;
    const bulkPutSpy = vi.spyOn(db.products, 'bulkPut').mockRejectedValueOnce(new Error('QuotaExceededError'));
    renderModal();

    fireEvent.change(
      screen.getByPlaceholderText(/Hal. Tindahan ni Aling Maria|e.g. Maria's Sari-Sari Store/i),
      { target: { value: 'Tindahan ni Maria' } }
    );
    fireEvent.click(screen.getByRole('button', { name: /Simulan ang Aking Tindahan|Launch My Store/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/Hindi na-save ang setup ng tindahan|Store setup could not be saved/i);
    expect(useAuthStore.getState().isOnboarded).toBe(false);
    expect(useAuthStore.getState().tenantId).toBe(originalTenantId);
    expect(await db.products.count()).toBe(0);
    expect(await db.tenants.count()).toBe(0);
    expect(screen.getByRole('button', { name: /Simulan ang Aking Tindahan|Launch My Store/i })).toBeEnabled();

    bulkPutSpy.mockRestore();
    fireEvent.click(screen.getByRole('button', { name: /Simulan ang Aking Tindahan|Launch My Store/i }));

    await waitFor(() => expect(useAuthStore.getState().isOnboarded).toBe(true));
    expect(await db.products.count()).toBe(50);
  });

  it('renders in edit mode and allows updating store profile without re-seeding', async () => {
    useAuthStore.setState({
      isOnboarded: true,
      isOnboardingOpen: true,
      onboardingMode: 'edit',
      businessName: 'Original Store',
      ownerName: 'Juan Dela Cruz',
      userPhone: '09191234567'
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

  });

  it('allows clearing owner and phone in edit mode', async () => {
    useAuthStore.setState({
      isOnboarded: true,
      isOnboardingOpen: true,
      onboardingMode: 'edit',
      businessName: 'Original Store',
      ownerName: 'Juan Dela Cruz',
      userPhone: '09191234567'
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
    expect(useAuthStore.getState().ownerName).toBe('');
    expect(useAuthStore.getState().userPhone).toBe('');
  });
});
