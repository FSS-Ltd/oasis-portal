import { useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useClerk } from '@clerk/clerk-expo';
import { api, type RouterOutputs } from '../../lib/trpc';
import { C } from '../smoke/mobile-theme';
import { PortalMobileHeader } from '../smoke/portal-mobile-shell';
import { ErrorText, InlineSpinner } from '../smoke/smoke-ui';
import { StaffClubManagerAttendance } from './staff-club-manager-attendance';
import { StaffClubManagerClubList } from './staff-club-manager-club-list';
import { StaffClubManagerNotices } from './staff-club-manager-notices';
import { StaffClubManagerOverview } from './staff-club-manager-overview';
import { StaffClubManagerRoster } from './staff-club-manager-roster';
import { StaffClubManagerRota } from './staff-club-manager-rota';
import {
  addDays,
  clubManagerTabs,
  dateFromKey,
  dateKeyInSchoolTimeZone,
  formatClubDate,
  type StaffClubAttendanceRow,
  type StaffClubAttendanceStatus,
  type StaffClubManagerTab,
  type StaffClubNoticeDraft,
  weekStartKey,
} from './staff-club-manager-utils';
import { TabButton } from './staff-rota-common';

type SessionUser = NonNullable<RouterOutputs['health']['me']['user']>;
type StatusMessage = { message: string; tone: 'error' | 'success' };

function friendlyError(error: unknown): string {
  return error instanceof Error ? error.message : 'Please try again.';
}

