import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { FluentProvider } from '@fluentui/react-components';
import { QrPhSubscriptionDialog } from './QrPhSubscriptionDialog';
import { sariSariLightTheme } from '../theme/theme';
import { useSubscriptionStore } from '../state/subscriptionStore';
import { useLanguageStore } from '../state/languageStore';

describe('QrPhSubscriptionDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useLanguageStore.setState({ language: 'en' });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllTimers();
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

    // Ensure generateQrPhPayment was NOT called again
    expect(mockGenerate).toHaveBeenCalledTimes(1);
  });
});

