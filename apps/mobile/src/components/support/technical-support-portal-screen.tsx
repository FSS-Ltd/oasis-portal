import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useClerk } from '@clerk/clerk-expo';
import { api, type RouterOutputs } from '../../lib/trpc';
import { C } from '../core/mobile-theme';
import {
  Badge,
  Card,
  ErrorText,
  Field,
  InlineSpinner,
  MobileButton,
  MutedText,
  SectionTitle,
  StatCard,
} from '../core/mobile-ui';
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

type SessionUser = NonNullable<RouterOutputs['health']['me']['user']>;
type AccessAccount = RouterOutputs['admin']['listUserAccounts'][number];
type AccessInvitation = RouterOutputs['admin']['listUserInvitations'][number];
type AccessRole = 'Parent' | 'TechnicalSupport';
type AccessFilter = 'active' | 'all' | 'inactive' | AccessRole;
type SupportPortalRoute =
  | 'access'
  | 'attendance'
  | 'behaviour'
  | 'calendar'
  | 'clubs'
  | 'communications'
  | 'incidents'
  | 'pace'
  | 'shop';
type DirectoryRow =
  | { account: AccessAccount; id: string; kind: 'account' }
  | { id: string; invitation: AccessInvitation; kind: 'invitation' };

const supportTabs: Array<PortalMobileNavItem<SupportPortalRoute>> = [
  { id: 'access', icon: 'profile', label: 'Access' },
  { id: 'attendance', icon: 'attendance', label: 'Attendance' },
  { id: 'behaviour', icon: 'behaviour', label: 'Behaviour' },
  { id: 'calendar', icon: 'calendar', label: 'Calendar' },
  { id: 'communications', icon: 'messages', label: 'Messages' },
  { id: 'clubs', icon: 'clubs', label: 'Clubs' },
  { id: 'incidents', icon: 'incidents', label: 'Incidents' },
  { id: 'pace', icon: 'pace', label: 'PACE' },
  { id: 'shop', icon: 'shop', label: 'Shop' },
];

const accessRoles: readonly AccessRole[] = ['Parent', 'TechnicalSupport'];

const accessFilters: Array<{ id: AccessFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'inactive', label: 'Inactive' },
  { id: 'Parent', label: 'Parents' },
  { id: 'TechnicalSupport', label: 'Technical Support' },
];

function roleLabel(role: string): string {
  return role === 'TechnicalSupport' ? 'Technical Support' : role;
}

