import React from 'react';
import {
  Link,
  linkStyle,
  mutedParagraphStyle,
  OasisEmailShell,
  paragraphStyle,
  Text,
} from './_components/oasis-email-shell.js';

export interface MessageNotificationEmailProps {
  messageUrl?: string;
  recipientName?: string;
  senderName: string;
  threadSubject: string;
  logoUrl?: string;
}

export function buildMessageNotificationEmailText({
  messageUrl,
  senderName,
  threadSubject,
}: Pick<MessageNotificationEmailProps, 'messageUrl' | 'senderName' | 'threadSubject'>): string {
  const lines = [
    `You have a new Oasis Portal message from ${senderName}.`,
    `Thread: ${threadSubject}`,
    'Sign in to Oasis Portal to read and reply.',
  ];
  if (messageUrl) lines.push(`Open the message thread: ${messageUrl}`);
  return lines.join('\n\n');
}

export function MessageNotificationEmail({
  messageUrl,
  recipientName,
  senderName,
  threadSubject,
  logoUrl,
}: MessageNotificationEmailProps) {
  const logoProps = logoUrl ? { logoUrl } : {};
  const ctaProps = messageUrl
    ? { cta: { href: messageUrl, label: 'Open message thread' } }
    : {};

  return (
    <OasisEmailShell
      eyebrow="Oasis Learning Centre"
      footerNote="For privacy, this email does not include the message body."
      preview={`New Oasis Portal message from ${senderName}.`}
      title="New portal message"
      {...ctaProps}
      {...logoProps}
    >
      <Text style={paragraphStyle}>
        {recipientName ? `${recipientName}, y` : 'Y'}ou have a new Oasis Portal message from{' '}
        <strong>{senderName}</strong>.
      </Text>
      <Text style={paragraphStyle}>
        Thread: <strong>{threadSubject}</strong>
      </Text>
      <Text style={mutedParagraphStyle}>
        Sign in to Oasis Portal to read and reply. The message content is available only inside the
        portal.
      </Text>
      {messageUrl ? (
        <Text style={mutedParagraphStyle}>
          If the button does not work, copy and paste this link into your browser:{' '}
          <Link href={messageUrl} style={linkStyle}>
            {messageUrl}
          </Link>
        </Text>
      ) : null}
    </OasisEmailShell>
  );
}

export default MessageNotificationEmail;
