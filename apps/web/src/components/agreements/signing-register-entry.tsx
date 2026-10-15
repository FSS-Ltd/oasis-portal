'use client';

import { useState, type FormEvent } from 'react';
import { api, type RouterOutputs } from '@/lib/trpc';
import { friendlyErrorMessage } from '@/lib/notifications';
import { uploadAgreement } from './upload-agreement';

type RegisterRow = RouterOutputs['userAgreement']['register']['rows'][number];

export function RegisterEntry({ row, onChange }: { row: RegisterRow; onChange: () => void }) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [signedOn, setSignedOn] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [manualUrl, setManualUrl] = useState<string | null>(null);
  const open = api.userAgreement.open.useMutation();
  const retry = api.userAgreement.retryEmail.useMutation();
  const manual = api.userAgreement.download.useQuery(
    { requestId: row.id, copy: 'manual' },
    { enabled: false, retry: false },
  );
  async function showPdf() {
    try {
      setPdfUrl((await open.mutateAsync({ requestId: row.id })).url);
    } catch (cause) {
      setError(friendlyErrorMessage(cause));
    }
  }
  async function showManualPdf() {
    try {
      const result = await manual.refetch();
      if (result.error) throw new Error(result.error.message);
      setManualUrl(result.data?.url ?? null);
    } catch (cause) {
      setError(friendlyErrorMessage(cause));
    }
  }
  async function record(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file || !signedOn) return;
    const form = new FormData();
    form.set('action', 'recordSigned');
    form.set('requestId', row.id);
    form.set('file', file);
    form.set('signedOn', signedOn);
    try {
      await uploadAgreement(form);
      setRecording(false);
      onChange();
    } catch (cause) {
      setError(friendlyErrorMessage(cause));
    }
  }
  return (
    <>
      <tr>
        <td>
          <strong>{row.name}</strong>
          <small>{row.role}</small>
        </td>
        <td>{row.kind === 'UserAgreement' ? 'User Agreement' : 'Safeguarding & Data Annex'}</td>
        <td>
          {row.title} · v{row.version}
        </td>
        <td>{row.status === 'NeedsSigning' ? 'Needs signing' : row.status}</td>
        <td>
          {row.signatureMethod === 'HeadRecorded'
            ? 'Recorded as signed by administrator'
            : (row.signatureMethod ?? '—')}
          {row.recordedByName && row.signedAt ? (
            <small>
              By {row.recordedByName} · recorded {new Date(row.signedAt).toLocaleString('en-GB')}
            </small>
          ) : null}
        </td>
        <td>
          {row.declaredSignedOn
            ? new Date(row.declaredSignedOn).toLocaleDateString('en-GB')
            : row.signedAt
              ? new Date(row.signedAt).toLocaleDateString('en-GB')
              : '—'}
        </td>
        <td>
          <code>{row.signatureId ?? '—'}</code>
        </td>
        <td>
          {row.emailStatus ?? '—'}
          {row.emailStatus ? ` (${String(row.emailAttempts)})` : ''}
        </td>
        <td>
          <button
            disabled={open.isPending}
            onClick={() => {
              void showPdf();
            }}
            type="button"
          >
            Open
          </button>
          {row.hasManualSource ? (
            <button
              disabled={manual.isFetching}
              onClick={() => {
                void showManualPdf();
              }}
              type="button"
            >
              Uploaded signed PDF
            </button>
          ) : null}
          {row.status === 'NeedsSigning' ? (
            <button
              onClick={() => {
                setRecording(!recording);
              }}
              type="button"
            >
              Record signed
            </button>
          ) : null}
          {row.status === 'NeedsSigning' &&
          ['Failed', 'MissingEmail', 'NeedsReview'].includes(row.emailStatus ?? '') ? (
            <button
              disabled={retry.isPending}
              onClick={() => {
                const reviewedAmbiguousOutcome = row.emailStatus === 'NeedsReview';
                if (
                  reviewedAmbiguousOutcome &&
                  !window.confirm(
                    'The earlier email outcome is uncertain and a retry may send a duplicate. Have you reviewed the delivery before retrying?',
                  )
                )
                  return;
                void retry
                  .mutateAsync({ requestId: row.id, reviewedAmbiguousOutcome })
                  .then(onChange)
                  .catch((cause: unknown) => {
                    setError(friendlyErrorMessage(cause));
                  });
              }}
              type="button"
            >
              Retry email
            </button>
          ) : null}
        </td>
      </tr>
      {pdfUrl || manualUrl || recording || error ? (
        <tr>
          <td colSpan={9}>
            {pdfUrl ? (
              <a href={pdfUrl} rel="noreferrer" target="_blank">
                Open document PDF
              </a>
            ) : null}
            {manualUrl ? (
              <a href={manualUrl} rel="noreferrer" target="_blank">
                Open uploaded signed PDF
              </a>
            ) : null}
            {recording ? (
              <form
                className="agreement-register__record"
                onSubmit={(event) => {
                  void record(event);
                }}
              >
                <label>
                  Signed PDF
                  <input
                    accept="application/pdf,.pdf"
                    onChange={(event) => {
                      setFile(event.target.files?.[0] ?? null);
                    }}
                    required
                    type="file"
                  />
                </label>
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
                <button type="submit">Save signed record</button>
              </form>
            ) : null}
            {error ? <p role="alert">{error}</p> : null}
          </td>
        </tr>
      ) : null}
    </>
  );
}
