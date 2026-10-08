'use client';

import { useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { friendlyErrorMessage, showErrorToast, showSuccessToast } from '@/lib/notifications';
import { api, type RouterOutputs } from '@/lib/trpc';
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
  InvoiceTotal,
  MessageOfficeAction,
  invoiceStatusLabel,
  parentInvoiceStatusFilters,
  type InvoiceDto,
  type ParentInvoiceStatusFilter,
} from './invoice-ui';

type ParentYearSummary = RouterOutputs['invoice']['listParent']['yearSummary'];

function PaymentDonut({
  paidAmountPence,
  overdueAmountPence,
  remainingAmountPence,
}: {
  paidAmountPence: number;
  overdueAmountPence: number;
  remainingAmountPence: number;
}) {
  const total = Math.max(1, paidAmountPence + overdueAmountPence + remainingAmountPence);
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const paidLength = (paidAmountPence / total) * circumference;
  const overdueLength = (overdueAmountPence / total) * circumference;
  const remainingLength = circumference - paidLength - overdueLength;
  return (
    <div className="parent-fees-chart">
      <div className="parent-fees-chart__amount parent-fees-chart__amount--paid">
        <span>Paid</span>
        <strong>{formatPence(paidAmountPence)}</strong>
      </div>
      <svg aria-label="Payment progress" height="116" role="img" viewBox="0 0 116 116" width="116">
        <circle cx="58" cy="58" fill="none" r={radius} stroke="#d8dde8" strokeWidth="16" />
        <circle
          cx="58"
          cy="58"
          fill="none"
          r={radius}
          stroke="#7f8795"
          strokeDasharray={`${String(remainingLength)} ${String(circumference - remainingLength)}`}
          strokeDashoffset="0"
          strokeLinecap="round"
          strokeWidth="16"
          transform="rotate(-90 58 58)"
        />
        <circle
          cx="58"
          cy="58"
          fill="none"
          r={radius}
          stroke="#d04a4a"
          strokeDasharray={`${String(overdueLength)} ${String(circumference - overdueLength)}`}
          strokeDashoffset={-remainingLength}
          strokeLinecap="round"
          strokeWidth="16"
          transform="rotate(-90 58 58)"
        />
        <circle
          cx="58"
          cy="58"
          fill="none"
          r={radius}
          stroke="#24a36a"
          strokeDasharray={`${String(paidLength)} ${String(circumference - paidLength)}`}
          strokeDashoffset={-(remainingLength + overdueLength)}
          strokeLinecap="round"
          strokeWidth="16"
          transform="rotate(-90 58 58)"
        />
      </svg>
      <div className="parent-fees-chart__amount parent-fees-chart__amount--left">
        <span>Left to pay</span>
        <strong>{formatPence(remainingAmountPence + overdueAmountPence)}</strong>
      </div>
    </div>
  );
}

function ParentDiscountControls({
  invoice,
  pending,
  onToggleDiscount,
}: {
  invoice: InvoiceDto;
  pending: boolean;
  onToggleDiscount: (discountId: string, optedOut: boolean) => void;
}) {
  if (invoice.discounts.length === 0) return null;
  return (
    <section className="parent-discount-controls">
      <h3>Discount choices</h3>
      {invoice.discounts.map((discount) => (
        <label key={discount.id}>
          <input
            checked={discount.optedOut}
            disabled={!discount.canOptOut || pending}
            onChange={(event) => {
              onToggleDiscount(discount.id, event.target.checked);
            }}
            type="checkbox"
          />
          <span>
            <strong>{discount.label}</strong>
            <small>
              {discount.optedOut
                ? 'Opted out'
                : `${formatPence(discount.appliedAmountPence)} applied`}
            </small>
          </span>
        </label>
      ))}
    </section>
  );
}

