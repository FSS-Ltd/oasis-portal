'use client';

import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { ConfirmationDialog } from '@/components/admin/confirmation-dialog';
import { Button } from '@/components/ui/button';
import { friendlyErrorMessage, showErrorToast, showSuccessToast } from '@/lib/notifications';
import { api } from '@/lib/trpc';

interface PendingInviteDeleteActionProps {
  invitationId: string;
  email: string;
}

export function PendingInviteDeleteAction({ invitationId, email }: PendingInviteDeleteActionProps) {
  const utils = api.useUtils();
  const [open, setOpen] = useState(false);
  const deleteInvitation = api.admin.deleteUserInvitation.useMutation({
    async onSuccess() {
      await utils.admin.listUserInvitations.invalidate();
      setOpen(false);
      showSuccessToast('Pending invitation deleted.');
    },
    onError(error) {
      showErrorToast(error, 'Invitation could not be deleted.');
    },
  });

  return (
    <>
      <Button
        onClick={() => {
          setOpen(true);
        }}
        pending={deleteInvitation.isPending}
        size="sm"
        type="button"
        variant="danger"
      >
        <Trash2 aria-hidden="true" size={15} />
        Delete invitation
      </Button>
      <ConfirmationDialog
        confirmLabel="Delete invitation"
        errorMessage={
          deleteInvitation.error ? friendlyErrorMessage(deleteInvitation.error) : undefined
        }
        onCancel={() => {
          if (!deleteInvitation.isPending) setOpen(false);
        }}
        onConfirm={() => {
          deleteInvitation.mutate({ id: invitationId });
        }}
        open={open}
        pending={deleteInvitation.isPending}
        title={`Delete invitation for ${email}?`}
      >
        <p>
          This revokes the pending Clerk invitation when possible and removes the local invite row.
        </p>
      </ConfirmationDialog>
    </>
  );
}
