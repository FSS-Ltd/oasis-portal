import React from 'react';
import type { Role } from '@oasis/domain';
import {
  Link,
  linkStyle,
  mutedParagraphStyle,
  OasisEmailShell,
  paragraphStyle,
  Text,
} from './_components/oasis-email-shell.js';

export const ROLE_LABELS = {
  Head: 'Head',
  Principal: 'Principal',
  Pastor: 'Pastor',
  HeadOfDiscipline: 'Head of Discipline',
  TechnicalSupport: 'Technical Support',
  ClubsAdmin: 'Clubs Admin',
  ClubsLead: 'Clubs Lead',
  Supervisor: 'Supervisor',
  Parent: 'Parent / Guardian',
  Student: 'Student',
} as const satisfies Record<Role, string>;

export interface UserInviteEmailProps {
  inviteUrl: string;
  logoUrl?: string;
  role: Role;
}

export function portalLabelForRole(role: Role): string {
  if (role === 'Parent') return 'Parent Portal';
  if (role === 'Student') return 'Student Portal';
  if (role === 'ClubsLead') return 'Clubs Lead Portal';
  if (role === 'Supervisor' || role === 'ClubsAdmin') return 'Staff Portal';
  return 'Admin Portal';
}

export function buildUserInviteEmailText({
  inviteUrl,
  role,
}: Pick<UserInviteEmailProps, 'inviteUrl' | 'role'>): string {
  const roleLabel = ROLE_LABELS[role];
  const portalLabel = portalLabelForRole(role);
  return [
    `You have been invited to Oasis Portal as ${roleLabel}.`,
    `This gives you access to the ${portalLabel}.`,
    `Accept the invitation and set up your Oasis Portal account: ${inviteUrl}`,
    'If you were not expecting this invitation, you can ignore this email.',
  ].join('\n\n');
}

export function UserInviteEmail({ inviteUrl, logoUrl, role }: UserInviteEmailProps) {
  const roleLabel = ROLE_LABELS[role];
  const portalLabel = portalLabelForRole(role);
  const logoProps = logoUrl ? { logoUrl } : {};

  return (
    <OasisEmailShell
      cta={{ href: inviteUrl, label: 'Accept invitation' }}
      eyebrow="Oasis Learning Centre"
      footerNote="If you were not expecting this invitation, you can safely ignore this email."
      preview={`Set up your ${portalLabel} access for Oasis Portal.`}
      title={`You have been invited to ${portalLabel}`}
      {...logoProps}
    >
      <Text style={paragraphStyle}>
        Your Oasis Portal account has been prepared with the role <strong>{roleLabel}</strong>.
      </Text>
      <Text style={paragraphStyle}>
        Use the button below to accept the invitation and set up your Oasis Portal account.
      </Text>
      <Text style={mutedParagraphStyle}>
        If the button does not work, copy and paste this link into your browser:{' '}
        <Link href={inviteUrl} style={linkStyle}>
          {inviteUrl}
        </Link>
      </Text>
    </OasisEmailShell>
  );
}

export default UserInviteEmail;
