import { useEffect, useMemo, useState } from 'react';
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
  StaffSpecialAttendanceRoster,
  type SpecialAttendanceRowData,
} from './staff-special-attendance-roster';
import {
  addDays,
  countAttendanceRows,
  dateFromKey,
  dateKeyInSchoolTimeZone,
  formatAttendanceDate,
  type AttendanceDraft,
  type AttendanceStatus,
  type SpecialAttendanceRegister,
} from './staff-attendance-utils';

type SessionUser = NonNullable<RouterOutputs['health']['me']['user']>;
type AttendanceMode = 'daily' | 'special';

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
  const [attendanceMode, setAttendanceMode] = useState<AttendanceMode>('daily');
  const [drafts, setDrafts] = useState<Record<string, AttendanceDraft | undefined>>({});
  const [pendingStudentId, setPendingStudentId] = useState<string | null>(null);
  const [pendingSpecialStudentId, setPendingSpecialStudentId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [specialRegister, setSpecialRegister] = useState<SpecialAttendanceRegister>('FieldTrip');
  const [specialDestination, setSpecialDestination] = useState('');
  const selectedDate = useMemo(() => dateFromKey(dateKey), [dateKey]);
  const roster = api.attendance.forDate.useQuery({ date: selectedDate }, { retry: false });
  const specialRoster = api.attendance.specialForDate.useQuery(
    { date: selectedDate, register: specialRegister },
    { enabled: attendanceMode === 'special', retry: false },
  );
  const rows = roster.data ?? [];
  const specialRows = specialRoster.data?.rows ?? [];
  const sessionDestination = specialRoster.data?.session.destination ?? '';
  const counts = useMemo(() => countAttendanceRows(rows), [rows]);

  useEffect(() => {
    setSpecialDestination(sessionDestination);
  }, [dateKey, sessionDestination, specialRegister]);

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
  const saveSpecialSession = api.attendance.saveSpecialSession.useMutation({
    onError: (error) => {
      setStatusMessage(error.message);
    },
    onSuccess: async (saved) => {
      setSpecialDestination(saved.destination ?? '');
      setStatusMessage('Special attendance destination saved.');
      await utils.attendance.specialForDate.invalidate({
        date: dateFromKey(saved.date),
        register: saved.register,
      });
    },
  });
  const markSpecialAttendance = api.attendance.markSpecial.useMutation({
    onError: (error) => {
      setStatusMessage(error.message);
      setPendingSpecialStudentId(null);
    },
    onSuccess: async (saved) => {
      setStatusMessage(`Special attendance saved: ${saved.status}`);
      setPendingSpecialStudentId(null);
      await Promise.all([
        utils.attendance.specialForDate.invalidate({
          date: dateFromKey(saved.date),
          register: saved.register,
        }),
        utils.staffHome.summary.invalidate(),
      ]);
    },
  });

  async function refresh() {
    if (attendanceMode === 'special') {
      await specialRoster.refetch();
      return;
    }
    await roster.refetch();
  }

  function changeDate(nextDate: string) {
    setDateKey(nextDate);
    setDrafts({});
    setStatusMessage(null);
  }

  function changeMode(nextMode: AttendanceMode) {
    setAttendanceMode(nextMode);
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

  function saveSpecialDestination() {
    setStatusMessage(null);
    saveSpecialSession.mutate({
      date: selectedDate,
      destination: specialDestination,
      register: specialRegister,
    });
  }

  function saveSpecialRow(row: SpecialAttendanceRowData, status: AttendanceStatus) {
    setPendingSpecialStudentId(row.studentId);
    setStatusMessage(null);
    markSpecialAttendance.mutate({
      date: selectedDate,
      register: specialRegister,
      status,
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

        <View style={styles.modeCard}>
          <Text style={styles.modeLabel}>Attendance type</Text>
          <View style={styles.modeActions}>
            <ModeButton
              active={attendanceMode === 'daily'}
              label="Student register"
              onPress={() => {
                changeMode('daily');
              }}
            />
            <ModeButton
              active={attendanceMode === 'special'}
              label="Trips & locations"
              onPress={() => {
                changeMode('special');
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
                markAttendance.isPending ||
                specialRoster.isFetching ||
                markSpecialAttendance.isPending
              }
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {statusMessage ? (
            <View
              style={[
                styles.statusMessage,
                markAttendance.error || markSpecialAttendance.error || saveSpecialSession.error
                  ? styles.errorMessage
                  : styles.successMessage,
              ]}
            >
              <Text
                style={[
                  styles.statusMessageText,
                  markAttendance.error || markSpecialAttendance.error || saveSpecialSession.error
                    ? styles.errorMessageText
                    : styles.successMessageText,
                ]}
              >
                {statusMessage}
              </Text>
            </View>
          ) : null}

          {attendanceMode === 'daily' && roster.isLoading ? (
            <InlineSpinner label="Loading attendance roster" />
          ) : null}
          {attendanceMode === 'daily' && roster.error ? (
            <ErrorText>{roster.error.message}</ErrorText>
          ) : null}

          {attendanceMode === 'daily' && !roster.isLoading && !roster.error ? (
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
          {attendanceMode === 'special' ? (
            <StaffSpecialAttendanceRoster
              destination={specialDestination}
              error={specialRoster.error?.message ?? null}
              loading={specialRoster.isLoading}
              onChangeDestination={setSpecialDestination}
              onChangeRegister={(nextRegister) => {
                setSpecialRegister(nextRegister);
                setStatusMessage(null);
              }}
              onSaveDestination={saveSpecialDestination}
              onSaveRow={saveSpecialRow}
              pendingStudentId={pendingSpecialStudentId}
              register={specialRegister}
              rows={specialRows}
              saving={markSpecialAttendance.isPending}
              savingDestination={saveSpecialSession.isPending}
              sessionDestination={sessionDestination}
            />
          ) : null}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

function ModeButton({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.modeButton, active ? styles.modeButtonActive : null]}
    >
      <Text style={[styles.modeButtonText, active ? styles.modeButtonTextActive : null]}>
        {label}
      </Text>
    </Pressable>
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
  modeActions: {
    flexDirection: 'row',
    gap: 8,
  },
  modeButton: {
    alignItems: 'center',
    backgroundColor: C.surface,
    borderColor: C.border,
    borderRadius: 8,
    borderWidth: 1.5,
    flex: 1,
    minHeight: 38,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  modeButtonActive: {
    backgroundColor: C.blueLight,
    borderColor: C.blueMid,
  },
  modeButtonText: {
    color: C.textSecondary,
    fontSize: 12,
    fontWeight: '900',
    textAlign: 'center',
  },
  modeButtonTextActive: {
    color: C.navy,
  },
  modeCard: {
    backgroundColor: C.surface,
    borderColor: C.border,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
    padding: 12,
  },
  modeLabel: {
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
