'use client';

import { useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Check, History, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { friendlyErrorMessage, showErrorToast, showSuccessToast } from '@/lib/notifications';
import { api, type RouterOutputs } from '@/lib/trpc';

type PendingDemerit = RouterOutputs['behaviour']['parentReleaseQueue'][number];

const ease = [0.16, 1, 0.3, 1] as const;
const relativeTime = new Intl.RelativeTimeFormat('en-GB', { numeric: 'auto' });

function waitingFor(value: Date | string, now = Date.now()): string {
  const minutes = Math.round((new Date(value).getTime() - now) / 60_000);
  if (Math.abs(minutes) < 60) return relativeTime.format(minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return relativeTime.format(hours, 'hour');
  return relativeTime.format(Math.round(hours / 24), 'day');
}

function formatDateTime(value: Date | string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
  }).format(new Date(value));
}

/** Tile weight follows the deduction so the queue can be scanned by severity. */
function severity(meritDelta: number): 'low' | 'mid' | 'high' {
  const units = Math.abs(meritDelta);
  if (units >= 6) return 'high';
  if (units >= 3) return 'mid';
  return 'low';
}

function meritLabel(meritDelta: number): string {
  const units = Math.abs(meritDelta);
  return units === 1 ? 'merit' : 'merits';
}

