'use client';

import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { Hash, MessageCircle, ShieldCheck, UsersRound } from 'lucide-react';
import { friendlyErrorMessage, showErrorToast, showSuccessToast } from '@/lib/notifications';
import { api } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Field, TextInput } from '@/components/ui/field';
import {
  countLabel,
  formatCommunityDateTime,
  type AdminCommunityGroup,
  type AdminCommunityMessage,
  type StudentModerationRow,
} from './community-types';

interface GroupFormState {
  title: string;
  description: string;
  isPublic: boolean;
  active: boolean;
}

interface BlockFormState {
  studentId: string;
  reason: string;
}

const emptyGroupForm: GroupFormState = {
  title: '',
  description: '',
  isPublic: true,
  active: true,
};

function groupMeta(group: AdminCommunityGroup): string {
  return [
    group.isCentral ? 'Central' : group.isPublic ? 'Public join' : 'Invite only',
    group.active ? 'Active' : 'Disabled',
    countLabel(group.memberCount, 'member'),
  ].join(' · ');
}

function GroupRow({
  active,
  group,
  onSelect,
}: {
  active: boolean;
  group: AdminCommunityGroup;
  onSelect: (groupId: string) => void;
}) {
  return (
    <button
      aria-pressed={active}
      className={active ? 'community-group-row is-active' : 'community-group-row'}
      onClick={() => {
        onSelect(group.id);
      }}
      type="button"
    >
      <span className="community-group-row__icon">
        {group.isCentral ? (
          <MessageCircle aria-hidden="true" size={17} />
        ) : (
          <Hash aria-hidden="true" size={17} />
        )}
      </span>
      <span>
        <strong>{group.title}</strong>
        <small>{groupMeta(group)}</small>
      </span>
    </button>
  );
}

function AdminMessageRow({ message }: { message: AdminCommunityMessage }) {
  return (
    <article className="community-admin-message">
      <header>
        <strong>{message.sender.fullName}</strong>
        <time>{formatCommunityDateTime(message.createdAt)}</time>
      </header>
      <p>{message.body}</p>
    </article>
  );
}

function MembershipButton({
  group,
  onToggle,
  pending,
  student,
}: {
  group: AdminCommunityGroup;
  onToggle: (studentId: string, active: boolean) => void;
  pending: boolean;
  student: StudentModerationRow;
}) {
  const member = group.members.some((row) => row.studentId === student.studentId);
  return (
    <div className="community-membership-row">
      <span>
        <strong>{student.fullName}</strong>
        <small>{student.yearGroup}</small>
      </span>
      <Button
        disabled={group.isCentral}
        onClick={() => {
          onToggle(student.studentId, !member);
        }}
        pending={pending}
        size="sm"
        type="button"
        variant={member ? 'secondary' : 'ghost'}
      >
        {member ? 'Remove' : 'Add'}
      </Button>
    </div>
  );
}

function StudentBlockRow({
  form,
  onReasonChange,
  onToggle,
  pending,
  student,
}: {
  form: BlockFormState;
  onReasonChange: (studentId: string, reason: string) => void;
  onToggle: (student: StudentModerationRow) => void;
  pending: boolean;
  student: StudentModerationRow;
}) {
  const blocked = student.communityMessagingBlocked;
  return (
    <article className={blocked ? 'community-student-row is-blocked' : 'community-student-row'}>
      <span>
        <strong>{student.fullName}</strong>
        <small>{student.yearGroup}</small>
      </span>
      <input
        aria-label={`Reason for ${student.fullName}`}
        className="input"
        onChange={(event) => {
          onReasonChange(student.studentId, event.target.value);
        }}
        placeholder="Reason"
        value={form.studentId === student.studentId ? form.reason : ''}
      />
      <Button
        onClick={() => {
          onToggle(student);
        }}
        pending={pending}
        size="sm"
        type="button"
        variant={blocked ? 'secondary' : 'danger'}
      >
        {blocked ? 'Enable' : 'Disable'}
      </Button>
    </article>
  );
}

