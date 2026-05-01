'use client';

import { PERMISSION_TAGS, type PermissionTag } from '@oasis/domain';
import { ShieldCheck } from 'lucide-react';
import { api, type RouterOutputs } from '@/lib/trpc';
import { permissionTagLabel } from '@/lib/profile-display';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';

type UserRow = RouterOutputs['admin']['listUsers'][number];

function toggleTag(tags: readonly string[], tag: PermissionTag): PermissionTag[] {
  const next = new Set(tags);
  if (next.has(tag)) {
    next.delete(tag);
  } else {
    next.add(tag);
  }
  return PERMISSION_TAGS.filter((candidate) => next.has(candidate));
}

export function UserTagManager() {
  const utils = api.useUtils();
  const usersQuery = api.admin.listUsers.useQuery(undefined, { retry: false });
  const updateTags = api.admin.updateUserTags.useMutation({
    onSuccess: async () => {
      await utils.admin.listUsers.invalidate();
    },
  });
  const users = usersQuery.data ?? [];
  const columns: DataTableColumn<UserRow>[] = [
    {
      id: 'user',
      header: 'User',
      render: (user) => (
        <span className="student-row__text">
          <strong>{user.fullName}</strong>
          <span>{user.email}</span>
        </span>
      ),
    },
    { id: 'role', header: 'Role', render: (user) => user.role },
    {
      id: 'tags',
      header: 'Permission tags',
      render: (user) => (
        <div className="tag-toggle-list">
          {PERMISSION_TAGS.map((tag) => {
            const checked = user.tags.includes(tag);
            return (
              <label className={checked ? 'tag-toggle is-checked' : 'tag-toggle'} key={tag}>
                <input
                  checked={checked}
                  disabled={updateTags.isPending}
                  onChange={() => {
                    updateTags.mutate({
                      userId: user.id,
                      tags: toggleTag(user.tags, tag),
                    });
                  }}
                  type="checkbox"
                />
                <ShieldCheck aria-hidden="true" size={14} />
                <span>{permissionTagLabel(tag)}</span>
              </label>
            );
          })}
        </div>
      ),
    },
  ];

  return (
    <section className="grid">
      <div className="section-title">
        <div>
          <h2>Permission tags</h2>
          <p className="muted">
            Grant or revoke temporary access without changing a user&apos;s role.
          </p>
        </div>
      </div>
      <div className="panel panel--scroll">
        <DataTable
          columns={columns}
          empty={
            <EmptyState
              detail="Invite supervisors or parents before assigning permission tags."
              title="No active users found"
            />
          }
          errorMessage={usersQuery.error?.message}
          getRowKey={(user) => user.id}
          loading={usersQuery.isLoading}
          loadingLabel="Loading users..."
          rows={users}
          tableClassName="user-tags-table"
        />
      </div>
      {updateTags.error ? (
        <p className="status--error" role="alert">
          {updateTags.error.message}
        </p>
      ) : null}
    </section>
  );
}
