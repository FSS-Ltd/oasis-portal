'use client';

import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { showErrorToast, showSuccessToast } from '@/lib/notifications';
import { api } from '@/lib/trpc';

interface PendingInviteResendActionProps {
  invitationId: string;
}

export function PendingInviteResendAction({ invitationId }: PendingInviteResendActionProps) {
  const utils = api.useUtils();
  const resendInvitation = api.admin.resendUserInvitation.useMutation<undefined>({
    async onSuccess() {
      await utils.admin.listUserInvitations.invalidate();
      showSuccessToast('Invitation email resent.');
    },
    onError(error) {
      showErrorToast(error, 'Invitation email could not be resent.');
    },
  });

  return (
    <div className="pending-invite-actions">
      <Button
        onClick={() => {
          resendInvitation.mutate({ id: invitationId });
        }}
        pending={resendInvitation.isPending}
        size="sm"
        type="button"
        variant="secondary"
      >
        <Send aria-hidden="true" size={15} />
        Resend invitation
      </Button>
    </div>
  );
}
