'use client';

import { useEffect, useMemo, useState } from 'react';
import { GraduationCap, UserPlus, UsersRound } from 'lucide-react';
import { displaySchoolYearLabel } from '@oasis/domain';
import { api } from '@/lib/trpc';
import { roleLabel } from '@/lib/profile-display';
import { EmptyState } from '@/components/ui/empty-state';
import { InviteUserForm } from './invite-user-form';
import { PeopleDirectory } from './_components/people-directory';
import { PendingInviteProfilePanel } from './_components/pending-invite-profile-panel';
import { StudentProfilePanel } from './_components/student-profile-panel';
import { UserProfilePanel } from './_components/user-profile-panel';
import {
  childLabel,
  type DirectoryFilter,
  type DirectoryItem,
} from './_components/people-profile-model';

interface PeopleProfilesClientProps {
  currentUserId: string;
}

export function PeopleProfilesClient({ currentUserId }: PeopleProfilesClientProps) {
  const [filter, setFilter] = useState<DirectoryFilter>('all');
  const [search, setSearch] = useState('');
  const [selectedKey, setSelectedKey] = useState('');
  const usersQuery = api.admin.listUsers.useQuery(undefined, { retry: false });
  const invitationsQuery = api.admin.listUserInvitations.useQuery(undefined, { retry: false });
  const studentsQuery = api.student.list.useQuery({ includeInactive: true }, { retry: false });

  const directoryItems = useMemo<DirectoryItem[]>(() => {
    const studentItems: DirectoryItem[] = (studentsQuery.data ?? []).map((student) => ({
      key: `student:${student.id}`,
      kind: 'student',
      student,
      title: student.fullName,
      subtitle: `${displaySchoolYearLabel(student.yearGroup)} · ${student.active ? 'Active' : 'Archived'}`,
      searchText:
        `${student.fullName} ${student.yearGroup} ${student.active ? 'active' : 'archived'}`.toLowerCase(),
    }));

    const userItems: DirectoryItem[] = (usersQuery.data ?? [])
      .filter((user) => user.role !== 'Student')
      .map((user) => {
        const kind = user.role === 'Parent' ? 'parent' : 'supervisor';
        return {
          key: `${kind}:${user.id}`,
          kind,
          user,
          title: user.fullName,
          subtitle:
            kind === 'parent'
              ? `${childLabel(user.children.length)} · ${user.active ? 'Active' : 'Inactive'}`
              : `${roleLabel(user.role)} · ${user.active ? 'Active' : 'Inactive'}`,
          searchText:
            `${user.fullName} ${user.email} ${roleLabel(user.role)} ${user.active ? 'active' : 'inactive'}`.toLowerCase(),
        };
      });

    const invitationItems: DirectoryItem[] = (invitationsQuery.data ?? []).map((invitation) => ({
      key: `invite:${invitation.id}`,
      kind: 'invite',
      invitation,
      title: invitation.email,
      subtitle: roleLabel(invitation.role),
      searchText: `${invitation.email} ${roleLabel(invitation.role)} pending`.toLowerCase(),
    }));

    return [...studentItems, ...userItems, ...invitationItems].sort((a, b) =>
      a.title.localeCompare(b.title),
    );
  }, [invitationsQuery.data, studentsQuery.data, usersQuery.data]);

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    return directoryItems.filter((item) => {
      const filterKind =
        item.kind === 'invite'
          ? item.invitation.role === 'Parent'
            ? 'parent'
            : 'supervisor'
          : item.kind;
      const matchesFilter = filter === 'all' || filterKind === filter;
      const matchesSearch = query.length === 0 || item.searchText.includes(query);
      return matchesFilter && matchesSearch;
    });
  }, [directoryItems, filter, search]);

  useEffect(() => {
    if (filteredItems.length === 0) {
      setSelectedKey('');
      return;
    }
    if (!filteredItems.some((item) => item.key === selectedKey)) {
      setSelectedKey(filteredItems[0]?.key ?? '');
    }
  }, [filteredItems, selectedKey]);

  const selectedItem = filteredItems.find((item) => item.key === selectedKey) ?? filteredItems[0];
  const loading = usersQuery.isLoading || studentsQuery.isLoading || invitationsQuery.isLoading;
  const error =
    usersQuery.error?.message ?? studentsQuery.error?.message ?? invitationsQuery.error?.message;
  const accountCount =
    (usersQuery.data?.filter((user) => user.role !== 'Student').length ?? 0) +
    (invitationsQuery.data?.length ?? 0);

  return (
    <div className="people-profiles">
      <div className="people-profiles__summary">
        <div className="people-summary-card">
          <UsersRound aria-hidden="true" size={18} />
          <span>
            <strong>{String(accountCount)}</strong>
            <small>Accounts and pending invites</small>
          </span>
        </div>
        <div className="people-summary-card">
          <GraduationCap aria-hidden="true" size={18} />
          <span>
            <strong>{String(studentsQuery.data?.length ?? 0)}</strong>
            <small>Student profiles</small>
          </span>
        </div>
        <div className="people-summary-card">
          <UserPlus aria-hidden="true" size={18} />
          <span>
            <strong>Invite</strong>
            <small>Add a supervisor or parent</small>
          </span>
        </div>
      </div>

      {error ? <p className="status--error">{error}</p> : null}

      <div className="people-profiles__layout">
        <PeopleDirectory
          filter={filter}
          items={filteredItems}
          loading={loading}
          onFilterChange={setFilter}
          onSearchChange={setSearch}
          onSelect={setSelectedKey}
          search={search}
          selectedKey={selectedItem?.key ?? ''}
        />
        <div className="people-profiles__detail">
          {!selectedItem && !loading ? (
            <EmptyState
              detail="Invite a person or create a student to begin."
              title="No profile selected"
            />
          ) : null}
          {selectedItem?.kind === 'student' ? (
            <StudentProfilePanel student={selectedItem.student} />
          ) : null}
          {selectedItem?.kind === 'parent' || selectedItem?.kind === 'supervisor' ? (
            <UserProfilePanel
              currentUserId={currentUserId}
              kind={selectedItem.kind}
              user={selectedItem.user}
            />
          ) : null}
          {selectedItem?.kind === 'invite' ? (
            <PendingInviteProfilePanel invitation={selectedItem.invitation} />
          ) : null}
        </div>
      </div>

      <section className="people-invite-section">
        <div className="section-title">
          <div>
            <h2>Invite person</h2>
            <p className="muted">
              Send an invitation with the correct Oasis role and optional permission tag.
            </p>
          </div>
        </div>
        <InviteUserForm />
      </section>
    </div>
  );
}
