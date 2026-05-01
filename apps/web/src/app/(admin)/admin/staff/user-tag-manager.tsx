'use client';

import { PERMISSION_TAGS, type PermissionTag } from '@oasis/domain';
import { ShieldCheck } from 'lucide-react';
import { api } from '@/lib/trpc';
import { MotionList, MotionTableRow } from '@/components/admin/motion';

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
        {usersQuery.isLoading ? (
          <div className="empty-state">Loading users...</div>
        ) : usersQuery.error ? (
          <div className="empty-state status--error">{usersQuery.error.message}</div>
        ) : users.length === 0 ? (
          <div className="empty-state">
            <strong>No active users found</strong>
            <span>Invite staff or parents before assigning permission tags.</span>
          </div>
        ) : (
          <MotionList>
            <table className="table user-tags-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>Permission tags</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <MotionTableRow key={user.id}>
                    <td>
                      <span className="student-row__text">
                        <strong>{user.fullName}</strong>
                        <span>{user.email}</span>
                      </span>
                    </td>
                    <td>{user.role}</td>
                    <td>
                      <div className="tag-toggle-list">
                        {PERMISSION_TAGS.map((tag) => {
                          const checked = user.tags.includes(tag);
                          return (
                            <label
                              className={checked ? 'tag-toggle is-checked' : 'tag-toggle'}
                              key={tag}
                            >
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
                              <span>{tag}</span>
                            </label>
                          );
                        })}
                      </div>
                    </td>
                  </MotionTableRow>
                ))}
              </tbody>
            </table>
          </MotionList>
        )}
      </div>
      {updateTags.error ? (
        <p className="status--error" role="alert">
          {updateTags.error.message}
        </p>
      ) : null}
    </section>
  );
}
