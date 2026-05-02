'use client';

import { useEffect, useMemo, useState } from 'react';
import { Search, UserCheck, UserCog, UserPlus, UsersRound } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { EmptyState } from '@/components/ui/empty-state';
import { roleLabel } from '@/lib/profile-display';
import { api } from '@/lib/trpc';
import { AccessAccountPanel } from './access-account-panel';
import { accessFilters, type AccessAccount, type AccessFilter } from './access-account-model';
import { AccessInviteForm } from './access-invite-form';

interface AccessManagementClientProps {
  currentUserId: string;
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

export function AccessManagementClient({ currentUserId }: AccessManagementClientProps) {
  const [filter, setFilter] = useState<AccessFilter>('all');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const accountsQuery = api.admin.listUserAccounts.useQuery(undefined, { retry: false });
  const accounts = accountsQuery.data ?? [];

  const filteredAccounts = useMemo(() => {
    const query = search.trim().toLowerCase();
    return accounts.filter((account) => filterAccount(account, filter, query));
  }, [accounts, filter, search]);

  useEffect(() => {
    if (filteredAccounts.length === 0) {
      setSelectedId('');
      return;
    }
    if (!filteredAccounts.some((account) => account.id === selectedId)) {
      setSelectedId(filteredAccounts[0]?.id ?? '');
    }
  }, [filteredAccounts, selectedId]);

  const selectedAccount =
    filteredAccounts.find((account) => account.id === selectedId) ?? filteredAccounts[0];
  const parentCount = accounts.filter((account) => account.role === 'Parent').length;
  const supportCount = accounts.filter((account) => account.role === 'TechnicalSupport').length;
  const activeCount = accounts.filter((account) => account.active).length;

  return (
    <div className="people-profiles">
      <div className="people-profiles__summary">
        <div className="people-summary-card">
          <UsersRound aria-hidden="true" size={18} />
          <span>
            <strong>{String(accounts.length)}</strong>
            <small>Account shells</small>
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

      {accountsQuery.error ? <p className="status--error">{accountsQuery.error.message}</p> : null}

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
            {accountsQuery.isLoading ? (
              <div className="empty-state">Loading accounts...</div>
            ) : null}
            {!accountsQuery.isLoading && filteredAccounts.length === 0 ? (
              <EmptyState
                detail="Try another filter or invite a new account."
                title="No accounts found"
              />
            ) : null}
            {filteredAccounts.map((account, index) => (
              <button
                className={
                  account.id === selectedAccount?.id
                    ? 'people-directory-row is-active'
                    : 'people-directory-row'
                }
                key={account.id}
                onClick={() => {
                  setSelectedId(account.id);
                }}
                type="button"
              >
                <Avatar
                  className="people-avatar people-avatar--supervisor"
                  index={index}
                  name={account.fullName}
                />
                <span>
                  <strong>{account.fullName}</strong>
                  <small>
                    <i aria-hidden="true" />
                    {roleLabel(account.role)} · {account.active ? 'Active' : 'Inactive'}
                  </small>
                </span>
              </button>
            ))}
          </div>
        </aside>
        <div className="people-profiles__detail">
          {!selectedAccount && !accountsQuery.isLoading ? (
            <EmptyState detail="Invite a person to begin." title="No account selected" />
          ) : null}
          {selectedAccount ? (
            <AccessAccountPanel account={selectedAccount} currentUserId={currentUserId} />
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
