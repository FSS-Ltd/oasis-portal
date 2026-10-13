'use client';

import { useState, type FormEvent } from 'react';
import { api } from '@/lib/trpc';
import { friendlyErrorMessage } from '@/lib/notifications';
import { uploadAgreement } from './upload-agreement';

type UploadMode = 'new' | 'replace' | 'assign';

export function HeadUpload({ onComplete }: { onComplete: () => void }) {
  const people = api.userAgreement.people.useQuery(undefined, { retry: false });
  const documents = api.userAgreement.documents.useQuery(undefined, { retry: false });
  const assign = api.userAgreement.assign.useMutation();
  const [mode, setMode] = useState<UploadMode>('new');
  const [selectedDocument, setSelectedDocument] = useState('');
  const [selectedPeople, setSelectedPeople] = useState<string[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<'UserAgreement' | 'SafeguardingDataAnnex'>('UserAgreement');
  const [status, setStatus] = useState<'NeedsSigning' | 'Signed'>('NeedsSigning');
  const [signedOn, setSignedOn] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    if (
      selectedPeople.length === 0 ||
      (mode !== 'new' && !selectedDocument) ||
      (mode !== 'assign' && !file) ||
      (status === 'Signed' && (selectedPeople.length !== 1 || !signedOn))
    ) {
      setError('Complete the document and recipient details before continuing.');
      return;
    }
    setBusy(true);
    try {
      if (mode === 'assign') {
        await assign.mutateAsync({ versionId: selectedDocument, recipientIds: selectedPeople });
      } else if (file) {
        const form = new FormData();
        form.set('file', file);
        form.set('title', title);
        form.set('kind', kind);
        form.set('status', status);
        form.set('recipientIds', JSON.stringify(selectedPeople));
        if (mode === 'replace')
          form.set(
            'agreementId',
            documents.data?.find((doc) => doc.latestVersionId === selectedDocument)?.id ?? '',
          );
        if (status === 'Signed') form.set('signedOn', signedOn);
        await uploadAgreement(form);
      }
      setSelectedPeople([]);
      setFile(null);
      setSuccess(mode === 'assign' ? 'Signing requests created.' : 'Agreement uploaded.');
      onComplete();
      void documents.refetch();
    } catch (cause) {
      setError(friendlyErrorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className="panel agreement-manager__form"
      onSubmit={(event) => {
        void submit(event);
      }}
    >
      <h2>Upload or assign a form</h2>
      <label>
        Action
        <select
          onChange={(event) => {
            setMode(event.target.value as UploadMode);
          }}
          value={mode}
        >
          <option value="new">New form</option>
          <option value="replace">Upload a new version</option>
          <option value="assign">Assign existing version</option>
        </select>
      </label>
      {mode !== 'new' ? (
        <label>
          Existing form
          <select
            onChange={(event) => {
              const doc = documents.data?.find(
                (entry) => entry.latestVersionId === event.target.value,
              );
              setSelectedDocument(event.target.value);
              if (doc) {
                setTitle(doc.title);
                setKind(doc.kind);
              }
            }}
            required
            value={selectedDocument}
          >
            <option value="">Choose a form</option>
            {documents.data
              ?.filter((doc) => doc.latestVersionId)
              .map((doc) => (
                <option key={doc.id} value={doc.latestVersionId ?? ''}>
                  {doc.title} · v{doc.latestVersion}
                </option>
              ))}
          </select>
        </label>
      ) : (
        <>
          <label>
            Form title
            <input
              maxLength={160}
              onChange={(event) => {
                setTitle(event.target.value);
              }}
              required
              value={title}
            />
          </label>
          <label>
            Form type
            <select
              onChange={(event) => {
                setKind(event.target.value as typeof kind);
              }}
              value={kind}
            >
              <option value="UserAgreement">User Agreement</option>
              <option value="SafeguardingDataAnnex">Safeguarding & Data Annex</option>
            </select>
          </label>
        </>
      )}
      {mode !== 'assign' ? (
        <label>
          PDF (10 MB maximum)
          <input
            accept="application/pdf,.pdf"
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
            }}
            required
            type="file"
          />
        </label>
      ) : null}
      <label>
        Recipients
        <select
          multiple
          onChange={(event) => {
            setSelectedPeople(Array.from(event.target.selectedOptions, (option) => option.value));
          }}
          size={Math.min(8, Math.max(3, people.data?.length ?? 3))}
          value={selectedPeople}
        >
          {people.data?.map((person) => (
            <option key={person.id} value={person.id}>
              {person.name} · {person.role}
            </option>
          ))}
        </select>
        <small>Select one or more people. Hold Ctrl or Command to select multiple.</small>
      </label>
      {mode !== 'assign' ? (
        <label>
          Status
          <select
            onChange={(event) => {
              setStatus(event.target.value as typeof status);
            }}
            value={status}
          >
            <option value="NeedsSigning">Needs signing</option>
            <option value="Signed">Already signed (one person)</option>
          </select>
        </label>
      ) : null}
      {mode !== 'assign' && status === 'Signed' ? (
        <label>
          Date signed
          <input
            onChange={(event) => {
              setSignedOn(event.target.value);
            }}
            required
            type="date"
            value={signedOn}
          />
        </label>
      ) : null}
      <button disabled={busy || people.isLoading || (mode !== 'assign' && !file)} type="submit">
        {busy ? 'Saving…' : mode === 'assign' ? 'Send signing request' : 'Save form'}
      </button>
      {error ? <p role="alert">{error}</p> : null}
      {success ? <p role="status">{success}</p> : null}
    </form>
  );
}
