import { useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useClerk } from '@clerk/clerk-expo';
import { api, type RouterOutputs } from '../../lib/trpc';
import { C } from '../core/mobile-theme';
import { PortalMobileHeader } from '../core/portal-mobile-shell';
import { ErrorText, InlineSpinner } from '../core/mobile-ui';
import { StaffClubLeadAttendance } from './staff-club-lead-attendance';
import { StaffClubLeadBehaviour } from './staff-club-lead-behaviour';
import { StaffClubLeadNoticeboard } from './staff-club-lead-noticeboard';
import { StaffClubLeadOverview } from './staff-club-lead-overview';
import { StaffClubLeadSwitcher } from './staff-club-lead-switcher';
import { TabButton } from './staff-rota-common';
import {
  addDays,
  clubLeadTabs,
  dateFromKey,
  dateKeyInSchoolTimeZone,
  formatClubDate,
  meritAmountValue,
  type StaffClubAttendanceRow,
  type StaffClubAttendanceStatus,
  type StaffClubBehaviourDraft,
  type StaffClubLeadTab,
  type StaffClubNoticeDraft,
} from './staff-club-lead-utils';

type SessionUser = NonNullable<RouterOutputs['health']['me']['user']>;
type StatusMessage = { message: string; tone: 'error' | 'success' };

function friendlyError(error: unknown): string {
  return error instanceof Error ? error.message : 'Please try again.';
}

export function StaffClubLeadScreen({
  onBack,
  user,
}: {
  onBack: () => void;
  user: SessionUser | undefined;
}) {
  const { signOut } = useClerk();
  const utils = api.useUtils();
  const [activeTab, setActiveTab] = useState<StaffClubLeadTab>('overview');
  const [todayKey] = useState(() => dateKeyInSchoolTimeZone(new Date()));
  const [attendanceDateKey, setAttendanceDateKey] = useState(() =>
    dateKeyInSchoolTimeZone(new Date()),
  );
  const [selectedClubId, setSelectedClubId] = useState<string | null>(null);
  const [pendingAttendanceStudentId, setPendingAttendanceStudentId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<StatusMessage | null>(null);
  const todayDate = useMemo(() => dateFromKey(todayKey), [todayKey]);
  const attendanceDate = useMemo(() => dateFromKey(attendanceDateKey), [attendanceDateKey]);
  const assignedClubs = api.club.leadClubs.useQuery(undefined, { retry: false });
  const clubs = assignedClubs.data ?? [];
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
  const recentEntries = api.behaviour.recentEntries.useQuery(
    { date: todayDate, clubId },
    { enabled: selectedClub !== null, retry: false },
  );

  const markAttendance = api.club.markAttendance.useMutation();
  const sendNotice = api.club.notify.useMutation();
  const logBehaviour = api.behaviour.log.useMutation();

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
      assignedClubs.refetch(),
      selectedClub ? roster.refetch() : Promise.resolve(),
      selectedClub ? attendance.refetch() : Promise.resolve(),
      selectedClub ? notifications.refetch() : Promise.resolve(),
      selectedClub ? recentEntries.refetch() : Promise.resolve(),
    ]);
  }

  function changeAttendanceDate(direction: 'next' | 'previous' | 'today') {
    setAttendanceDateKey((current) => {
      if (direction === 'today') return todayKey;
      return addDays(current, direction === 'next' ? 1 : -1);
    });
    setStatusMessage(null);
    setPendingAttendanceStudentId(null);
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
        utils.club.roster.invalidate({ clubId: selectedClub.id }),
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

  async function submitBehaviour(draft: StaffClubBehaviourDraft): Promise<boolean> {
    if (!selectedClub) return false;
    setStatusMessage(null);
    try {
      await logBehaviour.mutateAsync({
        amount: draft.type === 'Merit' ? meritAmountValue(draft.amount) : undefined,
        category: draft.category.trim(),
        clubId: selectedClub.id,
        note: draft.note.trim() ? draft.note.trim() : undefined,
        studentId: draft.studentId,
        type: draft.type,
        visibility: 'General',
      });
      setStatusMessage({ message: 'Behaviour saved for this club.', tone: 'success' });
      await Promise.all([
        utils.behaviour.recentEntries.invalidate({ date: todayDate, clubId: selectedClub.id }),
        utils.club.roster.invalidate({ clubId: selectedClub.id }),
        utils.staffHome.summary.invalidate(),
      ]);
      return true;
    } catch (error) {
      setStatusMessage({
        message: `Behaviour could not be saved: ${friendlyError(error)}`,
        tone: 'error',
      });
      return false;
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
  const entryRows = recentEntries.data?.entries ?? [];
  const refreshing =
    assignedClubs.isFetching ||
    roster.isFetching ||
    attendance.isFetching ||
    notifications.isFetching ||
    recentEntries.isFetching ||
    markAttendance.isPending ||
    sendNotice.isPending ||
    logBehaviour.isPending;

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
            <Text style={styles.eyebrow}>Club lead</Text>
            <Text style={styles.title}>Roster, attendance, behaviour and notices</Text>
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
          {assignedClubs.isLoading ? <InlineSpinner label="Loading assigned clubs" /> : null}
          {assignedClubs.error ? <ErrorText>{assignedClubs.error.message}</ErrorText> : null}
          {!assignedClubs.isLoading && !assignedClubs.error && !selectedClub ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No assigned clubs</Text>
              <Text style={styles.emptyText}>Assigned active clubs will appear here.</Text>
            </View>
          ) : null}

          {selectedClub ? (
            <>
              <StaffClubLeadSwitcher
                clubs={clubs}
                onSelect={(nextClubId) => {
                  setSelectedClubId(nextClubId);
                  setStatusMessage(null);
                  setActiveTab('overview');
                }}
                selectedClubId={selectedClub.id}
              />

              <View style={styles.tabRow}>
                {clubLeadTabs.map((tab) => (
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

              {roster.error ? <ErrorText>{roster.error.message}</ErrorText> : null}

              {activeTab === 'overview' ? (
                <StaffClubLeadOverview
                  club={selectedClub}
                  entries={entryRows}
                  notifications={notificationRows}
                  roster={rosterRows}
                />
              ) : null}
              {activeTab === 'behaviour' ? (
                <StaffClubLeadBehaviour
                  entries={entryRows}
                  error={recentEntries.error?.message ?? null}
                  loading={recentEntries.isLoading}
                  onSubmit={submitBehaviour}
                  roster={rosterRows}
                  saving={logBehaviour.isPending}
                />
              ) : null}
              {activeTab === 'attendance' ? (
                <StaffClubLeadAttendance
                  error={attendance.error?.message ?? null}
                  formattedDate={formatClubDate(attendanceDateKey)}
                  loading={attendance.isLoading}
                  onChangeDate={changeAttendanceDate}
                  onMark={(row, status) => {
                    void markClubAttendance(row, status);
                  }}
                  pendingStudentId={pendingAttendanceStudentId}
                  rows={attendanceRows}
                />
              ) : null}
              {activeTab === 'noticeboard' ? (
                <StaffClubLeadNoticeboard
                  error={notifications.error?.message ?? null}
                  loading={notifications.isLoading}
                  notifications={notificationRows}
                  onSubmit={submitNotice}
                  posting={sendNotice.isPending}
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
    color: C.success,
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