export function StaffClubManagerScreen({
  onBack,
  user,
}: {
  onBack: () => void;
  user: SessionUser | undefined;
}) {
  const { signOut } = useClerk();
  const utils = api.useUtils();
  const [activeTab, setActiveTab] = useState<StaffClubManagerTab>('overview');
  const [attendanceDateKey, setAttendanceDateKey] = useState(() =>
    dateKeyInSchoolTimeZone(new Date()),
  );
  const [weekStartDateKey, setWeekStartDateKey] = useState(() => weekStartKey(new Date()));
  const [selectedClubId, setSelectedClubId] = useState<string | null>(null);
  const [pendingAttendanceStudentId, setPendingAttendanceStudentId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<StatusMessage | null>(null);
  const attendanceDate = useMemo(() => dateFromKey(attendanceDateKey), [attendanceDateKey]);
  const weekStart = useMemo(() => dateFromKey(weekStartDateKey), [weekStartDateKey]);
  const weekEndDateKey = useMemo(() => addDays(weekStartDateKey, 6), [weekStartDateKey]);
  const weekEnd = useMemo(() => dateFromKey(weekEndDateKey), [weekEndDateKey]);

  const managedClubs = api.club.managementList.useQuery(undefined, { retry: false });
  const clubs = managedClubs.data ?? [];
  const selectedClub = clubs.find((club) => club.id === selectedClubId) ?? clubs[0] ?? null;
  const clubId = selectedClub?.id ?? '';

  const roster = api.club.roster.useQuery(
    { clubId },
    { enabled: selectedClub !== null, retry: false },
  );
  const attendance = api.club.attendanceForSession.useQuery(
    { clubId, date: attendanceDate },
    { enabled: selectedClub !== null, retry: false },
  );
  const notifications = api.club.notifications.useQuery(
    { clubId },
    { enabled: selectedClub !== null, retry: false },
  );
  const rotaSchedule = api.club.clubRotaSchedule.useQuery(
    { clubId, from: weekStart, to: weekEnd },
    { enabled: selectedClub !== null, retry: false },
  );

  const markAttendance = api.club.markAttendance.useMutation();
  const resetAttendance = api.club.resetAttendanceForSession.useMutation();
  const sendNotice = api.club.notify.useMutation();

  useEffect(() => {
    if (!selectedClubId && clubs[0]) {
      setSelectedClubId(clubs[0].id);
    }
    if (selectedClubId && clubs.length > 0 && !clubs.some((club) => club.id === selectedClubId)) {
      setSelectedClubId(clubs[0]?.id ?? null);
    }
  }, [clubs, selectedClubId]);

  async function refresh() {
    await Promise.all([
      managedClubs.refetch(),
      selectedClub ? roster.refetch() : Promise.resolve(),
      selectedClub ? attendance.refetch() : Promise.resolve(),
      selectedClub ? notifications.refetch() : Promise.resolve(),
      selectedClub ? rotaSchedule.refetch() : Promise.resolve(),
    ]);
  }

  function changeAttendanceDate(direction: 'next' | 'previous' | 'today') {
    setAttendanceDateKey((current) => {
      if (direction === 'today') return dateKeyInSchoolTimeZone(new Date());
      return addDays(current, direction === 'next' ? 1 : -1);
    });
    setStatusMessage(null);
    setPendingAttendanceStudentId(null);
  }

  function changeWeek(direction: 'next' | 'previous' | 'today') {
    setWeekStartDateKey((current) => {
      if (direction === 'today') return weekStartKey(new Date());
      return addDays(current, direction === 'next' ? 7 : -7);
    });
    setStatusMessage(null);
  }

  async function markClubAttendance(
    row: StaffClubAttendanceRow,
    status: StaffClubAttendanceStatus,
  ) {
    if (!selectedClub) return;
    setStatusMessage(null);
    setPendingAttendanceStudentId(row.studentId);
    try {
      await markAttendance.mutateAsync({
        clubId: selectedClub.id,
        date: attendanceDate,
        status,
        studentId: row.studentId,
      });
      setStatusMessage({
        message: `Attendance saved: ${row.studentName} marked ${status.toLowerCase()}.`,
        tone: 'success',
      });
      await Promise.all([
        utils.club.attendanceForSession.invalidate({
          clubId: selectedClub.id,
          date: attendanceDate,
        }),
        utils.club.managementList.invalidate(),
        utils.staffHome.summary.invalidate(),
      ]);
    } catch (error) {
      setStatusMessage({
        message: `Attendance could not be saved: ${friendlyError(error)}`,
        tone: 'error',
      });
    } finally {
      setPendingAttendanceStudentId(null);
    }
  }

  async function resetSessionAttendance() {
    if (!selectedClub) return;
    setStatusMessage(null);
    try {
      const result = await resetAttendance.mutateAsync({
        clubId: selectedClub.id,
        date: attendanceDate,
      });
      setStatusMessage({
        message: `Attendance reset: ${String(result.deletedCount)} marks cleared.`,
        tone: 'success',
      });
      await Promise.all([
        utils.club.attendanceForSession.invalidate({
          clubId: selectedClub.id,
          date: attendanceDate,
        }),
        utils.club.managementList.invalidate(),
        utils.staffHome.summary.invalidate(),
      ]);
    } catch (error) {
      setStatusMessage({
        message: `Attendance could not be reset: ${friendlyError(error)}`,
        tone: 'error',
      });
    }
  }

  async function submitNotice(draft: StaffClubNoticeDraft): Promise<boolean> {
    if (!selectedClub) return false;
    setStatusMessage(null);
    try {
      const result = await sendNotice.mutateAsync({
        body: draft.body.trim(),
        clubId: selectedClub.id,
        title: draft.title.trim(),
      });
      const partialFailure = result.failedCount > 0;
      setStatusMessage({
        message: partialFailure
          ? `Notice posted, but ${String(result.failedCount)} delivery attempt failed. ${String(
              result.sentCount,
            )} sent.`
          : `Notice posted: ${String(result.sentCount)} sent.`,
        tone: partialFailure ? 'error' : 'success',
      });
      await Promise.all([
        utils.club.notifications.invalidate({ clubId: selectedClub.id }),
        utils.club.managementList.invalidate(),
        utils.staffHome.summary.invalidate(),
      ]);
      return true;
    } catch (error) {
      setStatusMessage({
        message: `Club notice could not be sent: ${friendlyError(error)}`,
        tone: 'error',
      });
      return false;
    }
  }

  const rosterRows = roster.data?.signups ?? [];
  const attendanceRows = attendance.data?.students ?? [];
  const notificationRows = notifications.data ?? [];
  const shiftRows = rotaSchedule.data ?? [];
  const refreshing =
    managedClubs.isFetching ||
    roster.isFetching ||
    attendance.isFetching ||
    notifications.isFetching ||
    rotaSchedule.isFetching ||
    markAttendance.isPending ||
    resetAttendance.isPending ||
    sendNotice.isPending;

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
        subtitle={`${user?.role ?? 'Staff'} · Clubs`}
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
            <Text style={styles.eyebrow}>Club manager</Text>
            <Text style={styles.title}>All clubs, registers, notices and rota cover</Text>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              onRefresh={() => {
                void refresh();
              }}
              refreshing={refreshing}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {managedClubs.isLoading ? <InlineSpinner label="Loading club manager data" /> : null}
          {managedClubs.error ? <ErrorText>{managedClubs.error.message}</ErrorText> : null}
          {!managedClubs.isLoading && !managedClubs.error && !selectedClub ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No active clubs</Text>
              <Text style={styles.emptyText}>Active clubs will appear here.</Text>
            </View>
          ) : null}

          {selectedClub ? (
            <>
              <StaffClubManagerClubList
                clubs={clubs}
                onSelect={(nextClubId) => {
                  setSelectedClubId(nextClubId);
                  setStatusMessage(null);
                  setActiveTab('overview');
                }}
                selectedClubId={selectedClub.id}
              />

              <View style={styles.tabRow}>
                {clubManagerTabs.map((tab) => (
                  <TabButton
                    active={activeTab === tab.id}
                    key={tab.id}
                    label={tab.label}
                    onPress={() => {
                      setActiveTab(tab.id);
                    }}
                  />
                ))}
              </View>

              {statusMessage ? (
                <View
                  style={[
                    styles.statusMessage,
                    statusMessage.tone === 'error' ? styles.errorMessage : styles.successMessage,
                  ]}
                >
                  <Text
                    style={[
                      styles.statusMessageText,
                      statusMessage.tone === 'error'
                        ? styles.errorMessageText
                        : styles.successMessageText,
                    ]}
                  >
                    {statusMessage.message}
                  </Text>
                </View>
              ) : null}

              {activeTab === 'overview' ? (
                <StaffClubManagerOverview
                  attendanceRows={attendanceRows}
                  club={selectedClub}
                  clubs={clubs}
                  notifications={notificationRows}
                  roster={rosterRows}
                  shifts={shiftRows}
                />
              ) : null}
              {activeTab === 'roster' ? (
                <StaffClubManagerRoster
                  error={roster.error?.message ?? null}
                  loading={roster.isLoading}
                  roster={rosterRows}
                />
              ) : null}
              {activeTab === 'attendance' ? (
                <StaffClubManagerAttendance
                  error={attendance.error?.message ?? null}
                  formattedDate={formatClubDate(attendanceDateKey)}
                  loading={attendance.isLoading}
                  onChangeDate={changeAttendanceDate}
                  onMark={(row, status) => {
                    void markClubAttendance(row, status);
                  }}
                  onReset={() => {
                    void resetSessionAttendance();
                  }}
                  pendingStudentId={pendingAttendanceStudentId}
                  resetting={resetAttendance.isPending}
                  rows={attendanceRows}
                />
              ) : null}
              {activeTab === 'notices' ? (
                <StaffClubManagerNotices
                  error={notifications.error?.message ?? null}
                  loading={notifications.isLoading}
                  notifications={notificationRows}
                  onSubmit={submitNotice}
                  posting={sendNotice.isPending}
                />
              ) : null}
              {activeTab === 'rota' ? (
                <StaffClubManagerRota
                  error={rotaSchedule.error?.message ?? null}
                  formattedWeek={`${formatClubDate(weekStartDateKey)} - ${formatClubDate(
                    weekEndDateKey,
                  )}`}
                  loading={rotaSchedule.isLoading}
                  onChangeWeek={changeWeek}
                  shifts={shiftRows}
                />
              ) : null}
            </>
          ) : null}
        </ScrollView>
      </View>
    </SafeAreaView>
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
  emptyState: {
    backgroundColor: C.surface,
    borderColor: C.border,
    borderRadius: 12,
    borderWidth: 1,
    gap: 5,
    padding: 18,
  },
  emptyText: {
    color: C.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  emptyTitle: {
    color: C.navy,
    fontSize: 18,
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
    color: C.blue,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  scrollContent: {
    gap: 14,
    paddingBottom: 36,
  },
  shell: {
    backgroundColor: C.bg,
    flex: 1,
  },
  statusMessage: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
  },
  statusMessageText: {
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 17,
  },
  successMessage: {
    backgroundColor: C.successBg,
    borderColor: C.successMid,
  },
  successMessageText: {
    color: C.success,
  },
  tabRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
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
