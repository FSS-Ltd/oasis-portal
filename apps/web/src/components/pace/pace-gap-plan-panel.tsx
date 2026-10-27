'use client';

import { useEffect, useRef, useState } from 'react';
import { PACE_CATALOGUE } from '@oasis/domain';
import { api, type RouterOutputs } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { ConfirmationDialog } from '@/components/admin/confirmation-dialog';

type Summary = RouterOutputs['academicInventory']['gapPlansForAssignment'];
type Plan = Summary['plans'][number];

const LEVEL_SIZE = 12;
const LEVELS = Array.from({ length: Math.ceil(PACE_CATALOGUE.length / LEVEL_SIZE) }, (_, i) => i);
const FIRST_PACE = PACE_CATALOGUE[0] ?? 1001;
const LAST_PACE = PACE_CATALOGUE[PACE_CATALOGUE.length - 1] ?? 1144;

function levelIndexOf(paceNumber: number): number {
  return Math.max(
    0,
    Math.min(LEVELS.length - 1, Math.floor((paceNumber - FIRST_PACE) / LEVEL_SIZE)),
  );
}

export function PaceGapPlanPanel({
  studentId,
  subjectId,
  initialGaps,
  initialJumpTo,
}: {
  studentId: string;
  subjectId: string;
  /** Prefill for a new plan, e.g. from a diagnostic result. Ignored when a plan exists. */
  initialGaps?: readonly number[];
  initialJumpTo?: number;
}) {
  const utils = api.useUtils();
  const enabled = Boolean(studentId && subjectId);
  const query = api.academicInventory.gapPlansForAssignment.useQuery(
    { studentId, subjectId },
    { enabled, retry: false },
  );
  const [selected, setSelected] = useState<number[]>([]);
  const [jumpTo, setJumpTo] = useState('');
  const [level, setLevel] = useState<number | null>(null);
  const lastClicked = useRef<number | null>(null);
  const [message, setMessage] = useState('');
  const [conflict, setConflict] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<Plan | null>(null);
  const activePlan = query.data?.plans.find((plan) => plan.status === 'Active');
  const reviewPlan = query.data?.plans.find((plan) => plan.reviewRequired);
  const completed = new Set(query.data?.completedPaceNumbers ?? []);

  const draftValues = useRef({ selected, jumpTo });
  draftValues.current = { selected, jumpTo };
  const initialRef = useRef({ initialGaps, initialJumpTo });
  initialRef.current = { initialGaps, initialJumpTo };
  const initialKey = JSON.stringify([initialGaps ?? null, initialJumpTo ?? null]);
  const baseline = useRef<{
    identity: string;
    selected: number[];
    jumpTo: string;
    plan: Plan | undefined;
    currentPaceNumber: number;
  } | null>(null);
  const [resetRevision, setResetRevision] = useState(0);
  function acceptLatest() {
    baseline.current = null;
    setResetRevision((value) => value + 1);
  }

  async function invalidateGapPlanDependencies() {
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
  }

  const pending = api.academicInventory.createGapPlan.useMutation({
    onSuccess: async (_, variables) => {
      if (baseline.current?.identity !== `${variables.studentId}:${variables.subjectId}:new`)
        return;
      acceptLatest();
      setConflict(false);
      setMessage('Gap PACEs started.');
      await invalidateGapPlanDependencies();
    },
    onError: (error) => {
      setMessage(error.message);
      setConflict(error.data?.code === 'CONFLICT');
    },
  });
  const update = api.academicInventory.updateGapPlan.useMutation({
    onSuccess: async (_, variables) => {
      if (baseline.current?.plan?.id !== variables.planId) return;
      acceptLatest();
      setConflict(false);
      setMessage('Gap plan saved.');
      await invalidateGapPlanDependencies();
    },
    onError: (error) => {
      setMessage(error.message);
      setConflict(error.data?.code === 'CONFLICT');
    },
  });
  const cancel = api.academicInventory.cancelGapPlan.useMutation({
    onSuccess: async (_, variables) => {
      if (baseline.current?.plan?.id !== variables.planId) return;
      acceptLatest();
      setCancelTarget(null);
      setMessage('Gap plan cancelled. The student is at its configured destination.');
      await invalidateGapPlanDependencies();
    },
    onError: (error) => {
      setMessage(error.message);
    },
  });
  const review = api.academicInventory.reviewGapPlan.useMutation({
    onSuccess: async (_, variables) => {
      if (baseline.current?.plan?.id !== variables.planId) return;
      acceptLatest();
      setMessage('Gap plan review resolved.');
      await invalidateGapPlanDependencies();
    },
    onError: (error) => {
      setMessage(error.message);
    },
  });
  const busy = pending.isPending || update.isPending || cancel.isPending || review.isPending;

  useEffect(() => {
    if (!query.data) return;
    const plan = activePlan ?? reviewPlan;
    const identity = `${studentId}:${subjectId}:${plan?.id ?? 'new'}`;
    const previous = baseline.current;
    const samePlan = previous?.identity === identity;
    const selectedDirty =
      samePlan &&
      JSON.stringify(draftValues.current.selected) !== JSON.stringify(previous.selected);
    const jumpDirty = samePlan && draftValues.current.jumpTo !== previous.jumpTo;
    const prefill = plan ? undefined : initialRef.current;
    const nextSelected =
      plan?.items
        .filter((item) => !item.removed && !item.completed)
        .map((item) => item.paceNumber) ?? [...(prefill?.initialGaps ?? [])].sort((a, b) => a - b);
    const nextJump = String(
      activePlan?.jumpToPaceNumber ?? prefill?.initialJumpTo ?? query.data.currentPaceNumber,
    );
    if (!selectedDirty) setSelected(nextSelected);
    if (!jumpDirty) setJumpTo(nextJump);
    baseline.current = {
      identity,
      selected: selectedDirty ? previous.selected : nextSelected,
      jumpTo: jumpDirty ? previous.jumpTo : nextJump,
      // A dirty draft must keep its original concurrency token even after a live refetch.
      plan: samePlan && (selectedDirty || jumpDirty) ? previous.plan : plan,
      currentPaceNumber:
        samePlan && (selectedDirty || jumpDirty)
          ? previous.currentPaceNumber
          : query.data.currentPaceNumber,
    };
    if (!samePlan) {
      setMessage('');
      setConflict(false);
      setCancelTarget(null);
      setLevel(null);
      lastClicked.current = null;
    }
  }, [studentId, subjectId, query.data, activePlan, reviewPlan, resetRevision, initialKey]);

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

  const jumpNumber = Number(jumpTo);
  const sortedSelected = [...selected].sort((a, b) => a - b);
  const editablePlan: Plan | undefined = activePlan;
  const reviewedPlan = activePlan ?? reviewPlan;
  const maxRetainedGap = Math.max(
    ...(reviewedPlan?.items.filter((item) => !item.removed).map((item) => item.paceNumber) ?? []),
    ...(sortedSelected.length ? sortedSelected : [0]),
  );
  const lockedPaces = new Set([
    ...completed,
    ...(editablePlan?.items.filter((item) => !item.removed && item.completed) ?? []).map(
      (item) => item.paceNumber,
    ),
  ]);
  const activeLevel = level ?? levelIndexOf(query.data.currentPaceNumber);
  const visiblePaces = PACE_CATALOGUE.slice(
    activeLevel * LEVEL_SIZE,
    activeLevel * LEVEL_SIZE + LEVEL_SIZE,
  );
  const selectedPerLevel = LEVELS.map(
    (index) => sortedSelected.filter((pace) => levelIndexOf(pace) === index).length,
  );
  const afterLastGap = maxRetainedGap + 1;
  let jumpProblem = '';
  if (!Number.isInteger(jumpNumber) || jumpNumber < FIRST_PACE || jumpNumber > LAST_PACE) {
    jumpProblem = `Enter a PACE between ${String(FIRST_PACE)} and ${String(LAST_PACE)}.`;
  } else if (sortedSelected.some((pace) => pace >= jumpNumber)) {
    jumpProblem = `Must be higher than the last gap (PACE ${String(maxRetainedGap)}).`;
  } else if (completed.has(jumpNumber)) {
    jumpProblem = `PACE ${String(jumpNumber)} is already completed. Choose an incomplete PACE.`;
  }
  const togglePace = (pace: number, shiftKey: boolean) => {
    const anchor = lastClicked.current;
    lastClicked.current = pace;
    setSelected((current) => {
      if (shiftKey && anchor !== null && anchor !== pace) {
        const from = Math.min(anchor, pace);
        const to = Math.max(anchor, pace);
        const range = PACE_CATALOGUE.filter(
          (value) => value >= from && value <= to && !lockedPaces.has(value),
        );
        return [...new Set([...current, ...range])].sort((a, b) => a - b);
      }
      return current.includes(pace)
        ? current.filter((value) => value !== pace)
        : [...current, pace].sort((a, b) => a - b);
    });
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
        expectedVersion: baseline.current?.plan?.version ?? editablePlan.version,
        remainingPaceNumbers: sortedSelected,
        jumpToPaceNumber: jumpNumber,
      });
    } else {
      pending.mutate({
        studentId,
        subjectId,
        paceNumbers: sortedSelected,
        jumpToPaceNumber: jumpNumber,
        expectedCurrentPaceNumber:
          baseline.current?.currentPaceNumber ?? query.data.currentPaceNumber,
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
                  expectedVersion: baseline.current?.plan?.version ?? reviewPlan.version,
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
      <section className="pace-gap__step" aria-labelledby="pace-gap-step-gaps">
        <h3 className="pace-gap__step-title" id="pace-gap-step-gaps">
          <span aria-hidden="true">1</span> Missing PACEs
        </h3>
        <div className="pace-gap__levels" role="group" aria-label="PACE level">
          {LEVELS.map((index) => (
            <button
              key={index}
              type="button"
              className="pace-gap__level"
              aria-current={index === activeLevel ? 'true' : undefined}
              aria-label={`Level ${String(index + 1)}, PACEs ${String(FIRST_PACE + index * LEVEL_SIZE)} to ${String(FIRST_PACE + index * LEVEL_SIZE + LEVEL_SIZE - 1)}${selectedPerLevel[index] ? `, ${String(selectedPerLevel[index])} selected` : ''}`}
              onClick={() => {
                setLevel(index);
              }}
            >
              L{index + 1}
              {selectedPerLevel[index] ? (
                <span className="pace-gap__level-count" aria-hidden="true">
                  {selectedPerLevel[index]}
                </span>
              ) : null}
            </button>
          ))}
        </div>
        <div className="pace-gap__tiles">
          {visiblePaces.map((pace) => {
            const locked = lockedPaces.has(pace);
            const picked = !locked && selected.includes(pace);
            return (
              <button
                key={pace}
                type="button"
                className="pace-gap__tile"
                aria-pressed={locked ? undefined : picked}
                aria-label={`PACE ${String(pace)}${locked ? ', already completed' : picked ? ', gap' : ''}`}
                data-state={locked ? 'done' : picked ? 'gap' : 'idle'}
                disabled={locked || busy}
                onClick={(event) => {
                  togglePace(pace, event.shiftKey);
                }}
              >
                {pace}
                {locked ? (
                  <span className="pace-gap__tile-mark" aria-hidden="true">
                    ✓
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
        <p className="field__hint">Tap a PACE to mark it as a gap. Shift-click selects a range.</p>
        <div className="pace-gap__chips" aria-live="polite">
          {sortedSelected.length ? (
            <>
              {sortedSelected.map((pace) => (
                <button
                  key={pace}
                  type="button"
                  className="pace-gap__chip"
                  aria-label={`Remove PACE ${String(pace)}`}
                  disabled={busy}
                  onClick={() => {
                    setSelected((current) => current.filter((value) => value !== pace));
                  }}
                >
                  {pace} <span aria-hidden="true">✕</span>
                </button>
              ))}
              <button
                type="button"
                className="pace-gap__clear"
                disabled={busy}
                onClick={() => {
                  setSelected([]);
                }}
              >
                Clear all
              </button>
            </>
          ) : (
            <span className="field__hint">No gaps selected yet.</span>
          )}
        </div>
      </section>

      <section className="pace-gap__step" aria-labelledby="pace-gap-step-resume">
        <h3 className="pace-gap__step-title" id="pace-gap-step-resume">
          <span aria-hidden="true">2</span> Resume at PACE
        </h3>
        <div className="pace-gap__resume">
          <label className="field">
            <span className="field__label">After the gaps, continue from</span>
            <input
              className="input pace-gap__resume-input"
              type="number"
              inputMode="numeric"
              min={Math.max(afterLastGap, FIRST_PACE)}
              max={LAST_PACE}
              value={jumpTo}
              disabled={busy}
              aria-invalid={sortedSelected.length > 0 && jumpProblem ? true : undefined}
              aria-describedby="pace-gap-resume-hint"
              onChange={(event) => {
                setJumpTo(event.target.value);
              }}
            />
          </label>
          {sortedSelected.length > 0 && afterLastGap <= LAST_PACE && jumpNumber !== afterLastGap ? (
            <button
              type="button"
              className="pace-gap__suggest"
              disabled={busy}
              onClick={() => {
                setJumpTo(String(afterLastGap));
              }}
            >
              Use PACE {afterLastGap} (after last gap)
            </button>
          ) : null}
        </div>
        <p
          className={sortedSelected.length > 0 && jumpProblem ? 'pace-gap__error' : 'field__hint'}
          id="pace-gap-resume-hint"
          role={sortedSelected.length > 0 && jumpProblem ? 'alert' : undefined}
        >
          {sortedSelected.length > 0 && jumpProblem
            ? jumpProblem
            : 'Must be higher than every gap. The student jumps here once the gaps are done.'}
        </p>
      </section>
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
              acceptLatest();
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
