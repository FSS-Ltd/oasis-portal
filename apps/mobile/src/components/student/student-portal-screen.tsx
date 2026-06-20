import { useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useClerk } from '@clerk/clerk-expo';
import { api, type RouterOutputs } from '../../lib/trpc';
import { C } from '../core/mobile-theme';
import {
  PortalMobileBottomNav,
  PortalMobileHeader,
  type PortalMobileNavItem,
} from '../core/portal-mobile-shell';
import { ErrorText } from '../core/mobile-ui';
import { StudentClubsFaithScreen } from './student-clubs-faith-screen';
import { StudentHomeworkActivityScreen } from './student-homework-activity-screen';
import { StudentHomeScreen } from './student-home-screen';
import { StudentLearningScreen } from './student-learning-screen';
import type { PublicLeaderboardKind } from './student-learning-utils';
import { StudentMessagesScreen } from './student-messages-screen';
import {
  conversationHasPastoralParticipant,
  studentDirectUnreadCount as countStudentDirectUnread,
} from './student-messages-utils';
import { StudentMobileAccessGate } from './student-mobile-access-gate';
import { StudentNotificationsScreen } from './student-notifications-screen';
import { StudentWalletScreen } from './student-wallet-screen';
import type { TransferAccount } from './student-wallet-utils';

type SessionUser = NonNullable<RouterOutputs['health']['me']['user']>;
type MessagePage = RouterOutputs['message']['listConversations'];
type LoadedMessagePage = { cursor: string | undefined; page: MessagePage };
type StudentMobileTab = 'home' | 'wallet' | 'learning' | 'activity' | 'clubs' | 'updates' | 'messages';

const messagePageSize = 20;

export function StudentPortalScreen({ user }: { user: SessionUser }) {
  const { signOut } = useClerk();
  const signOutStudent = () => {
    void signOut();
  };

  return (
    <SafeAreaView style={styles.shell}>
      <PortalMobileHeader
        actionAccessibilityLabel={`Sign out of student account ${user.id}`}
        actionLabel="Out"
        avatarLabel="ST"
        eyebrow="Student Portal"
        onActionPress={signOutStudent}
        subtitle="Student account"
        title="Oasis Learning Centre"
        variant="dark"
      />

      <StudentMobileAccessGate onSignOut={signOutStudent}>
        <StudentPortalContent user={user} />
      </StudentMobileAccessGate>
    </SafeAreaView>
  );
}

