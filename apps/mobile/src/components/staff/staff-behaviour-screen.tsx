import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useClerk } from '@clerk/clerk-expo';
import { api, type RouterOutputs } from '../../lib/trpc';
import { C } from '../core/mobile-theme';
import { PortalMobileHeader } from '../core/portal-mobile-shell';
import { BehaviourFormCard } from './staff-behaviour-form';
import { BehaviourRecentPanel } from './staff-behaviour-recent-panel';
import { BehaviourStudentPicker } from './staff-behaviour-student-picker';
import {
  addDays,
  dateFromKey,
  dateKeyInSchoolTimeZone,
  defaultCategory,
  formatBehaviourDate,
  behaviourAmountValue,
  hasBehaviourFormErrors,
  previewSingleDemeritStage,
  validateBehaviourForm,
  type BehaviourFormState,
  type BehaviourType,
} from './staff-behaviour-utils';

type SessionUser = NonNullable<RouterOutputs['health']['me']['user']>;

const initialType: BehaviourType = 'Merit';

function defaultAmountForType(nextType: BehaviourType, current: BehaviourFormState) {
  if (nextType === 'Demerit') return '1';
  if (nextType === 'Merit' && current.type !== 'Merit') return '1';
  return current.amount;
}

function defaultVisibilityForType(nextType: BehaviourType): BehaviourFormState['visibility'] {
  switch (nextType) {
    case 'Merit':
      return 'General';
    case 'Demerit':
    case 'General':
      return 'Sensitive';
  }
}

function newBehaviourForm(): BehaviourFormState {
  return {
    amount: '5',
    category: defaultCategory(initialType),
    note: '',
    selectedStudentId: '',
    type: initialType,
    visibility: 'General',
  };
}

export function StaffBehaviourScreen({
  onBack,
  user,
}: {
  onBack: () => void;
  user: SessionUser | undefined;
}) {
  const { signOut } = useClerk();
  const utils = api.useUtils();
  const [dateKey, setDateKey] = useState(() => dateKeyInSchoolTimeZone(new Date()));
  const [form, setForm] = useState<BehaviourFormState>(() => newBehaviourForm());
  const [submitted, setSubmitted] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const selectedDate = useMemo(() => dateFromKey(dateKey), [dateKey]);
  const roster = api.attendance.forDate.useQuery({ date: selectedDate }, { retry: false });
  const recent = api.behaviour.recentEntries.useQuery({ date: selectedDate }, { retry: false });
  const demeritStatuses = api.behaviour.dailyDemeritStatuses.useQuery(
    { date: selectedDate },
    { retry: false },
  );
  const studentRows = roster.data ?? [];
  const selectedStudentId = form.selectedStudentId || studentRows[0]?.studentId || '';
  const selectedStudent = studentRows.find((row) => row.studentId === selectedStudentId) ?? null;
  const selectedDemeritStatus =
    demeritStatuses.data?.statuses.find((status) => status.studentId === selectedStudentId) ?? null;
  const formWithSelectedStudent = useMemo(
    () => ({ ...form, selectedStudentId }),
    [form, selectedStudentId],
  );
  const errors = useMemo(
    () => validateBehaviourForm(formWithSelectedStudent),
    [formWithSelectedStudent],
  );
  const demeritPreview = useMemo(
    () =>
      formWithSelectedStudent.type === 'Demerit' && selectedStudentId
        ? previewSingleDemeritStage(
            selectedStudentId,
            selectedDemeritStatus,
            formWithSelectedStudent.category,
            formWithSelectedStudent.amount,
          )
        : null,
    [formWithSelectedStudent, selectedDemeritStatus, selectedStudentId],
  );

  const logBehaviour = api.behaviour.log.useMutation({
    onError: (error) => {
      setStatusMessage(error.message);
    },
    onSuccess: async (entry) => {
      setStatusMessage(`Behaviour saved: ${entry.type}`);
      setForm((current) => ({ ...current, note: '' }));
      setSubmitted(false);
      await Promise.all([
        utils.behaviour.recentEntries.invalidate({ date: dateFromKey(dateKey) }),
        utils.behaviour.dailyDemeritStatuses.invalidate({ date: dateFromKey(dateKey) }),
        utils.staffHome.summary.invalidate(),
      ]);
    },
  });

  async function refresh() {
    await Promise.all([roster.refetch(), recent.refetch(), demeritStatuses.refetch()]);
  }

  function changeDate(nextDate: string) {
    setDateKey(nextDate);
    setForm(newBehaviourForm());
    setSubmitted(false);
    setStatusMessage(null);
  }

  function submit() {
    setSubmitted(true);
    setStatusMessage(null);
    if (hasBehaviourFormErrors(errors)) return;
    logBehaviour.mutate({
      amount:
        formWithSelectedStudent.type === 'Merit' || formWithSelectedStudent.type === 'Demerit'
          ? behaviourAmountValue(form.amount)
          : undefined,
      category: formWithSelectedStudent.category.trim(),
      note: formWithSelectedStudent.note.trim(),
      studentId: formWithSelectedStudent.selectedStudentId,
      type: formWithSelectedStudent.type,
      visibility: formWithSelectedStudent.visibility,
    });
  }

  function changeBehaviourType(nextType: BehaviourType) {
    setForm((current) => ({
      ...current,
      amount: defaultAmountForType(nextType, current),
      category: defaultCategory(nextType),
      type: nextType,
      visibility: defaultVisibilityForType(nextType),
    }));
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
        subtitle={`${user?.role ?? 'Staff'} · Behaviour`}
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
            <Text style={styles.eyebrow}>Behaviour log</Text>
            <Text style={styles.title}>Record merit and demerit entries</Text>
          </View>
        </View>

        <View style={styles.dateCard}>
          <Text style={styles.dateLabel}>{formatBehaviourDate(dateKey)}</Text>
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
              refreshing={
                roster.isFetching ||
                recent.isFetching ||
                demeritStatuses.isFetching ||
                logBehaviour.isPending
              }
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {statusMessage ? (
            <View
              style={[
                styles.statusMessage,
                logBehaviour.error ? styles.errorMessage : styles.successMessage,
              ]}
            >
              <Text
                style={[
                  styles.statusMessageText,
                  logBehaviour.error ? styles.errorMessageText : styles.successMessageText,
                ]}
              >
                {statusMessage}
              </Text>
            </View>
          ) : null}

          <BehaviourStudentPicker
            error={roster.error?.message ?? null}
            loading={roster.isLoading}
            onSelect={(studentId) => {
              setForm((current) => ({ ...current, selectedStudentId: studentId }));
            }}
            rows={studentRows}
            selectedStudentId={selectedStudentId}
          />
          {submitted && errors.selectedStudentId ? (
            <Text style={styles.validationText}>{errors.selectedStudentId}</Text>
          ) : null}

          <BehaviourFormCard
            errors={errors}
            demeritPreview={demeritPreview}
            form={form}
            onChange={setForm}
            onSubmit={submit}
            onTypeChange={changeBehaviourType}
            saving={logBehaviour.isPending}
            selectedStudentName={selectedStudent ? selectedStudent.studentName : 'None selected'}
            submitted={submitted}
          />

          <BehaviourRecentPanel
            entries={recent.data?.entries ?? []}
            error={recent.error?.message ?? null}
            loading={recent.isLoading}
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
    padding: 10,
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
    lineHeight: 24,
  },
  titleGroup: {
    flex: 1,
    gap: 2,
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
