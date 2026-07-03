import React from 'react';
import {
  Link,
  linkStyle,
  mutedParagraphStyle,
  OasisEmailShell,
  paragraphStyle,
  Text,
} from './_components/oasis-email-shell.js';

export type InvoicePastDueReminderDays = 2 | 5;

export interface InvoicePastDueReminderEmailProps {
  daysPastDue: InvoicePastDueReminderDays;
  familyLabel: string;
  invoiceNumber: string;
  invoiceUrl?: string;
  logoUrl?: string;
}

function familyGreetingLabel(familyLabel: string): string {
  const trimmed = familyLabel.trim();
  if (!trimmed) return 'Oasis family';
  return /\bfamily$/iu.test(trimmed) ? trimmed : `${trimmed} family`;
}

function reminderLead(daysPastDue: InvoicePastDueReminderDays, invoiceNumber: string): string {
  if (daysPastDue === 2) {
    return `We hope that this message finds you well. This is a gentle reminder that Invoice ${invoiceNumber} is now 2 days past due.`;
  }

  return `This is a gentle follow-up that Invoice ${invoiceNumber} is now 5 days past due.`;
}

function reminderAction(daysPastDue: InvoicePastDueReminderDays): string {
  if (daysPastDue === 2) {
    return 'When you have a moment, please sign in to Oasis Portal to review the invoice and make payment. If payment has already been sent, please make sure to mark it as paid on the portal. And if you have done that and have received this message, please contact us so that we can update the records.';
  }

  return 'Please sign in to Oasis Portal when you are able to review the invoice and make payment. If there is anything you need to discuss, please reply to this email and we will be glad to help.';
}

export function buildInvoicePastDueReminderEmailText({
  daysPastDue,
  familyLabel,
  invoiceNumber,
  invoiceUrl,
}: Pick<
  InvoicePastDueReminderEmailProps,
  'daysPastDue' | 'familyLabel' | 'invoiceNumber' | 'invoiceUrl'
>): string {
  const lines = [
    `Hello ${familyGreetingLabel(familyLabel)},`,
    reminderLead(daysPastDue, invoiceNumber),
    reminderAction(daysPastDue),
    'Thank you for your care and support.',
    'With thanks,\nOasis Learning Centre',
  ];
  if (invoiceUrl) lines.push(`Open fees: ${invoiceUrl}`);
  return lines.join('\n\n');
}

export function InvoicePastDueReminderEmail({
  daysPastDue,
  familyLabel,
  invoiceNumber,
  invoiceUrl,
  logoUrl,
}: InvoicePastDueReminderEmailProps) {
  const greetingLabel = familyGreetingLabel(familyLabel);
  const logoProps = logoUrl ? { logoUrl } : {};
  const ctaProps = invoiceUrl ? { cta: { href: invoiceUrl, label: 'Open fees' } } : {};

  return (
    <OasisEmailShell
      eyebrow="Oasis Learning Centre"
      footerNote="For privacy, this email does not include invoice line items, payment amounts, or PDF contents."
      preview={`A gentle ${daysPastDue === 2 ? 'reminder' : 'follow-up'} for the ${greetingLabel}.`}
      title={`Invoice ${invoiceNumber} is ${String(daysPastDue)} days past due`}
      {...ctaProps}
      {...logoProps}
    >
      <Text style={paragraphStyle}>Hello {greetingLabel},</Text>
      <Text style={paragraphStyle}>{reminderLead(daysPastDue, invoiceNumber)}</Text>
      <Text style={paragraphStyle}>{reminderAction(daysPastDue)}</Text>
      <Text style={paragraphStyle}>Thank you for your care and support.</Text>
      <Text style={paragraphStyle}>
        With thanks,
        <br />
        Oasis Learning Centre
      </Text>
      {invoiceUrl ? (
        <Text style={mutedParagraphStyle}>
          If the button does not work, copy and paste this link into your browser:{' '}
          <Link href={invoiceUrl} style={linkStyle}>
            {invoiceUrl}
          </Link>
        </Text>
      ) : null}
    </OasisEmailShell>
  );
}

export default InvoicePastDueReminderEmail;
