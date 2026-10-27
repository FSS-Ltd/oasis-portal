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

export interface PaceInventoryOrderRequest {
  subjectId: string;
  paceNumbers: number[];
}

/** Thrown when some subjects were ordered before one failed, so the modal keeps only the rest. */
export class PartialOrderError extends Error {
  readonly completedSubjectIds: readonly string[];

  constructor(completedSubjectIds: readonly string[], message: string) {
    super(message);
    this.name = 'PartialOrderError';
    this.completedSubjectIds = completedSubjectIds;
  }
}

function subjectOptionLabel(
  choice: PaceInventoryOrderSubjectChoice,
  selectedCount: number,
): string {
  return selectedCount > 0
    ? `${choice.subjectLabel} (${String(selectedCount)} selected)`
    : choice.subjectLabel;
}

export function PaceInventoryOrderModal({
  onClose,
  onSubmit,
  pending,
  studentName,
  subjects,
}: {
  onClose: () => void;
  onSubmit: (orders: PaceInventoryOrderRequest[]) => Promise<void>;
  pending: boolean;
  studentName: string;
  subjects: readonly PaceInventoryOrderSubjectChoice[];
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const submittingRef = useRef(false);
  const subjectSelectId = `pace-order-subject-${useId()}`;
  const [subjectId, setSubjectId] = useState(subjects[0]?.subjectId ?? '');
  // Picks are kept per subject so a student's subjects can be ordered in one go.
  const [selections, setSelections] = useState<Record<string, number[]>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const subject = subjects.find((choice) => choice.subjectId === subjectId) ?? null;
  const paceNumbers = selections[subjectId] ?? [];
  const orders: PaceInventoryOrderRequest[] = subjects.flatMap((choice) => {
    const picked = selections[choice.subjectId] ?? [];
    return picked.length > 0 ? [{ subjectId: choice.subjectId, paceNumbers: picked }] : [];
  });
  const unavailableSubjects = subjects.filter((choice) =>
    (selections[choice.subjectId] ?? []).some(
      (paceNumber) => !choice.availablePaceNumbers.includes(paceNumber),
    ),
  );
  const hasUnavailableSelection = unavailableSubjects.length > 0;
  const totalPaces = orders.reduce((total, order) => total + order.paceNumbers.length, 0);
  const submitLabel =
    orders.length > 1
      ? `Order ${String(totalPaces)} PACEs for ${String(orders.length)} subjects`
      : 'Create order';

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
    if (orders.length === 0 || hasUnavailableSelection || pending || submittingRef.current) {
      return;
    }
    submittingRef.current = true;
    setSubmitError(null);
    try {
      await onSubmit(orders);
    } catch (error) {
      if (error instanceof PartialOrderError) {
        // Drop what was ordered and keep the rest, so the user can retry just the failed subjects.
        const done = new Set(error.completedSubjectIds);
        const remaining = orders.filter((order) => !done.has(order.subjectId));
        setSelections(
          Object.fromEntries(remaining.map((order) => [order.subjectId, order.paceNumbers])),
        );
        if (remaining[0]) setSubjectId(remaining[0].subjectId);
      }
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
                setSubmitError(null);
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
                  {subjectOptionLabel(choice, (selections[choice.subjectId] ?? []).length)}
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
                onChange={(next) => {
                  setSelections((current) => ({ ...current, [subjectId]: next }));
                }}
                selectedPaceNumbers={paceNumbers}
                subjectLabel=""
                title="Choose PACEs to order"
                description="Select the remaining future PACEs you want to order."
              />
            </>
          )}
          {hasUnavailableSelection ? (
            <p className="status--error" role="alert">
              Some selected PACEs are now supplied or already on order (
              {unavailableSubjects.map((choice) => choice.subjectLabel).join(', ')}). Update your
              selection to continue.
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
            disabled={pending || orders.length === 0 || hasUnavailableSelection}
            pending={pending}
            type="submit"
          >
            <PackagePlus aria-hidden="true" size={16} />
            {submitLabel}
          </Button>
        </footer>
      </form>
    </dialog>
  );
}
