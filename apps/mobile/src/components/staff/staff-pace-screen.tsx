import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useClerk } from '@clerk/clerk-expo';
import { api, type RouterOutputs } from '../../lib/trpc';
import { C } from '../core/mobile-theme';
import { PortalMobileHeader } from '../core/portal-mobile-shell';
import { StaffPaceFormCard } from './staff-pace-form';
import { StaffPaceStudentPicker } from './staff-pace-student-picker';
import { StaffPaceSubjectPanel } from './staff-pace-subject-panel';
import {
  addDays,
  dateFromKey,
  dateKeyInSchoolTimeZone,
  formatPaceDate,
  hasPaceFormErrors,
  paceNumberValue,
  paceRecordStatus,
  scoreValue,
  validatePaceForm,
  type PaceFormState,
} from './staff-pace-utils';

type SessionUser = NonNullable<RouterOutputs['health']['me']['user']>;
type PaceSubject = RouterOutputs['pace']['forStudent']['subjects'][number];
type PaceWarnings = RouterOutputs['pace']['forStudent']['warnings'];

function newPaceForm(): PaceFormState {
  return {
    paceNumber: '',
    score: '',
    selectedStudentId: '',
    subjectId: '',
    testType: 'SelfTest',
  };
}

function formForSubject(current: PaceFormState, subject: PaceSubject | null): PaceFormState {
  if (!subject) return current;
  const hasCurrentSubject = current.subjectId === subject.subjectId;
  return {
    ...current,
    paceNumber: hasCurrentSubject ? current.paceNumber : String(subject.currentPaceNumber),
    subjectId: hasCurrentSubject ? current.subjectId : subject.subjectId,
    testType: hasCurrentSubject
      ? current.testType
      : subject.latestSelfTest
        ? 'FinalTest'
        : 'SelfTest',
  };
}

function blockedReason({
  dateKey,
  form,
  subject,
  warnings,
}: {
  dateKey: string;
  form: PaceFormState;
  subject: PaceSubject | null;
  warnings: PaceWarnings | null;
}): string | null {
  if (warnings?.atLimit) return 'The daily PACE test limit has been reached for this student.';
  const paceNumber = paceNumberValue(form.paceNumber);
  if (!subject || paceNumber === null) return null;
  if (form.testType === 'FinalTest' && !subject.selfTestPaceNumbers.includes(paceNumber)) {
    return 'Record a Self-Test before saving a PACE Test for this PACE number.';
  }
  if (!warnings) return null;
  const oppositeType = form.testType === 'SelfTest' ? 'FinalTest' : 'SelfTest';
  const hasOppositeToday = subject.recentRecords.some((record) => {
    const completedAt = record.completedAt ?? record.createdAt;
    const recordDate = new Date(completedAt).toISOString().slice(0, 10);
    return (
      record.paceNumber === paceNumber && record.testType === oppositeType && recordDate === dateKey
    );
  });
  return hasOppositeToday
    ? 'This PACE number already has the opposite test type recorded today.'
    : null;
}

