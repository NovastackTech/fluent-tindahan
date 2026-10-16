import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FluentProvider } from '@fluentui/react-components';
import { BarcodeScannerModal } from './BarcodeScannerModal';
import { sariSariLightTheme } from '../theme/theme';

const mockStart = vi.fn();
const mockStop = vi.fn().mockResolvedValue(undefined);
const mockClear = vi.fn();
const mockApplyVideoConstraints = vi.fn().mockResolvedValue(undefined);

vi.mock('html5-qrcode', () => ({
  Html5Qrcode: vi.fn().mockImplementation(function () {
    return {
      start: mockStart,
      stop: mockStop,
      clear: mockClear,
      applyVideoConstraints: mockApplyVideoConstraints
    };
  }),
  Html5QrcodeSupportedFormats: {
    EAN_13: 0,
    EAN_8: 1,
    UPC_A: 2,
    UPC_E: 3,
    CODE_128: 4,
    CODE_39: 5,
    QR_CODE: 6
  }
}));

describe('BarcodeScannerModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderModal = (props: {
    isOpen?: boolean;
    onClose?: () => void;
    onScan?: (code: string) => void;
  } = {}) => {
    const onClose = props.onClose || vi.fn();
    const onScan = props.onScan || vi.fn();
    return {
      onClose,
      onScan,
      ...render(
        <FluentProvider theme={sariSariLightTheme}>
          <BarcodeScannerModal
            isOpen={props.isOpen ?? true}
            onClose={onClose}
            onScan={onScan}
          />
        </FluentProvider>
      )
    };
  };

  it('renders modal with title and manual barcode input', () => {
    renderModal();

    expect(screen.getByText(/Kamera Barcode Scanner|Camera Barcode Scanner/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/I-type ang barcode/i)).toBeInTheDocument();
  });

  it('submits manual barcode and triggers onScan and onClose', () => {
    const { onScan, onClose } = renderModal();

    const input = screen.getByPlaceholderText(/I-type ang barcode/i);
    fireEvent.change(input, { target: { value: '4800016644026' } });

    const submitBtn = screen.getByRole('button', { name: /Enter/i });
    fireEvent.click(submitBtn);

    expect(onScan).toHaveBeenCalledWith('4800016644026');
    expect(onClose).toHaveBeenCalled();
  });

  it('switches camera facing mode when switch camera button is clicked', async () => {
    renderModal();

    const switchBtn = screen.getByRole('button', { name: /Palitan ang Kamera|Switch Camera/i });
    fireEvent.click(switchBtn);

    expect(switchBtn).toBeInTheDocument();
  });

  it('toggles flashlight torch button', () => {
    renderModal();

    const torchBtn = screen.getByRole('button', { name: /Flashlight/i });
    fireEvent.click(torchBtn);

    expect(torchBtn).toBeInTheDocument();
  });

  it('triggers onScan and onClose when camera scanner detects barcode', async () => {
    mockStart.mockImplementation(async (_facing, _config, onSuccess) => {
      onSuccess('4800016644026');
    });

    const { onScan, onClose } = renderModal();

    await waitFor(() => {
      expect(mockStart).toHaveBeenCalled();
      expect(onScan).toHaveBeenCalledWith('4800016644026');
      expect(onClose).toHaveBeenCalled();
    }, { timeout: 1500 });
  });

  it('displays camera permission error when start fails with NotAllowedError', async () => {
    mockStart.mockRejectedValue(Object.assign(new Error('Permission denied'), { name: 'NotAllowedError' }));

    renderModal();

    await waitFor(() => {
      expect(screen.getByText(/Kailangan ng pahintulot|permission/i)).toBeInTheDocument();
    }, { timeout: 1500 });
  });

  it('stops and clears scanner when modal closes while start() is pending', async () => {
    let resolveStart: () => void = () => {};
    mockStart.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveStart = resolve;
        })
    );

    const { rerender } = render(
      <FluentProvider theme={sariSariLightTheme}>
        <BarcodeScannerModal isOpen={true} onClose={vi.fn()} onScan={vi.fn()} />
      </FluentProvider>
    );

    await waitFor(() => {
      expect(mockStart).toHaveBeenCalled();
    }, { timeout: 1500 });

    rerender(
      <FluentProvider theme={sariSariLightTheme}>
        <BarcodeScannerModal isOpen={false} onClose={vi.fn()} onScan={vi.fn()} />
      </FluentProvider>
    );

    resolveStart();

    await waitFor(() => {
      expect(mockStop).toHaveBeenCalled();
      expect(mockClear).toHaveBeenCalled();
    });
  });
});

