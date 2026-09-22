'use client';

import { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser';

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
    const reader = new BrowserMultiFormatReader();
    let controls: IScannerControls | undefined;
    let active = true;

    async function startScanner() {
      try {
        controls = await reader.decodeFromConstraints(
          { video: { facingMode: { ideal: 'environment' } } },
          videoRef.current ?? undefined,
          (result) => {
            if (!result || !active) return;
            active = false;
            controls?.stop();
            onDetectedRef.current(result.getText().trim());
          },
        );
      } catch {
        if (active)
          setError('Camera access is unavailable. Enter the barcode manually or upload an image.');
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
