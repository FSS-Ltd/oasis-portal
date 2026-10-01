'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { RefreshCw, Printer } from 'lucide-react';
import { ACTIVE_SCORE_KEY_SCOPE_LABELS, ACTIVE_SCORE_KEY_SCOPES } from '@oasis/domain';
import { api } from '@/lib/trpc';
import type { RouterOutputs } from '@/lib/trpc';
import { friendlyErrorMessage, showErrorToast } from '@/lib/notifications';
import { Button } from '@/components/ui/button';
import styles from './active-score-keys-report.module.css';

const reportPdfUrl = '/api/reports/score-keys/pdf';
type ActiveScoreKeyRow = RouterOutputs['report']['scoreKeys']['current']['rows'][number];

function formatTimestamp(value: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Europe/London',
  }).format(value);
}

export function ActiveScoreKeysReport({ enabled = true }: { enabled?: boolean }) {
  const [scope, setScope] = useState<(typeof ACTIVE_SCORE_KEY_SCOPES)[number]>('all');
  const reportQuery = api.report.scoreKeys.current.useQuery(
    { scope },
    {
      enabled,
      staleTime: 0,
      refetchOnMount: true,
      refetchOnReconnect: true,
      refetchOnWindowFocus: true,
      refetchInterval: () =>
        typeof document === 'undefined' || document.visibilityState === 'visible' ? 30_000 : false,
      retry: false,
    },
  );
  const [printing, setPrinting] = useState(false);
  const [openPdfUrl, setOpenPdfUrl] = useState<string | null>(null);
  const previousPdfUrl = useRef<string | null>(null);
  const data = reportQuery.data;
  const rowsBySubject = useMemo(() => {
    const groups = new Map<string, ActiveScoreKeyRow[]>();
    for (const row of data?.rows ?? []) {
      const rows = groups.get(row.subjectId) ?? [];
      rows.push(row);
      groups.set(row.subjectId, rows);
    }
    return [...groups.values()];
  }, [data?.rows]);

  useEffect(() => {
    function refetchWhenVisible() {
      if (document.visibilityState === 'visible') {
        void reportQuery.refetch();
      }
    }
    document.addEventListener('visibilitychange', refetchWhenVisible);
    return () => {
      document.removeEventListener('visibilitychange', refetchWhenVisible);
    };
  }, [reportQuery.refetch]);

  useEffect(
    () => () => {
      if (previousPdfUrl.current) URL.revokeObjectURL(previousPdfUrl.current);
    },
    [],
  );

  async function printReport() {
    const viewer = window.open('about:blank', '_blank');
    setPrinting(true);
    try {
      const response = await fetch(`${reportPdfUrl}?scope=${scope}`, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`PDF request failed (${String(response.status)}).`);
      }
      const url = URL.createObjectURL(await response.blob());
      if (previousPdfUrl.current) URL.revokeObjectURL(previousPdfUrl.current);
      previousPdfUrl.current = url;
      setOpenPdfUrl(url);
      if (viewer) viewer.location.href = url;
    } catch (error) {
      viewer?.close();
      showErrorToast(error, 'The active score-key PDF could not be prepared.');
    } finally {
      setPrinting(false);
    }
  }

  const errorMessage = reportQuery.error ? friendlyErrorMessage(reportQuery.error) : null;
  const accessDenied = reportQuery.error?.data?.code === 'FORBIDDEN';

  return (
    <section aria-labelledby="active-score-keys-title" className={styles.report}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Reports</p>
          <h1 id="active-score-keys-title">Active Score Keys</h1>
          <p className={styles.description}>
            Score keys needed for active children’s current PACEs.
          </p>
        </div>
      </header>

      {reportQuery.isLoading && !data ? (
        <p aria-live="polite" className={styles.notice} role="status">
          Loading active score keys…
        </p>
      ) : null}
      {accessDenied ? (
        <div className={styles.error} role="alert">
          <p>Access denied. Active score keys are not available for this account.</p>
        </div>
      ) : null}
      {!accessDenied && errorMessage ? (
        <div className={styles.error} role="alert">
          <p>{data ? 'Could not refresh. Showing the last successful update.' : errorMessage}</p>
          {!data ? (
            <Button onClick={() => void reportQuery.refetch()} type="button" variant="secondary">
              Retry
            </Button>
          ) : null}
        </div>
      ) : null}

      {!accessDenied && data ? (
        <>
          <div className={styles.scopePicker}>
            <label htmlFor="score-key-scope">Child group</label>
            <select
              id="score-key-scope"
              onChange={(event) => {
                const selected = ACTIVE_SCORE_KEY_SCOPES.find(
                  (option) => option === event.currentTarget.value,
                );
                if (selected) setScope(selected);
              }}
              value={scope}
            >
              {ACTIVE_SCORE_KEY_SCOPES.map((option) => (
                <option key={option} value={option}>
                  {ACTIVE_SCORE_KEY_SCOPE_LABELS[option]}
                </option>
              ))}
            </select>
          </div>
          <dl aria-label="Score-key summary" className={styles.summary}>
            <div>
              <dt>Active Score Keys</dt>
              <dd>{data.activeKeyCount}</dd>
            </div>
            <div>
              <dt>Subjects</dt>
              <dd>{data.subjectCount}</dd>
            </div>
          </dl>

          <div className={styles.toolbar}>
            <div className={styles.actions}>
              <Button
                disabled={reportQuery.isFetching}
                onClick={() => void reportQuery.refetch()}
                type="button"
                variant="secondary"
              >
                <RefreshCw aria-hidden="true" size={16} />
                Refresh
              </Button>
              <Button disabled={printing} onClick={() => void printReport()} type="button">
                <Printer aria-hidden="true" size={16} />
                {printing ? 'Preparing PDF…' : 'Print / Save PDF'}
              </Button>
              {openPdfUrl ? (
                <a href={openPdfUrl} rel="noreferrer" target="_blank">
                  Open PDF
                </a>
              ) : null}
            </div>
            <p aria-live="polite" className={styles.updated}>
              {reportQuery.isFetching ? 'Refreshing… ' : ''}Updated{' '}
              {formatTimestamp(data.generatedAt)}
            </p>
          </div>

          {data.rows.length === 0 ? (
            <p className={styles.empty}>No active score keys are currently needed.</p>
          ) : (
            <div className={styles.tableScroller}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">Subject</th>
                    <th scope="col">Current PACE</th>
                    <th scope="col">Score Key</th>
                    <th scope="col">Children</th>
                  </tr>
                </thead>
                <tbody>
                  {rowsBySubject.flatMap((rows) =>
                    rows.map((row) => (
                      <tr key={`${row.subjectId}-${String(row.paceNumber)}`}>
                        <th scope="row">{row.subjectName}</th>
                        <td>{row.paceNumber}</td>
                        <td>{row.paceNumber}</td>
                        <td>{row.childCount}</td>
                      </tr>
                    )),
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : null}
    </section>
  );
}
