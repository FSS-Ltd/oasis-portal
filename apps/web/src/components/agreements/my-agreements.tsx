'use client';

import { useEffect, useState } from 'react';
import { api, type RouterOutputs } from '@/lib/trpc';
import { friendlyErrorMessage } from '@/lib/notifications';

type Agreement = RouterOutputs['userAgreement']['mine'][number];

export function AgreementPendingBadge() {
  const pending = api.userAgreement.pendingCount.useQuery(undefined, { retry: false });
  return pending.data ? (
    <b aria-label={`${String(pending.data)} agreements need signing`}>{pending.data}</b>
  ) : null;
}

export function AgreementHomeAlert({ href }: { href: string }) {
  const pending = api.userAgreement.pendingCount.useQuery(undefined, { retry: false });
  if (!pending.data) return null;
  return (
    <a className="panel agreement-home-alert" href={href} role="status">
      <strong>
        {pending.data} {pending.data === 1 ? 'agreement needs' : 'agreements need'} your signature
      </strong>
      <span>Open User Agreements to review and sign.</span>
    </a>
  );
}

function AgreementDetail({
  row,
  onSigned,
  feedback,
  onFeedback,
}: {
  row: Agreement;
  onSigned: () => void;
  feedback: string | undefined;
  onFeedback: (requestId: string, message: string) => void;
}) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [verification, setVerification] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const open = api.userAgreement.open.useMutation();
  const sign = api.userAgreement.sign.useMutation();
  const download = api.userAgreement.download.useQuery(
    { requestId: row.id, copy: 'completed' },
    { enabled: false, retry: false },
  );
  const verify = api.userAgreement.verify.useQuery(
    { requestId: row.id },
    { enabled: false, retry: false },
  );

  async function openForm() {
    setError(null);
    try {
      const result = await open.mutateAsync({ requestId: row.id });
      setPdfUrl(result.url);
    } catch (cause) {
      setError(friendlyErrorMessage(cause));
    }
  }

  async function signForm() {
    setError(null);
    try {
      await sign.mutateAsync({ requestId: row.id, acknowledged: true, fullName: fullName.trim() });
      setPdfUrl(null);
      onFeedback(row.id, 'Your electronic signature was saved. Checking verification…');
      onSigned();
    } catch (cause) {
      setError(friendlyErrorMessage(cause));
      return;
    }
    try {
      const result = await verify.refetch();
      onFeedback(
        row.id,
        result.data?.valid
          ? 'Verified: document and signing record match.'
          : 'Verification could not be confirmed. Contact the Head.',
      );
    } catch {
      onFeedback(
        row.id,
        'Signature saved. Verification is temporarily unavailable. Try again below.',
      );
    }
  }

  async function verifySignature() {
    setError(null);
    try {
      const result = await verify.refetch();
      if (result.error) throw new Error(result.error.message);
      setVerification(
        result.data?.valid
          ? 'Verified: document and signing record match.'
          : 'Verification failed. Contact the Head.',
      );
    } catch (cause) {
      setError(friendlyErrorMessage(cause));
    }
  }

  async function prepareDownload() {
    setError(null);
    try {
      const result = await download.refetch();
      if (result.error) throw new Error(result.error.message);
      setDownloadUrl(result.data?.url ?? null);
    } catch (cause) {
      setError(friendlyErrorMessage(cause));
    }
  }

  return (
    <article className="panel agreement-detail" id={`agreement-${row.id}`}>
      <div className="agreement-detail__heading">
        <div>
          <h2>{row.title}</h2>
          <p>
            {row.kind === 'UserAgreement' ? 'User Agreement' : 'Safeguarding & Data Annex'} ·
            Version {row.version}
          </p>
        </div>
        <strong>
          {row.status === 'NeedsSigning'
            ? 'Needs signing'
            : row.status === 'Signed'
              ? 'Signed'
              : 'Superseded'}
        </strong>
      </div>
      {row.status === 'NeedsSigning' ? (
        <>
          <button
            disabled={open.isPending}
            onClick={() => {
              void openForm();
            }}
            type="button"
          >
            {open.isPending ? 'Opening…' : pdfUrl ? 'Reopen PDF' : 'Open PDF'}
          </button>
          {pdfUrl ? (
            <>
              <iframe className="agreement-detail__pdf" src={pdfUrl} title={`${row.title} PDF`} />
              <a href={pdfUrl} rel="noreferrer" target="_blank">
                Open PDF in a new tab
              </a>
              <label className="agreement-detail__check">
                <input
                  checked={acknowledged}
                  onChange={(event) => {
                    setAcknowledged(event.target.checked);
                  }}
                  type="checkbox"
                />
                I have read and understand this form.
              </label>
              <label>
                Full name for electronic signature
                <input
                  autoComplete="name"
                  maxLength={160}
                  onChange={(event) => {
                    setFullName(event.target.value);
                  }}
                  value={fullName}
                />
              </label>
              <button
                disabled={!acknowledged || !fullName.trim() || sign.isPending}
                onClick={() => {
                  void signForm();
                }}
                type="button"
              >
                {sign.isPending ? 'Signing…' : 'Sign electronically'}
              </button>
            </>
          ) : null}
        </>
      ) : row.status === 'Signed' ? (
        <div className="agreement-detail__signed">
          {feedback ? <p role="status">{feedback}</p> : null}
          <p>
            {row.signatureMethod === 'HeadRecorded'
              ? 'Recorded as signed by Head'
              : 'Signed electronically'}{' '}
            on{' '}
            {row.declaredSignedOn
              ? new Date(row.declaredSignedOn).toLocaleDateString('en-GB')
              : row.signedAt
                ? new Date(row.signedAt).toLocaleString('en-GB')
                : 'date unavailable'}
            .
          </p>
          <p>
            Signature ID: <code>{row.signatureId}</code>
          </p>
          <button
            disabled={download.isFetching}
            onClick={() => {
              void prepareDownload();
            }}
            type="button"
          >
            {download.isFetching ? 'Preparing PDF…' : 'Prepare signed PDF'}
          </button>
          {downloadUrl ? (
            <a href={downloadUrl} rel="noreferrer" target="_blank">
              Download signed PDF and receipt
            </a>
          ) : null}
          <button
            disabled={verify.isFetching}
            onClick={() => {
              void verifySignature();
            }}
            type="button"
          >
            {verify.isFetching ? 'Verifying…' : 'Verify signing record'}
          </button>
          {verification ? <p role="status">{verification}</p> : null}
        </div>
      ) : null}
      {error ? <p role="alert">{error}</p> : null}
    </article>
  );
}