function formatDate(value: Date | string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

function rowTitle(row: DirectoryRow): string {
  return row.kind === 'account' ? row.account.fullName : row.invitation.email;
}

function rowSubtitle(row: DirectoryRow): string {
  if (row.kind === 'invitation') {
    return `${roleLabel(row.invitation.role)} · Pending`;
  }

  return `${roleLabel(row.account.role)} · ${row.account.active ? 'Active' : 'Inactive'}`;
}

function rowMatches(row: DirectoryRow, query: string): boolean {
  if (!query) return true;
  const haystack =
    row.kind === 'account'
      ? `${row.account.fullName} ${row.account.email} ${row.account.role}`
      : `${row.invitation.email} ${row.invitation.role} pending`;
  return haystack.toLowerCase().includes(query);
}

function rowRole(row: DirectoryRow): string {
  return row.kind === 'account' ? row.account.role : row.invitation.role;
}

function countRowsByRole(rows: DirectoryRow[], role: AccessRole): number {
  return rows.filter((row) => rowRole(row) === role).length;
}

function filterAccount(account: AccessAccount, filter: AccessFilter, query: string): boolean {
  const matchesFilter =
    filter === 'all' ||
    (filter === 'active' && account.active) ||
    (filter === 'inactive' && !account.active) ||
    account.role === filter;
  return matchesFilter && rowMatches({ account, id: account.id, kind: 'account' }, query);
}

function filterInvitation(
  invitation: AccessInvitation,
  filter: AccessFilter,
  query: string,
): boolean {
  const matchesFilter = filter === 'all' || invitation.role === filter;
  return matchesFilter && rowMatches({ id: invitation.id, invitation, kind: 'invitation' }, query);
}

export function TechnicalSupportPortalScreen({
  onSwitchToParent,
  user,
}: {
  onSwitchToParent?: () => void;
  user: SessionUser;
}) {
  const { signOut } = useClerk();
  const utils = api.useUtils();
  const [route, setRoute] = useState<SupportPortalRoute>('access');
  const [filter, setFilter] = useState<AccessFilter>('all');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<AccessRole>('Parent');
  const accountsQuery = api.admin.listUserAccounts.useQuery(undefined, { retry: false });
  const invitationsQuery = api.admin.listUserInvitations.useQuery(undefined, { retry: false });
  const calendarQuery = api.calendar.listVisible.useQuery(undefined, {
    enabled: route === 'calendar',
    retry: false,
  });
  const inviteUser = api.admin.inviteUser.useMutation({
    async onSuccess() {
      setInviteEmail('');
      await Promise.all([
        utils.admin.listUserAccounts.invalidate(),
        utils.admin.listUserInvitations.invalidate(),
      ]);
    },
  });

  const accounts = accountsQuery.data ?? [];
  const invitations = invitationsQuery.data ?? [];
  const rows = useMemo<DirectoryRow[]>(() => {
    const pendingRows = invitations.map((invitation) => ({
      id: `invitation:${invitation.id}`,
      invitation,
      kind: 'invitation' as const,
    }));
    const accountRows = accounts.map((account) => ({
      account,
      id: `account:${account.id}`,
      kind: 'account' as const,
    }));
    return [...pendingRows, ...accountRows];
  }, [accounts, invitations]);
  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter((row) =>
      row.kind === 'account'
        ? filterAccount(row.account, filter, query)
        : filterInvitation(row.invitation, filter, query),
    );
  }, [filter, rows, search]);
  const selectedRow = filteredRows.find((row) => row.id === selectedId) ?? filteredRows[0] ?? null;
  const loading = accountsQuery.isLoading || invitationsQuery.isLoading;
  const errorMessage = accountsQuery.error?.message ?? invitationsQuery.error?.message ?? null;
  const activeCount = accounts.filter((account) => account.active).length;
  const parentCount = countRowsByRole(rows, 'Parent');
  const supportCount = countRowsByRole(rows, 'TechnicalSupport');
  const bottomNav = (
    <PortalMobileBottomNav
      activeId={route}
      items={supportTabs}
      onSelect={setRoute}
      primaryItemLimit={5}
      variant="dark"
    />
  );

  useEffect(() => {
    if (!selectedRow) {
      setSelectedId('');
      return;
    }
    if (selectedRow.id !== selectedId) {
      setSelectedId(selectedRow.id);
    }
  }, [selectedId, selectedRow]);

  function submitInvite() {
    inviteUser.mutate({
      email: inviteEmail,
      role: inviteRole,
      tags: [],
    });
  }

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
  if (route === 'communications') {
    return <StaffCommunicationsScreen onBack={openAccessRoute} user={user} />;
  }
  if (route === 'incidents') return <StaffIncidentScreen onBack={openAccessRoute} user={user} />;
  if (route === 'pace') return <StaffPaceScreen onBack={openAccessRoute} user={user} />;
  if (route === 'shop') return <StaffShopCounterScreen onBack={openAccessRoute} user={user} />;

  return (
    <SafeAreaView style={styles.shell}>
      <TechnicalSupportHeader
        onSignOut={() => {
          void signOut();
        }}
        subtitle="User Access"
      />
      <ScrollView contentContainerStyle={styles.content} style={styles.scroller}>
        {onSwitchToParent ? (
          <Card>
            <View style={styles.detailHeader}>
              <View style={styles.rowBody}>
                <SectionTitle>Parent mode</SectionTitle>
                <MutedText>Switch to parent mode for your linked child account.</MutedText>
              </View>
              <MobileButton label="Parent mode" onPress={onSwitchToParent} variant="blue" />
            </View>
          </Card>
        ) : null}

        <View style={styles.intro}>
          <Badge variant="blue">Technical Support</Badge>
          <Text style={styles.title}>User Access</Text>
          <MutedText>Scoped parent and support account administration.</MutedText>
        </View>

        <View style={styles.statsGrid}>
          <StatCard label="Accounts and invites" value={String(rows.length)} />
          <StatCard accent={C.success} label="Active accounts" value={String(activeCount)} />
          <StatCard accent={C.navy} label="Support" value={String(supportCount)} />
          <StatCard accent={C.crimson} label="Parents" value={String(parentCount)} />
        </View>

        {errorMessage ? <ErrorText>{errorMessage}</ErrorText> : null}

        <Card>
          <SectionTitle>Invite account</SectionTitle>
          <Field
            keyboardType="email-address"
            label="Email"
            onChangeText={setInviteEmail}
            placeholder="name@example.com"
            value={inviteEmail}
          />
          <View style={styles.roleToggle}>
            {accessRoles.map((role) => (
              <Pressable
                accessibilityRole="button"
                key={role}
                onPress={() => {
                  setInviteRole(role);
                }}
                style={[styles.roleButton, inviteRole === role ? styles.roleButtonActive : null]}
              >
                <Text
                  style={[
                    styles.roleButtonText,
                    inviteRole === role ? styles.roleButtonTextActive : null,
                  ]}
                >
                  {roleLabel(role)}
                </Text>
              </Pressable>
            ))}
          </View>
          {inviteUser.error ? <ErrorText>{inviteUser.error.message}</ErrorText> : null}
          {inviteUser.data ? <MutedText>Invitation email sent.</MutedText> : null}
          <MobileButton
            disabled={inviteEmail.trim().length === 0 || inviteUser.isPending}
            label={inviteUser.isPending ? 'Sending...' : 'Send invite'}
            onPress={submitInvite}
            variant="navy"
          />
        </Card>

        <Card>
          <SectionTitle>Directory</SectionTitle>
          <View style={styles.filterToggle}>
            {accessFilters.map((option) => (
              <Pressable
                accessibilityRole="button"
                key={option.id}
                onPress={() => {
                  setFilter(option.id);
                }}
                style={[
                  styles.filterButton,
                  filter === option.id ? styles.filterButtonActive : null,
                ]}
              >
                <Text
                  style={[
                    styles.filterButtonText,
                    filter === option.id ? styles.filterButtonTextActive : null,
                  ]}
                >
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </View>
          <Field
            label="Search"
            onChangeText={setSearch}
            placeholder="Search accounts..."
            value={search}
          />
          {loading ? <InlineSpinner label="Loading accounts" /> : null}
          {!loading && filteredRows.length === 0 ? <MutedText>No accounts found.</MutedText> : null}
          <View style={styles.directoryList}>
            {filteredRows.map((row) => (
              <Pressable
                accessibilityRole="button"
                key={row.id}
                onPress={() => {
                  setSelectedId(row.id);
                }}
                style={[
                  styles.directoryRow,
                  selectedRow?.id === row.id ? styles.selectedRow : null,
                ]}
              >
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{rowTitle(row).slice(0, 1).toUpperCase()}</Text>
                </View>
                <View style={styles.rowBody}>
                  <Text style={styles.rowTitle}>{rowTitle(row)}</Text>
                  <Text style={styles.rowSubtitle}>{rowSubtitle(row)}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        </Card>

        {selectedRow?.kind === 'account' ? (
          <AccessAccountDetail account={selectedRow.account} currentUserId={user.id} />
        ) : null}
        {selectedRow?.kind === 'invitation' ? (
          <AccessInvitationDetail invitation={selectedRow.invitation} />
        ) : null}
      </ScrollView>
      {bottomNav}
    </SafeAreaView>
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

function AccessAccountDetail({
  account,
  currentUserId,
}: {
  account: AccessAccount;
  currentUserId: string;
}) {
  const utils = api.useUtils();
  const [fullName, setFullName] = useState(account.fullName);
  const [phone, setPhone] = useState(account.phone ?? '');
  const [address, setAddress] = useState(account.address ?? '');
  const updateProfile = api.admin.updateUserAccountProfile.useMutation({
    async onSuccess() {
      await utils.admin.listUserAccounts.invalidate();
    },
  });
  const updateStatus = api.admin.updateUserAccountStatus.useMutation({
    async onSuccess() {
      await utils.admin.listUserAccounts.invalidate();
    },
  });
  const isSelf = account.id === currentUserId;

  useEffect(() => {
    setFullName(account.fullName);
    setPhone(account.phone ?? '');
    setAddress(account.address ?? '');
  }, [account]);

  function saveProfile() {
    updateProfile.mutate({
      userId: account.id,
      fullName,
      phone,
      address,
    });
  }

  return (
    <Card>
      <View style={styles.detailHeader}>
        <View>
          <SectionTitle>{account.fullName}</SectionTitle>
          <MutedText>{roleLabel(account.role)}</MutedText>
        </View>
        <Badge variant={account.active ? 'success' : 'warning'}>
          {account.active ? 'Active' : 'Inactive'}
        </Badge>
      </View>
      <Field label="Full name" onChangeText={setFullName} value={fullName} />
      <Field label="Phone" onChangeText={setPhone} value={phone} />
      <Field label="Address" onChangeText={setAddress} value={address} />
      <DetailRow label="Email" value={account.email} />
      <DetailRow label="Joined" value={formatDate(account.createdAt)} />
      {updateProfile.error ? <ErrorText>{updateProfile.error.message}</ErrorText> : null}
      {updateStatus.error ? <ErrorText>{updateStatus.error.message}</ErrorText> : null}
      <View style={styles.actionRow}>
        <MobileButton
          disabled={updateProfile.isPending || fullName.trim().length === 0}
          label={updateProfile.isPending ? 'Saving...' : 'Save profile'}
          onPress={saveProfile}
          variant="blue"
        />
        <MobileButton
          disabled={isSelf || updateStatus.isPending}
          label={account.active ? 'Deactivate' : 'Reactivate'}
          onPress={() => {
            updateStatus.mutate({ userId: account.id, active: !account.active });
          }}
          variant={account.active ? 'danger' : 'success'}
        />
      </View>
      {isSelf ? <MutedText>Your own account cannot be deactivated here.</MutedText> : null}
    </Card>
  );
}

function AccessInvitationDetail({ invitation }: { invitation: AccessInvitation }) {
  return (
    <Card>
      <View style={styles.detailHeader}>
        <View>
          <SectionTitle>{invitation.email}</SectionTitle>
          <MutedText>{roleLabel(invitation.role)}</MutedText>
        </View>
        <Badge variant="warning">Pending</Badge>
      </View>
      <DetailRow label="Email delivery" value={invitation.emailStatus} />
      <DetailRow label="Invited" value={formatDate(invitation.createdAt)} />
      <MutedText>This account becomes active after the invite is accepted.</MutedText>
    </Card>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: C.blueLight,
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  avatarText: {
    color: C.navy,
    fontSize: 14,
    fontWeight: '800',
  },
  content: {
    gap: 16,
    padding: 18,
    paddingBottom: 32,
  },
  detailHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  detailLabel: {
    color: C.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  detailRow: {
    borderBottomColor: C.border,
    borderBottomWidth: 1,
    gap: 4,
    paddingBottom: 10,
  },
  detailValue: {
    color: C.textPrimary,
    fontSize: 13,
    fontWeight: '600',
  },
  filterButton: {
    alignItems: 'center',
    borderColor: C.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  filterButtonActive: {
    backgroundColor: C.navy,
    borderColor: C.navy,
  },
  filterButtonText: {
    color: C.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  filterButtonTextActive: {
    color: C.surface,
  },
  filterToggle: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  directoryList: {
    gap: 10,
  },
  directoryRow: {
    alignItems: 'center',
    borderColor: C.border,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 12,
  },
  intro: {
    gap: 8,
  },
  roleButton: {
    alignItems: 'center',
    borderColor: C.border,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  roleButtonActive: {
    backgroundColor: C.navy,
    borderColor: C.navy,
  },
  roleButtonText: {
    color: C.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  roleButtonTextActive: {
    color: C.surface,
  },
  roleToggle: {
    flexDirection: 'row',
    gap: 10,
  },
  rowBody: {
    flex: 1,
    gap: 3,
  },
  rowSubtitle: {
    color: C.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  rowTitle: {
    color: C.textPrimary,
    fontSize: 14,
    fontWeight: '800',
  },
  scroller: {
    backgroundColor: C.bg,
  },
  selectedRow: {
    backgroundColor: C.blueLight,
    borderColor: C.blueMid,
  },
  shell: {
    backgroundColor: C.bg,
    flex: 1,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  title: {
    color: C.textPrimary,
    fontSize: 28,
    fontWeight: '800',
  },
});
