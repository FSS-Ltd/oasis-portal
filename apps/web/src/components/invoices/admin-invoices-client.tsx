'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Download, Eye, Plus, ReceiptText, Search, Trash2, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { friendlyErrorMessage, showErrorToast, showSuccessToast } from '@/lib/notifications';
import { api } from '@/lib/trpc';
import {
  adminInvoiceStatusFilters,
  filterCountLabel,
  formatFileSize,
  formatInvoiceDate,
  formatPence,
  InvoiceEmptyState,
  InvoiceFilterButton,
  InvoiceDiscounts,
  InvoiceLineItems,
  InvoicePdfAction,
  InvoicePrimaryMeta,
  InvoiceStatCard,
  InvoiceStatusBadge,
  InvoiceTotal,
  type AdminInvoiceStatusFilter,
  type InvoiceDto,
} from './invoice-ui';
import { AdminInvoiceCreateModal } from './admin-invoice-create-modal';
import { InvoiceFeeSettings } from './invoice-fee-settings';

function AdminInvoiceCreateLoadingModal({
  error,
  onClose,
}: {
  error: unknown;
  onClose: () => void;
}) {
  return (
    <div aria-modal="true" className="invoice-modal invoice-modal--wide" role="dialog">
      <button
        aria-label="Close invoice creator"
        className="invoice-modal__backdrop"
        onClick={onClose}
        type="button"
      />
      <section className="invoice-modal__panel">
        <header className="invoice-modal__header invoice-modal__header--navy">
          <span>
            <ReceiptText aria-hidden="true" size={19} />
          </span>
          <div>
            <p>Create Invoice</p>
            <h2>Compose learning centre fees</h2>
          </div>
          <button aria-label="Close invoice creator" onClick={onClose} type="button">
            <X aria-hidden="true" size={18} />
          </button>
        </header>
        <div className="invoice-modal__body">
          {error ? (
            <p className="invoice-form-error">
              {friendlyErrorMessage(error, 'Invoice options could not be loaded.')}
            </p>
          ) : (
            <InvoiceEmptyState
              body="Preparing family and discount options."
              title="Loading invoice options"
            />
          )}
        </div>
        <footer className="invoice-modal__footer">
          <Button onClick={onClose} type="button" variant="ghost">
            Cancel
          </Button>
        </footer>
      </section>
    </div>
  );
}

function AdminInvoiceDrawer({
  detailsId,
  detailsRef,
  invoice,
  onClose,
  onConfirmPayment,
  onDelete,
  onMarkPaid,
  onMarkUnpaid,
  onRejectPayment,
  pending,
}: {
  detailsId: string;
  detailsRef: (node: HTMLElement | null) => void;
  invoice: InvoiceDto;
  onClose: () => void;
  onConfirmPayment: (invoice: InvoiceDto) => void;
  onDelete: (invoice: InvoiceDto) => void;
  onMarkPaid: (invoice: InvoiceDto) => void;
  onMarkUnpaid: (invoice: InvoiceDto) => void;
  onRejectPayment: (invoice: InvoiceDto) => void;
  pending: boolean;
}) {
  return (
    <aside className="invoice-drawer" id={detailsId} ref={detailsRef} tabIndex={-1}>
      <header>
        <button aria-label="Close invoice details" onClick={onClose} type="button">
          <X aria-hidden="true" size={18} />
        </button>
        <span>Invoice</span>
        <h2>{invoice.invoiceNumber ?? 'Draft invoice'}</h2>
        <InvoiceStatusBadge status={invoice.displayStatus} />
      </header>
      <InvoicePrimaryMeta invoice={invoice} />
      <InvoiceLineItems invoice={invoice} />
      <InvoiceDiscounts invoice={invoice} />
      <InvoiceTotal invoice={invoice} />
      <dl className="invoice-file-meta">
        <div>
          <dt>Source file</dt>
          <dd>{invoice.originalFileName}</dd>
        </div>
        <div>
          <dt>Size</dt>
          <dd>{formatFileSize(invoice.fileSizeBytes)}</dd>
        </div>
      </dl>
      <div className="invoice-drawer__actions">
        <InvoicePdfAction invoiceId={invoice.id} />
        {invoice.status === 'Paid' ? (
          <Button
            onClick={() => {
              onMarkUnpaid(invoice);
            }}
            pending={pending}
            size="sm"
            variant="secondary"
          >
            Mark unpaid
          </Button>
        ) : invoice.status === 'Unpaid' ? (
          <Button
            onClick={() => {
              onMarkPaid(invoice);
            }}
            pending={pending}
            size="sm"
          >
            Mark paid
          </Button>
        ) : invoice.status === 'PaymentPending' ? (
          <>
            <Button
              onClick={() => {
                onConfirmPayment(invoice);
              }}
              pending={pending}
              size="sm"
            >
              Confirm payment
            </Button>
            <Button
              onClick={() => {
                onRejectPayment(invoice);
              }}
              pending={pending}
              size="sm"
              variant="secondary"
            >
              Reject
            </Button>
          </>
        ) : null}
        <Button
          onClick={() => {
            onDelete(invoice);
          }}
          pending={pending}
          size="sm"
          variant="danger"
        >
          <Trash2 aria-hidden="true" size={15} />
          Delete
        </Button>
      </div>
    </aside>
  );
}

