import { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useClerk } from '@clerk/clerk-expo';
import { type RouterOutputs, api } from '../../lib/trpc';
import { UserAccessScreen } from '../access/user-access-screen';
import { C } from '../core/mobile-theme';
import { Badge, Card, MobileButton, MutedText, SectionTitle } from '../core/mobile-ui';
import {
  PortalMobileBottomNav,
  PortalMobileHeader,
  type PortalMobileNavItem,
} from '../core/portal-mobile-shell';
import { ParentCalendarScreen } from '../parent/parent-calendar-screen';
import { StaffAttendanceScreen } from '../staff/staff-attendance-screen';
import { StaffBehaviourScreen } from '../staff/staff-behaviour-screen';
import { StaffClubManagerScreen } from '../staff/staff-club-manager-screen';
import { StaffCommunicationsScreen } from '../staff/staff-communications-screen';
import { StaffIncidentScreen } from '../staff/staff-incident-screen';
import { StaffPaceScreen } from '../staff/staff-pace-screen';
import { StaffShopCounterScreen } from '../staff/staff-shop-counter-screen';
import { StaffScoreKeyReportScreen } from '../reports/staff-score-key-report-screen';

type SessionUser = NonNullable<RouterOutputs['health']['me']['user']>;
type SupportPortalRoute =
  | 'access'
  | 'attendance'
  | 'behaviour'
  | 'calendar'
  | 'clubs'
  | 'communications'
  | 'incidents'
  | 'pace'
  | 'reports'
  | 'shop';

const supportTabs: Array<PortalMobileNavItem<SupportPortalRoute>> = [
  { id: 'access', icon: 'profile', label: 'Access' },
  { id: 'attendance', icon: 'attendance', label: 'Attendance' },
  { id: 'behaviour', icon: 'behaviour', label: 'Behaviour' },
  { id: 'calendar', icon: 'calendar', label: 'Calendar' },
  { id: 'communications', icon: 'messages', label: 'Messages' },
  { id: 'clubs', icon: 'clubs', label: 'Clubs' },
  { id: 'incidents', icon: 'incidents', label: 'Incidents' },
  { id: 'pace', icon: 'pace', label: 'PACE' },
  { id: 'reports', icon: 'profile', label: 'Reports' },
  { id: 'shop', icon: 'shop', label: 'Shop' },
];

export function TechnicalSupportPortalScreen({
  onSwitchToParent,
  user,
}: {
  onSwitchToParent?: () => void;
  user: SessionUser;
}) {
  const { signOut } = useClerk();
  const [route, setRoute] = useState<SupportPortalRoute>('access');
  const calendarQuery = api.calendar.listVisible.useQuery(undefined, {
    enabled: route === 'calendar',
    retry: false,
  });
  const bottomNav = (
    <PortalMobileBottomNav
      activeId={route}
      items={supportTabs}
      onSelect={setRoute}
      primaryItemLimit={5}
      variant="dark"
    />
  );

  function openAccessRoute() {
    setRoute('access');
  }

  if (route === 'calendar') {
    return (
      <SafeAreaView style={styles.shell}>
        <TechnicalSupportHeader
          onSignOut={() => {
            void signOut();
          }}
          subtitle="Calendar"
        />
        <ScrollView contentContainerStyle={styles.content} style={styles.scroller}>
          <ParentCalendarScreen
            detail="Dates visible to the support admin shell."
            error={calendarQuery.error?.message ?? null}
            events={calendarQuery.data ?? []}
            eyebrow="Support Calendar"
            loading={calendarQuery.isLoading}
            title="Key Dates"
          />
        </ScrollView>
        {bottomNav}
      </SafeAreaView>
    );
  }

  if (route === 'attendance') return <StaffAttendanceScreen onBack={openAccessRoute} user={user} />;
  if (route === 'behaviour') return <StaffBehaviourScreen onBack={openAccessRoute} user={user} />;
  if (route === 'clubs') return <StaffClubManagerScreen onBack={openAccessRoute} user={user} />;
  if (route === 'communications')
    return <StaffCommunicationsScreen onBack={openAccessRoute} user={user} />;
  if (route === 'incidents') return <StaffIncidentScreen onBack={openAccessRoute} user={user} />;
  if (route === 'pace') return <StaffPaceScreen onBack={openAccessRoute} user={user} />;
  if (route === 'reports') return <StaffScoreKeyReportScreen onBack={openAccessRoute} />;
  if (route === 'shop') return <StaffShopCounterScreen onBack={openAccessRoute} user={user} />;

  return (
    <UserAccessScreen
      currentUserId={user.id}
      footer={bottomNav}
      header={
        <TechnicalSupportHeader
          onSignOut={() => {
            void signOut();
          }}
          subtitle="User Access"
        />
      }
      introduction={
        <>
          {onSwitchToParent ? (
            <Card>
              <MobileButton label="Parent mode" onPress={onSwitchToParent} variant="blue" />
              <MutedText>Switch to parent mode for your linked child account.</MutedText>
            </Card>
          ) : null}
          <Badge variant="blue">Technical Support</Badge>
          <SectionTitle>User Access</SectionTitle>
          <MutedText>
            Manage account invitations, profiles, roles, permissions, and sign-in status.
          </MutedText>
        </>
      }
    />
  );
}

function TechnicalSupportHeader({
  onSignOut,
  subtitle,
}: {
  onSignOut: () => void;
  subtitle: string;
}) {
  return (
    <PortalMobileHeader
      actionAccessibilityLabel="Sign out of Technical Support account"
      actionLabel="Out"
      avatarLabel="TS"
      eyebrow="Support Portal"
      onActionPress={onSignOut}
      subtitle={subtitle}
      title="Oasis Learning Centre"
      variant="dark"
    />
  );
}

const styles = StyleSheet.create({
  content: { padding: 18, paddingBottom: 32 },
  scroller: { backgroundColor: C.bg },
  shell: { backgroundColor: C.bg, flex: 1 },
});
