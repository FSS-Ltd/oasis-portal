import React from 'react';
import {
  mutedParagraphStyle,
  OasisEmailShell,
  paragraphStyle,
  Text,
} from './_components/oasis-email-shell.js';

export interface ClubNotificationEmailProps {
  body: string;
  childNames: string[];
  clubName: string;
  logoUrl?: string;
  recipientName?: string;
  title: string;
}

function childrenLabel(childNames: string[]): string {
  if (childNames.length === 0) return 'your linked child';
  if (childNames.length === 1) return childNames[0] ?? 'your linked child';
  return childNames.join(', ');
}

export function buildClubNotificationEmailText({
  body,
  childNames,
  clubName,
  title,
}: Pick<ClubNotificationEmailProps, 'body' | 'childNames' | 'clubName' | 'title'>): string {
  return [
    `New club notification from ${clubName}.`,
    `Title: ${title}`,
    `For: ${childrenLabel(childNames)}`,
    body,
  ].join('\n\n');
}

export function ClubNotificationEmail({
  body,
  childNames,
  clubName,
  logoUrl,
  recipientName,
  title,
}: ClubNotificationEmailProps) {
  const logoProps = logoUrl ? { logoUrl } : {};
  const childLabel = childrenLabel(childNames);

  return (
    <OasisEmailShell
      eyebrow="Oasis Learning Centre"
      footerNote="You are receiving this because you are linked as a guardian for a student signed up to this club."
      preview={`New club notification from ${clubName}.`}
      title="Club notification"
      {...logoProps}
    >
      <Text style={paragraphStyle}>
        {recipientName ? `${recipientName}, y` : 'Y'}ou have a new notification from{' '}
        <strong>{clubName}</strong>.
      </Text>
      <Text style={paragraphStyle}>
        For: <strong>{childLabel}</strong>
      </Text>
      <Text style={paragraphStyle}>
        Title: <strong>{title}</strong>
      </Text>
      <Text style={paragraphStyle}>{body}</Text>
      <Text style={mutedParagraphStyle}>
        Contact Oasis Learning Centre through your usual centre contact if you need help with this
        club update.
      </Text>
    </OasisEmailShell>
  );
}

export default ClubNotificationEmail;
