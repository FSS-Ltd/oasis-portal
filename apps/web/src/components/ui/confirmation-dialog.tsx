'use client';

import type { FormEvent, ReactNode } from 'react';
import { useId } from 'react';
import { X } from 'lucide-react';
import { Button } from './button';
import { Field, TextInput } from './field';

interface ConfirmationDialogProps {
  body: ReactNode;
  confirmLabel: string;
  confirmation: string;
  expectedConfirmation: string;
  onCancel: () => void;
  onConfirm: () => void;
  onConfirmationChange: (value: string) => void;
  pending?: boolean;
  title: string;
  errorMessage?: string | undefined;
}

export function ConfirmationDialog({
  body,
  confirmLabel,
  confirmation,
  expectedConfirmation,
  errorMessage,
  onCancel,
  onConfirm,
  onConfirmationChange,
  pending = false,
  title,
}: ConfirmationDialogProps) {
  const titleId = useId();
  const confirmed = confirmation === expectedConfirmation;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!confirmed || pending) return;
    onConfirm();
  }

  return (
    <div
      aria-labelledby={titleId}
      aria-modal="true"
      className="confirmation-dialog-backdrop"
      role="dialog"
    >
      <form className="confirmation-dialog" onSubmit={submit}>
        <header className="confirmation-dialog__header">
          <div>
            <h2 id={titleId}>{title}</h2>
          </div>
          <Button onClick={onCancel} size="sm" type="button" variant="ghost">
            <X aria-hidden="true" size={16} />
            <span className="sr-only">Close</span>
          </Button>
        </header>
        <div className="confirmation-dialog__body">
          <div className="confirmation-dialog__copy">{body}</div>
          <Field hint={`Type ${expectedConfirmation} to confirm.`} label="Confirmation">
            <TextInput
              autoComplete="off"
              onChange={(event) => {
                onConfirmationChange(event.target.value);
              }}
              value={confirmation}
            />
          </Field>
          {errorMessage ? (
            <p className="status--error" role="alert">
              {errorMessage}
            </p>
          ) : null}
        </div>
        <footer className="confirmation-dialog__footer">
          <Button disabled={pending} onClick={onCancel} type="button" variant="secondary">
            Cancel
          </Button>
          <Button disabled={!confirmed} pending={pending} type="submit" variant="danger">
            {confirmLabel}
          </Button>
        </footer>
      </form>
    </div>
  );
}
