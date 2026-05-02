'use client';

import { Clock, Mail, ShieldCheck } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { permissionTagLabel, roleLabel } from '@/lib/profile-display';
import type { InvitationRow } from './people-profile-model';
import { formatDate } from './people-profile-model';

interface PendingInviteProfilePanelProps {
  invitation: InvitationRow;
}

function emailStatusLabel(status: InvitationRow['emailStatus']): string {
  if (status === 'Sent') return 'Email sent';
  if (status === 'Failed') return 'Email failed';
  return 'Email queued';
}

export function PendingInviteProfilePanel({ invitation }: PendingInviteProfilePanelProps) {
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
              <strong>{formatDate(invitation.createdAt)}</strong>
            </div>
            <div className="profile-field-row profile-field-row--stacked">
              <span>Permission tags</span>
              <div className="tag-toggle-list">
                {invitation.tags.length > 0 ? (
                  invitation.tags.map((tag) => (
                    <span className="tag-toggle is-checked" key={tag}>
                      <ShieldCheck aria-hidden="true" size={14} />
                      <span>{permissionTagLabel(tag)}</span>
                    </span>
                  ))
                ) : (
                  <span className="muted">No extra tags</span>
                )}
              </div>
            </div>
          </div>
          <div className="profile-contact-strip">
            <span>
              <Mail aria-hidden="true" size={15} />
              {invitation.email}
            </span>
            <span>
              <Clock aria-hidden="true" size={15} />
              This person appears here until they accept the invite.
            </span>
          </div>
        </div>
      </section>
    </section>
  );
}