function DemeritCard({ item }: { item: PendingDemerit }) {
  const utils = api.useUtils();
  const router = useRouter();
  const noteId = useId();
  const original = item.note ?? '';
  const [note, setNote] = useState(original);
  const [confirmingReject, setConfirmingReject] = useState(false);
  // Return focus to Reject after "Keep it" so keyboard users stay on this card.
  const restoreRejectFocus = useRef(false);
  const cardRef = useRef<HTMLElement>(null);
  // Staff-only cards with no note start collapsed so the queue scans quickly.
  const [noteOpen, setNoteOpen] = useState(item.visibility !== 'Sensitive' || Boolean(item.note));
  const edited = note.trim() !== original.trim();
  const sensitive = item.visibility === 'Sensitive';
  const firstName = item.student.fullName.split(' ')[0] ?? item.student.fullName;

  /** Keyboard users land on the next decision instead of the top of the page. */
  function focusNextCard(): void {
    const listItem = cardRef.current?.closest('li');
    const target = listItem?.nextElementSibling ?? listItem?.previousElementSibling;
    target?.querySelector<HTMLElement>('h2')?.focus();
  }

  async function refresh(): Promise<void> {
    focusNextCard();
    await Promise.all([
      utils.behaviour.parentReleaseQueue.invalidate(),
      utils.behaviour.recentEntries.invalidate(),
    ]);
    // The nav badge count is rendered by the server layout.
    router.refresh();
  }

  const release = api.behaviour.releaseDemerit.useMutation({
    onSuccess: async ({ guardiansEmailed }) => {
      // Only claim an email went out when the server says one did.
      const deduction = `−${String(Math.abs(item.meritDelta))} ${meritLabel(item.meritDelta)}`;
      showSuccessToast(
        sensitive
          ? `Approved. ${deduction} on ${firstName}'s record. Staff only, no email sent.`
          : guardiansEmailed > 0
            ? `Approved. ${deduction} on ${firstName}'s record. Parents emailed.`
            : `Approved. ${deduction} on ${firstName}'s record. No parent email was sent; see the audit log.`,
      );
      await refresh();
    },
    onError: (error) => {
      showErrorToast(error, 'The demerit could not be approved.');
    },
  });
  const reject = api.behaviour.rejectDemerit.useMutation({
    onSuccess: async () => {
      showSuccessToast(`Removed. The demerit is no longer on ${firstName}'s record.`);
      await refresh();
    },
    onError: (error) => {
      showErrorToast(error, 'The demerit could not be removed.');
    },
  });
  const busy = release.isPending || reject.isPending;
  const error = release.error ?? reject.error;

  function approve(): void {
    // An emptied note is sent as '' so the Head can clear it, never silently restored.
    release.mutate({ id: item.id, ...(edited ? { note: note.trim() } : {}) });
  }

  return (
    <article
      aria-busy={busy}
      aria-labelledby={`${noteId}-student`}
      className="demerit-approval"
      ref={cardRef}
      data-busy={busy || undefined}
    >
      <div
        aria-hidden="true"
        className="demerit-approval__value"
        data-severity={severity(item.meritDelta)}
      >
        <span className="demerit-approval__figure">−{Math.abs(item.meritDelta)}</span>
        <span className="demerit-approval__unit">{meritLabel(item.meritDelta)}</span>
      </div>

      <div className="demerit-approval__body">
        <header className="demerit-approval__header">
          <div>
            <h2 id={`${noteId}-student`} tabIndex={-1}>
              {item.student.fullName}
              <span className="demerit-approval__year">{item.student.yearGroup}</span>
            </h2>
            <p className="demerit-approval__meta">
              <strong>{item.category}</strong>
              <span className="sr-only">
                Deduction: {Math.abs(item.meritDelta)} {meritLabel(item.meritDelta)}
              </span>
              <span>Logged by {item.recordedBy.fullName}</span>
              <time dateTime={new Date(item.createdAt).toISOString()}>
                {formatDateTime(item.createdAt)} · {waitingFor(item.createdAt)}
              </time>
            </p>
            {sensitive ? (
              <span className="demerit-approval__flag">Sensitive · never sent to parents</span>
            ) : null}
          </div>
        </header>

        {noteOpen ? (
          <div className="demerit-approval__note">
            <div className="demerit-approval__note-label">
              <label htmlFor={noteId}>
                {sensitive ? 'Note (staff only)' : 'Note parents will read'}
                <span className="sr-only"> for {item.student.fullName}</span>
              </label>
              {edited ? (
                <span className="demerit-approval__edited" role="status">
                  Edited. Only your version is sent; the original stays in the staff history.
                </span>
              ) : null}
            </div>
            <textarea
              // Opened from "Add staff note": put the cursor straight in the field.
              autoFocus={sensitive && !original}
              className="input textarea"
              disabled={busy}
              id={noteId}
              maxLength={2000}
              onChange={(event) => {
                setNote(event.target.value);
              }}
              placeholder={
                sensitive
                  ? 'No note was recorded.'
                  : 'No note was recorded. Add one for parents if it helps.'
              }
              rows={3}
              value={note}
            />
            {edited ? (
              <button
                className="demerit-approval__reset"
                disabled={busy}
                onClick={() => {
                  setNote(original);
                }}
                type="button"
              >
                <RotateCcw aria-hidden="true" size={14} />
                Restore original wording
              </button>
            ) : null}
          </div>
        ) : (
          <button
            className="demerit-approval__add-note"
            disabled={busy}
            onClick={() => {
              setNoteOpen(true);
            }}
            type="button"
          >
            <Plus aria-hidden="true" size={14} />
            Add staff note
            <span className="sr-only"> for {item.student.fullName}</span>
          </button>
        )}

        {item.noteEdits.length > 0 ? (
          <details className="demerit-approval__history">
            <summary>
              <History aria-hidden="true" size={14} />
              Edit history · staff only ({item.noteEdits.length})
            </summary>
            <ol>
              {item.noteEdits.map((edit) => (
                <li key={edit.id}>
                  <p className="demerit-approval__history-meta">
                    {edit.editedByName} · {formatDateTime(edit.createdAt)}
                  </p>
                  <p>
                    <del>{edit.previousNote ?? 'No note'}</del>
                  </p>
                  <p>
                    <ins>{edit.nextNote ?? 'No note'}</ins>
                  </p>
                </li>
              ))}
            </ol>
          </details>
        ) : null}

        <AnimatePresence initial={false} mode="wait">
          {confirmingReject ? (
            <motion.div
              animate={{ opacity: 1, y: 0 }}
              className="demerit-approval__confirm"
              exit={{ opacity: 0, y: -4 }}
              initial={{ opacity: 0, y: 4 }}
              key="confirm"
              role="group"
              aria-label="Confirm rejection"
              transition={{ duration: 0.18, ease }}
            >
              <p>
                Remove this demerit from {firstName}&apos;s record? Parents are never told and no
                merits are deducted.
                <strong className="demerit-approval__warning">This cannot be undone.</strong>
              </p>
              <div className="demerit-approval__actions">
                <Button
                  // Focus the destructive choice so keyboard users land on the decision.
                  autoFocus
                  onClick={() => {
                    reject.mutate({ id: item.id });
                  }}
                  pending={reject.isPending}
                  className="demerit-approval__remove"
                  type="button"
                  variant="secondary"
                >
                  {reject.isPending ? null : <Trash2 aria-hidden="true" size={16} />}
                  {reject.isPending ? 'Removing…' : 'Remove demerit'}
                </Button>
                <Button
                  className="demerit-approval__keep"
                  disabled={busy}
                  onClick={() => {
                    restoreRejectFocus.current = true;
                    setConfirmingReject(false);
                  }}
                  type="button"
                  variant="secondary"
                >
                  Keep it
                </Button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              animate={{ opacity: 1, y: 0 }}
              className="demerit-approval__actions"
              exit={{ opacity: 0, y: -4 }}
              initial={{ opacity: 0, y: 4 }}
              key="actions"
              ref={(node: HTMLDivElement | null) => {
                if (!node || !restoreRejectFocus.current) return;
                restoreRejectFocus.current = false;
                node.querySelector<HTMLButtonElement>('[data-reject-trigger]')?.focus();
              }}
              transition={{ duration: 0.18, ease }}
            >
              <Button
                aria-describedby={`${noteId}-student`}
                onClick={approve}
                pending={release.isPending}
                type="button"
              >
                {release.isPending ? (
                  'Approving…'
                ) : (
                  <>
                    <Check aria-hidden="true" size={16} />
                    {sensitive
                      ? 'Approve'
                      : edited
                        ? 'Approve with my edit'
                        : 'Approve and notify parents'}
                  </>
                )}
              </Button>
              <Button
                aria-describedby={`${noteId}-student`}
                data-reject-trigger
                disabled={busy}
                onClick={() => {
                  setConfirmingReject(true);
                }}
                type="button"
                variant="secondary"
              >
                Reject
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {error ? (
          <p className="status--error" role="alert">
            {friendlyErrorMessage(error)}
          </p>
        ) : null}
      </div>
    </article>
  );
}

export function DemeritApprovalsClient() {
  const reduceMotion = useReducedMotion();
  const queue = api.behaviour.parentReleaseQueue.useQuery(undefined, { retry: false });
  const items = queue.data ?? [];
  const count = items.length;

  return (
    <div className="snapshot-page demerit-approvals-page">
      <header className="demerit-approvals-page__header">
        <div>
          <h1>Demerit approvals</h1>
          <p>
            Nothing reaches a family until you decide. Approving deducts the merits and emails the
            child&apos;s parents. Rejecting removes the demerit from the record.
          </p>
        </div>
        {queue.data ? (
          <p className="demerit-approvals-page__count" aria-live="polite">
            <span className="demerit-approvals-page__count-figure">{count}</span>
            <span>waiting</span>
          </p>
        ) : null}
      </header>

      {queue.isLoading ? (
        <div aria-busy="true" aria-label="Loading demerits" className="demerit-approvals-skeleton">
          <span />
          <span />
        </div>
      ) : null}
      {queue.error ? (
        <p className="status--error" role="alert">
          {friendlyErrorMessage(queue.error)}
        </p>
      ) : null}

      {queue.data && count === 0 ? (
        <EmptyState
          className="demerit-approvals-page__empty"
          detail="New demerits land here the moment staff log them."
          title="All clear. No demerits are waiting."
        />
      ) : null}

      <ol aria-label="Demerits waiting for a decision" className="demerit-approvals-list">
        <AnimatePresence initial={false}>
          {items.map((item) => (
            <motion.li
              animate={{ opacity: 1, height: 'auto' }}
              exit={
                reduceMotion
                  ? { opacity: 0, transition: { duration: 0 } }
                  : { opacity: 0, height: 0, x: 24, transition: { duration: 0.32, ease } }
              }
              initial={reduceMotion ? false : { opacity: 0, height: 0 }}
              key={item.id}
              layout={!reduceMotion}
              transition={{ duration: 0.28, ease }}
            >
              <DemeritCard item={item} />
            </motion.li>
          ))}
        </AnimatePresence>
      </ol>
    </div>
  );
}
