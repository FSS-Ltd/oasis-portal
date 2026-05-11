import React from 'react';
import {
  mutedParagraphStyle,
  OasisEmailShell,
  paragraphStyle,
  Text,
} from './_components/oasis-email-shell.js';

export interface BehaviourNotificationEmailProps {
  category: string;
  childName: string;
  logoUrl?: string;
  note?: string | null;
  recipientName?: string;
  type: 'Merit' | 'Demerit';
}

export function buildBehaviourNotificationEmailText({
  category,
  childName,
  note,
  type,
}: Pick<BehaviourNotificationEmailProps, 'category' | 'childName' | 'note' | 'type'>): string {
  const lines = [
    `${childName} received a ${type.toLowerCase()} on Oasis Portal.`,
    `Type: ${type}`,
    `Category: ${category}`,
  ];
  if (note) lines.push(`Note: ${note}`);
  return lines.join('\n\n');
}

export function BehaviourNotificationEmail({
  category,
  childName,
  logoUrl,
  note,
  recipientName,
  type,
}: BehaviourNotificationEmailProps) {
  const logoProps = logoUrl ? { logoUrl } : {};

  return (
    <OasisEmailShell
      eyebrow="Oasis Learning Centre"
      footerNote="For privacy, automated behaviour emails are sent only for General behaviour entries."
      preview={`${childName} received a ${type.toLowerCase()} on Oasis Portal.`}
      title={`${type} recorded`}
      {...logoProps}
    >
      <Text style={paragraphStyle}>
        {recipientName ? `${recipientName}, y` : 'Y'}ou are receiving this because you are linked as
        a guardian for <strong>{childName}</strong>.
      </Text>
      <Text style={paragraphStyle}>
        Type: <strong>{type}</strong>
      </Text>
      <Text style={paragraphStyle}>
        Category: <strong>{category}</strong>
      </Text>
      {note ? (
        <Text style={paragraphStyle}>
          Note: <strong>{note}</strong>
        </Text>
      ) : (
        <Text style={mutedParagraphStyle}>No note was added to this entry.</Text>
      )}
    </OasisEmailShell>
  );
}

export default BehaviourNotificationEmail;
