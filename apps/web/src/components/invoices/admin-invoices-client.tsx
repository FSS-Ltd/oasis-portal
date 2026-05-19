'use client';

import { type ChangeEvent, type FormEvent, useMemo, useState } from 'react';
import { Download, Eye, FileUp, Loader2, Search, Trash2, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field, SelectInput, TextInput } from '@/components/ui/field';
import { api, type RouterOutputs } from '@/lib/trpc';
import {
  adminInvoiceStatusFilters,
  filterCountLabel,
  formatFileSize,
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
  type AdminInvoiceStatusFilter,
  type InvoiceDto,
} from './invoice-ui';

type UploadDraftResult = RouterOutputs['invoice']['uploadDraft'];
type BillableStudent = RouterOutputs['invoice']['listBillableStudents'][number];

interface ReviewLineForm {
  description: string;
  quantity: string;
  unitAmount: string;
}

interface ReviewForm {
  studentId: string;
  invoiceNumber: string;
  issuedOn: string;
  dueOn: string;
  term: string;
  lineItems: ReviewLineForm[];
}

const emptyReviewLine = (): ReviewLineForm => ({
  description: '',
  quantity: '1',
  unitAmount: '0.00',
});

function penceToPoundsInput(amountPence: number): string {
  return (amountPence / 100).toFixed(2);
}

function parsePenceInput(value: string): number | null {
  const normalized = value.trim().replace(/[£,\s]/gu, '');
  if (!/^[0-9]+(?:\.[0-9]{1,2})?$/u.test(normalized)) return null;
  const amount = Number(normalized);
  return Number.isFinite(amount) ? Math.round(amount * 100) : null;
}

function reviewFormFromUpload(result: UploadDraftResult): ReviewForm {
  const parsed = result.parsed;
  return {
    studentId: '',
    invoiceNumber: parsed.invoiceNumber ?? result.invoice.invoiceNumber ?? '',
    issuedOn: parsed.issuedOn ?? '',
    dueOn: parsed.dueOn ?? '',
    term: parsed.term ?? '',
    lineItems:
      parsed.lineItems.length > 0
        ? parsed.lineItems.map((line) => ({
            description: line.description,
            quantity: String(line.quantity),
            unitAmount: penceToPoundsInput(line.unitAmountPence),
          }))
        : [emptyReviewLine()],
  };
}

function isUploadDraftResult(
  payload: UploadDraftResult | { error?: string },
): payload is UploadDraftResult {
  return 'invoice' in payload && 'parsed' in payload;
}

function buildPublishInput(form: ReviewForm, invoiceId: string) {
  if (!form.studentId) return 'Select a student.';
  if (!form.invoiceNumber.trim()) return 'Invoice number is required.';
  if (!form.dueOn) return 'Due date is required.';

  const lineItems = form.lineItems.map((line) => {
    const description = line.description.trim();
    const quantity = Number(line.quantity);
    const unitAmountPence = parsePenceInput(line.unitAmount);
    if (!description || !Number.isInteger(quantity) || quantity <= 0 || unitAmountPence === null) {
      return null;
    }
    return { description, quantity, unitAmountPence };
  });

  if (lineItems.some((line) => line === null)) {
    return 'Each line needs a description, quantity, and amount.';
  }
  const validLineItems = lineItems.filter(
    (line): line is { description: string; quantity: number; unitAmountPence: number } =>
      line !== null,
  );

  return {
    invoiceId,
    studentId: form.studentId,
    invoiceNumber: form.invoiceNumber.trim(),
    issuedOn: form.issuedOn || null,
    dueOn: form.dueOn,
    term: form.term.trim() || null,
    lineItems: validLineItems,
  };
}

