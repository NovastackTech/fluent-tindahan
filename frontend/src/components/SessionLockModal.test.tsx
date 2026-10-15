import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FluentProvider } from '@fluentui/react-components';
import { SessionLockModal } from './SessionLockModal';
import { sariSariLightTheme } from '../theme/theme';
import { useAuthStore } from '../state/authStore';
import { useLanguageStore } from '../state/languageStore';
import * as authService from '../services/authService';

vi.mock('../services/authService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/authService')>();
  return {
    ...actual,
    loginPin: vi.fn(),
    loginStore: vi.fn(),
    computeLocalPinHash: vi.fn(),
    verifyLocalPin: vi.fn()
  };
});

describe('SessionLockModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    useLanguageStore.setState({ language: 'tl' });
    useAuthStore.getState().resetOfflinePinFailures();
    useAuthStore.setState({
      tenantId: 'test-tenant-123',
      userId: 'test-user-456',
      userEmail: 'owner@tindahan.ph',
      businessName: "Aling Nena's Store",
      hasPin: true,
      isSessionLocked: true,
      localPinVerifier: null
    });
  });

  const renderModal = () => {
    return render(
      <FluentProvider theme={sariSariLightTheme}>
        <SessionLockModal />
      </FluentProvider>
    );
  };

  it('does not render when isSessionLocked is false', () => {
    useAuthStore.setState({ isSessionLocked: false });
    renderModal();

    expect(screen.queryByText(/Naka-lock ang Kaha|Till Screen Locked/i)).not.toBeInTheDocument();
  });

  it('does not render when hasPin is false', () => {
    useAuthStore.setState({ hasPin: false });
    renderModal();

    expect(screen.queryByText(/Naka-lock ang Kaha|Till Screen Locked/i)).not.toBeInTheDocument();
  });

  it('renders modal with business name and PIN keypad when locked', () => {
    renderModal();

    expect(screen.getByText(/Naka-lock ang Kaha/i)).toBeInTheDocument();
    expect(screen.getByText(/Aling Nena's Store • owner@tindahan\.ph/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /I-unlock ang Kaha/i })).toBeInTheDocument();
  });

  it('unlocks session via offline localPinVerifier match', async () => {
    useAuthStore.setState({ localPinVerifier: 'pbkdf2:v1:100000:salt:hash' });
    vi.mocked(authService.verifyLocalPin).mockResolvedValue(true);

    renderModal();

    // Type PIN "1234" via numeric keypad buttons
    fireEvent.click(screen.getByRole('button', { name: '1' }));
    fireEvent.click(screen.getByRole('button', { name: '2' }));
    fireEvent.click(screen.getByRole('button', { name: '3' }));
    fireEvent.click(screen.getByRole('button', { name: '4' }));

    const unlockBtn = screen.getByRole('button', { name: /I-unlock ang Kaha/i });
    fireEvent.click(unlockBtn);

    await waitFor(() => {
      expect(authService.verifyLocalPin).toHaveBeenCalledWith('1234', 'pbkdf2:v1:100000:salt:hash', 'test-tenant-123');
      expect(useAuthStore.getState().isSessionLocked).toBe(false);
      expect(useAuthStore.getState().offlineFailedPinAttempts).toBe(0);
    });
  });

  it('unlocks session via online loginPin when offline verifier does not match', async () => {
    useAuthStore.setState({ localPinVerifier: 'different-hash' });
    vi.mocked(authService.verifyLocalPin).mockResolvedValue(false);
    vi.mocked(authService.loginPin).mockResolvedValue({
      token: 'jwt-token-online',
      tenantId: 'test-tenant-123',
      userId: 'test-user-456',
      email: 'owner@tindahan.ph',
      businessName: "Aling Nena's Store",
      ownerName: 'Nena Santos',
      phone: '09171234567',
      role: 'Owner',
      tier: 'Libre',
      planTier: 'Libre',
      subscriptionEndDate: null,
      hasPin: true,
      expiresAt: '2030-01-01T00:00:00Z'
    });

    renderModal();

    fireEvent.click(screen.getByRole('button', { name: '1' }));
    fireEvent.click(screen.getByRole('button', { name: '2' }));
    fireEvent.click(screen.getByRole('button', { name: '3' }));
    fireEvent.click(screen.getByRole('button', { name: '4' }));

    const unlockBtn = screen.getByRole('button', { name: /I-unlock ang Kaha/i });
    fireEvent.click(unlockBtn);

    await waitFor(() => {
      expect(authService.loginPin).toHaveBeenCalledWith({
        email: 'owner@tindahan.ph',
        pin: '1234'
      });
      expect(useAuthStore.getState().isSessionLocked).toBe(false);
    });
  });

  it('locks out offline after 5 consecutive failed PIN attempts and disables keypad', async () => {
    useAuthStore.setState({ localPinVerifier: 'pbkdf2:v1:100000:salt:hash' });
    vi.mocked(authService.verifyLocalPin).mockResolvedValue(false);
    vi.mocked(authService.loginPin).mockRejectedValue(new Error('Network offline'));

    renderModal();

    const unlockBtn = screen.getByRole('button', { name: /I-unlock ang Kaha/i });

    // Fail 5 times
    for (let attempt = 1; attempt <= 5; attempt++) {
      fireEvent.click(screen.getByRole('button', { name: '9' }));
      fireEvent.click(screen.getByRole('button', { name: '9' }));
      fireEvent.click(screen.getByRole('button', { name: '9' }));
      fireEvent.click(screen.getByRole('button', { name: '9' }));
      fireEvent.click(unlockBtn);
      await waitFor(() => {
        expect(useAuthStore.getState().offlineFailedPinAttempts).toBe(attempt);
      });
    }

    await waitFor(() => {
      expect(useAuthStore.getState().offlineFailedPinAttempts).toBe(5);
      expect(useAuthStore.getState().isOfflinePinLockedOut()).toBe(true);
      expect(screen.getByText(/Naka-lockout ang PIN nang \d+ minuto|PIN locked for \d+ minutes/i)).toBeInTheDocument();
      // Keypad button 1 should now be disabled
      expect(screen.getByRole('button', { name: '1' })).toBeDisabled();
    });
  });

  it('allows unlocking with master password even when PIN is locked out', async () => {
    // Start in locked-out state
    useAuthStore.getState().recordOfflinePinFailure();
    useAuthStore.getState().recordOfflinePinFailure();
    useAuthStore.getState().recordOfflinePinFailure();
    useAuthStore.getState().recordOfflinePinFailure();
    useAuthStore.getState().recordOfflinePinFailure();
    expect(useAuthStore.getState().isOfflinePinLockedOut()).toBe(true);

    vi.mocked(authService.loginStore).mockResolvedValue({
      token: 'jwt-token-password',
      tenantId: 'test-tenant-123',
      userId: 'test-user-456',
      email: 'owner@tindahan.ph',
      businessName: "Aling Nena's Store",
      ownerName: 'Nena Santos',
      phone: '09171234567',
      role: 'Owner',
      tier: 'Libre',
      planTier: 'Libre',
      subscriptionEndDate: null,
      hasPin: true,
      expiresAt: '2030-01-01T00:00:00Z'
    });

    renderModal();

    expect(screen.getByText(/Naka-lockout ang PIN nang \d+ minuto|PIN locked for \d+ minutes/i)).toBeInTheDocument();

    // Switch to password mode
    fireEvent.click(screen.getByRole('button', { name: /Gamit ang Password|Use Password/i }));

    const passInput = screen.getByLabelText(/Password/i);
    fireEvent.change(passInput, { target: { value: 'MasterPassword123!' } });

    const unlockBtn = screen.getByRole('button', { name: /I-unlock ang Kaha/i });
    fireEvent.click(unlockBtn);

    await waitFor(() => {
      expect(authService.loginStore).toHaveBeenCalledWith({
        email: 'owner@tindahan.ph',
        password: 'MasterPassword123!'
      });
      expect(useAuthStore.getState().isSessionLocked).toBe(false);
      expect(useAuthStore.getState().isOfflinePinLockedOut()).toBe(false);
    });
  });

  it('unlocks session using password mode fallback', async () => {
    vi.mocked(authService.loginStore).mockResolvedValue({
      token: 'jwt-token-password',
      tenantId: 'test-tenant-123',
      userId: 'test-user-456',
      email: 'owner@tindahan.ph',
      businessName: "Aling Nena's Store",
      ownerName: 'Nena Santos',
      phone: '09171234567',
      role: 'Owner',
      tier: 'Libre',
      planTier: 'Libre',
      subscriptionEndDate: null,
      hasPin: true,
      expiresAt: '2030-01-01T00:00:00Z'
    });

    renderModal();

    // Switch to password mode
    const switchModeBtn = screen.getByRole('button', { name: /Gamit ang Password|Use Password/i });
    fireEvent.click(switchModeBtn);

    const passInput = screen.getByLabelText(/Password/i);
    fireEvent.change(passInput, { target: { value: 'CorrectPassword123!' } });

    const unlockBtn = screen.getByRole('button', { name: /I-unlock ang Kaha/i });
    fireEvent.click(unlockBtn);

    await waitFor(() => {
      expect(authService.loginStore).toHaveBeenCalledWith({
        email: 'owner@tindahan.ph',
        password: 'CorrectPassword123!'
      });
      expect(useAuthStore.getState().isSessionLocked).toBe(false);
    });
  });

  it('displays lockout error when API returns 429 lockout status', async () => {
    vi.mocked(authService.loginPin).mockRejectedValue({
      response: {
        status: 429,
        data: { message: 'Masyadong maraming maling pagsubok. Naka-lockout nang 15 minuto.' }
      }
    });

    renderModal();

    fireEvent.click(screen.getByRole('button', { name: '9' }));
    fireEvent.click(screen.getByRole('button', { name: '9' }));
    fireEvent.click(screen.getByRole('button', { name: '9' }));
    fireEvent.click(screen.getByRole('button', { name: '9' }));

    const unlockBtn = screen.getByRole('button', { name: /I-unlock ang Kaha/i });
    fireEvent.click(unlockBtn);

    await waitFor(() => {
      expect(screen.getByText(/Naka-lockout nang 15 minuto/i)).toBeInTheDocument();
      expect(useAuthStore.getState().isSessionLocked).toBe(true);
    });
  });
});
