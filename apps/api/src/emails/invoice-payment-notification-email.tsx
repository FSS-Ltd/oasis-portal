import React from 'react';
import {
  Link,
  linkStyle,
  mutedParagraphStyle,
  OasisEmailShell,
  paragraphStyle,
  Text,
} from './_components/oasis-email-shell.js';

export interface InvoicePaymentNotificationEmailProps {
  familyLabel: string;
  invoiceNumber: string;
  invoiceUrl?: string;
  logoUrl?: string;
  recipientName?: string;
}

export function buildInvoicePaymentNotificationEmailText({
  familyLabel,
  invoiceNumber,
  invoiceUrl,
}: Pick<
  InvoicePaymentNotificationEmailProps,
  'familyLabel' | 'invoiceNumber' | 'invoiceUrl'
>): string {
  const lines = [
    `The ${familyLabel} has marked Invoice ${invoiceNumber} as paid.`,
    'It is awaiting your confirmation in Oasis Portal.',
  ];
  if (invoiceUrl) lines.push(`Open invoices: ${invoiceUrl}`);
  return lines.join('\n\n');
}

export function InvoicePaymentNotificationEmail({
  familyLabel,
  invoiceNumber,
  invoiceUrl,
  logoUrl,
  recipientName,
}: InvoicePaymentNotificationEmailProps) {
  const logoProps = logoUrl ? { logoUrl } : {};
  const ctaProps = invoiceUrl ? { cta: { href: invoiceUrl, label: 'Open invoices' } } : {};

  return (
    <OasisEmailShell
      eyebrow="Oasis Learning Centre"
      footerNote="For privacy, this email does not include invoice line items, payment amounts, or PDF contents."
      preview={`Invoice ${invoiceNumber} is awaiting confirmation.`}
      title="Invoice payment awaiting confirmation"
      {...ctaProps}
      {...logoProps}
    >
      <Text style={paragraphStyle}>
        {recipientName ? `${recipientName}, t` : 'T'}he <strong>{familyLabel}</strong> has marked{' '}
        <strong>Invoice {invoiceNumber}</strong> as paid.
      </Text>
      <Text style={paragraphStyle}>It is awaiting your confirmation in Oasis Portal.</Text>
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

export default InvoicePaymentNotificationEmail;