export function AdminInvoicesClient() {
  const utils = api.useUtils();
  const invoiceDetailsId = 'admin-invoice-detail-drawer';
  const invoiceDetailsRef = useRef<HTMLElement | null>(null);
  const [status, setStatus] = useState<AdminInvoiceStatusFilter>('All');
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [createInvoiceError, setCreateInvoiceError] = useState<string | null>(null);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [focusInvoiceDetails, setFocusInvoiceDetails] = useState(false);
  const [pendingInvoiceId, setPendingInvoiceId] = useState<string | null>(null);

  const invoicesQuery = api.invoice.listAdmin.useQuery(
    { status, search: search.trim() || undefined },
    { retry: false },
  );
  const feeConfigQuery = api.invoice.listFeeConfig.useQuery({ schoolYear: 2026 }, { retry: false });
  const familiesQuery = api.invoice.listBillableFamilies.useQuery(undefined, {
    enabled: createOpen,
    retry: false,
  });
  const presetsQuery = api.invoice.discountPresets.useQuery(undefined, {
    enabled: createOpen,
    retry: false,
  });
  const upsertFeeConfig = api.invoice.upsertFeeConfig.useMutation({
    onSuccess: async () => {
      await feeConfigQuery.refetch();
      showSuccessToast('Fee settings saved.');
    },
    onError(error) {
      showErrorToast(error, 'Fee settings could not be saved.');
    },
  });
  const createGeneratedInvoice = api.invoice.createGenerated.useMutation({
    onSuccess: async (invoice) => {
      setCreateInvoiceError(null);
      setCreateOpen(false);
      setSelectedInvoiceId(invoice.id);
      await utils.invoice.listAdmin.invalidate();
      showSuccessToast('Invoice generated.');
    },
    onError(error) {
      setCreateInvoiceError(friendlyErrorMessage(error, 'Invoice could not be generated.'));
      showErrorToast(error, 'Invoice could not be generated.');
    },
  });
  const markPaid = api.invoice.markPaid.useMutation({
    onSettled: () => {
      setPendingInvoiceId(null);
    },
    onSuccess: async () => {
      await utils.invoice.listAdmin.invalidate();
      showSuccessToast('Invoice marked paid.');
    },
    onError(error) {
      showErrorToast(error, 'Invoice could not be marked paid.');
    },
  });
  const markUnpaid = api.invoice.markUnpaid.useMutation({
    onSettled: () => {
      setPendingInvoiceId(null);
    },
    onSuccess: async () => {
      await utils.invoice.listAdmin.invalidate();
      showSuccessToast('Invoice marked unpaid.');
    },
    onError(error) {
      showErrorToast(error, 'Invoice could not be marked unpaid.');
    },
  });
  const confirmPayment = api.invoice.confirmPayment.useMutation({
    onSettled: () => {
      setPendingInvoiceId(null);
    },
    onSuccess: async () => {
      await utils.invoice.listAdmin.invalidate();
      showSuccessToast('Payment confirmed.');
    },
    onError(error) {
      showErrorToast(error, 'Payment could not be confirmed.');
    },
  });
  const rejectPayment = api.invoice.rejectPayment.useMutation({
    onSettled: () => {
      setPendingInvoiceId(null);
    },
    onSuccess: async () => {
      await utils.invoice.listAdmin.invalidate();
      showSuccessToast('Payment marked unpaid.');
    },
    onError(error) {
      showErrorToast(error, 'Payment could not be rejected.');
    },
  });
  const deleteInvoice = api.invoice.delete.useMutation({
    onSettled: () => {
      setPendingInvoiceId(null);
    },
    onSuccess: async () => {
      setSelectedInvoiceId(null);
      await utils.invoice.listAdmin.invalidate();
      showSuccessToast('Invoice deleted.');
    },
    onError(error) {
      showErrorToast(error, 'Invoice could not be deleted.');
    },
  });

  const invoices = invoicesQuery.data?.invoices ?? [];
  const stats = invoicesQuery.data?.stats;
  const createOptionsError = familiesQuery.error ?? presetsQuery.error ?? null;
  const createOptionsReady = Boolean(familiesQuery.data && presetsQuery.data);
  const createModalKey = familiesQuery.data
    ? familiesQuery.data.map((family) => family.familyKey).join('|')
    : 'loading';
  const selectedInvoice = useMemo(
    () => invoices.find((invoice) => invoice.id === selectedInvoiceId) ?? null,
    [invoices, selectedInvoiceId],
  );

  useEffect(() => {
    if (!focusInvoiceDetails || !selectedInvoice) return;
    const drawer = invoiceDetailsRef.current;
    if (!drawer) return;
    drawer.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    drawer.focus({ preventScroll: true });
    setFocusInvoiceDetails(false);
  }, [focusInvoiceDetails, selectedInvoice]);

  function viewInvoice(invoiceId: string) {
    setSelectedInvoiceId(invoiceId);
    setFocusInvoiceDetails(true);
  }

  function handleDelete(invoice: InvoiceDto) {
    if (!window.confirm(`Delete ${invoice.invoiceNumber ?? 'draft invoice'}?`)) return;
    setPendingInvoiceId(invoice.id);
    deleteInvoice.mutate({ invoiceId: invoice.id });
  }

  return (
    <section className="invoice-page invoice-page--admin">
      <header className="invoice-page__header">
        <div>
          <p>Finance</p>
          <h1>Invoices & School Fees</h1>
        </div>
        <div className="invoice-header-actions">
          <Button
            onClick={() => {
              setCreateInvoiceError(null);
              setCreateOpen(true);
            }}
            type="button"
          >
            <Plus aria-hidden="true" size={16} />
            Create invoice
          </Button>
        </div>
      </header>

      {feeConfigQuery.data ? (
        <InvoiceFeeSettings
          config={feeConfigQuery.data}
          onSubmit={(input) => {
            upsertFeeConfig.mutate(input);
          }}
          pending={upsertFeeConfig.isPending}
        />
      ) : null}

      <div className="invoice-stat-grid">
        <InvoiceStatCard
          hint={filterCountLabel(stats?.totalCount ?? 0)}
          label="Outstanding"
          value={formatPence(stats?.outstandingAmountPence ?? 0)}
        />
        <InvoiceStatCard
          hint={filterCountLabel(stats?.overdueCount ?? 0)}
          label="Overdue"
          value={formatPence(stats?.overdueAmountPence ?? 0)}
        />
        <InvoiceStatCard
          hint={filterCountLabel(stats?.draftCount ?? 0)}
          label="Drafts"
          value={String(stats?.draftCount ?? 0)}
        />
        <InvoiceStatCard
          hint={filterCountLabel(stats?.paymentPendingCount ?? 0)}
          label="Pending"
          value={String(stats?.paymentPendingCount ?? 0)}
        />
        <InvoiceStatCard
          hint={filterCountLabel(stats?.paidCount ?? 0)}
          label="Paid"
          value={String(stats?.paidCount ?? 0)}
        />
      </div>

      <div className="invoice-toolbar">
        <div className="invoice-filter-group" aria-label="Invoice status filters">
          {adminInvoiceStatusFilters.map((filter) => (
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
            placeholder="Search invoices"
            value={search}
          />
        </label>
      </div>

      {invoicesQuery.isLoading ? (
        <InvoiceEmptyState body="Loading invoice records." title="Loading invoices" />
      ) : invoicesQuery.error ? (
        <InvoiceEmptyState body={friendlyErrorMessage(invoicesQuery.error)} title="Invoices unavailable" />
      ) : invoices.length === 0 ? (
        <InvoiceEmptyState
          action={
            <Button
              onClick={() => {
                setCreateInvoiceError(null);
                setCreateOpen(true);
              }}
              type="button"
              variant="secondary"
            >
              Create invoice
            </Button>
          }
          body="No invoices match this view."
          title="No invoices"
        />
      ) : (
        <div className="invoice-admin-grid">
          <div className="invoice-table-card">
            <table className="invoice-table">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Family</th>
                  <th>Due</th>
                  <th>Status</th>
                  <th>Total</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td>
                      <button
                        onClick={() => {
                          viewInvoice(invoice.id);
                        }}
                        type="button"
                      >
                        <strong>{invoice.invoiceNumber ?? 'Draft invoice'}</strong>
                        <span>{invoice.term ?? invoice.originalFileName}</span>
                      </button>
                    </td>
                    <td>
                      <span className="invoice-family-cell">
                        <strong>{invoice.familyLabel ?? 'Not set'}</strong>
                        <small>{invoice.studentName ?? 'Not assigned'}</small>
                      </span>
                    </td>
                    <td>{formatInvoiceDate(invoice.dueOn)}</td>
                    <td>
                      <InvoiceStatusBadge status={invoice.displayStatus} />
                    </td>
                    <td>{formatPence(invoice.totalAmountPence)}</td>
                    <td>
                      <div className="invoice-row-actions">
                        <button
                          aria-label="View invoice"
                          aria-controls={invoiceDetailsId}
                          className={selectedInvoiceId === invoice.id ? 'is-active' : undefined}
                          onClick={() => {
                            viewInvoice(invoice.id);
                          }}
                          type="button"
                        >
                          <Eye aria-hidden="true" size={15} />
                        </button>
                        <a
                          aria-label="Download invoice PDF"
                          href={`/api/invoices/${invoice.id}/pdf`}
                        >
                          <Download aria-hidden="true" size={15} />
                        </a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {selectedInvoice ? (
            <AdminInvoiceDrawer
              detailsId={invoiceDetailsId}
              detailsRef={(node) => {
                invoiceDetailsRef.current = node;
              }}
              invoice={selectedInvoice}
              onClose={() => {
                setSelectedInvoiceId(null);
              }}
              onConfirmPayment={(invoice) => {
                setPendingInvoiceId(invoice.id);
                confirmPayment.mutate({ invoiceId: invoice.id });
              }}
              onDelete={handleDelete}
              onMarkPaid={(invoice) => {
                setPendingInvoiceId(invoice.id);
                markPaid.mutate({ invoiceId: invoice.id });
              }}
              onMarkUnpaid={(invoice) => {
                setPendingInvoiceId(invoice.id);
                markUnpaid.mutate({ invoiceId: invoice.id });
              }}
              onRejectPayment={(invoice) => {
                setPendingInvoiceId(invoice.id);
                rejectPayment.mutate({ invoiceId: invoice.id });
              }}
              pending={pendingInvoiceId === selectedInvoice.id}
            />
          ) : (
            <aside className="invoice-drawer invoice-drawer--empty">
              <Badge tone="blue">Select</Badge>
              <h2>Invoice details</h2>
              <p>Choose a row to review line items, PDF metadata, and status actions.</p>
            </aside>
          )}
        </div>
      )}

      {createOpen && feeConfigQuery.data ? (
        createOptionsReady ? (
          <AdminInvoiceCreateModal
            families={familiesQuery.data ?? []}
            feeConfig={feeConfigQuery.data}
            key={createModalKey}
            onClose={() => {
              setCreateOpen(false);
            }}
            onSubmit={(input) => {
              setCreateInvoiceError(null);
              createGeneratedInvoice.mutate(input);
            }}
            pending={createGeneratedInvoice.isPending}
            serverError={createInvoiceError}
            presets={presetsQuery.data ?? []}
          />
        ) : (
          <AdminInvoiceCreateLoadingModal
            error={createOptionsError}
            onClose={() => {
              setCreateOpen(false);
            }}
          />
        )
      ) : null}
    </section>
  );
}
