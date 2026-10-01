import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { PACE_CATALOGUE } from '@oasis/domain';
import { api } from '../../lib/trpc';
import { C } from '../core/mobile-theme';
import { Card, ErrorText, Field, MobileButton, MutedText, SectionTitle } from '../core/mobile-ui';

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
  const [selected, setSelected] = useState<number[]>([]);
  const [jumpTo, setJumpTo] = useState('');
  const [rangeFrom, setRangeFrom] = useState('');
  const [rangeTo, setRangeTo] = useState('');
  const [page, setPage] = useState(0);
  const [message, setMessage] = useState('');
  const [conflict, setConflict] = useState(false);
  const active = query.data?.plans.find((plan) => plan.status === 'Active');
  const reviewPlan = query.data?.plans.find((plan) => plan.reviewRequired);
  const completed = new Set(query.data?.completedPaceNumbers ?? []);
  const create = api.academicInventory.createGapPlan.useMutation({
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
  const busy = create.isPending || update.isPending || cancel.isPending || review.isPending;

  useEffect(() => {
    setSelected(
      active?.items
        .filter((item) => !item.removed && !item.completed)
        .map((item) => item.paceNumber) ?? [],
    );
    setJumpTo(String(active?.jumpToPaceNumber ?? query.data?.currentPaceNumber ?? ''));
    setMessage('');
  }, [studentId, subjectId, query.data?.currentPaceNumber, active?.id, active?.version]);

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

  const numbers = PACE_CATALOGUE.slice(page * 12, page * 12 + 12);
  const sorted = [...selected].sort((a, b) => a - b);
  const jump = Number(jumpTo);
  const start = () => {
    if (!Number.isInteger(jump) || sorted.length === 0 || sorted.some((pace) => pace >= jump)) {
      setMessage('Select gap PACEs and a higher destination.');
      return;
    }
    setMessage('');
    if (active)
      update.mutate({
        planId: active.id,
        expectedVersion: active.version,
        remainingPaceNumbers: sorted,
        jumpToPaceNumber: jump,
      });
    else
      create.mutate({
        studentId,
        subjectId,
        paceNumbers: sorted,
        jumpToPaceNumber: jump,
        expectedCurrentPaceNumber: query.data.currentPaceNumber,
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
      <Field
        label="Jump to PACE"
        value={jumpTo}
        onChangeText={setJumpTo}
        keyboardType="numeric"
        disabled={busy}
      />
      <SectionTitle>
        Missing PACEs · {String(numbers[0])}–{String(numbers[numbers.length - 1])}
      </SectionTitle>
      <View style={styles.row}>
        <MobileButton
          compact
          variant="secondary"
          label="Previous 12"
          disabled={page === 0 || busy}
          onPress={() => {
            setPage((value) => value - 1);
          }}
        />
        <MobileButton
          compact
          variant="secondary"
          label="Next 12"
          disabled={(page + 1) * 12 >= PACE_CATALOGUE.length || busy}
          onPress={() => {
            setPage((value) => value + 1);
          }}
        />
      </View>
      <View style={styles.grid}>
        {numbers.map((pace) => {
          const locked = completed.has(pace);
          const checked = locked || selected.includes(pace);
          return (
            <Pressable
              key={pace}
              accessibilityRole="checkbox"
              accessibilityState={{ checked, disabled: locked || busy }}
              disabled={locked || busy}
              onPress={() => {
                setSelected((current) =>
                  checked
                    ? current.filter((value) => value !== pace)
                    : [...new Set([...current, pace])].sort((a, b) => a - b),
                );
              }}
              style={[styles.pace, checked ? styles.paceSelected : null]}
            >
              <Text style={styles.paceText}>
                PACE {pace}
                {locked ? ' · Already completed' : ''}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.range}>
        <View style={styles.rangeField}>
          <Field
            label="Range from"
            value={rangeFrom}
            onChangeText={setRangeFrom}
            keyboardType="numeric"
          />
        </View>
        <View style={styles.rangeField}>
          <Field
            label="Range to"
            value={rangeTo}
            onChangeText={setRangeTo}
            keyboardType="numeric"
          />
        </View>
      </View>
      <MobileButton label="Add Range" variant="secondary" disabled={busy} onPress={addRange} />
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
            void query.refetch().then(() => {
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
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 8 },
  pace: {
    minHeight: 48,
    minWidth: '47%',
    padding: 10,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    backgroundColor: C.surface,
  },
  paceSelected: { borderColor: C.blue, backgroundColor: C.blueLight },
  paceText: { color: C.textPrimary, fontSize: 14 },
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