export function AdminCommunityClient() {
  const utils = api.useUtils();
  const groupsQuery = api.community.listAdminGroups.useQuery(undefined, { retry: false });
  const studentsQuery = api.community.listStudentModeration.useQuery(undefined, { retry: false });
  const groups = groupsQuery.data ?? [];
  const students = studentsQuery.data ?? [];
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [groupForm, setGroupForm] = useState<GroupFormState>(emptyGroupForm);
  const [blockForm, setBlockForm] = useState<BlockFormState>({ studentId: '', reason: '' });
  const selectedGroup = useMemo(
    () => groups.find((group) => group.id === selectedGroupId) ?? groups[0] ?? null,
    [groups, selectedGroupId],
  );

  const messagesQuery = api.community.listAdminGroupMessages.useQuery(
    { groupId: selectedGroup?.id ?? '' },
    { enabled: Boolean(selectedGroup?.id), retry: false },
  );

  const createGroup = api.community.createGroup.useMutation({
    onError(error) {
      showErrorToast(error, 'Community group could not be created.');
    },
    async onSuccess() {
      setGroupForm(emptyGroupForm);
      await utils.community.listAdminGroups.invalidate();
      showSuccessToast('Community group created.');
    },
  });

  const updateGroup = api.community.updateGroup.useMutation({
    onError(error) {
      showErrorToast(error, 'Community group could not be updated.');
    },
    async onSuccess() {
      await utils.community.listAdminGroups.invalidate();
      showSuccessToast('Community group updated.');
    },
  });

  const setMembership = api.community.setMembership.useMutation({
    onError(error) {
      showErrorToast(error, 'Membership could not be updated.');
    },
    async onSuccess() {
      await utils.community.listAdminGroups.invalidate();
    },
  });

  const setBlocked = api.community.setStudentMessagingBlocked.useMutation({
    onError(error) {
      showErrorToast(error, 'Student messaging setting could not be updated.');
    },
    async onSuccess() {
      setBlockForm({ studentId: '', reason: '' });
      await utils.community.listStudentModeration.invalidate();
      showSuccessToast('Student messaging setting updated.');
    },
  });

  useEffect(() => {
    if (!selectedGroupId && groups[0]) setSelectedGroupId(groups[0].id);
  }, [groups, selectedGroupId]);

  function submitGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!groupForm.title.trim()) return;
    createGroup.mutate({
      title: groupForm.title,
      description: groupForm.description,
      isPublic: groupForm.isPublic,
      active: groupForm.active,
    });
  }

  function updateSelectedGroup(input: Partial<GroupFormState>) {
    if (!selectedGroup) return;
    updateGroup.mutate({
      groupId: selectedGroup.id,
      title: input.title ?? selectedGroup.title,
      description: input.description ?? selectedGroup.description ?? '',
      isPublic: input.isPublic ?? selectedGroup.isPublic,
      active: input.active ?? selectedGroup.active,
    });
  }

  function toggleMembership(studentId: string, active: boolean) {
    if (!selectedGroup) return;
    setMembership.mutate({ groupId: selectedGroup.id, studentId, active });
  }

  function updateReason(studentId: string, reason: string) {
    setBlockForm({ studentId, reason });
  }

  function toggleBlocked(student: StudentModerationRow) {
    const reason = blockForm.studentId === student.studentId ? blockForm.reason : '';
    setBlocked.mutate({
      studentId: student.studentId,
      blocked: !student.communityMessagingBlocked,
      reason,
    });
  }

  return (
    <div className="community-page">
      <div className="dashboard-hero">
        <p>Student community</p>
        <h1>Community controls</h1>
        <span>Manage groups, memberships, and student messaging access.</span>
      </div>

      <section
        className="panel panel__body community-admin-create"
        aria-labelledby="create-group-title"
      >
        <div className="section-title">
          <div>
            <h2 id="create-group-title">Create group</h2>
            <p className="muted">Groups are text-only and visible to community moderators.</p>
          </div>
        </div>
        <form
          className="community-admin-form"
          onSubmit={(event) => {
            submitGroup(event);
          }}
        >
          <Field label="Group title" required>
            <TextInput
              maxLength={120}
              onChange={(event) => {
                setGroupForm((current) => ({ ...current, title: event.target.value }));
              }}
              required
              value={groupForm.title}
            />
          </Field>
          <Field label="Description">
            <TextInput
              maxLength={500}
              onChange={(event) => {
                setGroupForm((current) => ({ ...current, description: event.target.value }));
              }}
              value={groupForm.description}
            />
          </Field>
          <label className="community-check">
            <input
              checked={groupForm.isPublic}
              onChange={(event) => {
                setGroupForm((current) => ({ ...current, isPublic: event.target.checked }));
              }}
              type="checkbox"
            />
            <span>Students can join</span>
          </label>
          <label className="community-check">
            <input
              checked={groupForm.active}
              onChange={(event) => {
                setGroupForm((current) => ({ ...current, active: event.target.checked }));
              }}
              type="checkbox"
            />
            <span>Group active</span>
          </label>
          <Button pending={createGroup.isPending} type="submit">
            Create Group
          </Button>
        </form>
      </section>

      <div className="community-admin-layout">
        <section
          className="panel community-group-panel"
          aria-labelledby="admin-community-groups-title"
        >
          <div className="message-panel-header">
            <h2 id="admin-community-groups-title">Groups</h2>
            <span>{String(groups.length)}</span>
          </div>
          {groupsQuery.isLoading ? <EmptyState title="Loading groups..." /> : null}
          {groupsQuery.error ? (
            <p className="status--error">{friendlyErrorMessage(groupsQuery.error)}</p>
          ) : null}
          <div className="community-group-list">
            {groups.map((group) => (
              <GroupRow
                active={group.id === selectedGroup?.id}
                group={group}
                key={group.id}
                onSelect={setSelectedGroupId}
              />
            ))}
          </div>
        </section>

        <section className="panel panel__body community-admin-detail">
          {selectedGroup ? (
            <>
              <div className="community-chat-header">
                <div>
                  <p>{selectedGroup.isCentral ? 'Central group' : 'Student group'}</p>
                  <h2>{selectedGroup.title}</h2>
                  <span>{groupMeta(selectedGroup)}</span>
                </div>
                <div className="community-admin-actions">
                  <Button
                    disabled={selectedGroup.isCentral}
                    onClick={() => {
                      updateSelectedGroup({ isPublic: !selectedGroup.isPublic });
                    }}
                    pending={updateGroup.isPending}
                    size="sm"
                    type="button"
                    variant="secondary"
                  >
                    {selectedGroup.isPublic ? 'Make Invite Only' : 'Allow Join'}
                  </Button>
                  <Button
                    onClick={() => {
                      updateSelectedGroup({ active: !selectedGroup.active });
                    }}
                    pending={updateGroup.isPending}
                    size="sm"
                    type="button"
                    variant={selectedGroup.active ? 'danger' : 'secondary'}
                  >
                    {selectedGroup.active ? 'Disable' : 'Enable'}
                  </Button>
                </div>
              </div>

              <div className="community-admin-columns">
                <section aria-labelledby="community-members-title">
                  <h3 id="community-members-title">
                    <UsersRound aria-hidden="true" size={16} />
                    Members
                  </h3>
                  <div className="community-membership-list">
                    {students.map((student) => (
                      <MembershipButton
                        group={selectedGroup}
                        key={student.studentId}
                        onToggle={toggleMembership}
                        pending={setMembership.isPending}
                        student={student}
                      />
                    ))}
                  </div>
                </section>

                <section aria-labelledby="community-message-oversight-title">
                  <h3 id="community-message-oversight-title">
                    <MessageCircle aria-hidden="true" size={16} />
                    Messages
                  </h3>
                  {messagesQuery.isLoading ? <EmptyState title="Loading messages..." /> : null}
                  {messagesQuery.error ? (
                    <p className="status--error">{friendlyErrorMessage(messagesQuery.error)}</p>
                  ) : null}
                  <div className="community-admin-message-list">
                    {(messagesQuery.data?.messages ?? []).map((message) => (
                      <AdminMessageRow key={message.id} message={message} />
                    ))}
                  </div>
                </section>
              </div>
            </>
          ) : (
            <EmptyState
              detail="Create a group to start managing community access."
              title="No group selected"
            />
          )}
        </section>
      </div>

      <section
        className="panel panel__body community-student-moderation"
        aria-labelledby="student-moderation-title"
      >
        <div className="section-title">
          <div>
            <h2 id="student-moderation-title">Student messaging</h2>
            <p className="muted">
              Disable messaging for a specific child without removing portal access.
            </p>
          </div>
          <ShieldCheck aria-hidden="true" size={20} />
        </div>
        {studentsQuery.isLoading ? <EmptyState title="Loading students..." /> : null}
        {studentsQuery.error ? (
          <p className="status--error">{friendlyErrorMessage(studentsQuery.error)}</p>
        ) : null}
        <div className="community-student-list">
          {students.map((student) => (
            <StudentBlockRow
              form={blockForm}
              key={student.studentId}
              onReasonChange={updateReason}
              onToggle={toggleBlocked}
              pending={setBlocked.isPending}
              student={student}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
