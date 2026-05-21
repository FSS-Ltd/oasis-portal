'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { friendlyErrorMessage } from '@/lib/user-facing-errors';
import { api } from '@/lib/trpc';
import {
  filterCountLabel,
  formatInvoiceDate,
  formatPence,
  InvoiceEmptyState,
  InvoiceFilterButton,
  InvoiceLineItems,
  InvoicePdfAction,
  InvoicePrimaryMeta,
  InvoiceStatCard,
  InvoiceStatusBadge,
  MessageOfficeAction,
  parentInvoiceStatusFilters,
  type InvoiceDto,
  type ParentInvoiceStatusFilter,
} from './invoice-ui';

function ParentInvoiceCard({
  invoice,
  open,
  onToggle,
}: {
  invoice: InvoiceDto;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <article className={open ? 'parent-invoice-card is-open' : 'parent-invoice-card'}>
      <button
        aria-expanded={open}
        className="parent-invoice-card__summary"
        onClick={onToggle}
        type="button"
      >
        <span>
          <strong>{invoice.invoiceNumber ?? 'Invoice'}</strong>
          <small>
            {invoice.term ?? 'School fees'} · Due {formatInvoiceDate(invoice.dueOn)}
          </small>
        </span>
        <span className="parent-invoice-card__amount">
          <b>{formatPence(invoice.totalAmountPence)}</b>
          <InvoiceStatusBadge status={invoice.displayStatus} />
        </span>
        <ChevronDown aria-hidden="true" size={17} />
      </button>
      {open ? (
        <div className="parent-invoice-card__detail">
          <InvoicePrimaryMeta invoice={invoice} />
          <InvoiceLineItems invoice={invoice} />
          <div className="parent-invoice-card__actions">
            <InvoicePdfAction invoiceId={invoice.id} />
            <MessageOfficeAction />
          </div>
        </div>
      ) : null}
    </article>
  );
}

export function ParentFeesClient() {
  const [status, setStatus] = useState<ParentInvoiceStatusFilter>('All');
  const [search, setSearch] = useState('');
  const [openInvoiceId, setOpenInvoiceId] = useState<string | null>(null);
  const invoicesQuery = api.invoice.listParent.useQuery(
    { status, search: search.trim() || undefined },
    { retry: false },
  );
  const invoices = invoicesQuery.data?.invoices ?? [];
  const stats = invoicesQuery.data?.stats;
  const firstUnpaidInvoiceId = useMemo(
    () => invoices.find((invoice) => invoice.status === 'Unpaid')?.id ?? invoices[0]?.id ?? null,
    [invoices],
  );
  const activeOpenInvoiceId = openInvoiceId ?? firstUnpaidInvoiceId;

  return (
    <section className="invoice-page invoice-page--parent">
      <header className="parent-fees-hero">
        <div>
          <p>School Fees</p>
          <h1>{formatPence(stats?.outstandingAmountPence ?? 0)}</h1>
          <span>Outstanding balance</span>
        </div>
        <div className="parent-fees-hero__stats">
          <InvoiceStatCard
            hint={filterCountLabel(stats?.overdueCount ?? 0)}
            label="Overdue"
            value={formatPence(stats?.overdueAmountPence ?? 0)}
          />
          <InvoiceStatCard
            hint={filterCountLabel(stats?.paidCount ?? 0)}
            label="Paid"
            value={String(stats?.paidCount ?? 0)}
          />
        </div>
      </header>

      <div className="invoice-toolbar">
        <div className="invoice-filter-group" aria-label="School fee status filters">
          {parentInvoiceStatusFilters.map((filter) => (
            <InvoiceFilterButton
              active={status === filter}
              key={filter}
              onClick={() => {
                setStatus(filter);
              }}
            >
              {filter}
            </InvoiceFilterButton>
          ))}
        </div>
        <label className="invoice-search">
          <Search aria-hidden="true" size={16} />
          <input
            onChange={(event) => {
              setSearch(event.target.value);
            }}
            placeholder="Search fees"
            value={search}
          />
        </label>
      </div>

      {invoicesQuery.isLoading ? (
        <InvoiceEmptyState body="Loading school fee invoices." title="Loading fees" />
      ) : invoicesQuery.error ? (
        <InvoiceEmptyState body={friendlyErrorMessage(invoicesQuery.error)} title="Fees unavailable" />
      ) : invoices.length === 0 ? (
        <InvoiceEmptyState body="No invoices match this view." title="No invoices" />
      ) : (
        <div className="parent-invoice-list">
          {invoices.map((invoice) => (
            <ParentInvoiceCard
              invoice={invoice}
              key={invoice.id}
              onToggle={() => {
                setOpenInvoiceId((current) =>
                  activeOpenInvoiceId === invoice.id && current ? null : invoice.id,
                );
              }}
              open={activeOpenInvoiceId === invoice.id}
            />
          ))}
        </div>
      )}
    </section>
  );
}
