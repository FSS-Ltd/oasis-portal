'use client';

import { Clock, Mail } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { roleLabel } from '@/lib/profile-display';
import { PendingInviteResendAction } from '../_components/pending-invite-resend-action';
import { formatAccountDate, type AccessInvitation } from './access-account-model';

interface AccessPendingInvitePanelProps {
  invitation: AccessInvitation;
}

function emailStatusLabel(status: AccessInvitation['emailStatus']): string {
  if (status === 'Sent') return 'Email sent';
  if (status === 'Failed') return 'Email failed';
  return 'Email queued';
}

export function AccessPendingInvitePanel({ invitation }: AccessPendingInvitePanelProps) {
  return (
    <section className="person-profile person-profile--supervisor">
      <section className="profile-hero">
        <Avatar className="profile-hero__avatar" name={invitation.email} />
        <div className="profile-hero__body">
          <div>
            <h2>{invitation.email}</h2>
            <p>{roleLabel(invitation.role)}</p>
          </div>
          <div className="profile-hero__badges">
            <span>{roleLabel(invitation.role)}</span>
            <span>Pending</span>
            <span>{emailStatusLabel(invitation.emailStatus)}</span>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel__body form-grid">
          <div className="profile-field-list">
            <div className="profile-field-row">
              <span>Status</span>
              <Badge tone="amber">Pending</Badge>
            </div>
            <div className="profile-field-row">
              <span>Email delivery</span>
              <Badge tone={invitation.emailStatus === 'Sent' ? 'green' : 'amber'}>
                {emailStatusLabel(invitation.emailStatus)}
              </Badge>
            </div>
            <div className="profile-field-row">
              <span>Invited</span>
              <strong>{formatAccountDate(invitation.createdAt)}</strong>
            </div>
          </div>
          <div className="profile-contact-strip">
            <span>
              <Mail aria-hidden="true" size={15} />
              {invitation.email}
            </span>
            <span>
              <Clock aria-hidden="true" size={15} />
              This account becomes active after the invite is accepted.
            </span>
          </div>
          <PendingInviteResendAction invitationId={invitation.id} />
        </div>
      </section>
    </section>
  );
}
