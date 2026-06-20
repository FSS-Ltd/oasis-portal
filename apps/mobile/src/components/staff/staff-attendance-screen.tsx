import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useClerk } from '@clerk/clerk-expo';
import { api, type RouterOutputs } from '../../lib/trpc';
import { C } from '../core/mobile-theme';
import { ErrorText, InlineSpinner } from '../core/mobile-ui';
import { PortalMobileHeader } from '../core/portal-mobile-shell';
import { AttendanceRoster, type AttendanceRowData } from './staff-attendance-roster';
import { AttendanceSummaryCard } from './staff-attendance-summary';
import {
  addDays,
  countAttendanceRows,
  dateFromKey,
  dateKeyInSchoolTimeZone,
  formatAttendanceDate,
  type AttendanceDraft,
} from './staff-attendance-utils';

type SessionUser = NonNullable<RouterOutputs['health']['me']['user']>;

export function StaffAttendanceScreen({
  onBack,
  user,
}: {
  onBack: () => void;
  user: SessionUser | undefined;
}) {
  const { signOut } = useClerk();
  const utils = api.useUtils();
  const [dateKey, setDateKey] = useState(() => dateKeyInSchoolTimeZone(new Date()));
  const [drafts, setDrafts] = useState<Record<string, AttendanceDraft | undefined>>({});
  const [pendingStudentId, setPendingStudentId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const roster = api.attendance.forDate.useQuery({ date: dateFromKey(dateKey) }, { retry: false });
  const rows = roster.data ?? [];
  const counts = useMemo(() => countAttendanceRows(rows), [rows]);

  const markAttendance = api.attendance.mark.useMutation({
    onError: (error) => {
      setStatusMessage(error.message);
      setPendingStudentId(null);
    },
    onSuccess: async (saved) => {
      setStatusMessage(`Attendance saved: ${saved.status}`);
      setDrafts((current) => ({ ...current, [saved.studentId]: undefined }));
      setPendingStudentId(null);
      await Promise.all([
        utils.attendance.forDate.invalidate({ date: dateFromKey(saved.date) }),
        utils.staffHome.summary.invalidate(),
      ]);
    },
  });

  async function refresh() {
    await roster.refetch();
  }

  function changeDate(nextDate: string) {
    setDateKey(nextDate);
    setDrafts({});
    setStatusMessage(null);
  }

  function saveRow(row: AttendanceRowData, draft: AttendanceDraft) {
    setPendingStudentId(row.studentId);
    setStatusMessage(null);
    markAttendance.mutate({
      absenceReason: draft.status === 'Absent' ? draft.absenceReason : null,
      date: dateFromKey(dateKey),
      status: draft.status,
      studentId: row.studentId,
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
        subtitle={`${user?.role ?? 'Staff'} · Attendance`}
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
            <Text style={styles.eyebrow}>Attendance register</Text>
            <Text style={styles.title}>Mark student attendance</Text>
          </View>
        </View>

        <View style={styles.dateCard}>
          <Text style={styles.dateLabel}>{formatAttendanceDate(dateKey)}</Text>
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
              refreshing={roster.isFetching || markAttendance.isPending}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {statusMessage ? (
            <View
              style={[
                styles.statusMessage,
                markAttendance.error ? styles.errorMessage : styles.successMessage,
              ]}
            >
              <Text
                style={[
                  styles.statusMessageText,
                  markAttendance.error ? styles.errorMessageText : styles.successMessageText,
                ]}
              >
                {statusMessage}
              </Text>
            </View>
          ) : null}

          {roster.isLoading ? <InlineSpinner label="Loading attendance roster" /> : null}
          {roster.error ? <ErrorText>{roster.error.message}</ErrorText> : null}

          {!roster.isLoading && !roster.error ? (
            <>
              <AttendanceSummaryCard counts={counts} />
              <AttendanceRoster
                drafts={drafts}
                onChangeDraft={(studentId, draft) => {
                  setDrafts((current) => ({ ...current, [studentId]: draft }));
                }}
                onSave={saveRow}
                pendingStudentId={pendingStudentId}
                rows={rows}
                saving={markAttendance.isPending}
              />
            </>
          ) : null}
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
});
