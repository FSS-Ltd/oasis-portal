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
import { Card, ErrorText, MutedText, SectionTitle } from '../core/mobile-ui';
import { ParentCalendarScreen } from './parent-calendar-screen';
import { ParentChildDetailScreen } from './parent-child-detail-screen';
import { ParentClubsScreen } from './parent-clubs-screen';
import { ParentFeesInvoicesScreen } from './parent-fees-invoices-screen';
import { selectedParentChild } from './parent-home-utils';
import { ParentHomeScreen } from './parent-home-screen';
import { ParentIncidentReportsScreen } from './parent-incident-reports-screen';
import { ParentMessagesScreen } from './parent-messages-screen';
import { ParentNotificationsScreen } from './parent-notifications-screen';
import { ParentNoticesScreen } from './parent-notices-screen';
import { ParentPermissionSlipsScreen } from './parent-permission-slips-screen';
import { ParentProfileRegistrationScreen } from './parent-profile-registration-screen';
import { ParentReportsRanksScreen } from './parent-reports-ranks-screen';
import { ParentShopReservationsScreen } from './parent-shop-reservations-screen';
import { ParentStudentSettingsScreen } from './parent-student-settings-screen';

type SessionUser = NonNullable<RouterOutputs['health']['me']['user']>;
type MessagePage = RouterOutputs['message']['listConversations'];
type LoadedMessagePage = { cursor: string | undefined; page: MessagePage };
type ParentPortalRoute =
  | 'home'
  | 'child'
  | 'reports'
  | 'incidents'
  | 'notices'
  | 'notifications'
  | 'messages'
  | 'clubs'
  | 'shop'
  | 'fees'
  | 'calendar'
  | 'slips'
  | 'profile'
  | 'settings';
const messagePageSize = 20;

const parentTabs: Array<PortalMobileNavItem<ParentPortalRoute>> = [
  { id: 'home', icon: 'dashboard', label: 'Home' },
  { id: 'calendar', icon: 'calendar', label: 'Calendar' },
  { id: 'slips', icon: 'slips', label: 'Slips' },
  { id: 'fees', icon: 'fees', label: 'Fees' },
  { id: 'messages', icon: 'messages', label: 'Messages' },
  { id: 'notifications', icon: 'notices', label: 'Updates' },
  { id: 'child', icon: 'students', label: 'Child' },
  { id: 'notices', icon: 'notices', label: 'Notices' },
  { id: 'reports', icon: 'reports', label: 'Reports' },
  { id: 'incidents', icon: 'incidents', label: 'Incidents' },
  { id: 'clubs', icon: 'clubs', label: 'Clubs' },
  { id: 'shop', icon: 'shop', label: 'Shop' },
  { id: 'profile', icon: 'profile', label: 'Profile' },
  { id: 'settings', icon: 'settings', label: 'Settings' },
];

