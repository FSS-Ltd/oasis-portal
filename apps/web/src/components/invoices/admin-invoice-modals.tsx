'use client';

import type { ReactElement } from 'react';
import { Pencil, ReceiptText, Trash2, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { friendlyErrorMessage } from '@/lib/notifications';
import {
  formatFileSize,
  InvoiceDiscounts,
  InvoiceEmptyState,
  InvoiceLineItems,
  InvoicePdfAction,
  InvoicePrimaryMeta,
  InvoiceStatusBadge,
  InvoiceTotal,
  invoiceKindLabel,
  type InvoiceDto,
} from './invoice-ui';

export function AdminInvoiceCreateLoadingModal({
  error,
  eyebrow = 'Create Invoice',
  onClose,
  title = 'Compose learning centre fees',
}: {
  error: unknown;
  eyebrow?: string;
  onClose: () => void;
  title?: string;
}): ReactElement {
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
            <p>{eyebrow}</p>
            <h2>{title}</h2>
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

export function AdminInvoiceDeleteModal({
  invoice,
  onCancel,
  onConfirm,
  pending,
}: {
  invoice: InvoiceDto;
  onCancel: () => void;
  onConfirm: (invoice: InvoiceDto) => void;
  pending: boolean;
}): ReactElement {
  return (
    <div aria-modal="true" className="invoice-modal" role="dialog">
      <button
        aria-label="Cancel invoice delete"
        className="invoice-modal__backdrop"
        onClick={onCancel}
        type="button"
      />
      <section className="invoice-modal__panel invoice-modal__panel--narrow">
        <header className="invoice-modal__header invoice-modal__header--danger">
          <span>
            <Trash2 aria-hidden="true" size={19} />
          </span>
          <div>
            <p>Delete Invoice</p>
            <h2>{invoice.invoiceNumber ?? 'Draft invoice'}</h2>
          </div>
          <button aria-label="Cancel invoice delete" onClick={onCancel} type="button">
            <X aria-hidden="true" size={18} />
          </button>
        </header>
        <div className="invoice-modal__body">
          <p className="invoice-delete-copy">
            This removes the invoice from the family balance and cannot be undone.
          </p>
        </div>
        <footer className="invoice-modal__footer">
          <Button disabled={pending} onClick={onCancel} type="button" variant="ghost">
            Cancel
          </Button>
          <Button
            onClick={() => {
              onConfirm(invoice);
            }}
            pending={pending}
            type="button"
            variant="danger"
          >
            Delete invoice
          </Button>
        </footer>
      </section>
    </div>
  );
}

export function AdminInvoiceDrawer({
  detailsId,
  detailsRef,
  invoice,
  onClose,
  onConfirmPayment,
  onDelete,
  onEdit,
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
  onEdit: (invoice: InvoiceDto) => void;
  onMarkPaid: (invoice: InvoiceDto) => void;
  onMarkUnpaid: (invoice: InvoiceDto) => void;
  onRejectPayment: (invoice: InvoiceDto) => void;
  pending: boolean;
}): ReactElement {
  return (
    <aside className="invoice-drawer" id={detailsId} ref={detailsRef} tabIndex={-1}>
      <header>
        <button aria-label="Close invoice details" onClick={onClose} type="button">
          <X aria-hidden="true" size={18} />
        </button>
        <span>Invoice</span>
        <h2>{invoice.invoiceNumber ?? 'Draft invoice'}</h2>
        <div className="badge-list">
          <InvoiceStatusBadge status={invoice.displayStatus} />
          <Badge tone="grey">{invoiceKindLabel(invoice.kind)}</Badge>
        </div>
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
        {invoice.canEdit ? (
          <Button
            onClick={() => {
              onEdit(invoice);
            }}
            pending={pending}
            size="sm"
            type="button"
            variant="secondary"
          >
            <Pencil aria-hidden="true" size={15} />
            Edit
          </Button>
        ) : null}
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
