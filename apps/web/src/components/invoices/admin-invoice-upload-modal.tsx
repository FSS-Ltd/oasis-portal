'use client';

import { type ChangeEvent, type FormEvent, useEffect, useMemo, useState } from 'react';
import { Plus, ReceiptText, UploadCloud, X } from 'lucide-react';
import { displaySchoolYearLabel } from '@oasis/domain';
import { Button } from '@/components/ui/button';
import { Field, SelectInput, TextInput } from '@/components/ui/field';
import { formatFileSize, formatPence } from './invoice-ui';
import {
  defaultDueDate,
  defaultInvoiceNumber,
  defaultTerm,
  findFamilyForParsed,
  isUploadResponse,
  lineFormsFromParsed,
  parsedInvoiceFromUpload,
  parsedLineItemsForForms,
  parseInvoiceFromPdfFile,
  parsePenceInput,
  studentIdsForParsedLines,
  uploadErrorMessage,
  type BillableFamily,
  type FeeConfig,
  type LineForm,
  type PublishBillingCadence,
  type PublishDraftInput,
  type UploadDiscount,
  type UploadDraftResponse,
  type UploadParsedInvoice,
} from './admin-invoice-upload-utils';

function UploadFamilySummary({ family }: { family: BillableFamily }) {
  return (
    <section aria-label={`${family.familyLabel} fee summary`} className="invoice-family-summary">
      <div>
        <span>{family.yearSummary.cycleLabel}</span>
        <strong>{formatPence(family.yearSummary.adjustedAnnualAmountPence)}</strong>
      </div>
      <div>
        <span>Left to invoice</span>
        <strong>{formatPence(family.yearSummary.leftToInvoiceAmountPence)}</strong>
      </div>
      {family.yearSummary.children.length > 0 ? (
        <div className="invoice-family-summary__children">
          {family.yearSummary.children.map((child) => (
            <div className="invoice-family-summary__child" key={child.studentId}>
              <strong>{child.studentName}</strong>
              <small>{formatPence(child.leftToInvoiceAmountPence)} left to invoice</small>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

export function AdminInvoiceUploadModal({
  families,
  feeConfig,
  onClose,
  onSubmit,
  pending,
  serverError,
}: {
  families: readonly BillableFamily[];
  feeConfig: FeeConfig;
  onClose: () => void;
  onSubmit: (input: PublishDraftInput) => void;
  pending: boolean;
  serverError?: string | null;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [draft, setDraft] = useState<UploadDraftResponse | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [schoolYear, setSchoolYear] = useState(String(feeConfig.schoolYear));
  const [billingCadence, setBillingCadence] = useState<PublishBillingCadence>('Monthly');
  const [familyKey, setFamilyKey] = useState('');
  const [familyLabel, setFamilyLabel] = useState('');
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [invoiceNumber, setInvoiceNumber] = useState(defaultInvoiceNumber());
  const [issuedOn, setIssuedOn] = useState(today);
  const [dueOn, setDueOn] = useState(defaultDueDate(today));
  const [term, setTerm] = useState(defaultTerm(today));
  const [lineItems, setLineItems] = useState<LineForm[]>([]);
  const [discounts, setDiscounts] = useState<UploadDiscount[]>([]);

  const selectedFamily = useMemo(
    () => families.find((family) => family.familyKey === familyKey),
    [families, familyKey],
  );
  const subtotal = useMemo(
    () =>
      lineItems.reduce((sum, line) => {
        const unitAmountPence = parsePenceInput(line.unitAmount);
        const quantity = Number(line.quantity);
        return unitAmountPence === null || !Number.isInteger(quantity)
          ? sum
          : sum + unitAmountPence * quantity;
      }, 0),
    [lineItems],
  );
  const discountTotal = useMemo(
    () =>
      discounts.reduce((sum, discount) => {
        if (discount.kind !== 'ManualFixed') return sum;
        return sum + (discount.amountPence ?? 0);
      }, 0),
    [discounts],
  );
  const netTotal = Math.max(subtotal - discountTotal, 0);
  const canSubmit =
    draft !== null &&
    selectedFamily !== undefined &&
    selectedStudentIds.length > 0 &&
    invoiceNumber.trim().length > 0 &&
    dueOn.trim().length > 0 &&
    parsedLineItemsForForms(lineItems).length >= selectedStudentIds.length;

  useEffect(() => {
    if (!draft || familyKey || families.length === 0) return;
    const parsed = parsedInvoiceFromUpload(draft);
    const matchedFamily = findFamilyForParsed(families, parsed);
    if (!matchedFamily) return;
    setFamilyKey(matchedFamily.familyKey);
    setFamilyLabel(parsed.familyLabel ?? matchedFamily.familyLabel);
    setSelectedStudentIds(studentIdsForParsedLines(matchedFamily, parsed.lineItems));
  }, [draft, families, familyKey]);

  async function uploadFile(file: File) {
    setError(null);
    setUploading(true);
    let clientParsed: UploadParsedInvoice | null = null;
    let clientParseError: string | null = null;
    try {
      clientParsed = await parseInvoiceFromPdfFile(file);
    } catch (err) {
      clientParseError = err instanceof Error ? err.message : 'Browser PDF parser failed.';
    }
    if (clientParsed) {
      const parsedIssuedOn = clientParsed.issuedOn ?? today;
      const matchedFamily = findFamilyForParsed(families, clientParsed);
      setInvoiceNumber(clientParsed.invoiceNumber ?? defaultInvoiceNumber());
      setIssuedOn(parsedIssuedOn);
      setDueOn(clientParsed.dueOn ?? defaultDueDate(parsedIssuedOn));
      setTerm(clientParsed.term ?? defaultTerm(parsedIssuedOn));
      setLineItems(lineFormsFromParsed(clientParsed.lineItems));
      setDiscounts(clientParsed.discounts);
      setFamilyKey(matchedFamily?.familyKey ?? '');
      setFamilyLabel(clientParsed.familyLabel ?? matchedFamily?.familyLabel ?? '');
      setSelectedStudentIds(
        matchedFamily ? studentIdsForParsedLines(matchedFamily, clientParsed.lineItems) : [],
      );
    }

    const formData = new FormData();
    formData.set('file', file);

    try {
      const response = await fetch('/api/invoices/upload', {
        method: 'POST',
        body: formData,
      });
      const json: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(uploadErrorMessage(json));
      }
      if (!isUploadResponse(json)) {
        throw new Error('Invoice PDF upload returned an unexpected response.');
      }

      const parsed = parsedInvoiceFromUpload(json, clientParsed);
      if (parsed.lineItems.length === 0) {
        throw new Error(
          clientParseError
            ? `PDF uploaded, but no line items were parsed. Browser parser: ${clientParseError}`
            : 'PDF uploaded, but no line items were parsed. Check that the PDF has selectable fee text.',
        );
      }
      const parsedIssuedOn = parsed.issuedOn ?? today;
      const matchedFamily = findFamilyForParsed(families, parsed);
      setDraft({ ...json, parsed });
      setInvoiceNumber(parsed.invoiceNumber ?? defaultInvoiceNumber());
      setIssuedOn(parsedIssuedOn);
      setDueOn(parsed.dueOn ?? defaultDueDate(parsedIssuedOn));
      setTerm(parsed.term ?? defaultTerm(parsedIssuedOn));
      setLineItems(lineFormsFromParsed(parsed.lineItems));
      setDiscounts(parsed.discounts);
      setFamilyKey(matchedFamily?.familyKey ?? '');
      setFamilyLabel(parsed.familyLabel ?? matchedFamily?.familyLabel ?? '');
      setSelectedStudentIds(
        matchedFamily ? studentIdsForParsedLines(matchedFamily, parsed.lineItems) : [],
      );
    } catch (err) {
      setDraft(null);
      setLineItems([]);
      setDiscounts([]);
      setFamilyKey('');
      setFamilyLabel('');
      setSelectedStudentIds([]);
      setError(err instanceof Error ? err.message : 'Invoice PDF could not be uploaded.');
    } finally {
      setUploading(false);
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    void uploadFile(file);
  }

  function selectFamily(nextFamilyKey: string) {
    const nextFamily = families.find((family) => family.familyKey === nextFamilyKey);
    const parsed = draft ? parsedInvoiceFromUpload(draft) : null;
    setFamilyKey(nextFamilyKey);
    setFamilyLabel(parsed?.familyLabel ?? nextFamily?.familyLabel ?? '');
    setSelectedStudentIds(
      nextFamily && parsed ? studentIdsForParsedLines(nextFamily, parsed.lineItems) : [],
    );
  }

  function updateSelectedStudent(studentId: string, checked: boolean) {
    setSelectedStudentIds((current) =>
      checked
        ? [...new Set([...current, studentId])]
        : current.filter((candidate) => candidate !== studentId),
    );
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft) {
      setError('Upload a PDF invoice first.');
      return;
    }
    const year = Number(schoolYear);
    if (!Number.isInteger(year)) {
      setError('Fee year must be a number.');
      return;
    }
    if (!selectedFamily) {
      setError('Select a family.');
      return;
    }
    if (selectedStudentIds.length === 0) {
      setError('Select at least one child.');
      return;
    }
    const validLineItems = parsedLineItemsForForms(lineItems);
    if (validLineItems.length !== lineItems.length) {
      setError('Each line needs a description, quantity, and amount.');
      return;
    }
    if (validLineItems.length < selectedStudentIds.length) {
      setError('Imported invoices need one line item per selected child.');
      return;
    }
    if (discounts.length > 0 && validLineItems.length !== selectedStudentIds.length) {
      setError('Imported discounts need one line item per selected child.');
      return;
    }
    if (!invoiceNumber.trim() || !dueOn.trim()) {
      setError('Invoice number and due date are required.');
      return;
    }
    setError(null);
    onSubmit({
      invoiceId: draft.invoice.id,
      studentIds: selectedStudentIds,
      familyLabel: familyLabel.trim() || selectedFamily.familyLabel,
      schoolYear: year,
      billingCadence,
      invoiceNumber: invoiceNumber.trim(),
      issuedOn: issuedOn.trim() || null,
      dueOn,
      term: term.trim() || null,
      lineItems: validLineItems,
      discounts,
    });
  }

  return (
    <div aria-modal="true" className="invoice-modal invoice-modal--wide" role="dialog">
      <button
        aria-label="Close invoice uploader"
        className="invoice-modal__backdrop"
        onClick={onClose}
        type="button"
      />
      <form className="invoice-modal__panel" onSubmit={submit}>
        <header className="invoice-modal__header invoice-modal__header--navy">
          <span>
            <UploadCloud aria-hidden="true" size={19} />
          </span>
          <div>
            <p>Upload Invoice</p>
            <h2>Import pastor-created PDF</h2>
          </div>
          <button aria-label="Close invoice uploader" onClick={onClose} type="button">
            <X aria-hidden="true" size={18} />
          </button>
        </header>

        <div className="invoice-modal__body invoice-create-grid">
          <section className="invoice-create-section invoice-create-section--wide">
            <label className="invoice-upload-drop">
              <ReceiptText aria-hidden="true" size={24} />
              <strong>{draft ? draft.invoice.originalFileName : 'Choose PDF invoice'}</strong>
              <span>
                {draft
                  ? formatFileSize(draft.invoice.fileSizeBytes)
                  : 'PDF files only, up to 10 MB'}
              </span>
              <input accept="application/pdf" onChange={handleFileChange} type="file" />
            </label>
          </section>

          <section className="invoice-create-section">
            <h3>Invoice details</h3>
            <div className="invoice-review-grid">
              <Field label="Fee year" required>
                <TextInput
                  onChange={(event) => {
                    setSchoolYear(event.target.value);
                  }}
                  value={schoolYear}
                />
              </Field>
              <Field label="Cadence" required>
                <SelectInput
                  onChange={(event) => {
                    setBillingCadence(event.target.value as PublishBillingCadence);
                  }}
                  value={billingCadence}
                >
                  <option value="Annual">Annual</option>
                  <option value="Term">Term</option>
                  <option value="Monthly">Monthly</option>
                </SelectInput>
              </Field>
              <Field label="Invoice number" required>
                <TextInput
                  onChange={(event) => {
                    setInvoiceNumber(event.target.value);
                  }}
                  value={invoiceNumber}
                />
              </Field>
              <Field label="Billing period" required>
                <TextInput
                  onChange={(event) => {
                    setTerm(event.target.value);
                  }}
                  value={term}
                />
              </Field>
              <Field label="Issued">
                <TextInput
                  onChange={(event) => {
                    setIssuedOn(event.target.value);
                    setDueOn(defaultDueDate(event.target.value));
                  }}
                  type="date"
                  value={issuedOn}
                />
              </Field>
              <Field label="Due" required>
                <TextInput
                  onChange={(event) => {
                    setDueOn(event.target.value);
                  }}
                  type="date"
                  value={dueOn}
                />
              </Field>
            </div>
          </section>

          <section className="invoice-create-section">
            <h3>Family and children</h3>
            <Field label="Family" required>
              <SelectInput
                onChange={(event) => {
                  selectFamily(event.target.value);
                }}
                value={familyKey}
              >
                <option value="">Select family</option>
                {families.map((family) => (
                  <option key={family.familyKey} value={family.familyKey}>
                    {family.familyLabel}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <Field label="PDF family label" required>
              <TextInput
                disabled={!selectedFamily}
                onChange={(event) => {
                  setFamilyLabel(event.target.value);
                }}
                value={familyLabel}
              />
            </Field>
            <div className="invoice-child-list">
              {selectedFamily?.students.map((student) => (
                <label key={student.id}>
                  <input
                    checked={selectedStudentIds.includes(student.id)}
                    onChange={(event) => {
                      updateSelectedStudent(student.id, event.target.checked);
                    }}
                    type="checkbox"
                  />
                  <span>
                    <strong>{student.fullName}</strong>
                    <small>{displaySchoolYearLabel(student.yearGroup)}</small>
                  </span>
                </label>
              ))}
            </div>
            {selectedFamily ? <UploadFamilySummary family={selectedFamily} /> : null}
          </section>

          <section className="invoice-create-section invoice-create-section--wide">
            <div className="invoice-review-lines__header">
              <h3>Line items</h3>
              <Button
                disabled={!draft}
                onClick={() => {
                  setLineItems((current) => [
                    ...current,
                    { description: '', quantity: '1', unitAmount: '0.00' },
                  ]);
                }}
                size="sm"
                type="button"
                variant="secondary"
              >
                <Plus aria-hidden="true" size={14} />
                Add line
              </Button>
            </div>
            <div className="invoice-review-lines">
              {lineItems.map((line, index) => (
                <div className="invoice-review-line" key={`${line.description}-${String(index)}`}>
                  <TextInput
                    aria-label="Line item description"
                    onChange={(event) => {
                      setLineItems((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, description: event.target.value } : item,
                        ),
                      );
                    }}
                    placeholder="Description"
                    value={line.description}
                  />
                  <TextInput
                    aria-label="Quantity"
                    inputMode="numeric"
                    onChange={(event) => {
                      setLineItems((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, quantity: event.target.value } : item,
                        ),
                      );
                    }}
                    value={line.quantity}
                  />
                  <TextInput
                    aria-label="Unit amount"
                    inputMode="decimal"
                    onChange={(event) => {
                      setLineItems((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, unitAmount: event.target.value } : item,
                        ),
                      );
                    }}
                    value={line.unitAmount}
                  />
                  <button
                    aria-label="Remove line item"
                    disabled={lineItems.length === 1}
                    onClick={() => {
                      setLineItems((current) =>
                        current.filter((_, itemIndex) => itemIndex !== index),
                      );
                    }}
                    type="button"
                  >
                    <X aria-hidden="true" size={16} />
                  </button>
                </div>
              ))}
            </div>
          </section>

          {discounts.length > 0 ? (
            <section className="invoice-create-section invoice-create-section--wide">
              <h3>Imported discounts</h3>
              <div className="invoice-discounts">
                {discounts.map((discount, index) => (
                  <div className="invoice-discount-row" key={`${discount.label}-${String(index)}`}>
                    <span>
                      <strong>{discount.label}</strong>
                      <small>Imported from PDF</small>
                    </span>
                    <b>-{formatPence(discount.amountPence ?? 0)}</b>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </div>

        {error || serverError ? (
          <p className="invoice-form-error invoice-form-error--modal">{error ?? serverError}</p>
        ) : null}
        <footer className="invoice-modal__footer">
          <span className="invoice-create-subtotal">
            Subtotal {formatPence(subtotal)}
            {discountTotal > 0
              ? ` | Discounts -${formatPence(discountTotal)} | Total ${formatPence(netTotal)}`
              : ''}
          </span>
          <Button disabled={uploading || pending} onClick={onClose} type="button" variant="ghost">
            Cancel
          </Button>
          <Button disabled={!canSubmit || uploading} pending={pending || uploading} type="submit">
            Publish uploaded invoice
          </Button>
        </footer>
      </form>
    </div>
  );
}
