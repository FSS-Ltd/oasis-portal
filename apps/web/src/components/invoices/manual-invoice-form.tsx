'use client';

import { type FormEvent, type ReactNode, useMemo, useState } from 'react';
import { ReceiptText, X } from 'lucide-react';
import { displaySchoolYearLabel } from '@oasis/domain';
import { Button } from '@/components/ui/button';
import { Field, SelectInput, TextInput } from '@/components/ui/field';
import type { RouterInputs, RouterOutputs } from '@/lib/trpc';
import { formatPence } from './invoice-ui';

type CreateManualInvoiceInput = RouterInputs['invoice']['createManual'];
type BillableFamily = RouterOutputs['invoice']['listBillableFamilies'][number];
type InvoiceDto = RouterOutputs['invoice']['listAdmin']['invoices'][number];

interface ManualInvoiceFormProps {
  families: readonly BillableFamily[];
  initialInvoice?: InvoiceDto;
  pending: boolean;
  serverError?: string | null;
  onClose: () => void;
  onSubmit: (input: CreateManualInvoiceInput) => void;
  invoiceKindSelector?: ReactNode;
}

const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/u;
const maximumManualAmountPence = 5_000_000;

export function penceToPoundsInput(amountPence: number): string {
  return (amountPence / 100).toFixed(2);
}

export function parsePenceInput(value: string): number | null {
  const normalized = value.trim().replace(/[£,\s]/gu, '');
  if (!/^[0-9]+(?:\.[0-9]{1,2})?$/u.test(normalized)) return null;
  const amount = Number(normalized);
  return Number.isFinite(amount) ? Math.round(amount * 100) : null;
}

