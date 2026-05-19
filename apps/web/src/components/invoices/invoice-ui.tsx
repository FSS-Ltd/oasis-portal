import type { ReactNode } from 'react';
import Link from 'next/link';
import { Download, MessageSquare, ReceiptText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { RouterOutputs } from '@/lib/trpc';

export type InvoiceDto = RouterOutputs['invoice']['listAdmin']['invoices'][number];
export type InvoiceStatsDto = RouterOutputs['invoice']['listAdmin']['stats'];
export type InvoiceDisplayStatus = InvoiceDto['displayStatus'];
export type AdminInvoiceStatusFilter = 'All' | 'Draft' | 'Unpaid' | 'Overdue' | 'Paid';
export type ParentInvoiceStatusFilter = 'All' | 'Unpaid' | 'Overdue' | 'Paid';

export const adminInvoiceStatusFilters = ['All', 'Draft', 'Unpaid', 'Overdue', 'Paid'] as const;
export const parentInvoiceStatusFilters = ['All', 'Unpaid', 'Overdue', 'Paid'] as const;

export function formatPence(amountPence: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
  }).format(amountPence / 100);
}

export function formatInvoiceDate(value: Date | string | null): string {
  if (!value) return 'Not set';
  const date = value instanceof Date ? value : new Date(`${value}T00:00:00.000Z`);
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${String(bytes)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function statusBadgeTone(status: InvoiceDisplayStatus) {
  if (status === 'Paid') return 'green';
  if (status === 'Overdue') return 'red';
  if (status === 'Unpaid') return 'amber';
  return 'grey';
}

export function InvoiceStatusBadge({ status }: { status: InvoiceDisplayStatus }) {
  return <Badge tone={statusBadgeTone(status)}>{status}</Badge>;
}

export function InvoiceStatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <article className="invoice-stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{hint}</small>
    </article>
  );
}

export function InvoicePdfAction({
  invoiceId,
  label = 'Download PDF',
}: {
  invoiceId: string;
  label?: string;
}) {
  return (
    <a className="button button--secondary button--sm" href={`/api/invoices/${invoiceId}/pdf`}>
      <Download aria-hidden="true" size={15} />
      <span>{label}</span>
    </a>
  );
}

export function MessageOfficeAction() {
  return (
    <Link className="button button--ghost button--sm" href="/parent/messages">
      <MessageSquare aria-hidden="true" size={15} />
      <span>Message office</span>
    </Link>
  );
}

export function InvoiceEmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <section className="invoice-empty-state">
      <ReceiptText aria-hidden="true" size={22} />
      <h2>{title}</h2>
      <p>{body}</p>
      {action}
    </section>
  );
}

export function InvoiceFilterButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      className={active ? 'invoice-filter is-active' : 'invoice-filter'}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

export function InvoiceLineItems({ invoice }: { invoice: InvoiceDto }) {
  return (
    <div className="invoice-line-items">
      {invoice.lineItems.map((line) => (
        <div className="invoice-line-item" key={line.id}>
          <span>
            <strong>{line.description}</strong>
            <small>
              {String(line.quantity)} x {formatPence(line.unitAmountPence)}
            </small>
          </span>
          <b>{formatPence(line.totalAmountPence)}</b>
        </div>
      ))}
    </div>
  );
}

export function InvoicePrimaryMeta({ invoice }: { invoice: InvoiceDto }) {
  return (
    <dl className="invoice-meta-grid">
      <div>
        <dt>Student</dt>
        <dd>{invoice.studentName ?? 'Not assigned'}</dd>
      </div>
      <div>
        <dt>Term</dt>
        <dd>{invoice.term ?? 'Not set'}</dd>
      </div>
      <div>
        <dt>Issued</dt>
        <dd>{formatInvoiceDate(invoice.issuedOn)}</dd>
      </div>
      <div>
        <dt>Due</dt>
        <dd>{formatInvoiceDate(invoice.dueOn)}</dd>
      </div>
    </dl>
  );
}

export function InvoiceTotal({ invoice }: { invoice: InvoiceDto }) {
  return (
    <div className="invoice-total-row">
      <span>Total</span>
      <strong>{formatPence(invoice.totalAmountPence)}</strong>
    </div>
  );
}

export function filterCountLabel(count: number): string {
  return count === 1 ? '1 invoice' : `${String(count)} invoices`;
}
