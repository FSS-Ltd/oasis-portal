'use client';

import { useEffect, useRef, useState } from 'react';
import { PackagePlus } from 'lucide-react';
import { friendlyErrorMessage } from '@/lib/notifications';
import { Button } from '@/components/ui/button';
import { PaceCataloguePicker } from './pace-catalogue-picker';

export function PaceInventoryOrderModal({
  availablePaceNumbers,
  currentPaceNumber,
  onClose,
  onSubmit,
  pending,
  studentName,
  subjectLabel,
}: {
  availablePaceNumbers: readonly number[];
  currentPaceNumber: number | null;
  onClose: () => void;
  onSubmit: (paceNumbers: number[]) => Promise<void>;
  pending: boolean;
  studentName: string;
  subjectLabel: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const submittingRef = useRef(false);
  const [paceNumbers, setPaceNumbers] = useState<number[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const hasUnavailableSelection = paceNumbers.some(
    (paceNumber) => !availablePaceNumbers.includes(paceNumber),
  );

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  async function submitOrder(): Promise<void> {
    if (
      paceNumbers.length === 0 ||
      hasUnavailableSelection ||
      currentPaceNumber === null ||
      pending ||
      submittingRef.current
    ) {
      return;
    }
    submittingRef.current = true;
    setSubmitError(null);
    try {
      await onSubmit(paceNumbers);
    } catch (error) {
      setSubmitError(friendlyErrorMessage(error));
    } finally {
      submittingRef.current = false;
    }
  }

  return (
    <dialog
      aria-labelledby="pace-inventory-order-title"
      className="pace-inventory-order-dialog"
      onCancel={(event) => {
        event.preventDefault();
        if (!pending) onClose();
      }}
      ref={dialogRef}
    >
      <form
        className="pace-modal"
        onSubmit={(event) => {
          event.preventDefault();
          void submitOrder();
        }}
      >
        <header className="pace-modal__header">
          <div>
            <h2 id="pace-inventory-order-title">Create PACE order</h2>
            <p>
              {studentName} · {subjectLabel}
            </p>
          </div>
          <Button disabled={pending} onClick={onClose} type="button" variant="secondary">
            Cancel
          </Button>
        </header>
        <div className="pace-modal__body">
          {currentPaceNumber === null ? (
            <p className="status--error" role="alert">
              This subject assignment is no longer available. Close this order and refresh
              inventory.
            </p>
          ) : (
            <>
              <p className="muted">Current PACE #{String(currentPaceNumber)}</p>
              <PaceCataloguePicker
                availablePaceNumbers={availablePaceNumbers}
                currentPaceNumber={currentPaceNumber}
                disabled={pending}
                onChange={setPaceNumbers}
                selectedPaceNumbers={paceNumbers}
                subjectLabel={`${studentName} · ${subjectLabel}`}
              />
            </>
          )}
          {hasUnavailableSelection ? (
            <p className="status--error" role="alert">
              One or more selected PACEs are now supplied or already on order. Update your selection
              to continue.
            </p>
          ) : null}
          {submitError ? (
            <p className="status--error" role="alert">
              {submitError}
            </p>
          ) : null}
        </div>
        <footer className="pace-modal__footer">
          <Button
            disabled={
              pending ||
              currentPaceNumber === null ||
              paceNumbers.length === 0 ||
              hasUnavailableSelection
            }
            pending={pending}
            type="submit"
          >
            <PackagePlus aria-hidden="true" size={16} />
            Create order
          </Button>
        </footer>
      </form>
    </dialog>
  );
}