function UploadReviewModal({
  error,
  form,
  invoiceFileName,
  onAddLine,
  onClose,
  onFileChange,
  onPublish,
  onRemoveLine,
  onUpdateForm,
  onUpdateLine,
  publishing,
  students,
  uploading,
}: {
  error: string | null;
  form: ReviewForm | null;
  invoiceFileName: string | null;
  onAddLine: () => void;
  onClose: () => void;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onPublish: (event: FormEvent<HTMLFormElement>) => void;
  onRemoveLine: (index: number) => void;
  onUpdateForm: (patch: Partial<ReviewForm>) => void;
  onUpdateLine: (index: number, patch: Partial<ReviewLineForm>) => void;
  publishing: boolean;
  students: readonly BillableStudent[];
  uploading: boolean;
}) {
  return (
    <div aria-modal="true" className="invoice-modal" role="dialog">
      <button
        aria-label="Close invoice upload"
        className="invoice-modal__backdrop"
        onClick={onClose}
        type="button"
      />
      <form className="invoice-modal__panel" onSubmit={onPublish}>
        <header className="invoice-modal__header">
          <span>
            <FileUp aria-hidden="true" size={19} />
          </span>
          <div>
            <p>Invoice Upload</p>
            <h2>Review draft invoice</h2>
          </div>
          <button aria-label="Close invoice upload" onClick={onClose} type="button">
            <X aria-hidden="true" size={18} />
          </button>
        </header>

        <div className="invoice-modal__body">
          <label className="invoice-upload-drop">
            <input accept="application/pdf,.pdf" onChange={onFileChange} type="file" />
            {uploading ? (
              <Loader2 aria-hidden="true" className="button__spinner" size={18} />
            ) : (
              <FileUp aria-hidden="true" size={22} />
            )}
            <strong>{invoiceFileName ?? 'Upload PDF invoice'}</strong>
            <span>PDF, 10 MB max</span>
          </label>

          {error ? <p className="invoice-form-error">{error}</p> : null}

          {form ? (
            <>
              <div className="invoice-review-grid">
                <Field label="Student" required>
                  <SelectInput
                    onChange={(event) => {
                      onUpdateForm({ studentId: event.target.value });
                    }}
                    value={form.studentId}
                  >
                    <option value="">Select student</option>
                    {students.map((student) => (
                      <option key={student.id} value={student.id}>
                        {student.fullName} · {student.yearGroup}
                      </option>
                    ))}
                  </SelectInput>
                </Field>
                <Field label="Invoice number" required>
                  <TextInput
                    onChange={(event) => {
                      onUpdateForm({ invoiceNumber: event.target.value });
                    }}
                    value={form.invoiceNumber}
                  />
                </Field>
                <Field label="Issued">
                  <TextInput
                    onChange={(event) => {
                      onUpdateForm({ issuedOn: event.target.value });
                    }}
                    type="date"
                    value={form.issuedOn}
                  />
                </Field>
                <Field label="Due" required>
                  <TextInput
                    onChange={(event) => {
                      onUpdateForm({ dueOn: event.target.value });
                    }}
                    type="date"
                    value={form.dueOn}
                  />
                </Field>
                <Field label="Term">
                  <TextInput
                    onChange={(event) => {
                      onUpdateForm({ term: event.target.value });
                    }}
                    value={form.term}
                  />
                </Field>
              </div>

              <section className="invoice-review-lines">
                <div className="invoice-review-lines__header">
                  <h3>Line items</h3>
                  <Button onClick={onAddLine} size="sm" type="button" variant="secondary">
                    Add line
                  </Button>
                </div>
                {form.lineItems.map((line, index) => (
                  <div className="invoice-review-line" key={`${line.description}-${String(index)}`}>
                    <TextInput
                      aria-label="Line item description"
                      onChange={(event) => {
                        onUpdateLine(index, { description: event.target.value });
                      }}
                      placeholder="Description"
                      value={line.description}
                    />
                    <TextInput
                      aria-label="Quantity"
                      inputMode="numeric"
                      onChange={(event) => {
                        onUpdateLine(index, { quantity: event.target.value });
                      }}
                      value={line.quantity}
                    />
                    <TextInput
                      aria-label="Unit amount"
                      inputMode="decimal"
                      onChange={(event) => {
                        onUpdateLine(index, { unitAmount: event.target.value });
                      }}
                      value={line.unitAmount}
                    />
                    <button
                      aria-label="Remove line item"
                      disabled={form.lineItems.length === 1}
                      onClick={() => {
                        onRemoveLine(index);
                      }}
                      type="button"
                    >
                      <X aria-hidden="true" size={16} />
                    </button>
                  </div>
                ))}
              </section>
            </>
          ) : null}
        </div>

        <footer className="invoice-modal__footer">
          <Button onClick={onClose} type="button" variant="ghost">
            Cancel
          </Button>
          <Button disabled={!form} pending={publishing} type="submit">
            Publish invoice
          </Button>
        </footer>
      </form>
    </div>
  );
}

