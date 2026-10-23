'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { ShieldCheck, Trash2, UserCheck, UserX } from 'lucide-react';
import { canManageUserAccounts, type Role } from '@oasis/domain';
import { cn } from '@/lib/utils';
import { api } from '@/lib/trpc';
import { friendlyErrorMessage, showErrorToast, showSuccessToast } from '@/lib/notifications';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { statusTone, type UserRow } from './people-profile-model';
import styles from '../people-profiles.module.css';

type AccountAction = 'deactivate' | 'reactivate' | 'delete';

const actionLabels: Record<AccountAction, string> = {
  deactivate: 'Deactivate account',
  reactivate: 'Reactivate account',
  delete: 'Delete account',
};

interface AccountAccessPanelProps {
  currentUserId: string;
  currentUserRole: Role;
  onAccessChanged: () => void;
  user: Pick<UserRow, 'id' | 'fullName' | 'active'>;
}

export function AccountAccessPanel({
  currentUserId,
  currentUserRole,
  onAccessChanged,
  user,
}: AccountAccessPanelProps) {
  const utils = api.useUtils();
  const [action, setAction] = useState<AccountAction | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const isSelf = user.id === currentUserId;
  const canManage = canManageUserAccounts({ role: currentUserRole });

  async function refreshAccounts(): Promise<void> {
    await Promise.all([
      utils.admin.listUsers.invalidate(),
      utils.admin.listUserAccounts.invalidate(),
    ]);
  }

  const updateStatus = api.admin.updateUserAccountStatus.useMutation({
    async onSuccess() {
      setAction(null);
      showSuccessToast(user.active ? 'Account deactivated.' : 'Account reactivated.');
      await refreshAccounts();
      onAccessChanged();
    },
    onError(error) {
      showErrorToast(error, 'Account status could not be updated.');
    },
  });
  const deleteAccount = api.admin.deleteUserAccount.useMutation({
    async onSuccess() {
      setAction(null);
      showSuccessToast('Account deleted. Historical records have been retained.');
      await refreshAccounts();
      onAccessChanged();
    },
    onError(error) {
      showErrorToast(error, 'Account could not be deleted.');
    },
  });
  const pending = updateStatus.isPending || deleteAccount.isPending;
  const error = action === 'delete' ? deleteAccount.error : updateStatus.error;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (action && dialog && !dialog.open) dialog.showModal();
    if (!action && dialog?.open) dialog.close();
  }, [action]);

  function openAction(next: AccountAction): void {
    updateStatus.reset();
    deleteAccount.reset();
    setAction(next);
  }

  function confirmAction(): void {
    if (!action || pending || isSelf || !canManage) return;
    if (action === 'delete') deleteAccount.mutate({ userId: user.id });
    else updateStatus.mutate({ userId: user.id, active: action === 'reactivate' });
  }

  return (
    <section className="panel" aria-label="Account access">
      <div className={cn('panel__body', styles.accountAccess)}>
        <div className={styles.accessHeading}>
          <ShieldCheck aria-hidden="true" size={18} />
          <h2>Account access</h2>
          <Badge tone={statusTone(user.active)}>{user.active ? 'Active' : 'Inactive'}</Badge>
        </div>
        <div className={styles.accessRow}>
          <div>
            <h3>{user.active ? 'Pause portal access' : 'Restore portal access'}</h3>
            <p className="muted">
              {user.active
                ? 'Keep the profile and linked records. You can reactivate it later.'
                : 'Allow this person to use the portal again with their existing sign-in.'}
            </p>
          </div>
          <Button
            disabled={isSelf || !canManage || pending}
            onClick={() => {
              openAction(user.active ? 'deactivate' : 'reactivate');
            }}
            type="button"
            variant="secondary"
          >
            {user.active ? (
              <UserX aria-hidden="true" size={16} />
            ) : (
              <UserCheck aria-hidden="true" size={16} />
            )}
            {user.active ? 'Deactivate account' : 'Reactivate account'}
          </Button>
        </div>
        <div className={cn(styles.accessRow, styles.deleteRow)}>
          <div>
            <h3>Delete account</h3>
            <p className="muted">
              Remove this account from the directory and block portal access. Historical records are
              retained.
            </p>
          </div>
          <Button
            disabled={isSelf || !canManage || pending}
            onClick={() => {
              openAction('delete');
            }}
            type="button"
            variant="danger"
          >
            <Trash2 aria-hidden="true" size={16} /> Delete account
          </Button>
        </div>
        {isSelf ? <p className="muted">You cannot deactivate or delete your own account.</p> : null}
        {!canManage ? (
          <p className="muted">You do not have permission to manage account access.</p>
        ) : null}
      </div>

      <dialog
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        className={styles.actionDialog}
        onCancel={(event) => {
          event.preventDefault();
          if (!pending) setAction(null);
        }}
        ref={dialogRef}
      >
        <div className={styles.dialogBody}>
          <h2 id={titleId}>
            {action ? `${actionLabels[action]} for ${user.fullName}?` : 'Account access'}
          </h2>
          <p id={descriptionId}>
            {action === 'delete'
              ? 'This account will disappear from account management and lose portal access. Linked student profiles, attendance, safeguarding records and audit history will be retained. You cannot restore this account from this page.'
              : action === 'deactivate'
                ? 'This person will lose portal access and appear under Inactive in the people selector. Their profile and linked history will remain available.'
                : 'This person will return to the current directory and regain portal access if their sign-in is valid.'}
          </p>
          {error ? (
            <p className="status--error" role="alert">
              {friendlyErrorMessage(error)}
            </p>
          ) : null}
          <div className={styles.dialogActions}>
            <Button
              disabled={pending}
              onClick={() => {
                setAction(null);
              }}
              type="button"
              variant="secondary"
            >
              Cancel
            </Button>
            <Button
              onClick={confirmAction}
              pending={pending}
              type="button"
              variant={action === 'reactivate' ? 'primary' : 'danger'}
            >
              {action ? actionLabels[action] : 'Confirm'}
            </Button>
          </div>
        </div>
      </dialog>
    </section>
  );
}