export function StaffPaceScreen({
  onBack,
  user,
}: {
  onBack: () => void;
  user: SessionUser | undefined;
}) {
  const { signOut } = useClerk();
  const utils = api.useUtils();
  const [dateKey, setDateKey] = useState(() => dateKeyInSchoolTimeZone(new Date()));
  const [form, setForm] = useState<PaceFormState>(() => newPaceForm());
  const [submitted, setSubmitted] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const roster = api.pace.roster.useQuery({ date: dateFromKey(dateKey) }, { retry: false });
  const rosterStudents = roster.data?.students ?? [];
  const selectedStudentId = form.selectedStudentId || rosterStudents[0]?.studentId || '';
  const selectedStudent =
    rosterStudents.find((student) => student.studentId === selectedStudentId) ?? null;
  const pace = api.pace.forStudent.useQuery(
    { date: dateFromKey(dateKey), studentId: selectedStudentId },
    { enabled: selectedStudentId.length > 0, retry: false },
  );
  const subjects = pace.data?.subjects ?? [];
  const selectedSubject =
    subjects.find((subject) => subject.subjectId === form.subjectId) ?? subjects[0] ?? null;
  const formWithDefaults = useMemo(
    () => formForSubject({ ...form, selectedStudentId }, selectedSubject),
    [form, selectedStudentId, selectedSubject],
  );
  const errors = useMemo(() => validatePaceForm(formWithDefaults), [formWithDefaults]);
  const block = blockedReason({
    dateKey,
    form: formWithDefaults,
    subject: selectedSubject,
    warnings: pace.data?.warnings ?? null,
  });

  const recordPace = api.pace.record.useMutation({
    onError: (error) => {
      setStatusMessage(error.message);
    },
    onSuccess: async (result) => {
      setStatusMessage(paceRecordStatus(result));
      setForm((current) => ({
        ...current,
        paceNumber: result.newPaceNumber ? String(result.newPaceNumber) : current.paceNumber,
        score: '',
        testType: result.advanced ? 'SelfTest' : current.testType,
      }));
      setSubmitted(false);
      await Promise.all([
        utils.pace.forStudent.invalidate({
          date: dateFromKey(dateKey),
          studentId: result.studentId,
        }),
        utils.pace.roster.invalidate({ date: dateFromKey(dateKey) }),
        utils.staffHome.summary.invalidate(),
      ]);
    },
  });

  async function refresh() {
    await Promise.all([roster.refetch(), pace.refetch()]);
  }

  function changeDate(nextDate: string) {
    setDateKey(nextDate);
    setForm(newPaceForm());
    setSubmitted(false);
    setStatusMessage(null);
  }

  function submit() {
    setSubmitted(true);
    setStatusMessage(null);
    if (hasPaceFormErrors(errors) || block) return;
    const paceNumber = paceNumberValue(formWithDefaults.paceNumber);
    const score = scoreValue(formWithDefaults.score);
    if (paceNumber === null || score === null) return;
    recordPace.mutate({
      completedAt: dateFromKey(dateKey),
      paceNumber,
      score,
      studentId: formWithDefaults.selectedStudentId,
      subjectId: formWithDefaults.subjectId,
      testType: formWithDefaults.testType,
    });
  }

  return (
    <SafeAreaView style={styles.shell}>
      <PortalMobileHeader
        actionAccessibilityLabel="Sign out of staff account"
        actionLabel="Out"
        avatarLabel="S"
        eyebrow="Staff Portal"
        onActionPress={() => {
          void signOut();
        }}
        subtitle={`${user?.role ?? 'Staff'} · PACE`}
        title="Oasis Learning Centre"
        variant="dark"
      />
      <View style={styles.content}>
        <View style={styles.topRow}>
          <Pressable
            accessibilityLabel="Back to staff home"
            accessibilityRole="button"
            onPress={onBack}
            style={styles.backButton}
          >
            <Text style={styles.backButtonText}>Back</Text>
          </Pressable>
          <View style={styles.titleGroup}>
            <Text style={styles.eyebrow}>PACE score entry</Text>
            <Text style={styles.title}>Record student test scores</Text>
          </View>
        </View>

        <View style={styles.dateCard}>
          <Text style={styles.dateLabel}>{formatPaceDate(dateKey)}</Text>
          <View style={styles.dateActions}>
            <DateButton
              label="Prev"
              onPress={() => {
                changeDate(addDays(dateKey, -1));
              }}
            />
            <DateButton
              label="Today"
              onPress={() => {
                changeDate(dateKeyInSchoolTimeZone(new Date()));
              }}
            />
            <DateButton
              label="Next"
              onPress={() => {
                changeDate(addDays(dateKey, 1));
              }}
            />
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              onRefresh={() => {
                void refresh();
              }}
              refreshing={roster.isFetching || pace.isFetching || recordPace.isPending}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {statusMessage ? (
            <View
              style={[
                styles.statusMessage,
                recordPace.error ? styles.errorMessage : styles.successMessage,
              ]}
            >
              <Text
                style={[
                  styles.statusMessageText,
                  recordPace.error ? styles.errorMessageText : styles.successMessageText,
                ]}
              >
                {statusMessage}
              </Text>
            </View>
          ) : null}

          <StaffPaceStudentPicker
            error={roster.error?.message ?? null}
            loading={roster.isLoading}
            onSelect={(studentId) => {
              setForm({ ...newPaceForm(), selectedStudentId: studentId });
              setStatusMessage(null);
              setSubmitted(false);
            }}
            rows={rosterStudents}
            selectedStudentId={selectedStudentId}
          />
          {submitted && errors.selectedStudentId ? (
            <Text style={styles.validationText}>{errors.selectedStudentId}</Text>
          ) : null}

          <StaffPaceFormCard
            blockedReason={block}
            errors={errors}
            form={formWithDefaults}
            onChange={setForm}
            onSubmit={submit}
            saving={recordPace.isPending}
            selectedStudentName={selectedStudent ? selectedStudent.studentName : 'None selected'}
            subjects={subjects}
            submitted={submitted}
            warnings={pace.data?.warnings ?? null}
          />

          <StaffPaceSubjectPanel
            error={pace.error?.message ?? null}
            loading={pace.isLoading}
            subjects={subjects}
          />
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

function DateButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.dateButton}>
      <Text style={styles.dateButtonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backButton: {
    alignItems: 'center',
    borderColor: C.border,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 40,
    paddingHorizontal: 12,
  },
  backButtonText: {
    color: C.blue,
    fontSize: 13,
    fontWeight: '800',
  },
  content: {
    flex: 1,
    gap: 14,
    padding: 16,
  },
  dateActions: {
    flexDirection: 'row',
    gap: 8,
  },
  dateButton: {
    alignItems: 'center',
    backgroundColor: C.surface,
    borderColor: C.border,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    minHeight: 36,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  dateButtonText: {
    color: C.blue,
    fontSize: 12,
    fontWeight: '900',
  },
  dateCard: {
    backgroundColor: C.surface,
    borderColor: C.border,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
    padding: 12,
  },
  dateLabel: {
    color: C.navy,
    fontSize: 15,
    fontWeight: '900',
  },
  errorMessage: {
    backgroundColor: C.dangerBg,
    borderColor: C.dangerMid,
  },
  errorMessageText: {
    color: C.danger,
  },
  eyebrow: {
    color: C.textMuted,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  scrollContent: {
    gap: 12,
    paddingBottom: 28,
  },
  shell: {
    backgroundColor: C.bg,
    flex: 1,
  },
  statusMessage: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  statusMessageText: {
    fontSize: 12,
    fontWeight: '800',
  },
  successMessage: {
    backgroundColor: C.successBg,
    borderColor: C.successMid,
  },
  successMessageText: {
    color: C.success,
  },
  title: {
    color: C.navy,
    fontSize: 20,
    fontWeight: '900',
    lineHeight: 25,
  },
  titleGroup: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  topRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  validationText: {
    color: C.danger,
    fontSize: 12,
    fontWeight: '700',
  },
});
