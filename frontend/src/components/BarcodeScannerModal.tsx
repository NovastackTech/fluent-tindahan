import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  makeStyles,
  tokens,
  shorthands,
  Dialog,
  DialogSurface,
  DialogTitle,
  DialogBody,
  DialogContent,
  DialogActions,
  Button,
  Text,
  Input,
  Spinner,
  Badge
} from '@fluentui/react-components';
import {
  DismissRegular,
  FlashlightRegular,
  FlashlightOffRegular,
  CameraSwitchRegular,
  BarcodeScannerRegular,
  CheckmarkRegular,
  WarningRegular
} from '@fluentui/react-icons';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { playScanBeep } from '../utils/sound';
import { useTranslation } from '../state/languageStore';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (scannedCode: string) => void;
  title?: string;
}

const useStyles = makeStyles({
  surface: {
    maxWidth: '460px',
    width: '92%',
    ...shorthands.padding(tokens.spacingVerticalM),
    backgroundColor: tokens.colorNeutralBackground1,
    ...shorthands.borderRadius(tokens.borderRadiusLarge)
  },
  scannerContainer: {
    position: 'relative',
    width: '100%',
    minHeight: '280px',
    backgroundColor: '#000',
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  readerBox: {
    width: '100%',
    height: '100%',
    '& video': {
      width: '100% !important',
      height: 'auto !important',
      borderRadius: tokens.borderRadiusMedium,
      objectFit: 'cover'
    }
  },
  overlayGuide: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: '240px',
    height: '140px',
    ...shorthands.border('2px', 'dashed', '#00E676'),
    ...shorthands.borderRadius('12px'),
    pointerEvents: 'none',
    boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.45)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10
  },
  scanLaser: {
    position: 'absolute',
    width: '90%',
    height: '2px',
    backgroundColor: '#FF1744',
    boxShadow: '0 0 8px #FF1744',
    animationName: 'laserMove',
    animationDuration: '2s',
    animationIterationCount: 'infinite',
    animationTimingFunction: 'ease-in-out'
  },
  controlsRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: tokens.spacingVerticalS,
    gap: tokens.spacingHorizontalS
  },
  manualInputRow: {
    display: 'flex',
    gap: tokens.spacingHorizontalS,
    marginTop: tokens.spacingVerticalM
  },
  errorBox: {
    ...shorthands.padding(tokens.spacingVerticalM, tokens.spacingHorizontalM),
    backgroundColor: '#FFEBEE',
    color: '#C62828',
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: tokens.spacingVerticalS
  }
});

