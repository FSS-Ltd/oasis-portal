import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ROLES, type Role } from '@oasis/domain/rbac';
import { api } from '../../lib/trpc';
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
import { DeletionRequestAlert, DeletionRequestsCard } from './deletion-requests-card';
import { UserAccessAccountDetail } from './user-access-account-detail';
import {
  accessFilters,
  roleLabel,
  type AccessFilter,
  type AccessInvitation,
  type DirectoryRow,
} from './user-access-model';

interface UserAccessScreenProps {
  currentUserId: string;
  /** Opens this account's profile at the top, e.g. from a tapped deletion alert. */
  focusAccountId?: string | undefined;
  footer?: ReactNode | undefined;
  header: ReactNode;
  introduction: ReactNode;
}

function rowTitle(row: DirectoryRow): string {
  return row.kind === 'account' ? row.account.fullName : row.invitation.email;
}

function rowSubtitle(row: DirectoryRow): string {
  if (row.kind === 'invitation') return `${roleLabel(row.invitation.role)} · Pending`;
  const status = row.account.active ? 'Active' : 'Inactive';
  const deletion = row.account.deletionRequestedAt ? ' · Deletion requested' : '';
  return `${roleLabel(row.account.role)} · ${status}${deletion}`;
}

function rowMatches(row: DirectoryRow, query: string): boolean {
  if (!query) return true;
  const values =
    row.kind === 'account'
      ? `${row.account.fullName} ${row.account.email ?? ''} ${row.account.role}`
      : `${row.invitation.email} ${row.invitation.role} pending`;
  return values.toLowerCase().includes(query);
}

function rowMatchesFilter(row: DirectoryRow, filter: AccessFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'active') return row.kind === 'account' && row.account.active;
  if (filter === 'inactive') return row.kind === 'account' && !row.account.active;
  return (row.kind === 'account' ? row.account.role : row.invitation.role) === filter;
}

