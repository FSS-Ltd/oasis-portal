'use client';

import { type ReactNode } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CorrectionModalProps {
  children: ReactNode;
  errorMessage?: string | undefined;
  onClose: () => void;
  pending: boolean;
  title: string;
}

export function CorrectionModal({
  children,
  errorMessage,
  onClose,
  pending,
  title,
}: CorrectionModalProps) {
  return (
    <div className="admin-confirmation-backdrop">
      <section aria-modal="true" className="admin-confirmation-dialog" role="dialog">
        <header className="admin-confirmation-dialog__header">
          <div>
            <h2>{title}</h2>
          </div>
          <Button
            aria-label="Close"
            disabled={pending}
            onClick={onClose}
            size="sm"
            type="button"
            variant="ghost"
          >
            <X aria-hidden="true" size={16} />
          </Button>
        </header>
        {errorMessage ? <p className="status--error">{errorMessage}</p> : null}
        {children}
      </section>
    </div>
  );
}
