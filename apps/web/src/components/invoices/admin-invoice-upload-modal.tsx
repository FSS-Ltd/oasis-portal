'use client';

import { type ChangeEvent, type FormEvent, useEffect, useMemo, useState } from 'react';
import { Plus, ReceiptText, UploadCloud, X } from 'lucide-react';
import { parseSchoolFeeInvoiceText } from '@oasis/domain';
import { Button } from '@/components/ui/button';
import { Field, SelectInput, TextInput } from '@/components/ui/field';
import type { RouterInputs, RouterOutputs } from '@/lib/trpc';
import { formatFileSize, formatPence } from './invoice-ui';

type BillableFamily = RouterOutputs['invoice']['listBillableFamilies'][number];
type FeeConfig = RouterOutputs['invoice']['listFeeConfig'];
type PublishDraftInput = RouterInputs['invoice']['publishDraft'];
type PublishBillingCadence = NonNullable<PublishDraftInput['billingCadence']>;

interface UploadLineItem {
  description: string;
  quantity: number;
  unitAmountPence: number;
}

interface UploadParsedInvoice {
  invoiceNumber: string | null;
  familyLabel?: string | null;
  issuedOn: string | null;
  dueOn: string | null;
  term: string | null;
  totalAmountPence: number | null;
  lineItems: UploadLineItem[];
}

interface UploadDraftResponse {
  invoice: {
    id: string;
    familyLabel?: string | null;
    invoiceNumber?: string | null;
    issuedOn?: string | null;
    dueOn?: string | null;
    term?: string | null;
    totalAmountPence?: number | null;
    originalFileName: string;
    fileSizeBytes: number;
    lineItems?: UploadLineItem[];
  };
  parsed?: UploadParsedInvoice | null;
}

interface LineForm {
  description: string;
  quantity: string;
  unitAmount: string;
}

interface PromiseWithResolversResult<T> {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
}

type PromiseConstructorWithResolvers = PromiseConstructor & {
  withResolvers?: <T>() => PromiseWithResolversResult<T>;
};

type BrowserPdfPage = {
  getTextContent: () => Promise<{ items: unknown[] }>;
};

type BrowserPdfDocument = {
  numPages: number;
  getPage: (pageNumber: number) => Promise<BrowserPdfPage>;
};

type BrowserPdfJs = {
  getDocument: (input: { data: Uint8Array; disableWorker: boolean; isEvalSupported: boolean }) => {
    promise: Promise<BrowserPdfDocument>;
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isUploadLineItem(value: unknown): value is UploadLineItem {
  if (!isRecord(value)) return false;
  return (
    typeof value.description === 'string' &&
    typeof value.quantity === 'number' &&
    typeof value.unitAmountPence === 'number'
  );
}

function isParsedInvoice(value: unknown): value is UploadParsedInvoice {
  if (!isRecord(value)) return false;
  return Array.isArray(value.lineItems) && value.lineItems.every(isUploadLineItem);
}

function isUploadResponse(value: unknown): value is UploadDraftResponse {
  if (!isRecord(value) || !isRecord(value.invoice)) return false;
  const invoiceLineItems = value.invoice.lineItems;
  const parsed = value.parsed;
  return (
    typeof value.invoice.id === 'string' &&
    typeof value.invoice.originalFileName === 'string' &&
    typeof value.invoice.fileSizeBytes === 'number' &&
    (invoiceLineItems === undefined ||
      (Array.isArray(invoiceLineItems) && invoiceLineItems.every(isUploadLineItem))) &&
    (parsed === undefined || parsed === null || isParsedInvoice(parsed))
  );
}

function ensurePromiseWithResolvers(): void {
  const promiseConstructor = Promise as PromiseConstructorWithResolvers;
  if (typeof promiseConstructor.withResolvers === 'function') return;

  Object.defineProperty(promiseConstructor, 'withResolvers', {
    configurable: true,
    writable: true,
    value: function withResolvers<T>(): PromiseWithResolversResult<T> {
      let resolve!: (value: T | PromiseLike<T>) => void;
      let reject!: (reason?: unknown) => void;
      const promise = new Promise<T>((promiseResolve, promiseReject) => {
        resolve = promiseResolve;
        reject = promiseReject;
      });
      return { promise, resolve, reject };
    },
  });
}

async function parseInvoiceFromPdfFile(file: File): Promise<UploadParsedInvoice> {
  ensurePromiseWithResolvers();
  const pdfjs = (await import('pdfjs-dist/legacy/build/pdf.mjs')) as BrowserPdfJs;
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
    disableWorker: true,
    isEvalSupported: false,
  });
  const pdf = await loadingTask.promise;
  const textPages: string[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => {
        if (!isRecord(item) || typeof item.str !== 'string') return '';
        return item.str;
      })
      .filter(Boolean)
      .join('\n');
    if (pageText.trim()) textPages.push(pageText);
  }

  return parseSchoolFeeInvoiceText(textPages.join('\n\n'));
}

