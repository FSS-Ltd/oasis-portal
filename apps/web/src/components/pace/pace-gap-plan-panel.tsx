'use client';

import { useEffect, useState } from 'react';
import { PACE_CATALOGUE } from '@oasis/domain';
import { api, type RouterOutputs } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { ConfirmationDialog } from '@/components/admin/confirmation-dialog';

type Summary = RouterOutputs['academicInventory']['gapPlansForAssignment'];
type Plan = Summary['plans'][number];

export function PaceGapPlanPanel({
  studentId,
  subjectId,
}: {
  studentId: string;
  subjectId: string;
}) {
  const utils = api.useUtils();
  const enabled = Boolean(studentId && subjectId);
  const query = api.academicInventory.gapPlansForAssignment.useQuery(
    { studentId, subjectId },
    { enabled, retry: false },
  );
  const [selected, setSelected] = useState<number[]>([]);
  const [jumpTo, setJumpTo] = useState('');
  const [page, setPage] = useState(0);
  const [rangeFrom, setRangeFrom] = useState('');
  const [rangeTo, setRangeTo] = useState('');
  const [message, setMessage] = useState('');
  const [conflict, setConflict] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<Plan | null>(null);
  const activePlan = query.data?.plans.find((plan) => plan.status === 'Active');
  const reviewPlan = query.data?.plans.find((plan) => plan.reviewRequired);
  const completed = new Set(query.data?.completedPaceNumbers ?? []);
  const pending = api.academicInventory.createGapPlan.useMutation({
    onSuccess: async () => {
      setConflict(false);
      setMessage('Gap PACEs started.');
      await Promise.all([
        query.refetch(),
        utils.pace.forStudent.invalidate(),
        utils.pace.parentCurrent.invalidate(),
        utils.academicInventory.summary.invalidate(),
        utils.childLog.drillThrough.invalidate({ studentId }),
        utils.childLog.snapshot.invalidate(),
        utils.childLog.centreSnapshot.invalidate(),
        utils.childLog.parentDashboard.invalidate(),
      ]);
    },
    onError: (error) => {
      setMessage(error.message);
      setConflict(error.data?.code === 'CONFLICT');
    },
  });
  const update = api.academicInventory.updateGapPlan.useMutation({
    onSuccess: async () => {
      setConflict(false);
      setMessage('Gap plan saved.');
      await Promise.all([
        query.refetch(),
        utils.pace.forStudent.invalidate(),
        utils.pace.parentCurrent.invalidate(),
        utils.academicInventory.summary.invalidate(),
        utils.childLog.drillThrough.invalidate({ studentId }),
        utils.childLog.snapshot.invalidate(),
        utils.childLog.centreSnapshot.invalidate(),
        utils.childLog.parentDashboard.invalidate(),
      ]);
    },
    onError: (error) => {
      setMessage(error.message);
      setConflict(error.data?.code === 'CONFLICT');
    },
  });
  const cancel = api.academicInventory.cancelGapPlan.useMutation({
    onSuccess: async () => {
      setCancelTarget(null);
      setMessage('Gap plan cancelled. The student is at its configured destination.');
      await Promise.all([
        query.refetch(),
        utils.pace.forStudent.invalidate(),
        utils.pace.parentCurrent.invalidate(),
        utils.academicInventory.summary.invalidate(),
        utils.childLog.drillThrough.invalidate({ studentId }),
        utils.childLog.snapshot.invalidate(),
        utils.childLog.centreSnapshot.invalidate(),
        utils.childLog.parentDashboard.invalidate(),
      ]);
    },
    onError: (error) => {
      setMessage(error.message);
    },
  });
  const review = api.academicInventory.reviewGapPlan.useMutation({
    onSuccess: async () => {
      setMessage('Gap plan review resolved.');
      await Promise.all([
        query.refetch(),
        utils.pace.forStudent.invalidate(),
        utils.pace.parentCurrent.invalidate(),
        utils.academicInventory.summary.invalidate(),
        utils.childLog.drillThrough.invalidate({ studentId }),
        utils.childLog.snapshot.invalidate(),
        utils.childLog.centreSnapshot.invalidate(),
        utils.childLog.parentDashboard.invalidate(),
      ]);
    },
    onError: (error) => {
      setMessage(error.message);
    },
  });
  const busy = pending.isPending || update.isPending || cancel.isPending || review.isPending;

  useEffect(() => {
    const reviewSource = activePlan ?? reviewPlan;
    setSelected(
      reviewSource?.items
        .filter((item) => !item.removed && !item.completed)
        .map((item) => item.paceNumber) ?? [],
    );
    setJumpTo(String(activePlan?.jumpToPaceNumber ?? query.data?.currentPaceNumber ?? ''));
    setMessage('');
  }, [
    studentId,
    subjectId,
    query.data?.currentPaceNumber,
    activePlan?.id,
    activePlan?.version,
    reviewPlan?.id,
    reviewPlan?.version,
  ]);

  if (!enabled)
    return (
      <p className="field__hint">Choose a student and assigned subject to manage gap PACEs.</p>
    );
  if (query.isLoading) return <p role="status">Loading gap PACEs…</p>;
  if (query.isError)
    return (
      <p role="alert">
        Gap PACEs could not be loaded.{' '}
        <button type="button" onClick={() => void query.refetch()}>
          Retry
        </button>
      </p>
    );
  if (!query.data) return null;

  const visiblePaces = PACE_CATALOGUE.slice(page * 12, page * 12 + 12);
  const jumpNumber = Number(jumpTo);
  const sortedSelected = [...selected].sort((a, b) => a - b);
  const editablePlan: Plan | undefined = activePlan;
  const reviewedPlan = activePlan ?? reviewPlan;
  const maxRetainedGap = Math.max(
    ...(reviewedPlan?.items.filter((item) => !item.removed).map((item) => item.paceNumber) ?? []),
    ...(sortedSelected.length ? sortedSelected : [0]),
  );
  const addRange = () => {
    const from = Number(rangeFrom);
    const to = Number(rangeTo);
    if (!Number.isInteger(from) || !Number.isInteger(to) || from > to || from < 1001 || to > 1144) {
      setMessage('Choose a valid catalogue range from 1001 to 1144.');
      return;
    }
    setSelected((current) =>
      [
        ...new Set([
          ...current,
          ...PACE_CATALOGUE.filter((pace) => pace >= from && pace <= to && !completed.has(pace)),
        ]),
      ].sort((a, b) => a - b),
    );
    setMessage('');
  };
  const submit = () => {
    if (
      !Number.isInteger(jumpNumber) ||
      sortedSelected.length === 0 ||
      sortedSelected.some((pace) => pace >= jumpNumber)
    ) {
      setMessage('Select at least one gap PACE and a higher jump destination.');
      return;
    }
    setMessage('');
    if (editablePlan) {
      update.mutate({
        planId: editablePlan.id,
        expectedVersion: editablePlan.version,
        remainingPaceNumbers: sortedSelected,
        jumpToPaceNumber: jumpNumber,
      });
    } else {
      pending.mutate({
        studentId,
        subjectId,
        paceNumbers: sortedSelected,
        jumpToPaceNumber: jumpNumber,
        expectedCurrentPaceNumber: query.data.currentPaceNumber,
      });
    }
  };

  return (
    <div className="pace-gap" aria-busy={busy}>
      <div className="pace-gap__summary">
        <p>
          <strong>Current PACE</strong> · {query.data.currentPaceNumber}
        </p>
        {activePlan ? (
          <p>
            <strong>
              {activePlan.items.filter((item) => !item.removed && item.completed).length} of{' '}
              {activePlan.items.filter((item) => !item.removed).length} gaps completed
            </strong>{' '}
            · Current work remains on the active sequence.
          </p>
        ) : null}
      </div>

      {reviewPlan ? (
        <div className="notice notice--warning" role="alert">
          <strong>Needs Head review.</strong> A test correction changed completion evidence.
          Advancement is paused until this plan is reviewed.
          <div className="pace-gap__actions">
            <Button
              disabled={busy}
              onClick={() => {
                review.mutate({
                  planId: reviewPlan.id,
                  expectedVersion: reviewPlan.version,
                  decision: 'Reopen',
                  jumpToPaceNumber: jumpNumber,
                });
              }}
              type="button"
            >
              Reopen Gap PACEs
            </Button>
            <Button
              disabled={busy}
              onClick={() => {
                setCancelTarget(reviewPlan);
              }}
              type="button"
              variant="secondary"
            >
              Resume Advancement
            </Button>
          </div>
        </div>
      ) : null}

      {activePlan ? (
        <p className="field__hint">
          Editing keeps completed gaps locked. Saving deliberately switches to the earliest
          remaining gap.
        </p>
      ) : null}
      <div className="form-grid form-grid--two">
        <label className="field">
          <span className="field__label">Jump to PACE</span>
          <select
            className="input"
            value={jumpTo}
            onChange={(event) => {
              setJumpTo(event.target.value);
            }}
          >
            {PACE_CATALOGUE.filter((pace) => pace > maxRetainedGap).map((pace) => (
              <option key={pace} value={pace} disabled={completed.has(pace)}>
                {pace}
                {completed.has(pace) ? ' · Already completed' : ''}
              </option>
            ))}
          </select>
        </label>
        <div className="field">
          <span className="field__label">Select missing PACEs</span>
          <div className="pace-gap__catalogue-nav">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={page === 0}
              onClick={() => {
                setPage((value) => value - 1);
              }}
            >
              Previous 12
            </Button>
            <span>
              {visiblePaces[0]}–{visiblePaces[visiblePaces.length - 1]}
            </span>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={(page + 1) * 12 >= PACE_CATALOGUE.length}
              onClick={() => {
                setPage((value) => value + 1);
              }}
            >
              Next 12
            </Button>
          </div>
          <div className="pace-gap__checks">
            {visiblePaces.map((pace) => {
              const locked =
                completed.has(pace) ||
                Boolean(
                  editablePlan?.items.some(
                    (item) => item.paceNumber === pace && !item.removed && item.completed,
                  ),
                );
              return (
                <label className="pace-gap__check" key={pace}>
                  <input
                    type="checkbox"
                    checked={locked || selected.includes(pace)}
                    disabled={locked || busy}
                    onChange={(event) => {
                      setSelected((current) =>
                        event.target.checked
                          ? [...new Set([...current, pace])].sort((a, b) => a - b)
                          : current.filter((value) => value !== pace),
                      );
                    }}
                  />
                  <span>
                    PACE {pace}
                    {locked ? ' · Already completed' : ''}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      </div>
      <div className="pace-gap__range">
        <label className="field">
          <span className="field__label">From</span>
          <input
            className="input"
            inputMode="numeric"
            value={rangeFrom}
            onChange={(event) => {
              setRangeFrom(event.target.value);
            }}
            aria-label="Range start PACE"
          />
        </label>
        <label className="field">
          <span className="field__label">To</span>
          <input
            className="input"
            inputMode="numeric"
            value={rangeTo}
            onChange={(event) => {
              setRangeTo(event.target.value);
            }}
            aria-label="Range end PACE"
          />
        </label>
        <Button type="button" variant="secondary" onClick={addRange} disabled={busy}>
          Add Range
        </Button>
      </div>
      <p className="pace-gap__preview" aria-live="polite">
        {sortedSelected.length
          ? `Complete ${sortedSelected.join(', ')}, then jump to ${String(jumpNumber) || '…'}. Saving starts PACE ${String(sortedSelected[0])}.`
          : 'Select one or more missing PACEs.'}
      </p>
      <div className="pace-gap__actions">
        <Button disabled={busy || Boolean(reviewPlan) || conflict} onClick={submit} type="button">
          {busy ? 'Saving…' : activePlan ? 'Save Changes' : 'Start Gap PACEs'}
        </Button>
        {activePlan ? (
          <Button
            disabled={busy}
            onClick={() => {
              setCancelTarget(activePlan);
            }}
            type="button"
            variant="secondary"
          >
            Cancel Gap Plan
          </Button>
        ) : null}
      </div>
      {message ? (
        <p
          role={
            message.includes('could not') ||
            message.includes('changed') ||
            message.includes('Choose') ||
            message.includes('Select')
              ? 'alert'
              : 'status'
          }
        >
          {message}
        </p>
      ) : null}
      {conflict ? (
        <Button
          disabled={query.isFetching}
          onClick={() => {
            void query.refetch().then(() => {
              setConflict(false);
              setMessage('Latest plan loaded. Review it before saving again.');
            });
          }}
          type="button"
          variant="secondary"
        >
          {query.isFetching ? 'Refreshing…' : 'Refresh latest plan'}
        </Button>
      ) : null}
      {query.data.plans.length > 0 ? (
        <details className="pace-gap__history">
          <summary>Gap plan history</summary>
          {query.data.plans.map((plan) => (
            <p key={plan.id}>
              Plan {plan.status.toLowerCase()} · jump to {String(plan.jumpToPaceNumber)}
              {plan.reviewRequired ? ' · Needs review' : ''}
            </p>
          ))}
        </details>
      ) : null}
      {cancelTarget ? (
        <ConfirmationDialog
          confirmLabel={cancelTarget.status === 'Active' ? 'Cancel and jump' : 'Resume advancement'}
          errorMessage={cancel.error ? cancel.error.message : undefined}
          onCancel={() => {
            setCancelTarget(null);
          }}
          onConfirm={() => {
            cancel.mutate({ planId: cancelTarget.id, expectedVersion: cancelTarget.version });
          }}
          open
          pending={cancel.isPending}
          title={cancelTarget.status === 'Active' ? 'Cancel gap PACEs?' : 'Resume advancement?'}
          variant="danger"
        >
          {cancelTarget.status === 'Active'
            ? `This leaves unfinished gap PACEs and moves the student to PACE ${String(cancelTarget.jumpToPaceNumber)}. Scores and plan history are retained.`
            : 'This accepts the gaps as unresolved and clears this review blocker. The student stays on their current PACE; completed work can advance once other review blockers are cleared.'}
        </ConfirmationDialog>
      ) : null}
    </div>
  );
}
