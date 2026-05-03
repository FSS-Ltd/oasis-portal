'use client';

import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/trpc';

interface PendingInviteResendActionProps {
  invitationId: string;
}

export function PendingInviteResendAction({ invitationId }: PendingInviteResendActionProps) {
  const utils = api.useUtils();
  const resendInvitation = api.admin.resendUserInvitation.useMutation({
    async onSuccess() {
      await utils.admin.listUserInvitations.invalidate();
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
      {resendInvitation.error ? (
        <p className="status--error" role="alert">
          {resendInvitation.error.message}
        </p>
      ) : null}
      {resendInvitation.data ? (
        <p className="status--success" role="status">
          Invitation email resent.
        </p>
      ) : null}
    </div>
  );
}
