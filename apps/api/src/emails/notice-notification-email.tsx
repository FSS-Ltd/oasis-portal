import React from 'react';
import {
  Link,
  linkStyle,
  mutedParagraphStyle,
  OasisEmailShell,
  paragraphStyle,
  Text,
} from './_components/oasis-email-shell.js';

export type NoticeNotificationAudience = 'Supervisors' | 'Parents' | 'Both';

export interface NoticeNotificationEmailProps {
  audience: NoticeNotificationAudience;
  body: string;
  logoUrl?: string;
  noticeUrl?: string;
  recipientName?: string;
  title: string;
}

function audienceLabel(audience: NoticeNotificationAudience): string {
  if (audience === 'Both') return 'Parents and supervisors';
  return audience;
}

export function buildNoticeNotificationEmailText({
  audience,
  body,
  noticeUrl,
  title,
}: Pick<NoticeNotificationEmailProps, 'audience' | 'body' | 'noticeUrl' | 'title'>): string {
  const lines = [
    'A new Oasis Portal notice has been posted.',
    `Title: ${title}`,
    `Audience: ${audienceLabel(audience)}`,
    body,
  ];
  if (noticeUrl) lines.push(`Open the noticeboard: ${noticeUrl}`);
  return lines.join('\n\n');
}

export function NoticeNotificationEmail({
  audience,
  body,
  logoUrl,
  noticeUrl,
  recipientName,
  title,
}: NoticeNotificationEmailProps) {
  const logoProps = logoUrl ? { logoUrl } : {};
  const ctaProps = noticeUrl ? { cta: { href: noticeUrl, label: 'Open noticeboard' } } : {};

  return (
    <OasisEmailShell
      eyebrow="Oasis Learning Centre"
      footerNote="You are receiving this because this notice was posted to an audience you can access in Oasis Portal."
      preview={`New notice: ${title}`}
      title="Noticeboard update"
      {...ctaProps}
      {...logoProps}
    >
      <Text style={paragraphStyle}>
        {recipientName ? `${recipientName}, a` : 'A'} new notice has been posted to the Oasis Portal
        noticeboard.
      </Text>
      <Text style={paragraphStyle}>
        Title: <strong>{title}</strong>
      </Text>
      <Text style={paragraphStyle}>
        Audience: <strong>{audienceLabel(audience)}</strong>
      </Text>
      <Text style={paragraphStyle}>{body}</Text>
      <Text style={mutedParagraphStyle}>
        Sign in to Oasis Portal to view the noticeboard and any attachments.
      </Text>
      {noticeUrl ? (
        <Text style={mutedParagraphStyle}>
          If the button does not work, copy and paste this link into your browser:{' '}
          <Link href={noticeUrl} style={linkStyle}>
            {noticeUrl}
          </Link>
        </Text>
      ) : null}
    </OasisEmailShell>
  );
}

export default NoticeNotificationEmail;
