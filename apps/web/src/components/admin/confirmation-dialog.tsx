'use client';

import type { ReactNode } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ConfirmationDialogProps {
  cancelLabel?: string;
  children?: ReactNode;
  confirmLabel: string;
  errorMessage?: string | null | undefined;
  onCancel: () => void;
  onConfirm: () => void;
  open: boolean;
  pending?: boolean;
  title: string;
  variant?: 'danger' | 'primary';
}

export function ConfirmationDialog({
  cancelLabel = 'Cancel',
  children,
  confirmLabel,
  errorMessage,
  onCancel,
  onConfirm,
  open,
  pending = false,
  title,
  variant = 'danger',
}: ConfirmationDialogProps) {
  if (!open) return null;

  return (
    <div className="admin-confirmation-backdrop">
      <section
        aria-labelledby="admin-confirmation-title"
        aria-modal="true"
        className="admin-confirmation-dialog"
        role="dialog"
      >
        <header className="admin-confirmation-dialog__header">
          <span
            className={`admin-confirmation-dialog__icon admin-confirmation-dialog__icon--${variant}`}
          >
            <AlertTriangle aria-hidden="true" size={18} />
          </span>
          <div>
            <h2 id="admin-confirmation-title">{title}</h2>
            {children ? <div className="admin-confirmation-dialog__copy">{children}</div> : null}
          </div>
          <Button
            aria-label={cancelLabel}
            disabled={pending}
            onClick={onCancel}
            size="sm"
            type="button"
            variant="ghost"
          >
            <X aria-hidden="true" size={16} />
          </Button>
        </header>
        {errorMessage ? (
          <p className="status--error" role="alert">
            {errorMessage}
          </p>
        ) : null}
        <footer className="admin-confirmation-dialog__footer">
          <Button disabled={pending} onClick={onCancel} type="button" variant="secondary">
            {cancelLabel}
          </Button>
          <Button
            onClick={onConfirm}
            pending={pending}
            type="button"
            variant={variant === 'danger' ? 'danger' : 'primary'}
          >
            {confirmLabel}
          </Button>
        </footer>
      </section>
    </div>
  );
}
