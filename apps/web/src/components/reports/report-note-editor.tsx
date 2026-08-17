'use client';

import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field, TextInput } from '@/components/ui/field';
import type { ReportSpecificNoteDraft, ReportTextEntry } from './report-editor-state';
import { formatDate } from './report-format';

interface ReportNoteEditorProps {
  allowCategory: boolean;
  disabled: boolean;
  emptyLabel: string;
  label: string;
  onChange: (entries: ReportSpecificNoteDraft[]) => void;
  reportEntries: readonly ReportSpecificNoteDraft[];
  sourceEntries: readonly ReportTextEntry[];
}

function SourceEntries({
  emptyLabel,
  entries,
}: {
  emptyLabel: string;
  entries: readonly ReportTextEntry[];
}) {
  if (entries.length === 0) return <div className="empty-state">{emptyLabel}</div>;
  return (
    <div className="report-entry-list">
      {entries.map((entry) => (
        <article className="report-entry report-entry--source" key={entry.id}>
          <span>{formatDate(entry.createdAt)} · Source record</span>
          {entry.category ? <strong>{entry.category}</strong> : null}
          <p>{entry.note ?? 'No note recorded.'}</p>
        </article>
      ))}
    </div>
  );
}

export function ReportNoteEditor({
  allowCategory,
  disabled,
  emptyLabel,
  label,
  onChange,
  reportEntries,
  sourceEntries,
}: ReportNoteEditorProps) {
  function updateEntry(id: string, update: Partial<ReportSpecificNoteDraft>): void {
    onChange(reportEntries.map((entry) => (entry.id === id ? { ...entry, ...update } : entry)));
  }

  return (
    <div className="report-note-editor">
      <SourceEntries emptyLabel={emptyLabel} entries={sourceEntries} />
      {reportEntries.map((entry, index) => {
        const inputId = `report-note-${entry.id}`;
        const isBlank = entry.note.trim().length === 0;
        return (
          <article className="report-note-editor__entry" key={entry.id}>
            <div className="report-note-editor__header">
              <strong>{label} {String(index + 1)}</strong>
              <Button
                disabled={disabled}
                onClick={() => {
                  onChange(reportEntries.filter((candidate) => candidate.id !== entry.id));
                }}
                size="sm"
                type="button"
                variant="ghost"
              >
                <Trash2 aria-hidden="true" size={14} />
                Remove
              </Button>
            </div>
            {allowCategory ? (
              <Field label={`${label} ${String(index + 1)} category`}>
                <TextInput
                  disabled={disabled}
                  maxLength={120}
                  onChange={(event) => {
                    updateEntry(entry.id, { category: event.target.value });
                  }}
                  value={entry.category ?? ''}
                />
              </Field>
            ) : null}
            <Field
              error={isBlank ? 'Enter a note or remove this entry.' : undefined}
              label={`${label} ${String(index + 1)} note`}
            >
              <textarea
                className="input textarea"
                disabled={disabled}
                id={inputId}
                maxLength={5000}
                onChange={(event) => {
                  updateEntry(entry.id, { note: event.target.value });
                }}
                value={entry.note}
              />
            </Field>
          </article>
        );
      })}
      <Button
        disabled={disabled || reportEntries.length >= 50}
        onClick={() => {
          onChange([...reportEntries, { id: crypto.randomUUID(), note: '' }]);
        }}
        size="sm"
        type="button"
        variant="secondary"
      >
        <Plus aria-hidden="true" size={14} />
        Add {label}
      </Button>
    </div>
  );
}
