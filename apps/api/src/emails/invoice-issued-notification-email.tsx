import React from 'react';
import {
  Link,
  linkStyle,
  mutedParagraphStyle,
  OasisEmailShell,
  paragraphStyle,
  Text,
} from './_components/oasis-email-shell.js';

export interface InvoiceIssuedNotificationEmailProps {
  invoiceNumber: string;
  invoiceUrl?: string;
  logoUrl?: string;
  recipientName?: string;
}

export function buildInvoiceIssuedNotificationEmailText({
  invoiceNumber,
  invoiceUrl,
}: Pick<InvoiceIssuedNotificationEmailProps, 'invoiceNumber' | 'invoiceUrl'>): string {
  const lines = [
    'A new invoice has been issued to you.',
    `Invoice ${invoiceNumber} is ready in Oasis Portal.`,
  ];
  if (invoiceUrl) lines.push(`Open invoice: ${invoiceUrl}`);
  return lines.join('\n\n');
}

export function InvoiceIssuedNotificationEmail({
  invoiceNumber,
  invoiceUrl,
  logoUrl,
  recipientName,
}: InvoiceIssuedNotificationEmailProps) {
  const logoProps = logoUrl ? { logoUrl } : {};
  const ctaProps = invoiceUrl ? { cta: { href: invoiceUrl, label: 'Open invoice' } } : {};

  return (
    <OasisEmailShell
      eyebrow="Oasis Learning Centre"
      footerNote="For privacy, this email does not include invoice line items, payment amounts, or PDF contents."
      preview={`Invoice ${invoiceNumber} is ready in Oasis Portal.`}
      title="New invoice issued"
      {...ctaProps}
      {...logoProps}
    >
      <Text style={paragraphStyle}>
        {recipientName ? `${recipientName}, a` : 'A'} new invoice has been issued to you.
      </Text>
      <Text style={paragraphStyle}>
        <strong>Invoice {invoiceNumber}</strong> is ready in Oasis Portal.
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

export default InvoiceIssuedNotificationEmail;