export function defaultInvoiceNumber(): string {
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

export function defaultDueDate(issuedOn: string): string {
  if (!dateOnlyPattern.test(issuedOn)) return '';
  const date = new Date(`${issuedOn}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + 14);
  return date.toISOString().slice(0, 10);
}

function familyKeyForInvoice(
  families: readonly BillableFamily[],
  invoice: InvoiceDto | undefined,
): string {
  if (!invoice || invoice.students.length === 0) return '';
  const family = families.find((candidate) =>
    invoice.students.every((student) =>
      candidate.students.some((candidateStudent) => candidateStudent.id === student.id),
    ),
  );
  return family?.familyKey ?? '';
}

function initialAmountInput(invoice: InvoiceDto | undefined): string {
  const firstLine = invoice?.lineItems[0];
  return firstLine ? penceToPoundsInput(firstLine.unitAmountPence) : '';
}

export function ManualInvoiceForm({
  families,
  initialInvoice,
  invoiceKindSelector,
  onClose,
  onSubmit,
  pending,
  serverError,
}: ManualInvoiceFormProps) {
  const today = new Date().toISOString().slice(0, 10);
  const initialIssuedOn = initialInvoice?.issuedOn ?? today;
  const [invoiceTitle, setInvoiceTitle] = useState(initialInvoice?.invoiceTitle ?? '');
  const [amount, setAmount] = useState(initialAmountInput(initialInvoice));
  const [familyKey, setFamilyKey] = useState(familyKeyForInvoice(families, initialInvoice));
  const [familyLabel, setFamilyLabel] = useState(initialInvoice?.familyLabel ?? '');
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>(
    initialInvoice?.students.map((student) => student.id) ?? [],
  );
  const [invoiceNumber, setInvoiceNumber] = useState(
    initialInvoice?.invoiceNumber ?? defaultInvoiceNumber(),
  );
  const [issuedOn, setIssuedOn] = useState(initialIssuedOn);
  const [dueOn, setDueOn] = useState(initialInvoice?.dueOn ?? defaultDueDate(initialIssuedOn));
  const [error, setError] = useState<string | null>(null);
  const isEdit = Boolean(initialInvoice);

  const selectedFamily = useMemo(
    () => families.find((family) => family.familyKey === familyKey),
    [families, familyKey],
  );
  const amountPence = parsePenceInput(amount);
  const canSubmit = Boolean(
    invoiceTitle.trim() &&
    amountPence !== null &&
    amountPence > 0 &&
    amountPence <= maximumManualAmountPence &&
    selectedFamily &&
    selectedStudentIds.length > 0 &&
    familyLabel.trim() &&
    invoiceNumber.trim() &&
    dateOnlyPattern.test(issuedOn) &&
    dateOnlyPattern.test(dueOn),
  );
  const totalAmountPence = (amountPence ?? 0) * selectedStudentIds.length;

  function selectFamily(nextFamilyKey: string) {
    const nextFamily = families.find((family) => family.familyKey === nextFamilyKey);
    setError(null);
    setFamilyKey(nextFamilyKey);
    setFamilyLabel(nextFamily?.familyLabel ?? '');
    setSelectedStudentIds(nextFamily?.students.map((student) => student.id) ?? []);
  }

  function updateSelectedStudent(studentId: string, checked: boolean) {
    if (!selectedFamily?.students.some((student) => student.id === studentId)) return;
    setError(null);
    setSelectedStudentIds((current) =>
      checked
        ? [...new Set([...current, studentId])]
        : current.filter((candidate) => candidate !== studentId),
    );
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!invoiceTitle.trim()) {
      setError('Enter an invoice title.');
      return;
    }
    if (amountPence === null || amountPence <= 0 || amountPence > maximumManualAmountPence) {
      setError('Enter a valid amount per child.');
      return;
    }
    if (!selectedFamily) {
      setError('Select a family.');
      return;
    }
    const familyStudentIds = new Set(selectedFamily.students.map((student) => student.id));
    if (
      selectedStudentIds.length === 0 ||
      selectedStudentIds.some((studentId) => !familyStudentIds.has(studentId))
    ) {
      setError('Select at least one child from the selected family.');
      return;
    }
    if (!familyLabel.trim() || !invoiceNumber.trim()) {
      setError('Family and invoice number are required.');
      return;
    }
    if (!dateOnlyPattern.test(issuedOn) || !dateOnlyPattern.test(dueOn)) {
      setError('Issued and due dates are required.');
      return;
    }

    setError(null);
    onSubmit({
      invoiceTitle: invoiceTitle.trim(),
      amountPence,
      studentIds: selectedStudentIds,
      familyLabel: familyLabel.trim(),
      invoiceNumber: invoiceNumber.trim(),
      issuedOn,
      dueOn,
    });
  }

  return (
    <form className="invoice-modal__panel" onSubmit={submit}>
      <header className="invoice-modal__header invoice-modal__header--navy">
        <span>
          <ReceiptText aria-hidden="true" size={19} />
        </span>
        <div>
          <p>{isEdit ? 'Edit Invoice' : 'Create Invoice'}</p>
          <h2>{isEdit ? 'Update manual family invoice' : 'Compose manual family invoice'}</h2>
        </div>
        <button
          aria-label={isEdit ? 'Close invoice editor' : 'Close invoice creator'}
          onClick={onClose}
          type="button"
        >
          <X aria-hidden="true" size={18} />
        </button>
      </header>

      <div className="invoice-modal__body invoice-create-grid">
        {invoiceKindSelector ? (
          <section className="invoice-create-section invoice-create-section--wide">
            {invoiceKindSelector}
          </section>
        ) : null}
        <section className="invoice-create-section">
          <h3>Invoice details</h3>
          <div className="invoice-review-grid">
            <Field label="Title" required>
              <TextInput
                maxLength={160}
                onChange={(event) => {
                  setError(null);
                  setInvoiceTitle(event.target.value);
                }}
                required
                value={invoiceTitle}
              />
            </Field>
            <Field
              label="Amount per child"
              hint="This amount is charged once for each selected child."
              required
            >
              <TextInput
                inputMode="decimal"
                onChange={(event) => {
                  setError(null);
                  setAmount(event.target.value);
                }}
                placeholder="150.00"
                required
                value={amount}
              />
            </Field>
            <Field label="Invoice number" required>
              <TextInput
                maxLength={80}
                onChange={(event) => {
                  setError(null);
                  setInvoiceNumber(event.target.value);
                }}
                required
                value={invoiceNumber}
              />
            </Field>
            <Field label="Issued date" required>
              <TextInput
                onChange={(event) => {
                  setError(null);
                  setIssuedOn(event.target.value);
                  setDueOn(defaultDueDate(event.target.value));
                }}
                required
                type="date"
                value={issuedOn}
              />
            </Field>
            <Field label="Due date" required>
              <TextInput
                onChange={(event) => {
                  setError(null);
                  setDueOn(event.target.value);
                }}
                required
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
              required
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
        </section>
      </div>

      {error || serverError ? (
        <p className="invoice-form-error invoice-form-error--modal" role="alert">
          {error ?? serverError}
        </p>
      ) : null}
      <footer className="invoice-modal__footer">
        <span className="invoice-create-subtotal">Total {formatPence(totalAmountPence)}</span>
        <Button onClick={onClose} type="button" variant="ghost">
          Cancel
        </Button>
        <Button disabled={!canSubmit} pending={pending} type="submit">
          {isEdit ? 'Update manual invoice' : 'Create manual invoice'}
        </Button>
      </footer>
    </form>
  );
}