export function MyAgreements({
  heading = 'User Agreements',
  focusRequestId,
}: {
  heading?: string;
  focusRequestId?: string;
}) {
  const mine = api.userAgreement.mine.useQuery(undefined, { retry: false });
  const [feedback, setFeedback] = useState<Record<string, string>>({});
  function setRequestFeedback(requestId: string, message: string) {
    setFeedback((current) => ({ ...current, [requestId]: message }));
  }
  useEffect(() => {
    if (focusRequestId && mine.data?.some((row) => row.id === focusRequestId)) {
      document.getElementById(`agreement-${focusRequestId}`)?.scrollIntoView({ block: 'start' });
    }
  }, [focusRequestId, mine.data]);
  const utils = api.useUtils();
  const pending = mine.data?.filter((row) => row.status === 'NeedsSigning') ?? [];
  const signed = mine.data?.filter((row) => row.status === 'Signed') ?? [];
  function refresh() {
    void mine.refetch();
    void utils.userAgreement.pendingCount.invalidate();
  }
  return (
    <section className="agreement-page">
      <div className="page-header">
        <div>
          <p>Compliance</p>
          <h1>{heading}</h1>
          <p>Review forms assigned to you and keep a record of your signatures.</p>
        </div>
      </div>
      {mine.isLoading ? <p role="status">Loading agreements…</p> : null}
      {mine.error ? <p role="alert">{friendlyErrorMessage(mine.error)}</p> : null}
      <h2>Needs signing ({pending.length})</h2>
      {mine.data && pending.length === 0 ? <p>No forms need your signature.</p> : null}
      {pending.map((row) => (
        <AgreementDetail
          key={row.id}
          onSigned={refresh}
          onFeedback={setRequestFeedback}
          feedback={feedback[row.id]}
          row={row}
        />
      ))}
      <h2>Signed records ({signed.length})</h2>
      {mine.data && signed.length === 0 ? <p>No signed records yet.</p> : null}
      {signed.map((row) => (
        <AgreementDetail
          key={row.id}
          onSigned={refresh}
          onFeedback={setRequestFeedback}
          feedback={feedback[row.id]}
          row={row}
        />
      ))}
    </section>
  );
}