function StudentPortalContent({ user }: { user: SessionUser }) {
  const utils = api.useUtils();
  const [activeTab, setActiveTab] = useState<StudentMobileTab>('home');
  const [transferError, setTransferError] = useState<string | null>(null);
  const [transferPending, setTransferPending] = useState(false);
  const [transferStatus, setTransferStatus] = useState<string | null>(null);
  const [leaderboardKind, setLeaderboardKind] = useState<PublicLeaderboardKind>('TopTithers');
  const [pendingNotificationId, setPendingNotificationId] = useState<string | null>(null);
  const [notificationRefreshFailed, setNotificationRefreshFailed] = useState(false);
  const [messageCursor, setMessageCursor] = useState<string | undefined>(undefined);
  const [messagePages, setMessagePages] = useState<LoadedMessagePage[]>([]);
  const studentDashboard = api.student.dashboard.useQuery(undefined, { retry: false });
  const studentWallet = api.student.wallet.useQuery(undefined, { retry: false });
  const academicScreensEnabled = studentDashboard.data?.profile.academicScreensEnabled === true;
  const studentId = studentWallet.data?.studentId ?? '';
  const studentPace = api.pace.forStudent.useQuery(
    { studentId },
    { enabled: academicScreensEnabled && studentId.length > 0, retry: false },
  );
  const studentAttendance = api.attendance.studentSummary.useQuery(undefined, {
    enabled: academicScreensEnabled,
    retry: false,
  });
  const studentLeaderboard = api.leaderboard.get.useQuery(
    {
      includeViewerRows: true,
      kind: leaderboardKind,
      limit: 10,
      scope: 'public',
    },
    { retry: false },
  );
  const studentHomeworkDue = api.homework.studentDue.useQuery(undefined, { retry: false });
  const studentHomeworkGraded = api.homework.studentGraded.useQuery(undefined, { retry: false });
  const studentNotifications = api.studentNotification.list.useQuery(undefined, { retry: false });
  const studentNotificationUnread = api.studentNotification.unreadCount.useQuery(undefined, {
    retry: false,
  });
  const studentDirectConversations = api.message.listConversations.useQuery(
    { cursor: messageCursor, kinds: ['StudentDirect'], limit: messagePageSize },
    { retry: false },
  );
  const transfer = api.meritLedger.transfer.useMutation();
  const markNotificationRead = api.studentNotification.markRead.useMutation({
    onSettled: () => {
      setPendingNotificationId(null);
    },
    onSuccess: async () => {
      await Promise.all([
        utils.studentNotification.list.invalidate(),
        utils.studentNotification.unreadCount.invalidate(),
        utils.student.dashboard.invalidate(),
      ]);
    },
  });

  const studentDirectConversationRows = useMemo(
    () =>
      messagePages
        .flatMap(({ page }) => page.items)
        .filter(conversationHasPastoralParticipant),
    [messagePages],
  );
  const nextMessageCursor = messagePages[messagePages.length - 1]?.page.nextCursor ?? null;
  const studentDirectUnreadCount = useMemo(
    () => countStudentDirectUnread(studentDirectConversationRows),
    [studentDirectConversationRows],
  );
  const studentTabs: Array<PortalMobileNavItem<StudentMobileTab>> = [
    { id: 'home', icon: 'dashboard', label: 'Home' },
    { id: 'wallet', icon: 'wallet', label: 'Wallet' },
    { id: 'learning', icon: 'pace', label: 'Learning' },
    { id: 'activity', icon: 'clubs', label: 'Activity' },
    { id: 'clubs', icon: 'clubs', label: 'Clubs' },
    {
      id: 'updates',
      icon: 'notices',
      label: 'Updates',
      badge: studentNotificationUnread.data?.count,
    },
    {
      id: 'messages',
      icon: 'messages',
      label: 'Messages',
      badge: studentDirectUnreadCount,
    },
  ];

  useEffect(() => {
    if (!studentDirectConversations.data) return;
    setMessagePages((currentPages) => {
      const nextPage = { cursor: messageCursor, page: studentDirectConversations.data };
      if (!messageCursor) return [nextPage];
      const existingIndex = currentPages.findIndex((page) => page.cursor === messageCursor);
      if (existingIndex === -1) return [...currentPages, nextPage];
      return currentPages.map((page, index) => (index === existingIndex ? nextPage : page));
    });
  }, [studentDirectConversations.data, messageCursor]);

  async function refreshHomework() {
    await Promise.all([studentHomeworkDue.refetch(), studentHomeworkGraded.refetch()]);
  }

  async function refreshMessages() {
    setMessageCursor(undefined);
    setMessagePages([]);
    await utils.message.listConversations.invalidate();
  }

  async function refresh() {
    setNotificationRefreshFailed(false);
    setMessageCursor(undefined);
    setMessagePages([]);
    try {
      await Promise.all([
        studentDashboard.refetch(),
        studentWallet.refetch(),
        academicScreensEnabled && studentId.length > 0 ? studentPace.refetch() : Promise.resolve(),
        academicScreensEnabled ? studentAttendance.refetch() : Promise.resolve(),
        studentLeaderboard.refetch(),
        studentHomeworkDue.refetch(),
        studentHomeworkGraded.refetch(),
        studentNotifications.refetch(),
        studentNotificationUnread.refetch(),
        utils.message.listConversations.invalidate(),
      ]);
    } catch {
      setNotificationRefreshFailed(true);
    }
  }

  async function handleWalletTransfer(
    from: TransferAccount,
    to: TransferAccount,
    amount: number,
  ) {
    if (!studentWallet.data) {
      setTransferError('Transfer failed: wallet is not ready yet.');
      setTransferStatus(null);
      return;
    }

    const studentId = studentWallet.data.studentId;
    setTransferError(null);
    setTransferPending(true);
    setTransferStatus(null);

    try {
      await transfer.mutateAsync({ amount, from, studentId, to });
      await Promise.all([studentWallet.refetch(), studentDashboard.refetch()]);
      setTransferStatus('Transfer complete');
    } catch (error) {
      setTransferError(`Transfer failed: ${messageFromUnknown(error)}`);
    } finally {
      setTransferPending(false);
    }
  }

  function handleMarkNotificationRead(notificationId: string) {
    setPendingNotificationId(notificationId);
    markNotificationRead.mutate({ notificationId });
  }

  const refreshing =
    studentDashboard.isFetching ||
    studentWallet.isFetching ||
    studentPace.isFetching ||
    studentAttendance.isFetching ||
    studentLeaderboard.isFetching ||
    studentHomeworkDue.isFetching ||
    studentHomeworkGraded.isFetching ||
    studentNotifications.isFetching ||
    studentNotificationUnread.isFetching ||
    studentDirectConversations.isFetching;
  const queryError = studentDashboard.error?.message ?? studentWallet.error?.message ?? null;

  return (
    <>
      <ScrollView
        accessibilityLabel={`Student portal content for ${user.id}`}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            onRefresh={() => {
              void refresh();
            }}
            refreshing={refreshing}
            tintColor={C.surface}
            titleColor={C.surface}
          />
        }
      >
        {queryError && studentDashboard.data ? (
          <View style={styles.inlineError}>
            <ErrorText>{queryError}</ErrorText>
          </View>
        ) : null}

        {activeTab === 'home' ? (
          <StudentHomeScreen
            dashboard={studentDashboard.data}
            error={studentDashboard.error?.message ?? null}
            loading={studentDashboard.isLoading}
            onOpenWallet={() => {
              setActiveTab('wallet');
            }}
            wallet={studentWallet.data}
          />
        ) : null}

        {activeTab === 'wallet' ? (
          <StudentWalletScreen
            error={studentWallet.error?.message ?? studentDashboard.error?.message ?? null}
            loading={studentWallet.isLoading || studentDashboard.isLoading}
            onTransfer={(from, to, amount) => {
              void handleWalletTransfer(from, to, amount);
            }}
            transferError={transferError}
            transferPending={transferPending}
            transferStatus={transferStatus}
            wallet={studentWallet.data}
          />
        ) : null}

        {activeTab === 'learning' ? (
          <StudentLearningScreen
            attendance={studentAttendance.data}
            attendanceError={studentAttendance.error?.message ?? null}
            dashboard={studentDashboard.data}
            leaderboard={studentLeaderboard.data}
            leaderboardError={studentLeaderboard.error?.message ?? null}
            leaderboardKind={leaderboardKind}
            loading={
              studentDashboard.isLoading ||
              studentWallet.isLoading ||
              studentPace.isLoading ||
              studentAttendance.isLoading ||
              studentLeaderboard.isLoading
            }
            onSelectLeaderboardKind={setLeaderboardKind}
            pace={studentPace.data}
            paceError={studentPace.error?.message ?? null}
          />
        ) : null}

        {activeTab === 'activity' ? (
          <StudentHomeworkActivityScreen
            due={studentHomeworkDue.data}
            dueError={studentHomeworkDue.error?.message ?? null}
            graded={studentHomeworkGraded.data}
            gradedError={studentHomeworkGraded.error?.message ?? null}
            loading={studentHomeworkDue.isLoading || studentHomeworkGraded.isLoading}
            onRefreshHomework={refreshHomework}
          />
        ) : null}

        {activeTab === 'clubs' ? <StudentClubsFaithScreen /> : null}

        {activeTab === 'updates' ? (
          <StudentNotificationsScreen
            error={studentNotifications.error?.message ?? null}
            loading={studentNotifications.isLoading || studentNotificationUnread.isLoading}
            markReadError={markNotificationRead.error?.message ?? null}
            notifications={studentNotifications.data}
            onMarkRead={handleMarkNotificationRead}
            pendingNotificationId={pendingNotificationId}
            refreshFailed={
              notificationRefreshFailed ||
              Boolean(studentNotifications.error && studentNotifications.data)
            }
            unreadCount={
              studentNotificationUnread.data?.count ??
              studentDashboard.data?.notifications.unreadCount ??
              0
            }
          />
        ) : null}

        {activeTab === 'messages' ? (
          <StudentMessagesScreen
            conversations={studentDirectConversationRows}
            conversationsError={studentDirectConversations.error?.message ?? null}
            hasMore={Boolean(nextMessageCursor)}
            loading={studentDirectConversations.isLoading}
            loadingMore={studentDirectConversations.isFetching && Boolean(messageCursor)}
            onLoadMore={() => {
              if (nextMessageCursor) setMessageCursor(nextMessageCursor);
            }}
            onRefresh={refreshMessages}
            refreshing={refreshing}
          />
        ) : null}
      </ScrollView>

      <PortalMobileBottomNav
        activeId={activeTab}
        items={studentTabs}
        onSelect={setActiveTab}
        primaryItemLimit={3}
        variant="dark"
      />
    </>
  );
}

function messageFromUnknown(error: unknown): string {
  if (error instanceof Error) {
    if (error.message === 'insufficient source balance') return 'insufficient source balance';
    return error.message;
  }
  if (typeof error === 'string') return error;
  return 'The wallet action could not be completed.';
}

const styles = StyleSheet.create({
  content: {
    gap: 14,
    padding: 16,
    paddingBottom: 120,
  },
  inlineError: {
    backgroundColor: C.surface,
    borderColor: C.dangerMid,
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
  },
  shell: {
    backgroundColor: C.navy,
    flex: 1,
  },
});