const SCANNER_ELEMENT_ID = 'fluent-tindahan-barcode-reader';

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  onScan,
  title
}) => {
  const styles = useStyles();
  const { t } = useTranslation();

  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [manualCode, setManualCode] = useState('');

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const isScanningRef = useRef(false);

  const stopScanner = useCallback(async () => {
    if (html5QrCodeRef.current && isScanningRef.current) {
      try {
        await html5QrCodeRef.current.stop();
        html5QrCodeRef.current.clear();
      } catch {
        // Stop error can be safely ignored on teardown
      }
      isScanningRef.current = false;
      html5QrCodeRef.current = null;
    }
  }, []);

  const handleBarcodeDetected = useCallback((code: string) => {
    const cleanCode = code.trim();
    if (!cleanCode) return;

    playScanBeep();
    stopScanner();
    onScan(cleanCode);
    onClose();
  }, [onClose, onScan, stopScanner]);

  const startScanner = useCallback(async () => {
    try {
      if (html5QrCodeRef.current) {
        await stopScanner();
      }

      const qrCode = new Html5Qrcode(SCANNER_ELEMENT_ID);
      html5QrCodeRef.current = qrCode;

      const config = {
        fps: 20,
        qrbox: { width: 250, height: 150 },
        aspectRatio: 1.333,
        formatsToSupport: [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.QR_CODE
        ]
      };

      await qrCode.start(
        { facingMode: facingMode },
        config,
        (decodedText) => {
          // Detected!
          handleBarcodeDetected(decodedText);
        },
        () => {
          // Frame parsed with no barcode - safe to ignore
        }
      );

      isScanningRef.current = true;
      setIsLoading(false);
    } catch (err: any) {
      console.warn('Failed to start camera barcode scanner:', err);
      setIsLoading(false);
      setErrorMessage(
        err?.name === 'NotAllowedError'
          ? t.barcode.cameraPermissionDenied
          : t.barcode.cameraError
      );
    }
  }, [facingMode, handleBarcodeDetected, stopScanner, t.barcode.cameraError, t.barcode.cameraPermissionDenied]);

  useEffect(() => {
    if (!isOpen) {
      stopScanner();
      return;
    }

    let isMounted = true;

    // Timeout gives DOM dialog time to render scanner container element
    const timer = setTimeout(() => {
      if (!isMounted) return;

      setIsLoading(true);
      setErrorMessage(null);

      const element = document.getElementById(SCANNER_ELEMENT_ID);
      if (!element) {
        setIsLoading(false);
        return;
      }

      startScanner();
    }, 300);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      stopScanner();
    };
  }, [isOpen, facingMode, startScanner, stopScanner]);

  const toggleTorch = async () => {
    if (!html5QrCodeRef.current || !isScanningRef.current) return;
    try {
      // Html5Qrcode applyVideoConstraints support
      const nextState = !isTorchOn;
      await html5QrCodeRef.current.applyVideoConstraints({
        advanced: [{ torch: nextState } as any]
      });
      setIsTorchOn(nextState);
    } catch (e) {
      console.warn('Flashlight/torch not supported on this device track:', e);
    }
  };

  const switchCamera = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim()) {
      handleBarcodeDetected(manualCode.trim());
      setManualCode('');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(_, data) => !data.open && onClose()}>
      <DialogSurface className={styles.surface}>
        <DialogBody>
          <DialogTitle
            action={
              <Button
                appearance="subtle"
                aria-label="Close"
                icon={<DismissRegular />}
                onClick={onClose}
              />
            }
          >
            {title || t.barcode.scannerTitle}
          </DialogTitle>

          <DialogContent style={{ marginTop: tokens.spacingVerticalS }}>
            <Text size={200} style={{ color: tokens.colorNeutralForeground3, display: 'block', marginBottom: tokens.spacingVerticalS }}>
              {t.barcode.scannerDesc}
            </Text>

            {/* Viewfinder Window */}
            <div className={styles.scannerContainer}>
              <div id={SCANNER_ELEMENT_ID} className={styles.readerBox} />

              {!errorMessage && !isLoading && (
                <div className={styles.overlayGuide}>
                  <div className={styles.scanLaser} />
                  <Badge appearance="filled" color="success" size="small" style={{ position: 'absolute', bottom: '-26px' }}>
                    {t.barcode.scanPrompt}
                  </Badge>
                </div>
              )}

              {isLoading && (
                <div style={{ position: 'absolute', zIndex: 20 }}>
                  <Spinner label="Opening Camera..." size="medium" />
                </div>
              )}

              {errorMessage && (
                <div className={styles.errorBox}>
                  <WarningRegular style={{ fontSize: '32px' }} />
                  <Text weight="semibold" size={300}>
                    {errorMessage}
                  </Text>
                  <Text size={200}>
                    Maaari ring i-type ang barcode nang mano-mano sa ibaba:
                  </Text>
                </div>
              )}
            </div>

            {/* Quick Camera Controls */}
            {!errorMessage && (
              <div className={styles.controlsRow}>
                <Button
                  size="small"
                  appearance="subtle"
                  icon={isTorchOn ? <FlashlightOffRegular /> : <FlashlightRegular />}
                  onClick={toggleTorch}
                >
                  {t.barcode.flashlight} {isTorchOn ? 'ON' : 'OFF'}
                </Button>

                <Button
                  size="small"
                  appearance="subtle"
                  icon={<CameraSwitchRegular />}
                  onClick={switchCamera}
                >
                  {t.barcode.switchCamera}
                </Button>
              </div>
            )}

            {/* Fallback Manual Barcode Input */}
            <form onSubmit={handleManualSubmit} className={styles.manualInputRow}>
              <Input
                style={{ flex: 1 }}
                placeholder="I-type ang barcode dito..."
                value={manualCode}
                onChange={(_, data) => setManualCode(data.value)}
                contentBefore={<BarcodeScannerRegular />}
              />
              <Button
                appearance="primary"
                type="submit"
                icon={<CheckmarkRegular />}
                disabled={!manualCode.trim()}
              >
                Enter
              </Button>
            </form>
          </DialogContent>

          <DialogActions style={{ marginTop: tokens.spacingVerticalM }}>
            <Button appearance="secondary" onClick={onClose}>
              {t.common.close}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
};
