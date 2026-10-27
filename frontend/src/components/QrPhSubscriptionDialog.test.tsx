import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { FluentProvider } from '@fluentui/react-components';
import { QrPhSubscriptionDialog } from './QrPhSubscriptionDialog';
import { sariSariLightTheme } from '../theme/theme';
import { getPendingBillingReference, useSubscriptionStore } from '../state/subscriptionStore';
import { useLanguageStore } from '../state/languageStore';

describe('QrPhSubscriptionDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useLanguageStore.setState({ language: 'en' });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllTimers();
    localStorage.clear();
  });

  const renderDialog = (props: Partial<Parameters<typeof QrPhSubscriptionDialog>[0]> = {}) => {
    const defaultProps = {
      open: true,
      onClose: vi.fn(),
      targetTier: 'TindahanPro' as const,
      cycle: 'Monthly' as const,
      amount: 129.00,
      ...props
    };

    const res = render(
      <FluentProvider theme={sariSariLightTheme}>
        <QrPhSubscriptionDialog {...defaultProps} />
      </FluentProvider>
    );

    return {
      ...res,
      props: defaultProps
    };
  };

  it('renders nothing when open is false', () => {
    renderDialog({ open: false });
    expect(screen.queryByText(/Pay via QR Ph/i)).not.toBeInTheDocument();
  });

  it('generates QR Ph payment and displays amount, plan, and QR code image', async () => {
    const mockGenerate = vi.fn().mockResolvedValue({
      paymentIntentId: 'pi_sub_test_01',
      paymentMethodId: 'pm_sub_test_01',
      clientKey: 'client_001',
      status: 'awaiting_next_action',
      amountCentavos: 12900,
      qrCodeUrl: 'data:image/png;base64,mock_qr_sub',
      orderId: 'sub_test_ref_01',
      createdAt: '2026-10-22T00:00:00Z'
    });
    const mockCheck = vi.fn().mockResolvedValue({
      paymentIntentId: 'pi_sub_test_01',
      status: 'awaiting_next_action',
      isPaid: false,
      amountCentavos: 12900
    });

    useSubscriptionStore.setState({
      generateQrPhPayment: mockGenerate,
      checkQrPhStatus: mockCheck
    });

    renderDialog();

    await waitFor(() => {
      expect(mockGenerate).toHaveBeenCalledWith('TindahanPro', 'Monthly');
    });

    expect(await screen.findByText('₱129.00')).toBeInTheDocument();
    expect(await screen.findByText(/Tindahan Pro \(Monthly\)/i)).toBeInTheDocument();
    expect(await screen.findByText('Ref: sub_test_ref_01')).toBeInTheDocument();

    const img = await screen.findByAltText('QR Ph Subscription Code');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', 'data:image/png;base64,mock_qr_sub');
  });

  it('keeps a pending QR intent when the dialog closes', async () => {
    useSubscriptionStore.setState({
      generateQrPhPayment: vi.fn().mockResolvedValue({
        paymentIntentId: 'pi_abandoned',
        paymentMethodId: 'pm_abandoned',
        qrCodeUrl: 'data:image/png;base64,qr',
        orderId: 'sub_abandoned'
      })
    });
    const onClose = vi.fn();
    renderDialog({ onClose });

    await screen.findByAltText('QR Ph Subscription Code');
    expect(getPendingBillingReference()).toBe('pi_abandoned');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(getPendingBillingReference()).toBe('pi_abandoned');
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('displays error and allows retrying when generation fails', async () => {
    const mockGenerate = vi.fn()
      .mockRejectedValueOnce(new Error('Network error generating QR'))
      .mockResolvedValueOnce({
        paymentIntentId: 'pi_retry_01',
        paymentMethodId: 'pm_retry_01',
        clientKey: 'client_002',
        status: 'awaiting_next_action',
        amountCentavos: 12900,
        qrCodeUrl: 'data:image/png;base64,retry_sub_img',
        orderId: 'sub_retry_ref',
        createdAt: '2026-10-22T00:00:00Z'
      });

    useSubscriptionStore.setState({
      generateQrPhPayment: mockGenerate,
      checkQrPhStatus: vi.fn().mockResolvedValue({ isPaid: false })
    });

    renderDialog();

    expect(await screen.findByText('Network error generating QR')).toBeInTheDocument();
    const retryBtn = screen.getByRole('button', { name: /Try Again/i });
    expect(retryBtn).toBeInTheDocument();

    fireEvent.click(retryBtn);

    expect(await screen.findByAltText('QR Ph Subscription Code')).toBeInTheDocument();
  });

  it('confirms payment and upgrades subscription when status check succeeds', async () => {
    const mockGenerate = vi.fn().mockResolvedValue({
      paymentIntentId: 'pi_paid_sub_01',
      paymentMethodId: 'pm_paid_01',
      clientKey: 'client_003',
      status: 'awaiting_next_action',
      amountCentavos: 12900,
      qrCodeUrl: 'data:image/png;base64,paid_qr',
      orderId: 'sub_paid_ref',
      createdAt: '2026-10-22T00:00:00Z'
    });

    const mockCheck = vi.fn().mockResolvedValue({
      paymentIntentId: 'pi_paid_sub_01',
      status: 'succeeded',
      isPaid: true,
      amountCentavos: 12900,
      paymentId: 'pay_sub_done'
    });

    const mockConfirm = vi.fn().mockResolvedValue(true);
    const onClose = vi.fn();

    useSubscriptionStore.setState({
      generateQrPhPayment: mockGenerate,
      checkQrPhStatus: mockCheck,
      confirmQrPhPayment: mockConfirm
    });

    renderDialog({ onClose });

    const checkBtn = await screen.findByRole('button', { name: /Check Payment Status/i });
    fireEvent.click(checkBtn);

    expect(await screen.findByText(/Store subscription successfully upgraded!/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(mockConfirm).toHaveBeenCalledWith('pi_paid_sub_01', 'TindahanPro', 'Monthly');
    });

    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    }, { timeout: 2500 });
  });

  it('surfaces error and provides retry when confirmQrPhPayment fails after payment is detected', async () => {
    const mockGenerate = vi.fn().mockResolvedValue({
      paymentIntentId: 'pi_fail_sub_01',
      paymentMethodId: 'pm_fail_01',
      clientKey: 'client_005',
      status: 'awaiting_next_action',
      amountCentavos: 12900,
      qrCodeUrl: 'data:image/png;base64,fail_qr',
      orderId: 'sub_fail_ref',
      createdAt: '2026-10-22T00:00:00Z'
    });

    const mockCheck = vi.fn().mockResolvedValue({
      paymentIntentId: 'pi_fail_sub_01',
      status: 'succeeded',
      isPaid: true,
      amountCentavos: 12900,
      paymentId: 'pay_sub_fail'
    });

    const mockConfirm = vi.fn()
      .mockRejectedValueOnce(new Error('Gateway timeout on upgrade'))
      .mockResolvedValueOnce(true);

    const onClose = vi.fn();

    useSubscriptionStore.setState({
      generateQrPhPayment: mockGenerate,
      checkQrPhStatus: mockCheck,
      confirmQrPhPayment: mockConfirm
    });

    renderDialog({ onClose });

    const checkBtn = await screen.findByRole('button', { name: /Check Payment Status/i });
    fireEvent.click(checkBtn);

    // Confirm threw, so dialog should NOT show upgrade success
    expect(await screen.findByText('Gateway timeout on upgrade')).toBeInTheDocument();
    expect(screen.queryByText(/Store subscription successfully upgraded!/i)).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();

    // Clicking Try Again should call confirm again using the same intent, without regenerating QR
    const retryBtn = screen.getByRole('button', { name: /Try Again/i });
    fireEvent.click(retryBtn);

    expect(await screen.findByText(/Store subscription successfully upgraded!/i)).toBeInTheDocument();
    expect(mockGenerate).toHaveBeenCalledTimes(1);
    expect(mockConfirm).toHaveBeenCalledTimes(2);

    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    }, { timeout: 2500 });
  });

  it('does not re-trigger generateQrPhPayment when parent re-renders with a new onClose reference', async () => {
    const mockGenerate = vi.fn().mockResolvedValue({
      paymentIntentId: 'pi_stable_01',
      paymentMethodId: 'pm_stable_01',
      clientKey: 'client_004',
      status: 'awaiting_next_action',
      amountCentavos: 12900,
      qrCodeUrl: 'data:image/png;base64,stable_qr',
      orderId: 'sub_stable_ref',
      createdAt: '2026-10-22T00:00:00Z'
    });

    useSubscriptionStore.setState({
      generateQrPhPayment: mockGenerate,
      checkQrPhStatus: vi.fn().mockResolvedValue({ isPaid: false })
    });

    const { rerender } = render(
      <FluentProvider theme={sariSariLightTheme}>
        <QrPhSubscriptionDialog
          open={true}
          onClose={() => {}}
          targetTier="TindahanPro"
          cycle="Monthly"
          amount={129.00}
        />
      </FluentProvider>
    );

    await waitFor(() => {
      expect(mockGenerate).toHaveBeenCalledTimes(1);
    });

    // Simulate parent re-render with new inline onClose arrow function
    rerender(
      <FluentProvider theme={sariSariLightTheme}>
        <QrPhSubscriptionDialog
          open={true}
          onClose={() => {}}
          targetTier="TindahanPro"
          cycle="Monthly"
          amount={129.00}
        />
      </FluentProvider>
    );

    expect(mockGenerate).toHaveBeenCalledTimes(1);
  });

  it('clears an expired pending QR reference on reopen and generates a fresh QR code', async () => {
    const { setPendingBillingReference } = await import('../state/subscriptionStore');
    setPendingBillingReference('pi_expired_old');

    const mockCheck = vi.fn().mockResolvedValueOnce({
      paymentIntentId: 'pi_expired_old',
      status: 'expired',
      isPaid: false,
      amountCentavos: 12900
    });
    const mockGenerate = vi.fn().mockResolvedValueOnce({
      paymentIntentId: 'pi_fresh_new',
      paymentMethodId: 'pm_fresh_new',
      clientKey: 'ck_fresh',
      status: 'awaiting_next_action',
      amountCentavos: 12900,
      qrCodeUrl: 'data:image/png;base64,fresh_qr',
      orderId: 'sub_fresh_ref',
      createdAt: '2026-10-27T00:00:00Z'
    });

    useSubscriptionStore.setState({
      checkQrPhStatus: mockCheck,
      generateQrPhPayment: mockGenerate
    });

    renderDialog();

    await waitFor(() => {
      expect(mockCheck).toHaveBeenCalledWith('pi_expired_old');
      expect(mockGenerate).toHaveBeenCalledWith('TindahanPro', 'Monthly');
    });

    expect(getPendingBillingReference()).toBe('pi_fresh_new');
  });
});

