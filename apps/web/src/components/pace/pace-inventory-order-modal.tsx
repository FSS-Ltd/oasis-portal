'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { PackagePlus } from 'lucide-react';
import { friendlyErrorMessage } from '@/lib/notifications';
import { Button } from '@/components/ui/button';
import { Field, SelectInput } from '@/components/ui/field';
import { PaceCataloguePicker } from './pace-catalogue-picker';

export interface PaceInventoryOrderSubjectChoice {
  subjectId: string;
  subjectLabel: string;
  currentPaceNumber: number;
  availablePaceNumbers: readonly number[];
}

export function PaceInventoryOrderModal({
  onClose,
  onSubmit,
  pending,
  studentName,
  subjects,
}: {
  onClose: () => void;
  onSubmit: (subjectId: string, paceNumbers: number[]) => Promise<void>;
  pending: boolean;
  studentName: string;
  subjects: readonly PaceInventoryOrderSubjectChoice[];
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const submittingRef = useRef(false);
  const subjectSelectId = `pace-order-subject-${useId()}`;
  const [subjectId, setSubjectId] = useState(subjects[0]?.subjectId ?? '');
  const [paceNumbers, setPaceNumbers] = useState<number[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const subject = subjects.find((choice) => choice.subjectId === subjectId) ?? null;
  const hasUnavailableSelection = paceNumbers.some(
    (paceNumber) => !subject?.availablePaceNumbers.includes(paceNumber),
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

  useEffect(() => {
    setPaceNumbers([]);
    setSubmitError(null);
  }, [subjectId]);

  async function submitOrder(): Promise<void> {
    if (
      !subject ||
      paceNumbers.length === 0 ||
      hasUnavailableSelection ||
      pending ||
      submittingRef.current
    ) {
      return;
    }
    submittingRef.current = true;
    setSubmitError(null);
    try {
      await onSubmit(subject.subjectId, paceNumbers);
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
            <p>{studentName}</p>
          </div>
          <Button disabled={pending} onClick={onClose} type="button" variant="secondary">
            Cancel
          </Button>
        </header>
        <div className="pace-modal__body">
          <Field label="Subject">
            <SelectInput
              aria-label="Order subject"
              disabled={pending || subjects.length === 0}
              id={subjectSelectId}
              onChange={(event) => {
                setSubjectId(event.currentTarget.value);
              }}
              value={subjectId}
            >
              {subjects.length === 0 ? <option value="">No eligible subjects</option> : null}
              {subjectId && !subject ? (
                <option disabled value={subjectId}>
                  Subject no longer available
                </option>
              ) : null}
              {subjects.map((choice) => (
                <option key={choice.subjectId} value={choice.subjectId}>
                  {choice.subjectLabel}
                </option>
              ))}
            </SelectInput>
          </Field>
          {!subject ? (
            <p className="status--error" role="alert">
              {subjectId
                ? 'This subject assignment is no longer available. Close this order and refresh inventory.'
                : 'No subjects need attention for this student now. Close this order and refresh inventory.'}
            </p>
          ) : (
            <>
              <p className="pace-inventory-order__current">
                <span>Current PACE</span>
                <strong>#{String(subject.currentPaceNumber)}</strong>
              </p>
              <PaceCataloguePicker
                availablePaceNumbers={subject.availablePaceNumbers}
                currentPaceNumber={subject.currentPaceNumber}
                disabled={pending}
                onChange={setPaceNumbers}
                selectedPaceNumbers={paceNumbers}
                subjectLabel=""
                title="Choose PACEs to order"
                description="Select the remaining future PACEs you want to order."
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
            disabled={pending || !subject || paceNumbers.length === 0 || hasUnavailableSelection}
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
