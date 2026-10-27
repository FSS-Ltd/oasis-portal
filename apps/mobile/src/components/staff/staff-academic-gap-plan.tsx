import { useCallback, useEffect, useRef, useState, type SetStateAction } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { PACE_CATALOGUE } from '@oasis/domain';
import { api } from '../../lib/trpc';
import { C } from '../core/mobile-theme';
import { Card, ErrorText, Field, MobileButton, MutedText, SectionTitle } from '../core/mobile-ui';

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

export function StaffAcademicGapPlan({
  studentId,
  subjectId,
}: {
  studentId: string;
  subjectId: string;
}) {
  const utils = api.useUtils();
  const query = api.academicInventory.gapPlansForAssignment.useQuery(
    { studentId, subjectId },
    { enabled: Boolean(studentId && subjectId), retry: false },
  );
  const [selected, setSelectedState] = useState<number[]>([]);
  const [jumpTo, setJumpToState] = useState('');
  const dirty = useRef(false);
  // Keep the original optimistic version until this draft is saved or explicitly refreshed.
  const baseline = useRef<{
    identity: string;
    version: number | undefined;
    currentPace: number | undefined;
  }>();
  const [rangeFrom, setRangeFrom] = useState('');
  const [rangeTo, setRangeTo] = useState('');
  const [level, setLevel] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const [conflict, setConflict] = useState(false);
  const active = query.data?.plans.find((plan) => plan.status === 'Active');
  const reviewPlan = query.data?.plans.find((plan) => plan.reviewRequired);
  const completed = new Set(query.data?.completedPaceNumbers ?? []);
  const currentIdentity = useRef({
    studentId,
    subjectId,
    activeId: active?.id,
    reviewId: reviewPlan?.id,
  });
  currentIdentity.current = {
    studentId,
    subjectId,
    activeId: active?.id,
    reviewId: reviewPlan?.id,
  };

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

  const create = api.academicInventory.createGapPlan.useMutation({
    onSuccess: async (_data, variables) => {
      if (
        currentIdentity.current.studentId !== variables.studentId ||
        currentIdentity.current.subjectId !== variables.subjectId ||
        currentIdentity.current.activeId !== undefined
      )
        return;
      dirty.current = false;
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
    onSuccess: async (_data, variables) => {
      if (currentIdentity.current.activeId !== variables.planId) return;
      dirty.current = false;
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
    onSuccess: async (_data, variables) => {
      if (currentIdentity.current.activeId !== variables.planId) return;
      dirty.current = false;
      setMessage('Gap plan cancelled. The student is at its configured destination.');
      await invalidateGapPlanDependencies();
    },
    onError: (error) => {
      setMessage(error.message);
    },
  });
  const review = api.academicInventory.reviewGapPlan.useMutation({
    onSuccess: async (_data, variables) => {
      if (currentIdentity.current.reviewId !== variables.planId) return;
      dirty.current = false;
      setMessage('Gap plan review resolved.');
      await invalidateGapPlanDependencies();
    },
    onError: (error) => {
      setMessage(error.message);
    },
  });
  const busy = create.isPending || update.isPending || cancel.isPending || review.isPending;

  const resetDraft = useCallback(
    (data: typeof query.data) => {
      const plan = data?.plans.find((entry) => entry.status === 'Active');
      baseline.current = {
        identity: JSON.stringify([studentId, subjectId, plan?.id]),
        version: plan?.version,
        currentPace: data?.currentPaceNumber,
      };
      dirty.current = false;
      setConflict(false);
      setSelectedState(
        plan?.items
          .filter((item) => !item.removed && !item.completed)
          .map((item) => item.paceNumber) ?? [],
      );
      setRangeFrom('');
      setRangeTo('');
      setLevel(null);
      setJumpToState(String(plan?.jumpToPaceNumber ?? data?.currentPaceNumber ?? ''));
      setMessage('');
    },
    [studentId, subjectId],
  );
  const draftIdentity = JSON.stringify([studentId, subjectId, active?.id]);
  useEffect(() => {
    if (baseline.current?.identity === draftIdentity && dirty.current) return;
    resetDraft(query.data);
  }, [draftIdentity, query.data, resetDraft]);

  function setSelected(value: SetStateAction<number[]>) {
    dirty.current = true;
    setSelectedState(value);
  }

  function setJumpTo(value: string) {
    dirty.current = true;
    setJumpToState(value);
  }

  if (!studentId || !subjectId)
    return (
      <Card>
        <MutedText>Choose a student and assigned subject to manage gap PACEs.</MutedText>
      </Card>
    );
  if (query.isLoading)
    return (
      <Card>
        <MutedText>Loading gap PACEs…</MutedText>
      </Card>
    );
  if (query.isError || !query.data)
    return (
      <Card>
        <ErrorText>Gap PACEs could not be loaded.</ErrorText>
        <MobileButton
          label="Retry"
          variant="secondary"
          onPress={() => {
            void query.refetch();
          }}
        />
      </Card>
    );

  const sorted = [...selected].sort((a, b) => a - b);
  const jump = Number(jumpTo);
  const activeLevel = level ?? levelIndexOf(query.data.currentPaceNumber);
  const numbers = PACE_CATALOGUE.slice(
    activeLevel * LEVEL_SIZE,
    activeLevel * LEVEL_SIZE + LEVEL_SIZE,
  );
  const lastGap = sorted.length ? Math.max(...sorted) : 0;
  const afterLastGap = lastGap + 1;
  let jumpProblem = '';
  if (!Number.isInteger(jump) || jump < FIRST_PACE || jump > LAST_PACE) {
    jumpProblem = `Enter a PACE between ${String(FIRST_PACE)} and ${String(LAST_PACE)}.`;
  } else if (sorted.some((pace) => pace >= jump)) {
    jumpProblem = `Must be higher than the last gap (PACE ${String(lastGap)}).`;
  } else if (completed.has(jump)) {
    jumpProblem = `PACE ${String(jump)} is already completed. Choose an incomplete PACE.`;
  }
  const start = () => {
    if (!Number.isInteger(jump) || sorted.length === 0 || sorted.some((pace) => pace >= jump)) {
      setMessage('Select gap PACEs and a higher destination.');
      return;
    }
    setMessage('');
    if (active)
      update.mutate({
        planId: active.id,
        expectedVersion: baseline.current?.version ?? active.version,
        remainingPaceNumbers: sorted,
        jumpToPaceNumber: jump,
      });
    else
      create.mutate({
        studentId,
        subjectId,
        paceNumbers: sorted,
        jumpToPaceNumber: jump,
        expectedCurrentPaceNumber: baseline.current?.currentPace ?? query.data.currentPaceNumber,
      });
  };
  const addRange = () => {
    const from = Number(rangeFrom);
    const to = Number(rangeTo);
    if (!Number.isInteger(from) || !Number.isInteger(to) || from > to || from < 1001 || to > 1144) {
      setMessage('Enter a valid PACE range from 1001 to 1144.');
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
  return (
    <Card>
      <SectionTitle>Gap PACEs</SectionTitle>
      <MutedText>
        Current PACE #{String(query.data.currentPaceNumber)}
        {active
          ? ` · ${String(active.items.filter((item) => !item.removed && item.completed).length)} of ${String(active.items.filter((item) => !item.removed).length)} gaps completed`
          : ''}
      </MutedText>
      {reviewPlan ? (
        <View style={styles.review}>
          <Text accessibilityRole="alert" style={styles.reviewText}>
            Needs Head review. Advancement is paused because a test correction changed completion
            evidence.
          </Text>
          <MobileButton
            label="Reopen Gap PACEs"
            disabled={busy}
            onPress={() => {
              review.mutate({
                planId: reviewPlan.id,
                expectedVersion: reviewPlan.version,
                decision: 'Reopen',
                jumpToPaceNumber: jump,
              });
            }}
          />
          <MobileButton
            label="Resume Advancement"
            variant="secondary"
            disabled={busy}
            onPress={() => {
              confirmCancel(reviewPlan.id, reviewPlan.version, null);
            }}
          />
        </View>
      ) : null}
      <SectionTitle>1 · Missing PACEs</SectionTitle>
      <View accessibilityRole="tablist" style={styles.levels}>
        {LEVELS.map((index) => {
          const count = sorted.filter((pace) => levelIndexOf(pace) === index).length;
          return (
            <Pressable
              key={index}
              accessibilityRole="tab"
              accessibilityLabel={`Level ${String(index + 1)}${count ? `, ${String(count)} selected` : ''}`}
              accessibilityState={{ selected: index === activeLevel }}
              onPress={() => {
                setLevel(index);
              }}
              style={[styles.level, index === activeLevel ? styles.levelActive : null]}
            >
              <Text
                style={[styles.levelText, index === activeLevel ? styles.levelTextActive : null]}
              >
                L{String(index + 1)}
                {count ? ` · ${String(count)}` : ''}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.grid}>
        {numbers.map((pace) => {
          const locked = completed.has(pace);
          const picked = !locked && selected.includes(pace);
          return (
            <Pressable
              key={pace}
              accessibilityRole="button"
              accessibilityLabel={`PACE ${String(pace)}${locked ? ', already completed' : picked ? ', gap' : ''}`}
              accessibilityState={{ selected: picked, disabled: locked || busy }}
              disabled={locked || busy}
              onPress={() => {
                setSelected((current) =>
                  picked
                    ? current.filter((value) => value !== pace)
                    : [...new Set([...current, pace])].sort((a, b) => a - b),
                );
              }}
              style={[
                styles.pace,
                picked ? styles.paceSelected : null,
                locked ? styles.paceDone : null,
              ]}
            >
              <Text style={[styles.paceText, picked ? styles.paceTextSelected : null]}>
                {pace}
                {locked ? ' ✓' : ''}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.chips}>
        {sorted.length ? (
          sorted.map((pace) => (
            <Pressable
              key={pace}
              accessibilityRole="button"
              accessibilityLabel={`Remove PACE ${String(pace)}`}
              disabled={busy}
              onPress={() => {
                setSelected((current) => current.filter((value) => value !== pace));
              }}
              style={styles.chip}
            >
              <Text style={styles.chipText}>{pace} ✕</Text>
            </Pressable>
          ))
        ) : (
          <MutedText>No gaps selected yet.</MutedText>
        )}
      </View>
      <View style={styles.range}>
        <View style={styles.rangeField}>
          <Field
            disabled={busy}
            label="Range from"
            value={rangeFrom}
            onChangeText={(value) => {
              dirty.current = true;
              setRangeFrom(value);
            }}
            keyboardType="numeric"
          />
        </View>
        <View style={styles.rangeField}>
          <Field
            disabled={busy}
            label="Range to"
            value={rangeTo}
            onChangeText={(value) => {
              dirty.current = true;
              setRangeTo(value);
            }}
            keyboardType="numeric"
          />
        </View>
      </View>
      <MobileButton label="Add Range" variant="secondary" disabled={busy} onPress={addRange} />
      <SectionTitle>2 · Resume at PACE</SectionTitle>
      <Field
        label="Jump to PACE"
        value={jumpTo}
        onChangeText={setJumpTo}
        keyboardType="numeric"
        disabled={busy}
      />
      {sorted.length > 0 && jumpProblem ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {jumpProblem}
        </Text>
      ) : null}
      {sorted.length > 0 && afterLastGap <= LAST_PACE && jump !== afterLastGap ? (
        <MobileButton
          compact
          variant="secondary"
          label={`Use PACE ${String(afterLastGap)} (after last gap)`}
          disabled={busy}
          onPress={() => {
            setJumpTo(String(afterLastGap));
          }}
        />
      ) : null}
      <Text accessibilityLiveRegion="polite" style={styles.preview}>
        {sorted.length
          ? `Complete ${sorted.join(', ')}, then jump to ${jumpTo || '…'}. Saving starts PACE ${String(sorted[0])}.`
          : 'Select one or more missing PACEs.'}
      </Text>
      {message ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {message}
        </Text>
      ) : null}
      {conflict ? (
        <MobileButton
          label="Refresh latest plan"
          variant="secondary"
          disabled={query.isFetching}
          onPress={() => {
            void query.refetch().then((result) => {
              resetDraft(result.data);
              setConflict(false);
              setMessage('Latest plan loaded. Review it before saving again.');
            });
          }}
        />
      ) : null}
      <MobileButton
        label={busy ? 'Saving…' : active ? 'Save Changes' : 'Start Gap PACEs'}
        disabled={busy || Boolean(reviewPlan) || conflict}
        onPress={start}
      />
      {active ? (
        <MobileButton
          variant="danger"
          disabled={busy}
          label="Cancel Gap Plan"
          onPress={() => {
            confirmCancel(active.id, active.version, active.jumpToPaceNumber);
          }}
        />
      ) : null}
      {query.data.plans.length > 0 ? (
        <MutedText>
          Plan history:{' '}
          {query.data.plans
            .map((plan) => `${plan.status} · jump ${String(plan.jumpToPaceNumber)}`)
            .join(' / ')}
        </MutedText>
      ) : null}
    </Card>
  );

  function confirmCancel(planId: string, expectedVersion: number, destination: number | null) {
    const message =
      destination === null
        ? 'This accepts the gaps as unresolved and clears this review blocker. The student stays on their current PACE.'
        : `Unfinished gaps are left incomplete and the student moves to PACE ${String(destination)}. Scores and plan history remain.`;
    Alert.alert(destination === null ? 'Resume advancement?' : 'Cancel gap plan?', message, [
      { text: 'Keep plan', style: 'cancel' },
      {
        text: destination === null ? 'Resume' : 'Cancel plan',
        style: 'destructive',
        onPress: () => {
          cancel.mutate({ planId, expectedVersion });
        },
      },
    ]);
  }
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, marginVertical: 8 },
  levels: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: 8 },
  level: {
    flexBasis: '15%',
    flexGrow: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    backgroundColor: C.surface,
  },
  levelActive: { borderColor: C.navy, backgroundColor: C.navy },
  levelText: { color: C.textSecondary, fontSize: 13, fontWeight: '600' },
  levelTextActive: { color: C.surface },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: 8 },
  pace: {
    flexBasis: '14%',
    flexGrow: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    backgroundColor: C.surface,
  },
  // A selected gap is circled, like the red rings on the printed diagnostic chart.
  paceSelected: {
    borderWidth: 2,
    borderColor: C.crimson,
    borderRadius: 999,
    backgroundColor: C.crimsonLight,
  },
  paceDone: { borderStyle: 'dashed', backgroundColor: C.bg },
  paceText: { color: C.textPrimary, fontSize: 14 },
  paceTextSelected: { color: C.crimson, fontWeight: '700' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: 8 },
  chip: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: C.crimson,
    borderRadius: 999,
    backgroundColor: C.surface,
  },
  chipText: { color: C.crimson, fontSize: 13 },
  range: { flexDirection: 'row', gap: 8 },
  rangeField: { flex: 1 },
  review: {
    gap: 8,
    marginVertical: 12,
    padding: 12,
    borderRadius: 10,
    backgroundColor: C.warningBg,
  },
  reviewText: { color: C.textPrimary, fontSize: 15, lineHeight: 21 },
  error: { color: C.danger, fontSize: 14, lineHeight: 20 },
  preview: { marginVertical: 12, color: C.textPrimary, fontSize: 15, lineHeight: 21 },
});