function AdminInvoiceDrawer({
  invoice,
  onClose,
  onDelete,
  onMarkPaid,
  onMarkUnpaid,
  pending,
}: {
  invoice: InvoiceDto;
  onClose: () => void;
  onDelete: (invoice: InvoiceDto) => void;
  onMarkPaid: (invoice: InvoiceDto) => void;
  onMarkUnpaid: (invoice: InvoiceDto) => void;
  pending: boolean;
}) {
  return (
    <aside className="invoice-drawer">
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
  const [status, setStatus] = useState<AdminInvoiceStatusFilter>('All');
  const [search, setSearch] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadedDraft, setUploadedDraft] = useState<UploadDraftResult | null>(null);
  const [reviewForm, setReviewForm] = useState<ReviewForm | null>(null);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [pendingInvoiceId, setPendingInvoiceId] = useState<string | null>(null);

  const invoicesQuery = api.invoice.listAdmin.useQuery(
    { status, search: search.trim() || undefined },
    { retry: false },
  );
  const studentsQuery = api.invoice.listBillableStudents.useQuery(undefined, {
    enabled: uploadOpen,
    retry: false,
  });
  const publishDraft = api.invoice.publishDraft.useMutation({
    onSuccess: async (invoice) => {
      setUploadOpen(false);
      setUploadedDraft(null);
      setReviewForm(null);
      setSelectedInvoiceId(invoice.id);
      await utils.invoice.listAdmin.invalidate();
    },
  });
  const markPaid = api.invoice.markPaid.useMutation({
    onSettled: () => {
      setPendingInvoiceId(null);
    },
    onSuccess: async () => {
      await utils.invoice.listAdmin.invalidate();
    },
  });
  const markUnpaid = api.invoice.markUnpaid.useMutation({
    onSettled: () => {
      setPendingInvoiceId(null);
    },
    onSuccess: async () => {
      await utils.invoice.listAdmin.invalidate();
    },
  });
  const deleteInvoice = api.invoice.delete.useMutation({
    onSettled: () => {
      setPendingInvoiceId(null);
    },
    onSuccess: async () => {
      setSelectedInvoiceId(null);
      await utils.invoice.listAdmin.invalidate();
    },
  });

  const invoices = invoicesQuery.data?.invoices ?? [];
  const stats = invoicesQuery.data?.stats;
  const selectedInvoice = useMemo(
    () => invoices.find((invoice) => invoice.id === selectedInvoiceId) ?? null,
    [invoices, selectedInvoiceId],
  );

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    if (!file) return;
    const formData = new FormData();
    formData.set('file', file);
    setUploading(true);
    setUploadError(null);

    try {
      const response = await fetch('/api/invoices/upload', { method: 'POST', body: formData });
      const payload = (await response.json()) as UploadDraftResult | { error?: string };
      if (!response.ok || !isUploadDraftResult(payload)) {
        setUploadError('error' in payload && payload.error ? payload.error : 'Upload failed.');
        return;
      }
      setUploadedDraft(payload);
      setReviewForm(reviewFormFromUpload(payload));
      await utils.invoice.listAdmin.invalidate();
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Upload failed.');
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  }

  function handlePublish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!uploadedDraft || !reviewForm) return;
    const payload = buildPublishInput(reviewForm, uploadedDraft.invoice.id);
    if (typeof payload === 'string') {
      setUploadError(payload);
      return;
    }
    setUploadError(null);
    publishDraft.mutate(payload);
  }

  function handleDelete(invoice: InvoiceDto) {
    if (!window.confirm(`Delete ${invoice.invoiceNumber ?? 'draft invoice'}?`)) return;
    setPendingInvoiceId(invoice.id);
    deleteInvoice.mutate({ invoiceId: invoice.id });
  }

  function openUpload() {
    setUploadOpen(true);
    setUploadError(null);
    setUploadedDraft(null);
    setReviewForm(null);
  }

  return (
    <section className="invoice-page invoice-page--admin">
      <header className="invoice-page__header">
        <div>
          <p>Finance</p>
          <h1>Invoices & School Fees</h1>
        </div>
        <Button onClick={openUpload} type="button">
          <FileUp aria-hidden="true" size={16} />
          Upload invoice
        </Button>
      </header>

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
        <InvoiceEmptyState body={invoicesQuery.error.message} title="Invoices unavailable" />
      ) : invoices.length === 0 ? (
        <InvoiceEmptyState
          action={
            <Button onClick={openUpload} type="button" variant="secondary">
              Upload invoice
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
                  <th>Student</th>
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
                          setSelectedInvoiceId(invoice.id);
                        }}
                        type="button"
                      >
                        <strong>{invoice.invoiceNumber ?? 'Draft invoice'}</strong>
                        <span>{invoice.term ?? invoice.originalFileName}</span>
                      </button>
                    </td>
                    <td>{invoice.studentName ?? 'Not assigned'}</td>
                    <td>{formatInvoiceDate(invoice.dueOn)}</td>
                    <td>
                      <InvoiceStatusBadge status={invoice.displayStatus} />
                    </td>
                    <td>{formatPence(invoice.totalAmountPence)}</td>
                    <td>
                      <div className="invoice-row-actions">
                        <button
                          aria-label="View invoice"
                          onClick={() => {
                            setSelectedInvoiceId(invoice.id);
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
              invoice={selectedInvoice}
              onClose={() => {
                setSelectedInvoiceId(null);
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

      {uploadOpen ? (
        <UploadReviewModal
          error={uploadError ?? publishDraft.error?.message ?? studentsQuery.error?.message ?? null}
          form={reviewForm}
          invoiceFileName={uploadedDraft?.invoice.originalFileName ?? null}
          onAddLine={() => {
            setReviewForm((current) =>
              current
                ? { ...current, lineItems: [...current.lineItems, emptyReviewLine()] }
                : current,
            );
          }}
          onClose={() => {
            setUploadOpen(false);
          }}
          onFileChange={(event) => {
            void handleFileChange(event);
          }}
          onPublish={handlePublish}
          onRemoveLine={(index) => {
            setReviewForm((current) =>
              current
                ? {
                    ...current,
                    lineItems: current.lineItems.filter((_, lineIndex) => lineIndex !== index),
                  }
                : current,
            );
          }}
          onUpdateForm={(patch) => {
            setReviewForm((current) => (current ? { ...current, ...patch } : current));
          }}
          onUpdateLine={(index, patch) => {
            setReviewForm((current) =>
              current
                ? {
                    ...current,
                    lineItems: current.lineItems.map((line, lineIndex) =>
                      lineIndex === index ? { ...line, ...patch } : line,
                    ),
                  }
                : current,
            );
          }}
          publishing={publishDraft.isPending}
          students={studentsQuery.data ?? []}
          uploading={uploading}
        />
      ) : null}
    </section>
  );
}
