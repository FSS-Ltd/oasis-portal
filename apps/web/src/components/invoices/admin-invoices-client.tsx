'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Download, Eye, Pencil, Plus, Search, UploadCloud } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { friendlyErrorMessage, showErrorToast, showSuccessToast } from '@/lib/notifications';
import { api } from '@/lib/trpc';
import {
  adminInvoiceStatusFilters,
  filterCountLabel,
  formatInvoiceDate,
  formatPence,
  InvoiceEmptyState,
  InvoiceFilterButton,
  InvoiceStatCard,
  InvoiceStatusBadge,
  type AdminInvoiceStatusFilter,
  type InvoiceDto,
} from './invoice-ui';
import { AdminInvoiceCreateModal, AdminInvoiceEditModal } from './admin-invoice-create-modal';
import {
  AdminInvoiceCreateLoadingModal,
  AdminInvoiceDeleteModal,
  AdminInvoiceDrawer,
} from './admin-invoice-modals';
import { AdminInvoiceUploadModal } from './admin-invoice-upload-modal';
import { InvoiceFeeSettings } from './invoice-fee-settings';

type InvoiceSortKey = 'invoiceNumber' | 'family';

function compareInvoiceText(left: string | null | undefined, right: string | null | undefined) {
  return (left || '').localeCompare(right || '', undefined, { numeric: true, sensitivity: 'base' });
}

function sortInvoices(invoices: readonly InvoiceDto[], sortBy: InvoiceSortKey): InvoiceDto[] {
  return [...invoices].sort((left, right) => {
    if (sortBy === 'family') {
      const familyCompare = compareInvoiceText(left.familyLabel, right.familyLabel);
      if (familyCompare !== 0) return familyCompare;
      return compareInvoiceText(left.invoiceNumber, right.invoiceNumber);
    }
    const invoiceCompare = compareInvoiceText(left.invoiceNumber, right.invoiceNumber);
    if (invoiceCompare !== 0) return invoiceCompare;
    return compareInvoiceText(left.familyLabel, right.familyLabel);
  });
}

