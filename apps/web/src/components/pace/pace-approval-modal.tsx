'use client';

import { type FormEvent, useState } from 'react';
import { CheckCircle2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';

interface PaceApprovalModalProps {
  errorMessage?: string | undefined;
  onClose: () => void;
  onSave: (input: { notes: string; recordId: string }) => Promise<void>;
  pending: boolean;
  record: {
    id: string;
    paceNumber: number;
    score: number;
    subjectName: string;
  };
}

export function PaceApprovalModal({
  errorMessage,
  onClose,
  onSave,
  pending,
  record,
}: PaceApprovalModalProps) {
  const [notes, setNotes] = useState('');
  const trimmedNotes = notes.trim();

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!trimmedNotes) return;
    await onSave({ recordId: record.id, notes: trimmedNotes });
  }

  return (
    <div aria-modal="true" className="pace-modal-backdrop" role="dialog">
      <form
        className="pace-modal"
        onSubmit={(event) => {
          void submit(event);
        }}
      >
        <header className="pace-modal__header">
          <div>
            <h2>Approve PACE Advance</h2>
            <p>
              {record.subjectName} · PACE #{String(record.paceNumber)} · {String(record.score)}%
            </p>
          </div>
          <Button disabled={pending} onClick={onClose} size="sm" type="button" variant="ghost">
            <X aria-hidden="true" size={16} />
            <span className="sr-only">Close</span>
          </Button>
        </header>

        <div className="pace-modal__body">
          <Field label="Conversation notes">
            <textarea
              aria-label="Supervisor conversation notes"
              className="input textarea"
              maxLength={3000}
              onChange={(event) => {
                setNotes(event.target.value);
              }}
              required
              rows={5}
              value={notes}
            />
          </Field>
          {errorMessage ? <p className="status--error">{errorMessage}</p> : null}
        </div>

        <footer className="pace-modal__footer">
          <Button disabled={pending} onClick={onClose} type="button" variant="secondary">
            Cancel
          </Button>
          <Button disabled={!trimmedNotes} pending={pending} type="submit">
            <CheckCircle2 aria-hidden="true" size={16} />
            Approve advance
          </Button>
        </footer>
      </form>
    </div>
  );
}