function parsedInvoiceFromUpload(
  response: UploadDraftResponse,
  preferredParsed?: UploadParsedInvoice | null,
): UploadParsedInvoice {
  const invoiceLines = response.invoice.lineItems ?? [];
  const parsed = preferredParsed ?? response.parsed ?? null;
  const parsedLines = parsed && parsed.lineItems.length > 0 ? parsed.lineItems : invoiceLines;
  return {
    invoiceNumber: parsed?.invoiceNumber ?? response.invoice.invoiceNumber ?? null,
    familyLabel: parsed?.familyLabel ?? response.invoice.familyLabel ?? null,
    issuedOn: parsed?.issuedOn ?? response.invoice.issuedOn ?? null,
    dueOn: parsed?.dueOn ?? response.invoice.dueOn ?? null,
    term: parsed?.term ?? response.invoice.term ?? null,
    totalAmountPence: parsed?.totalAmountPence ?? response.invoice.totalAmountPence ?? null,
    lineItems: parsedLines,
  };
}

function uploadErrorMessage(value: unknown): string {
  if (isRecord(value) && typeof value.error === 'string') return value.error;
  return 'Invoice PDF could not be uploaded.';
}

function penceToPoundsInput(amountPence: number): string {
  return (amountPence / 100).toFixed(2);
}

function parsePenceInput(value: string): number | null {
  const normalized = value.trim().replace(/[£,\s]/gu, '');
  if (!/^[0-9]+(?:\.[0-9]{1,2})?$/u.test(normalized)) return null;
  const amount = Number(normalized);
  return Number.isFinite(amount) ? Math.round(amount * 100) : null;
}

function defaultInvoiceNumber(): string {
  const now = new Date();
  return [
    'OLC',
    String(now.getFullYear()).slice(2),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0'),
    String(now.getMilliseconds()).padStart(3, '0'),
  ].join('');
}

function defaultDueDate(issuedOn: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(issuedOn)) return '';
  const date = new Date(`${issuedOn}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + 14);
  return date.toISOString().slice(0, 10);
}

function defaultTerm(issuedOn: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(issuedOn)) return '';
  return new Intl.DateTimeFormat('en-GB', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
    .format(new Date(`${issuedOn}T00:00:00.000Z`))
    .toUpperCase();
}

function lineFormsFromParsed(lines: readonly UploadLineItem[]): LineForm[] {
  return lines.map((line) => ({
    description: line.description,
    quantity: String(line.quantity),
    unitAmount: penceToPoundsInput(line.unitAmountPence),
  }));
}

function parsedLineItemsForForms(lines: readonly LineForm[]): UploadLineItem[] {
  return lines
    .map((line) => {
      const quantity = Number(line.quantity);
      const unitAmountPence = parsePenceInput(line.unitAmount);
      if (
        !line.description.trim() ||
        !Number.isInteger(quantity) ||
        quantity <= 0 ||
        unitAmountPence === null
      ) {
        return null;
      }
      return { description: line.description.trim(), quantity, unitAmountPence };
    })
    .filter((line): line is UploadLineItem => line !== null);
}

function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, ' ')
    .trim();
}

function familyScore(family: BillableFamily, parsed: UploadParsedInvoice): number {
  const familyLabel = normalizeName(parsed.familyLabel ?? '');
  const familyName = normalizeName(family.familyLabel);
  const lineText = normalizeName(parsed.lineItems.map((line) => line.description).join(' '));
  const familyLabelScore =
    familyLabel &&
    familyName &&
    (familyLabel.includes(familyName) || familyName.includes(familyLabel))
      ? 3
      : 0;
  const childScore = family.students.reduce((score, student) => {
    const childName = normalizeName(student.fullName);
    return childName && lineText.includes(childName) ? score + 5 : score;
  }, 0);
  const surnameScore = family.students.some((student) => {
    const surname = normalizeName(student.fullName.split(/\s+/u).at(-1) ?? '');
    return surname && familyLabel.includes(surname);
  })
    ? 2
    : 0;
  return familyLabelScore + childScore + surnameScore;
}

function findFamilyForParsed(
  families: readonly BillableFamily[],
  parsed: UploadParsedInvoice,
): BillableFamily | null {
  const ranked = families
    .map((family) => ({ family, score: familyScore(family, parsed) }))
    .sort((left, right) => right.score - left.score);
  const best = ranked[0];
  return best && best.score > 0 ? best.family : null;
}

function studentIdsForParsedLines(
  family: BillableFamily,
  lines: readonly UploadLineItem[],
): string[] {
  const ids: string[] = [];
  lines.forEach((line) => {
    const description = normalizeName(line.description);
    const match = family.students.find((student) =>
      description.includes(normalizeName(student.fullName)),
    );
    if (match && !ids.includes(match.id)) ids.push(match.id);
  });
  return ids.length > 0 ? ids : family.students.map((student) => student.id);
}

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
      setFamilyKey(matchedFamily?.familyKey ?? '');
      setFamilyLabel(parsed.familyLabel ?? matchedFamily?.familyLabel ?? '');
      setSelectedStudentIds(
        matchedFamily ? studentIdsForParsedLines(matchedFamily, parsed.lineItems) : [],
      );
    } catch (err) {
      setDraft(null);
      setLineItems([]);
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
      setError('School year must be a number.');
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
              <Field label="School year" required>
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
                    <small>{student.yearGroup}</small>
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
        </div>

        {error || serverError ? (
          <p className="invoice-form-error invoice-form-error--modal">{error ?? serverError}</p>
        ) : null}
        <footer className="invoice-modal__footer">
          <span className="invoice-create-subtotal">Subtotal {formatPence(subtotal)}</span>
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