export function AdminInvoicesClient() {
  const utils = api.useUtils();
  const invoiceDetailsId = 'admin-invoice-detail-drawer';
  const invoiceDetailsRef = useRef<HTMLElement | null>(null);
  const [status, setStatus] = useState<AdminInvoiceStatusFilter>('All');
  const [sortBy, setSortBy] = useState<InvoiceSortKey>('invoiceNumber');
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [createInvoiceError, setCreateInvoiceError] = useState<string | null>(null);
  const [uploadInvoiceError, setUploadInvoiceError] = useState<string | null>(null);
  const [editInvoiceError, setEditInvoiceError] = useState<string | null>(null);
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<InvoiceDto | null>(null);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [focusInvoiceDetails, setFocusInvoiceDetails] = useState(false);
  const [pendingInvoiceId, setPendingInvoiceId] = useState<string | null>(null);

  const invoicesQuery = api.invoice.listAdmin.useQuery(
    { status, search: search.trim() || undefined },
    { retry: false },
  );
  const feeConfigQuery = api.invoice.listFeeConfig.useQuery(undefined, { retry: false });
  const familiesQuery = api.invoice.listBillableFamilies.useQuery(undefined, {
    enabled: createOpen || uploadOpen || Boolean(editingInvoiceId),
    retry: false,
  });
  const presetsQuery = api.invoice.discountPresets.useQuery(undefined, {
    enabled: createOpen || Boolean(editingInvoiceId),
    retry: false,
  });

  async function refreshInvoiceViews() {
    await Promise.all([
      utils.invoice.listAdmin.invalidate(),
      utils.invoice.listBillableFamilies.invalidate(),
      utils.invoice.listParent.invalidate(),
    ]);
  }

  const upsertFeeConfig = api.invoice.upsertFeeConfig.useMutation({
    onSuccess: async () => {
      await Promise.all([
        feeConfigQuery.refetch(),
        utils.invoice.listBillableFamilies.invalidate(),
        utils.invoice.listParent.invalidate(),
      ]);
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
      await refreshInvoiceViews();
      showSuccessToast('Invoice generated.');
    },
    onError(error) {
      setCreateInvoiceError(friendlyErrorMessage(error, 'Invoice could not be generated.'));
      showErrorToast(error, 'Invoice could not be generated.');
    },
  });
  const updateGeneratedInvoice = api.invoice.updateGenerated.useMutation({
    onSuccess: async (invoice) => {
      setEditInvoiceError(null);
      setEditingInvoiceId(null);
      setSelectedInvoiceId(invoice.id);
      await refreshInvoiceViews();
      showSuccessToast('Invoice updated.');
    },
    onError(error) {
      setEditInvoiceError(friendlyErrorMessage(error, 'Invoice could not be updated.'));
      showErrorToast(error, 'Invoice could not be updated.');
    },
  });
  const publishUploadedInvoice = api.invoice.publishDraft.useMutation({
    onSuccess: async (invoice) => {
      setUploadInvoiceError(null);
      setUploadOpen(false);
      setSelectedInvoiceId(invoice.id);
      await refreshInvoiceViews();
      showSuccessToast('Uploaded invoice published.');
    },
    onError(error) {
      setUploadInvoiceError(
        friendlyErrorMessage(error, 'Uploaded invoice could not be published.'),
      );
      showErrorToast(error, 'Uploaded invoice could not be published.');
    },
  });
  const markPaid = api.invoice.markPaid.useMutation({
    onSettled: () => {
      setPendingInvoiceId(null);
    },
    onSuccess: async () => {
      await refreshInvoiceViews();
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
      await refreshInvoiceViews();
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
      await refreshInvoiceViews();
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
      await refreshInvoiceViews();
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
      setDeleteCandidate(null);
      await refreshInvoiceViews();
      showSuccessToast('Invoice deleted.');
    },
    onError(error) {
      showErrorToast(error, 'Invoice could not be deleted.');
    },
  });

  const invoices = invoicesQuery.data?.invoices ?? [];
  const sortedInvoices = useMemo(() => sortInvoices(invoices, sortBy), [invoices, sortBy]);
  const stats = invoicesQuery.data?.stats;
  const createOptionsError = familiesQuery.error ?? presetsQuery.error ?? null;
  const createOptionsReady = Boolean(familiesQuery.data && presetsQuery.data);
  const uploadOptionsReady = Boolean(familiesQuery.data);
  const createModalKey = familiesQuery.data
    ? familiesQuery.data.map((family) => family.familyKey).join('|')
    : 'loading';
  const selectedInvoice = useMemo(
    () => invoices.find((invoice) => invoice.id === selectedInvoiceId) ?? null,
    [invoices, selectedInvoiceId],
  );
  const editingInvoice = useMemo(
    () => invoices.find((invoice) => invoice.id === editingInvoiceId) ?? null,
    [editingInvoiceId, invoices],
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
    setDeleteCandidate(invoice);
  }

  function confirmDelete(invoice: InvoiceDto) {
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
              setCreateOpen(false);
              setEditingInvoiceId(null);
              setCreateInvoiceError(null);
              setEditInvoiceError(null);
              setUploadInvoiceError(null);
              setUploadOpen(true);
            }}
            type="button"
            variant="secondary"
          >
            <UploadCloud aria-hidden="true" size={16} />
            Upload invoice
          </Button>
          <Button
            onClick={() => {
              setUploadOpen(false);
              setEditingInvoiceId(null);
              setEditInvoiceError(null);
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
        <label className="invoice-sort">
          <span>Sort by</span>
          <select
            onChange={(event) => {
              setSortBy(event.target.value as InvoiceSortKey);
            }}
            value={sortBy}
          >
            <option value="invoiceNumber">Invoice number</option>
            <option value="family">Family</option>
          </select>
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
        <InvoiceEmptyState
          action={
            <Button
              onClick={() => {
                setUploadOpen(false);
                setEditingInvoiceId(null);
                setEditInvoiceError(null);
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
                {sortedInvoices.map((invoice) => (
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
                        {invoice.canEdit ? (
                          <button
                            aria-label="Edit invoice"
                            onClick={() => {
                              setCreateOpen(false);
                              setUploadOpen(false);
                              setCreateInvoiceError(null);
                              setEditInvoiceError(null);
                              setSelectedInvoiceId(invoice.id);
                              setEditingInvoiceId(invoice.id);
                            }}
                            type="button"
                          >
                            <Pencil aria-hidden="true" size={15} />
                          </button>
                        ) : null}
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
              onEdit={(invoice) => {
                setCreateOpen(false);
                setUploadOpen(false);
                setCreateInvoiceError(null);
                setEditInvoiceError(null);
                setSelectedInvoiceId(invoice.id);
                setEditingInvoiceId(invoice.id);
              }}
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
      {uploadOpen && feeConfigQuery.data ? (
        uploadOptionsReady ? (
          <AdminInvoiceUploadModal
            families={familiesQuery.data ?? []}
            feeConfig={feeConfigQuery.data}
            onClose={() => {
              setUploadOpen(false);
            }}
            onSubmit={(input) => {
              setUploadInvoiceError(null);
              publishUploadedInvoice.mutate(input);
            }}
            pending={publishUploadedInvoice.isPending}
            serverError={uploadInvoiceError}
          />
        ) : (
          <AdminInvoiceCreateLoadingModal
            eyebrow="Upload Invoice"
            error={familiesQuery.error}
            onClose={() => {
              setUploadOpen(false);
            }}
            title="Import pastor-created PDF"
          />
        )
      ) : null}
      {editingInvoiceId && feeConfigQuery.data ? (
        editingInvoice && createOptionsReady ? (
          <AdminInvoiceEditModal
            families={familiesQuery.data ?? []}
            feeConfig={feeConfigQuery.data}
            initialInvoice={editingInvoice}
            key={`edit-${editingInvoice.id}-${createModalKey}`}
            onClose={() => {
              setEditingInvoiceId(null);
            }}
            onSubmit={(input) => {
              setEditInvoiceError(null);
              updateGeneratedInvoice.mutate({ ...input, invoiceId: editingInvoice.id });
            }}
            pending={updateGeneratedInvoice.isPending}
            presets={presetsQuery.data ?? []}
            serverError={editInvoiceError}
          />
        ) : (
          <AdminInvoiceCreateLoadingModal
            error={createOptionsError}
            onClose={() => {
              setEditingInvoiceId(null);
            }}
          />
        )
      ) : null}
      {deleteCandidate ? (
        <AdminInvoiceDeleteModal
          invoice={deleteCandidate}
          onCancel={() => {
            if (pendingInvoiceId === deleteCandidate.id) return;
            setDeleteCandidate(null);
          }}
          onConfirm={confirmDelete}
          pending={pendingInvoiceId === deleteCandidate.id}
        />
      ) : null}
    </section>
  );
}