function ParentInvoiceCard({
  invoice,
  markingPaid,
  open,
  togglingDiscount,
  onMarkPaid,
  onToggle,
  onToggleDiscount,
}: {
  invoice: InvoiceDto;
  markingPaid: boolean;
  open: boolean;
  togglingDiscount: boolean;
  onMarkPaid: (invoice: InvoiceDto) => void;
  onToggle: () => void;
  onToggleDiscount: (discountId: string, optedOut: boolean) => void;
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
            {invoice.kind === 'Manual'
              ? (invoice.invoiceTitle ?? 'Manual invoice')
              : (invoice.term ?? 'Centre Fees')}{' '}
            · Due {formatInvoiceDate(invoice.dueOn)}
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
          <ParentDiscountControls
            invoice={invoice}
            onToggleDiscount={onToggleDiscount}
            pending={togglingDiscount}
          />
          <InvoiceTotal invoice={invoice} />
          <div className="parent-invoice-card__actions">
            <InvoicePdfAction invoiceId={invoice.id} />
            {invoice.status === 'Unpaid' ? (
              <Button
                onClick={() => {
                  onMarkPaid(invoice);
                }}
                pending={markingPaid}
                size="sm"
                type="button"
              >
                Mark as paid
              </Button>
            ) : null}
            <MessageOfficeAction />
          </div>
          {invoice.status === 'PaymentPending' ? (
            <p className="parent-payment-note">Awaiting confirmation from a pastor or head.</p>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function ParentFeeCycleSummary({ summary }: { summary: ParentYearSummary | undefined }) {
  if (!summary) return null;
  return (
    <section className="parent-fee-cycle">
      <div>
        <span>Fee cycle</span>
        <strong>{summary.cycleLabel}</strong>
      </div>
      <div>
        <span>Annual Fee / Adjusted Fee</span>
        <strong className="parent-fee-cycle__adjusted-fee">
          {formatPence(summary.annualAmountPence)} /{' '}
          {formatPence(summary.adjustedAnnualAmountPence)}
          {summary.discountAmountPence > 0 ? (
            <small>({formatPence(summary.discountAmountPence)} saved)</small>
          ) : null}
        </strong>
      </div>
      <div>
        <span>Left to invoice</span>
        <strong>{formatPence(summary.grossLeftToInvoiceAmountPence)}</strong>
      </div>
      {summary.children.map((child) => (
        <article key={child.studentId}>
          <span>
            <strong>{child.studentName}</strong>
            <small>
              {child.chargeableMonths} months from{' '}
              {child.chargeableStartsOn ?? summary.cycleStartsOn}
            </small>
          </span>
          <span>
            <small>Paid</small>
            <strong>{formatPence(child.grossPaidAmountPence)}</strong>
          </span>
          <span>
            <small>Left to pay</small>
            <strong>{formatPence(child.grossRemainingAmountPence)}</strong>
          </span>
        </article>
      ))}
    </section>
  );
}

export function ParentFeesClient() {
  const utils = api.useUtils();
  const [status, setStatus] = useState<ParentInvoiceStatusFilter>('All');
  const [search, setSearch] = useState('');
  const [openInvoiceId, setOpenInvoiceId] = useState<string | null>(null);
  const [pendingInvoiceId, setPendingInvoiceId] = useState<string | null>(null);
  const [pendingDiscountId, setPendingDiscountId] = useState<string | null>(null);
  const invoicesQuery = api.invoice.listParent.useQuery(
    { status, search: search.trim() || undefined },
    { retry: false },
  );
  const markPaid = api.invoice.parentMarkPaid.useMutation({
    onSettled: () => {
      setPendingInvoiceId(null);
    },
    onSuccess: async () => {
      await utils.invoice.listParent.invalidate();
      showSuccessToast('Payment sent for confirmation.');
    },
    onError(error) {
      showErrorToast(error, 'Payment could not be marked paid.');
    },
  });
  const setDiscountOptOut = api.invoice.setDiscountOptOut.useMutation({
    onSettled: () => {
      setPendingDiscountId(null);
    },
    onSuccess: async () => {
      await utils.invoice.listParent.invalidate();
      showSuccessToast('Discount choice updated.');
    },
    onError(error) {
      showErrorToast(error, 'Discount choice could not be updated.');
    },
  });
  const invoices = invoicesQuery.data?.invoices ?? [];
  const stats = invoicesQuery.data?.stats;
  const yearSummary = invoicesQuery.data?.yearSummary;
  const schoolFeeInvoices = invoices.filter((invoice) => invoice.kind === 'SchoolFee');
  const manualInvoices = invoices.filter((invoice) => invoice.kind === 'Manual');
  const activeOpenInvoiceId = openInvoiceId;

  function renderInvoiceCard(invoice: InvoiceDto) {
    return (
      <ParentInvoiceCard
        invoice={invoice}
        key={invoice.id}
        markingPaid={pendingInvoiceId === invoice.id}
        onToggle={() => {
          setOpenInvoiceId((current) => (current === invoice.id ? null : invoice.id));
        }}
        onMarkPaid={(targetInvoice) => {
          setPendingInvoiceId(targetInvoice.id);
          markPaid.mutate({ invoiceId: targetInvoice.id });
        }}
        onToggleDiscount={(discountId, optedOut) => {
          setPendingDiscountId(discountId);
          setDiscountOptOut.mutate({ invoiceId: invoice.id, discountId, optedOut });
        }}
        open={activeOpenInvoiceId === invoice.id}
        togglingDiscount={invoice.discounts.some((discount) => discount.id === pendingDiscountId)}
      />
    );
  }

  return (
    <section className="invoice-page invoice-page--parent">
      <header className="parent-fees-hero">
        <div>
          <p>Current Balance</p>
          <h1>{formatPence(stats?.grossOutstandingAmountPence ?? 0)}</h1>
          <span>{yearSummary?.cycleLabel ?? 'Outstanding balance'}</span>
        </div>
        <PaymentDonut
          overdueAmountPence={stats?.grossOverdueAmountPence ?? 0}
          paidAmountPence={stats?.grossPaidAmountPence ?? 0}
          remainingAmountPence={stats?.grossRemainingAmountPence ?? 0}
        />
        <div className="parent-fees-hero__stats">
          <InvoiceStatCard
            hint={filterCountLabel(stats?.overdueCount ?? 0)}
            label="Overdue"
            value={formatPence(stats?.overdueAmountPence ?? 0)}
          />
          <InvoiceStatCard
            hint={filterCountLabel(stats?.paymentPendingCount ?? 0)}
            label="Awaiting confirmation"
            value={String(stats?.paymentPendingCount ?? 0)}
          />
        </div>
      </header>

      <ParentFeeCycleSummary summary={yearSummary} />

      <div className="invoice-toolbar">
        <div className="invoice-filter-group" aria-label="Invoice status filters">
          {parentInvoiceStatusFilters.map((filter) => (
            <InvoiceFilterButton
              active={status === filter}
              key={filter}
              onClick={() => {
                setStatus(filter);
              }}
            >
              {invoiceStatusLabel(filter)}
            </InvoiceFilterButton>
          ))}
        </div>
        <label className="invoice-search">
          <Search aria-hidden="true" size={16} />
          <input
            onChange={(event) => {
              setSearch(event.target.value);
            }}
            placeholder="Search invoices"
            value={search}
          />
        </label>
      </div>

      {invoicesQuery.isLoading ? (
        <InvoiceEmptyState body="Loading invoice records." title="Loading invoices" />
      ) : invoicesQuery.error ? (
        <InvoiceEmptyState
          body={friendlyErrorMessage(invoicesQuery.error)}
          title="Invoices unavailable"
        />
      ) : invoices.length === 0 ? (
        <InvoiceEmptyState body="No invoices match this view." title="No invoices" />
      ) : (
        <>
          <section aria-labelledby="parent-centre-fee-invoices-title">
            <div className="section-title">
              <h2 id="parent-centre-fee-invoices-title">Centre Fees</h2>
            </div>
            {schoolFeeInvoices.length === 0 ? (
              <InvoiceEmptyState
                body="No centre fee invoices match this view."
                title="No centre fees"
              />
            ) : (
              <div className="parent-invoice-list">{schoolFeeInvoices.map(renderInvoiceCard)}</div>
            )}
          </section>

          {manualInvoices.length > 0 ? (
            <section aria-labelledby="parent-other-invoices-title">
              <div className="section-title">
                <h2 id="parent-other-invoices-title">Other invoices</h2>
              </div>
              <div className="parent-invoice-list">{manualInvoices.map(renderInvoiceCard)}</div>
            </section>
          ) : null}
        </>
      )}
    </section>
  );
}
