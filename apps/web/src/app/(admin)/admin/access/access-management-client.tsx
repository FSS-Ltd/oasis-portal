'use client';

import { useEffect, useMemo, useState } from 'react';
import { Search, UserCheck, UserCog, UserPlus, UsersRound } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { roleLabel } from '@/lib/profile-display';
import { api } from '@/lib/trpc';
import { AccessAccountPanel } from './access-account-panel';
import {
  accessFilters,
  type AccessAccount,
  type AccessFilter,
  type AccessInvitation,
} from './access-account-model';
import { AccessInviteForm } from './access-invite-form';
import { AccessPendingInvitePanel } from './access-pending-invite-panel';

interface AccessManagementClientProps {
  canDeleteAccounts: boolean;
  currentUserId: string;
}

type AccessDirectoryRow =
  | { account: AccessAccount; key: string; kind: 'account' }
  | { invitation: AccessInvitation; key: string; kind: 'invitation' };

function rowRole(row: AccessDirectoryRow): AccessAccount['role'] {
  return row.kind === 'account' ? row.account.role : row.invitation.role;
}

function filterAccount(account: AccessAccount, filter: AccessFilter, query: string): boolean {
  const matchesFilter =
    filter === 'all' ||
    (filter === 'active' && account.active) ||
    (filter === 'inactive' && !account.active) ||
    account.role === filter;
  const matchesSearch =
    query.length === 0 ||
    `${account.fullName} ${account.email} ${roleLabel(account.role)}`.toLowerCase().includes(query);
  return matchesFilter && matchesSearch;
}

function filterInvitation(
  invitation: AccessInvitation,
  filter: AccessFilter,
  query: string,
): boolean {
  const matchesFilter = filter === 'all' || invitation.role === filter;
  const matchesSearch =
    query.length === 0 ||
    `${invitation.email} ${roleLabel(invitation.role)} pending`.toLowerCase().includes(query);
  return matchesFilter && matchesSearch;
}