export function ParentPortalScreen({
  onSwitchToStaff,
  user,
}: {
  onSwitchToStaff?: () => void;
  user: SessionUser;
}) {
  const { signOut } = useClerk();
  const [route, setRoute] = useState<ParentPortalRoute>('home');
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [pendingParentNotificationId, setPendingParentNotificationId] = useState<string | null>(
    null,
  );
  const [messageCursor, setMessageCursor] = useState<string | undefined>(undefined);
  const [messagePages, setMessagePages] = useState<LoadedMessagePage[]>([]);
  const profile = api.profile.me.useQuery(undefined, { retry: false });
  const dashboard = api.childLog.parentDashboard.useQuery(undefined, { retry: false });
  const registrationStatus = api.registration.status.useQuery(undefined, { retry: false });
  const children = useMemo(() => dashboard.data?.children ?? [], [dashboard.data?.children]);
  const hasLinkedChildren = children.length > 0;
  const notices = api.notice.listForParents.useQuery(undefined, {
    enabled: hasLinkedChildren && route === 'notices',
    retry: false,
  });
  const conversationsQuery = api.message.listConversations.useQuery(
    { cursor: messageCursor, kinds: ['ParentStaff'], limit: messagePageSize },
    { enabled: hasLinkedChildren && route === 'messages', retry: false },
  );
  const recipients = api.message.listRecipients.useQuery(
    { kind: 'ParentStaff' },
    { enabled: hasLinkedChildren && route === 'messages', retry: false },
  );
  const clubSignupContext = api.club.linkedChildSignupContext.useQuery(undefined, {
    enabled: hasLinkedChildren && route === 'clubs',
    retry: false,
  });
  const clubNotices = api.club.myClubNotices.useQuery(undefined, {
    enabled: hasLinkedChildren && route === 'clubs',
    retry: false,
  });
  const selectedChild = selectedParentChild(children, selectedChildId);
  const selectedStudentId = selectedChild?.student.id ?? '';
  const balances = api.meritLedger.balances.useQuery(
    { studentId: selectedStudentId },
    { enabled: Boolean(selectedStudentId), retry: false },
  );
  const shopItems = api.shop.listItems.useQuery(undefined, {
    enabled: route === 'shop',
    retry: false,
  });
  const shopReservations = api.shop.listReservations.useQuery(undefined, {
    enabled: route === 'shop',
    retry: false,
  });
  const permissionSlips = api.permissionSlip.listParent.useQuery(undefined, {
    enabled: route === 'slips',
    retry: false,
  });
  const parentNotifications = api.parentNotification.list.useQuery(undefined, {
    enabled: route === 'notifications',
    retry: false,
  });
  const parentNotificationUnread = api.parentNotification.unreadCount.useQuery(undefined, {
    retry: false,
  });
  const parentInvoices = api.invoice.listParent.useQuery(
    { status: 'All' },
    {
      enabled: route === 'fees',
      retry: false,
    },
  );
  const parentCalendar = api.calendar.listForParents.useQuery(undefined, {
    enabled: route === 'calendar',
    retry: false,
  });
  const utils = api.useUtils();
  const conversations = useMemo(
    () => messagePages.flatMap(({ page }) => page.items),
    [messagePages],
  );
  const nextMessageCursor = messagePages[messagePages.length - 1]?.page.nextCursor ?? null;
  const unreadNoticeCount = (notices.data ?? []).filter((notice) => !notice.read).length;
  const unreadMessageCount = conversations.reduce(
    (count, conversation) => count + conversation.unreadCount,
    0,
  );
  const unreadNotificationCount = parentNotificationUnread.data?.count ?? 0;
  const markParentNotificationRead = api.parentNotification.markRead.useMutation({
    async onSuccess() {
      await Promise.all([
        utils.parentNotification.list.invalidate(),
        utils.parentNotification.unreadCount.invalidate(),
      ]);
    },
    onSettled() {
      setPendingParentNotificationId(null);
    },
  });

  useEffect(() => {
    if (!conversationsQuery.data) return;
    setMessagePages((currentPages) => {
      const nextPage = { cursor: messageCursor, page: conversationsQuery.data };
      if (!messageCursor) return [nextPage];
      const existingIndex = currentPages.findIndex((page) => page.cursor === messageCursor);
      if (existingIndex === -1) return [...currentPages, nextPage];
      return currentPages.map((page, index) => (index === existingIndex ? nextPage : page));
    });
  }, [conversationsQuery.data, messageCursor]);

  async function refresh() {
    setMessageCursor(undefined);
    setMessagePages([]);
    await Promise.all([
      profile.refetch(),
      dashboard.refetch(),
      registrationStatus.refetch(),
      route === 'notices' ? notices.refetch() : Promise.resolve(),
      route === 'messages' ? utils.message.listConversations.invalidate() : Promise.resolve(),
      route === 'messages' ? recipients.refetch() : Promise.resolve(),
      route === 'clubs' ? clubSignupContext.refetch() : Promise.resolve(),
      route === 'clubs' ? clubNotices.refetch() : Promise.resolve(),
      selectedStudentId ? balances.refetch() : Promise.resolve(),
      route === 'shop' ? shopItems.refetch() : Promise.resolve(),
      route === 'shop' ? shopReservations.refetch() : Promise.resolve(),
      route === 'fees' ? parentInvoices.refetch() : Promise.resolve(),
      route === 'notifications' ? parentNotifications.refetch() : Promise.resolve(),
      parentNotificationUnread.refetch(),
      route === 'calendar' ? parentCalendar.refetch() : Promise.resolve(),
      route === 'slips' ? permissionSlips.refetch() : Promise.resolve(),
    ]);
  }

  const refreshing =
    dashboard.isFetching ||
    profile.isFetching ||
    registrationStatus.isFetching ||
    notices.isFetching ||
    conversationsQuery.isFetching ||
    recipients.isFetching ||
    clubSignupContext.isFetching ||
    clubNotices.isFetching ||
    balances.isFetching ||
    shopItems.isFetching ||
    shopReservations.isFetching ||
    parentInvoices.isFetching ||
    parentNotifications.isFetching ||
    parentNotificationUnread.isFetching ||
    parentCalendar.isFetching ||
    permissionSlips.isFetching;
  const routeQueryError =
    route === 'messages'
      ? (conversationsQuery.error?.message ?? recipients.error?.message ?? null)
      : route === 'notices'
        ? (notices.error?.message ?? null)
        : route === 'clubs'
          ? (clubSignupContext.error?.message ?? clubNotices.error?.message ?? null)
          : route === 'shop'
            ? (shopItems.error?.message ?? shopReservations.error?.message ?? balances.error?.message ?? null)
            : route === 'fees'
            ? (parentInvoices.error?.message ?? null)
            : route === 'notifications'
              ? (parentNotifications.error?.message ?? null)
              : route === 'calendar'
                ? (parentCalendar.error?.message ?? null)
                : route === 'slips'
                  ? (permissionSlips.error?.message ?? null)
                  : null;
  const bottomNav = (
    <PortalMobileBottomNav
      activeId={route}
      items={parentTabs.map((tab) => ({
        ...tab,
        badge:
          tab.id === 'notices'
            ? unreadNoticeCount
            : tab.id === 'messages'
              ? unreadMessageCount
              : tab.id === 'notifications'
                ? unreadNotificationCount
                : undefined,
      }))}
      onSelect={setRoute}
      primaryItemLimit={6}
    />
  );

  if (route === 'messages') {
    return (
      <SafeAreaView style={styles.shell}>
        <PortalMobileHeader
          actionAccessibilityLabel={
            onSwitchToStaff ? 'Switch back to staff mode' : `Sign out of parent account ${user.id}`
          }
          actionLabel={onSwitchToStaff ? 'Staff' : 'Out'}
          avatarLabel="P"
          eyebrow="Parent Portal"
          onActionPress={() => {
            if (onSwitchToStaff) {
              onSwitchToStaff();
              return;
            }
            void signOut();
          }}
          subtitle={
            selectedChild ? `Parent of ${selectedChild.student.fullName}` : 'Family account'
          }
          title="Oasis Learning Centre"
        />
        <View style={styles.messagesContent}>
          {routeQueryError ? <ErrorText>{routeQueryError}</ErrorText> : null}
          <ParentMessagesScreen
            conversations={conversations}
            hasMore={Boolean(nextMessageCursor)}
            loadingMore={conversationsQuery.isFetching && Boolean(messageCursor)}
            onLoadMore={() => {
              if (nextMessageCursor) setMessageCursor(nextMessageCursor);
            }}
            onRefresh={refresh}
            recipients={recipients.data ?? []}
            refreshing={refreshing}
          />
        </View>
        {bottomNav}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.shell}>
      <PortalMobileHeader
        actionAccessibilityLabel={
          onSwitchToStaff ? 'Switch back to staff mode' : `Sign out of parent account ${user.id}`
        }
        actionLabel={onSwitchToStaff ? 'Staff' : 'Out'}
        avatarLabel="P"
        eyebrow="Parent Portal"
        onActionPress={() => {
          if (onSwitchToStaff) {
            onSwitchToStaff();
            return;
          }
          void signOut();
        }}
        subtitle={selectedChild ? `Parent of ${selectedChild.student.fullName}` : 'Family account'}
        title="Oasis Learning Centre"
      />

      {route === 'home' ? (
        <ParentHomeScreen
          children={children}
          dashboard={dashboard.data}
          dashboardError={dashboard.error?.message ?? profile.error?.message ?? null}
          loadingDashboard={dashboard.isLoading || profile.isLoading}
          onRefresh={refresh}
          onSelectChild={setSelectedChildId}
          profile={profile.data}
          refreshing={dashboard.isFetching || profile.isFetching || registrationStatus.isFetching}
          registrationStatus={registrationStatus.data}
          selectedChild={selectedChild}
        />
      ) : route === 'child' ? (
        <ParentChildDetailScreen
          children={children}
          dashboardError={dashboard.error?.message ?? profile.error?.message ?? null}
          loadingDashboard={dashboard.isLoading || profile.isLoading}
          onRefresh={refresh}
          onSelectChild={setSelectedChildId}
          refreshing={refreshing}
          selectedChild={selectedChild}
        />
      ) : route === 'reports' ? (
        <ParentReportsRanksScreen
          children={children}
          dashboardError={dashboard.error?.message ?? profile.error?.message ?? null}
          loadingDashboard={dashboard.isLoading || profile.isLoading}
          onRefresh={refresh}
          onSelectChild={setSelectedChildId}
          refreshing={refreshing}
          selectedChild={selectedChild}
        />
      ) : route === 'incidents' ? (
        <ParentIncidentReportsScreen
          children={children}
          dashboardError={dashboard.error?.message ?? profile.error?.message ?? null}
          loadingDashboard={dashboard.isLoading || profile.isLoading}
          onOpenMessages={() => {
            setRoute('messages');
          }}
          onRefresh={refresh}
          onSelectChild={setSelectedChildId}
          refreshing={refreshing}
          selectedChild={selectedChild}
        />
      ) : route === 'profile' ? (
        <ParentProfileRegistrationScreen onRefresh={refresh} />
      ) : route === 'settings' ? (
        <ParentStudentSettingsScreen onRefresh={refresh} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              onRefresh={() => {
                void refresh();
              }}
              refreshing={refreshing}
            />
          }
          style={styles.scroller}
        >
          {routeQueryError ? <ErrorText>{routeQueryError}</ErrorText> : null}
          {route === 'notices' ? <ParentNoticesScreen notices={notices.data ?? []} /> : null}
          {route === 'clubs' ? (
            <ParentClubsScreen
              childrenRows={clubSignupContext.data?.children ?? []}
              clubNotices={clubNotices.data ?? []}
              clubNoticesError={clubNotices.error?.message ?? null}
              clubs={clubSignupContext.data?.clubs ?? []}
              loading={clubSignupContext.isLoading}
              loadingClubNotices={clubNotices.isLoading}
              selectedChildId={selectedStudentId}
              onSelectChild={setSelectedChildId}
            />
          ) : null}
          {route === 'shop' ? (
            selectedChild ? (
              <ParentShopReservationsScreen
                children={children}
                heldMerits={balances.data?.balances.ShopReserved ?? 0}
                items={shopItems.data ?? []}
                loading={shopItems.isFetching || balances.isFetching}
                reservations={shopReservations.data ?? []}
                reservationsError={shopReservations.error?.message ?? null}
                reservationsLoading={shopReservations.isFetching}
                selectedChild={selectedChild}
                shopError={shopItems.error?.message ?? balances.error?.message ?? null}
                spendBalance={
                  balances.data?.balances.Spend ?? selectedChild.metrics.meritBalances.Spend
                }
                onSelectChild={setSelectedChildId}
              />
            ) : (
              <Card>
                <SectionTitle>No linked child</SectionTitle>
                <MutedText>Link a child before reserving shop items.</MutedText>
              </Card>
            )
          ) : null}
          {route === 'slips' ? (
            <ParentPermissionSlipsScreen
              error={permissionSlips.error?.message ?? null}
              loading={permissionSlips.isFetching}
              slips={permissionSlips.data?.slips ?? []}
            />
          ) : null}
          {route === 'fees' ? (
            <ParentFeesInvoicesScreen
              data={parentInvoices.data}
              error={parentInvoices.error?.message ?? null}
              initialInvoiceId={selectedInvoiceId}
              loading={parentInvoices.isFetching}
            />
          ) : null}
          {route === 'notifications' ? (
            <ParentNotificationsScreen
              error={parentNotifications.error?.message ?? null}
              loading={parentNotifications.isFetching || parentNotificationUnread.isFetching}
              markReadError={markParentNotificationRead.error?.message ?? null}
              notifications={parentNotifications.data}
              pendingNotificationId={pendingParentNotificationId}
              unreadCount={unreadNotificationCount}
              onMarkRead={(notificationId) => {
                setPendingParentNotificationId(notificationId);
                markParentNotificationRead.mutate({ notificationId });
              }}
              onOpenInvoice={(invoiceId) => {
                setSelectedInvoiceId(invoiceId);
                setRoute('fees');
              }}
            />
          ) : null}
          {route === 'calendar' ? (
            <ParentCalendarScreen
              error={parentCalendar.error?.message ?? null}
              events={parentCalendar.data ?? []}
              loading={parentCalendar.isFetching}
            />
          ) : null}
        </ScrollView>
      )}

      {bottomNav}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 14,
    padding: 14,
    paddingBottom: 26,
  },
  messagesContent: {
    backgroundColor: C.bg,
    flex: 1,
    gap: 12,
    padding: 14,
    paddingBottom: 10,
  },
  scroller: {
    backgroundColor: C.bg,
    flex: 1,
  },
  shell: {
    backgroundColor: C.bg,
    flex: 1,
  },
});
