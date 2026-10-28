'use client';

import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { canManageUserAccounts, type Role } from '@oasis/domain';
import { cn } from '@/lib/utils';
import { api } from '@/lib/trpc';
import { showErrorToast, showSuccessToast } from '@/lib/notifications';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDate } from './people-profile-model';
import styles from '../people-profiles.module.css';

export function DeletionRequestsPanel({ currentUserRole }: { currentUserRole: Role }) {
  const utils = api.useUtils();
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const canManage = canManageUserAccounts({ role: currentUserRole });
  const queue = api.accountDeletion.queue.useQuery(undefined, { enabled: canManage });

  async function refresh(): Promise<void> {
    setConfirmingId(null);
    await Promise.all([
      utils.accountDeletion.queue.invalidate(),
      utils.admin.listUsers.invalidate(),
      utils.admin.listUserAccounts.invalidate(),
    ]);
  }

  const approve = api.accountDeletion.approve.useMutation({
    async onSuccess(result) {
      showSuccessToast(
        result.clerkUserDeleted
          ? 'Account deleted. Historical records have been retained.'
          : 'Account deleted and sign-in blocked. Remove the person in Clerk by hand.',
      );
      await refresh();
    },
    onError(error) {
      showErrorToast(error, 'Account could not be deleted.');
    },
  });
  const decline = api.accountDeletion.decline.useMutation({
    async onSuccess() {
      showSuccessToast('Request declined.');
      await refresh();
    },
    onError(error) {
      showErrorToast(error, 'Request could not be declined.');
    },
  });
  const pending = approve.isPending || decline.isPending;

  if (!canManage || !queue.data || queue.data.length === 0) return null;

  return (
    <section aria-label="Account deletion requests" className="panel">
      <div className={cn('panel__body', styles.accountAccess)}>
        <div className={styles.accessHeading}>
          <Trash2 aria-hidden="true" size={18} />
          <h2>Account deletion requests</h2>
          <Badge tone="amber">{queue.data.length} waiting</Badge>
        </div>
        {queue.data.map((request) => (
          <div className={styles.accessRow} key={request.userId}>
            <div>
              <h3>
                {request.fullName} ({request.role})
              </h3>
              <p className="muted">
                Requested {formatDate(request.requestedAt)}{' '}
                {request.requestedBySelf ? 'by the account holder' : 'by a parent or carer'}.
                Approving blocks sign-in and keeps attendance, safeguarding and audit records.
              </p>
            </div>
            {confirmingId === request.userId ? (
              <div className={styles.dialogActions}>
                <Button
                  disabled={pending}
                  onClick={() => {
                    setConfirmingId(null);
                  }}
                  type="button"
                  variant="secondary"
                >
                  Back
                </Button>
                <Button
                  onClick={() => {
                    approve.mutate({ userId: request.userId });
                  }}
                  pending={approve.isPending}
                  type="button"
                  variant="danger"
                >
                  Confirm deletion
                </Button>
              </div>
            ) : (
              <div className={styles.dialogActions}>
                <Button
                  disabled={pending}
                  onClick={() => {
                    decline.mutate({ userId: request.userId });
                  }}
                  type="button"
                  variant="secondary"
                >
                  Decline
                </Button>
                <Button
                  disabled={pending}
                  onClick={() => {
                    setConfirmingId(request.userId);
                  }}
                  type="button"
                  variant="danger"
                >
                  Approve deletion
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