export function AccessManagementClient({
  canDeleteAccounts,
  currentUserId,
}: AccessManagementClientProps) {
  const [filter, setFilter] = useState<AccessFilter>('all');
  const [search, setSearch] = useState('');
  const [selectedKey, setSelectedKey] = useState('');
  const accountsQuery = api.admin.listUserAccounts.useQuery(undefined, { retry: false });
  const invitationsQuery = api.admin.listUserInvitations.useQuery(undefined, { retry: false });
  const accounts = useMemo(() => accountsQuery.data ?? [], [accountsQuery.data]);
  const invitations = useMemo(() => invitationsQuery.data ?? [], [invitationsQuery.data]);

  const directoryRows = useMemo<AccessDirectoryRow[]>(() => {
    const invitationRows = invitations.map((invitation) => ({
      key: `invitation:${invitation.id}`,
      kind: 'invitation' as const,
      invitation,
    }));
    const accountRows = accounts.map((account) => ({
      key: `account:${account.id}`,
      kind: 'account' as const,
      account,
    }));
    return [...invitationRows, ...accountRows];
  }, [accounts, invitations]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return directoryRows.filter((row) =>
      row.kind === 'account'
        ? filterAccount(row.account, filter, query)
        : filterInvitation(row.invitation, filter, query),
    );
  }, [directoryRows, filter, search]);

  useEffect(() => {
    if (filteredRows.length === 0) {
      setSelectedKey('');
      return;
    }
    if (!filteredRows.some((row) => row.key === selectedKey)) {
      setSelectedKey(filteredRows[0]?.key ?? '');
    }
  }, [filteredRows, selectedKey]);

  const selectedRow = filteredRows.find((row) => row.key === selectedKey) ?? filteredRows[0];
  const parentCount = directoryRows.filter((row) => rowRole(row) === 'Parent').length;
  const supportCount = directoryRows.filter((row) => rowRole(row) === 'TechnicalSupport').length;
  const activeCount = accounts.filter((account) => account.active).length;
  const loading = accountsQuery.isLoading || invitationsQuery.isLoading;
  const error = accountsQuery.error?.message ?? invitationsQuery.error?.message;

  return (
    <div className="people-profiles">
      <div className="people-profiles__summary">
        <div className="people-summary-card">
          <UsersRound aria-hidden="true" size={18} />
          <span>
            <strong>{String(directoryRows.length)}</strong>
            <small>Accounts and invites</small>
          </span>
        </div>
        <div className="people-summary-card">
          <UserCheck aria-hidden="true" size={18} />
          <span>
            <strong>{String(activeCount)}</strong>
            <small>Active accounts</small>
          </span>
        </div>
        <div className="people-summary-card">
          <UserCog aria-hidden="true" size={18} />
          <span>
            <strong>{String(supportCount)}</strong>
            <small>Support accounts</small>
          </span>
        </div>
        <div className="people-summary-card">
          <UserPlus aria-hidden="true" size={18} />
          <span>
            <strong>{String(parentCount)}</strong>
            <small>Parent accounts</small>
          </span>
        </div>
      </div>

      {error ? <p className="status--error">{error}</p> : null}

      <div className="people-profiles__layout">
        <aside className="people-directory panel" aria-label="User access directory">
          <div className="people-directory__filters" role="tablist">
            {accessFilters.map((option) => (
              <button
                aria-selected={filter === option.id}
                className={filter === option.id ? 'is-selected' : undefined}
                key={option.id}
                onClick={() => {
                  setFilter(option.id);
                }}
                role="tab"
                type="button"
              >
                {option.label}
              </button>
            ))}
          </div>
          <label className="people-directory__search">
            <Search aria-hidden="true" size={15} />
            <span className="sr-only">Search user accounts</span>
            <input
              onChange={(event) => {
                setSearch(event.target.value);
              }}
              placeholder="Search accounts..."
              type="search"
              value={search}
            />
          </label>
          <div className="people-directory__list">
            {loading ? <div className="empty-state">Loading accounts...</div> : null}
            {!loading && filteredRows.length === 0 ? (
              <EmptyState
                detail="Try another filter or invite a new account."
                title="No accounts found"
              />
            ) : null}
            {filteredRows.map((row, index) => (
              <button
                className={
                  row.key === selectedRow?.key
                    ? 'people-directory-row is-active'
                    : 'people-directory-row'
                }
                key={row.key}
                onClick={() => {
                  setSelectedKey(row.key);
                }}
                type="button"
              >
                <Avatar
                  className="people-avatar people-avatar--supervisor"
                  index={index}
                  name={row.kind === 'account' ? row.account.fullName : row.invitation.email}
                />
                <span>
                  <strong>
                    {row.kind === 'account' ? row.account.fullName : row.invitation.email}
                  </strong>
                  <small>
                    <i aria-hidden="true" />
                    {row.kind === 'account' ? (
                      <>
                        {roleLabel(row.account.role)} · {row.account.active ? 'Active' : 'Inactive'}
                      </>
                    ) : (
                      <>
                        {roleLabel(row.invitation.role)}
                        <Badge tone="amber">Pending</Badge>
                      </>
                    )}
                  </small>
                </span>
              </button>
            ))}
          </div>
        </aside>
        <div className="people-profiles__detail">
          {!selectedRow && !loading ? (
            <EmptyState detail="Invite a person to begin." title="No account selected" />
          ) : null}
          {selectedRow?.kind === 'account' ? (
            <AccessAccountPanel
              account={selectedRow.account}
              canDeleteAccounts={canDeleteAccounts}
              currentUserId={currentUserId}
            />
          ) : null}
          {selectedRow?.kind === 'invitation' ? (
            <AccessPendingInvitePanel invitation={selectedRow.invitation} />
          ) : null}
        </div>
      </div>

      <section className="people-invite-section">
        <div className="section-title">
          <div>
            <h2>Invite account</h2>
            <p className="muted">Send an invitation for a parent or support account.</p>
          </div>
        </div>
        <AccessInviteForm />
      </section>
    </div>
  );
}
