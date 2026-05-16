import React from 'react';
import {
  Link,
  linkStyle,
  mutedParagraphStyle,
  OasisEmailShell,
  paragraphStyle,
  Text,
} from './_components/oasis-email-shell.js';

export interface ReportNotificationEmailProps {
  childName: string;
  logoUrl?: string;
  recipientName?: string;
  reportUrl?: string;
  term: string;
}

export function buildReportNotificationEmailText({
  childName,
  reportUrl,
  term,
}: Pick<ReportNotificationEmailProps, 'childName' | 'reportUrl' | 'term'>): string {
  const lines = [
    `A term report is ready for ${childName}.`,
    `Term: ${term}`,
    'Sign in to Oasis Portal to read the report.',
  ];
  if (reportUrl) lines.push(`Open the report: ${reportUrl}`);
  return lines.join('\n\n');
}

export function ReportNotificationEmail({
  childName,
  logoUrl,
  recipientName,
  reportUrl,
  term,
}: ReportNotificationEmailProps) {
  const logoProps = logoUrl ? { logoUrl } : {};
  const ctaProps = reportUrl ? { cta: { href: reportUrl, label: 'Open report' } } : {};

  return (
    <OasisEmailShell
      eyebrow="Oasis Learning Centre"
      footerNote="For privacy, this email does not include the report contents."
      preview={`A term report is ready for ${childName}.`}
      title="Term report ready"
      {...ctaProps}
      {...logoProps}
    >
      <Text style={paragraphStyle}>
        {recipientName ? `${recipientName}, a` : 'A'} term report is ready for{' '}
        <strong>{childName}</strong>.
      </Text>
      <Text style={paragraphStyle}>
        Term: <strong>{term}</strong>
      </Text>
      <Text style={mutedParagraphStyle}>
        Sign in to Oasis Portal to read the report. The report contents are available only inside
        the portal.
      </Text>
      {reportUrl ? (
        <Text style={mutedParagraphStyle}>
          If the button does not work, copy and paste this link into your browser:{' '}
          <Link href={reportUrl} style={linkStyle}>
            {reportUrl}
          </Link>
        </Text>
      ) : null}
    </OasisEmailShell>
  );
}

export default ReportNotificationEmail;
