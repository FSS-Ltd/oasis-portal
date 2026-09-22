'use client';

import { useEffect, useRef, useState } from 'react';
import {
  BarcodeFormat,
  BrowserMultiFormatReader,
  type IScannerControls,
} from '@zxing/browser';

const LIBRARY_BARCODE_FORMATS = [
  BarcodeFormat.EAN_13,
  BarcodeFormat.EAN_8,
  BarcodeFormat.UPC_A,
  BarcodeFormat.UPC_E,
  BarcodeFormat.CODE_128,
  BarcodeFormat.CODE_39,
  BarcodeFormat.CODE_93,
  BarcodeFormat.CODABAR,
  BarcodeFormat.ITF,
];

const CAMERA_CONSTRAINTS: MediaStreamConstraints = {
  audio: false,
  video: {
    facingMode: { ideal: 'environment' },
    height: { ideal: 1080 },
    width: { ideal: 1920 },
  },
};

function cameraErrorMessage(error: unknown): string {
  if (error instanceof DOMException && error.name === 'NotAllowedError') {
    return 'Camera access was denied. Allow camera access, then try again or enter the barcode manually.';
  }
  if (error instanceof DOMException && error.name === 'NotFoundError') {
    return 'No camera is available on this device. Enter the barcode manually or upload an image.';
  }
  return 'Camera access is unavailable. Enter the barcode manually or upload an image.';
}

export function LibraryBarcodeScanner({
  onClose,
  onDetected,
}: {
  onClose: () => void;
  onDetected: (barcode: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const onDetectedRef = useRef(onDetected);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    onDetectedRef.current = onDetected;
  }, [onDetected]);

  useEffect(() => {
    const reader = new BrowserMultiFormatReader(undefined, {
      delayBetweenScanAttempts: 100,
      delayBetweenScanSuccess: 150,
    });
    reader.possibleFormats = LIBRARY_BARCODE_FORMATS;
    let controls: IScannerControls | undefined;
    let active = true;

    async function startScanner() {
      try {
        controls = await reader.decodeFromConstraints(
          CAMERA_CONSTRAINTS,
          videoRef.current ?? undefined,
          (result, _scanError, scannerControls) => {
            if (!result || !active) return;
            active = false;
            scannerControls.stop();
            onDetectedRef.current(result.getText().trim());
          },
        );
      } catch (error) {
        if (active) setError(cameraErrorMessage(error));
      }
    }

    void startScanner();
    return () => {
      active = false;
      controls?.stop();
    };
  }, []);

  return (
    <div
      aria-labelledby="library-scanner-title"
      aria-modal="true"
      className="library-scanner"
      role="dialog"
    >
      <div className="library-scanner__panel">
        <div className="library-scanner__header">
          <div>
            <p className="eyebrow">Library circulation</p>
            <h2 id="library-scanner-title">Scan a book barcode</h2>
          </div>
          <button
            aria-label="Close barcode scanner"
            className="button button--secondary button--sm"
            onClick={onClose}
            type="button"
          >
            Close
          </button>
        </div>
        {error ? (
          <p className="status--error" role="alert">
            {error}
          </p>
        ) : (
          <>
            <div className="library-scanner__preview">
              <video
                aria-label="Live barcode camera preview"
                autoPlay
                muted
                playsInline
                ref={videoRef}
              />
              <span aria-hidden="true" className="library-scanner__frame" />
            </div>
            <p className="muted">
              Hold the barcode inside the frame. Oasis uses the camera only to read the barcode.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
