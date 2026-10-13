'use client';

import { type FormEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Panel } from '@/components/ui/panel';
import { friendlyErrorMessage, showSuccessToast } from '@/lib/notifications';
import { api } from '@/lib/trpc';
import { formatIncidentDateTime } from './incident-format';

interface IncidentSafeguardingNotesProps {
  canWrite: boolean;
  isDraft: boolean;
  reportId: string;
}

export function IncidentSafeguardingNotes({
  canWrite,
  isDraft,
  reportId,
}: IncidentSafeguardingNotesProps) {
  const [body, setBody] = useState('');
  const notes = api.incident.safeguardingNotes.list.useQuery({ reportId }, { retry: false });
  const utils = api.useUtils();
  const add = api.incident.safeguardingNotes.add.useMutation({
    async onSuccess() {
      setBody('');
      await utils.incident.safeguardingNotes.list.invalidate({ reportId });
      showSuccessToast('Safeguarding note saved.');
    },
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!body.trim() || add.isPending) return;
    add.mutate({ reportId, body });
  }

  return (
    <Panel body className="incident-side-panel incident-lead-notes">
      <h3>Safeguarding Lead notes</h3>
      <p className="muted">Internal notes for the Safeguarding Lead and Head.</p>
      {isDraft ? <p className="muted">Notes can be added after this report is submitted.</p> : null}
      {notes.isLoading ? <p className="muted">Loading notes…</p> : null}
      {notes.error ? (
        <p className="status--error" role="alert">
          {friendlyErrorMessage(notes.error)}
        </p>
      ) : null}
      {notes.data?.length === 0 ? <p className="muted">No notes yet.</p> : null}
      {notes.data && notes.data.length > 0 ? (
        <ol className="incident-lead-notes__list">
          {notes.data.map((note) => (
            <li key={note.id}>
              <div className="incident-lead-notes__meta">
                <strong>{note.authorName}</strong>
                <time dateTime={note.createdAt.toISOString()}>
                  {formatIncidentDateTime(note.createdAt)}
                </time>
              </div>
              <p>{note.body}</p>
            </li>
          ))}
        </ol>
      ) : null}
      {canWrite ? (
        <form className="incident-lead-notes__form" onSubmit={submit}>
          <Field label="Add a note" hint="Visible to the Safeguarding Lead and Head only.">
            <textarea
              className="input textarea"
              disabled={add.isPending}
              maxLength={3000}
              onChange={(event) => {
                setBody(event.target.value);
              }}
              value={body}
            />
          </Field>
          {add.error ? (
            <p className="status--error" role="alert">
              {friendlyErrorMessage(add.error)}
            </p>
          ) : null}
          <Button disabled={!body.trim()} pending={add.isPending} type="submit">
            Save note
          </Button>
        </form>
      ) : null}
    </Panel>
  );
}