export function UserAccessScreen({
  currentUserId,
  focusAccountId,
  footer,
  header,
  introduction,
}: UserAccessScreenProps) {
  const utils = api.useUtils();
  const [filter, setFilter] = useState<AccessFilter>('all');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState(focusAccountId ? `account:${focusAccountId}` : '');
  // The account opened from an alert: its profile shows first, and its deletion card stays mounted
  // after approval so the confirmation is still visible once the account leaves the list.
  const [focusedId, setFocusedId] = useState<string | null>(focusAccountId ?? null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<Role>('Parent');
  const accountsQuery = api.admin.listUserAccounts.useQuery(undefined, { retry: false });
  const invitationsQuery = api.admin.listUserInvitations.useQuery(undefined, { retry: false });
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
  const rows = useMemo<DirectoryRow[]>(
    () => [
      ...invitations.map((invitation) => ({
        id: `invitation:${invitation.id}`,
        invitation,
        kind: 'invitation' as const,
      })),
      ...accounts.map((account) => ({
        account,
        id: `account:${account.id}`,
        kind: 'account' as const,
      })),
    ],
    [accounts, invitations],
  );
  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter((row) => rowMatchesFilter(row, filter) && rowMatches(row, query));
  }, [filter, rows, search]);
  const selectedRow = filteredRows.find((row) => row.id === selectedId) ?? filteredRows[0] ?? null;
  const loading = accountsQuery.isLoading || invitationsQuery.isLoading;
  const errorMessage = accountsQuery.error?.message ?? invitationsQuery.error?.message ?? null;
  const activeCount = accounts.filter((account) => account.active).length;

  function focusAccount(accountId: string) {
    setFilter('all');
    setSearch('');
    setSelectedId(`account:${accountId}`);
    setFocusedId(accountId);
  }

  useEffect(() => {
    if (focusAccountId) focusAccount(focusAccountId);
  }, [focusAccountId]);

  useEffect(() => {
    // Wait for the list before falling back, or an alert's profile is replaced by the first row.
    if (loading) return;
    if (selectedRow && selectedRow.id !== selectedId) setSelectedId(selectedRow.id);
    if (!selectedRow) setSelectedId('');
  }, [loading, selectedId, selectedRow]);

  const selectedAccountId = selectedRow?.kind === 'account' ? selectedRow.account.id : null;
  const deletionCardId = focusedId ?? selectedAccountId;
  const detail = (
    <>
      {deletionCardId ? (
        <DeletionRequestsCard key={deletionCardId} userId={deletionCardId} />
      ) : null}
      {selectedRow?.kind === 'account' && (!focusedId || focusedId === selectedAccountId) ? (
        <UserAccessAccountDetail account={selectedRow.account} currentUserId={currentUserId} />
      ) : null}
      {selectedRow?.kind === 'invitation' && !focusedId ? (
        <InvitationDetail invitation={selectedRow.invitation} />
      ) : null}
    </>
  );

  return (
    <SafeAreaView style={styles.shell}>
      {header}
      <ScrollView contentContainerStyle={styles.content} style={styles.scroller}>
        {introduction}
        {focusedId ? detail : null}
        <View style={styles.statsGrid}>
          <StatCard label="Accounts and invites" value={String(rows.length)} />
          <StatCard accent={C.success} label="Active accounts" value={String(activeCount)} />
        </View>
        {errorMessage ? <ErrorText>{errorMessage}</ErrorText> : null}
        {focusedId ? null : <DeletionRequestAlert onOpen={focusAccount} />}
        <Card>
          <SectionTitle>Invite account</SectionTitle>
          <Field
            keyboardType="email-address"
            label="Email"
            onChangeText={setInviteEmail}
            placeholder="name@example.com"
            value={inviteEmail}
          />
          <View style={styles.choiceList}>
            {ROLES.map((role) => (
              <Pressable
                accessibilityRole="button"
                key={role}
                onPress={() => {
                  setInviteRole(role);
                }}
                style={[styles.choice, inviteRole === role ? styles.choiceActive : null]}
              >
                <Text
                  style={[styles.choiceText, inviteRole === role ? styles.choiceTextActive : null]}
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
            onPress={() => {
              inviteUser.mutate({ email: inviteEmail, role: inviteRole, tags: [] });
            }}
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
                  setFocusedId(null);
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
        {focusedId ? null : detail}
      </ScrollView>
      {footer}
    </SafeAreaView>
  );
}

function InvitationDetail({ invitation }: { invitation: AccessInvitation }) {
  return (
    <Card>
      <View style={styles.detailHeader}>
        <View>
          <SectionTitle>{invitation.email}</SectionTitle>
          <MutedText>{roleLabel(invitation.role)}</MutedText>
        </View>
        <Badge variant="warning">Pending</Badge>
      </View>
      <MutedText>Email delivery: {invitation.emailStatus}</MutedText>
      <MutedText>This account becomes active after the invite is accepted.</MutedText>
    </Card>
  );
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: 'center',
    backgroundColor: C.blueLight,
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  avatarText: { color: C.navy, fontSize: 14, fontWeight: '800' },
  choice: {
    borderColor: C.border,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  choiceActive: { backgroundColor: C.navy, borderColor: C.navy },
  choiceList: { gap: 8 },
  choiceText: { color: C.textSecondary, fontSize: 13, fontWeight: '700' },
  choiceTextActive: { color: C.surface },
  content: { gap: 16, padding: 18, paddingBottom: 32 },
  detailHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  directoryList: { gap: 10 },
  directoryRow: {
    alignItems: 'center',
    borderColor: C.border,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 12,
  },
  filterButton: {
    alignItems: 'center',
    borderColor: C.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  filterButtonActive: { backgroundColor: C.navy, borderColor: C.navy },
  filterButtonText: { color: C.textSecondary, fontSize: 12, fontWeight: '700' },
  filterButtonTextActive: { color: C.surface },
  filterToggle: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  rowBody: { flex: 1, gap: 3 },
  rowSubtitle: { color: C.textSecondary, fontSize: 12, fontWeight: '600' },
  rowTitle: { color: C.textPrimary, fontSize: 14, fontWeight: '800' },
  scroller: { backgroundColor: C.bg },
  selectedRow: { backgroundColor: C.blueLight, borderColor: C.blueMid },
  shell: { backgroundColor: C.bg, flex: 1 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
});
