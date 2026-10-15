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
    computeLocalPinHash: vi.fn()
  };
});

describe('SessionLockModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useLanguageStore.setState({ language: 'tl' });
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

  it('unlocks session via offline localPinVerifier SHA-256 match', async () => {
    useAuthStore.setState({ localPinVerifier: 'hashed-verifier-1234' });
    vi.mocked(authService.computeLocalPinHash).mockResolvedValue('hashed-verifier-1234');

    renderModal();

    // Type PIN "1234" via numeric keypad buttons
    fireEvent.click(screen.getByRole('button', { name: '1' }));
    fireEvent.click(screen.getByRole('button', { name: '2' }));
    fireEvent.click(screen.getByRole('button', { name: '3' }));
    fireEvent.click(screen.getByRole('button', { name: '4' }));

    const unlockBtn = screen.getByRole('button', { name: /I-unlock ang Kaha/i });
    fireEvent.click(unlockBtn);

    await waitFor(() => {
      expect(authService.computeLocalPinHash).toHaveBeenCalledWith('1234', 'test-tenant-123');
      expect(useAuthStore.getState().isSessionLocked).toBe(false);
    });
  });

  it('unlocks session via online loginPin when offline verifier does not match', async () => {
    useAuthStore.setState({ localPinVerifier: 'different-hash' });
    vi.mocked(authService.computeLocalPinHash).mockResolvedValue('computed-mismatch');
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
