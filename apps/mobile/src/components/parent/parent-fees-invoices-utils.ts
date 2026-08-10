import type { RouterOutputs } from '../../lib/trpc';

export type ParentFeesInvoicesData = RouterOutputs['invoice']['listParent'];
export type ParentInvoice = ParentFeesInvoicesData['invoices'][number];
export type ParentInvoiceDisplayStatus = ParentInvoice['displayStatus'];
export type ParentInvoiceStatusFilter = 'All' | 'Unpaid' | 'PaymentPending' | 'Overdue' | 'Paid';

export const parentInvoiceStatusFilters = [
  'All',
  'Unpaid',
  'PaymentPending',
  'Overdue',
  'Paid',
] as const satisfies readonly ParentInvoiceStatusFilter[];

export function formatPence(amountPence: number): string {
  return new Intl.NumberFormat('en-GB', {
    currency: 'GBP',
    style: 'currency',
  }).format(amountPence / 100);
}

export function formatInvoiceDate(value: Date | string | null): string {
  if (!value) return 'Not set';
  const date = value instanceof Date ? value : new Date(`${value}T00:00:00.000Z`);
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    timeZone: 'UTC',
    year: 'numeric',
  }).format(date);
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${String(bytes)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function invoiceStatusLabel(status: ParentInvoiceDisplayStatus | 'All'): string {
  if (status === 'PaymentPending') return 'Awaiting confirmation';
  return status;
}

export function invoiceStatusBadgeVariant(
  status: ParentInvoiceDisplayStatus,
): 'blue' | 'danger' | 'success' | 'warning' {
  if (status === 'Paid') return 'success';
  if (status === 'Overdue') return 'danger';
  if (status === 'PaymentPending') return 'blue';
  return 'warning';
}

export function filterCountLabel(count: number): string {
  return count === 1 ? '1 invoice' : `${String(count)} invoices`;
}

export function invoiceMatchesStatus(
  invoice: ParentInvoice,
  status: ParentInvoiceStatusFilter,
): boolean {
  if (status === 'All') return true;
  if (status === 'Overdue') return invoice.displayStatus === 'Overdue';
  return invoice.status === status;
}

export function studentNames(invoice: ParentInvoice): string {
  if (invoice.students.length > 0) {
    return invoice.students.map((student) => student.fullName).join(', ');
  }
  return invoice.studentName ?? 'Linked child';
}

export function invoiceTitle(invoice: ParentInvoice): string {
  return invoice.invoiceNumber ?? 'Invoice';
}
