'use client';

import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Plus, ReceiptText, X } from 'lucide-react';
import {
  SCHOOL_FEE_DISCOUNT_CHILD_INDEX_PREFIX,
  SCHOOL_FEE_DISCOUNT_EXPLANATION,
  calculateSchoolFeeFamilyDiscounts,
  schoolFeeDiscountChildIndexPresetCode,
  type SchoolFeeDiscountInput,
} from '@oasis/domain';
import { Button } from '@/components/ui/button';
import { Field, SelectInput, TextInput } from '@/components/ui/field';
import type { RouterInputs, RouterOutputs } from '@/lib/trpc';
import { formatPence } from './invoice-ui';

type BillableFamily = RouterOutputs['invoice']['listBillableFamilies'][number];
type FeeConfig = RouterOutputs['invoice']['listFeeConfig'];
type DiscountPreset = RouterOutputs['invoice']['discountPresets'][number];
type CreateInvoiceInput = RouterInputs['invoice']['createGenerated'];
type InvoiceDto = RouterOutputs['invoice']['listAdmin']['invoices'][number];

interface LineForm {
  studentId: string | null;
  description: string;
  quantity: string;
  unitAmount: string;
}

interface ManualDiscountForm {
  id: string;
  label: string;
  studentId: string;
  type: 'percent' | 'fixed';
  value: string;
}

const cadenceLabels = {
  Annual: 'Annual',
  Term: 'Term',
  Monthly: 'Monthly',
} as const;
const siblingDiscountCode = 'sibling';

type BillableStudent = BillableFamily['students'][number];
type StudentYearSummary = BillableFamily['yearSummary']['children'][number];

function studentYearSummary(
  family: BillableFamily | undefined,
  studentId: string | null,
): StudentYearSummary | null {
  if (!family || !studentId) return null;
  return family.yearSummary.children.find((child) => child.studentId === studentId) ?? null;
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

function parsePercentBps(value: string): number | null {
  const normalized = value.trim().replace(/%/gu, '');
  if (!/^[0-9]+(?:\.[0-9]{1,2})?$/u.test(normalized)) return null;
  const percent = Number(normalized);
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) return null;
  return Math.round(percent * 100);
}

function cadenceAmount(config: FeeConfig, cadence: CreateInvoiceInput['billingCadence']): number {
  if (cadence === 'Annual') return config.annualAmountPence;
  if (cadence === 'Term') return config.termAmountPence;
  return config.monthlyAmountPence;
}

function defaultAmountForStudent({
  cadence,
  family,
  fallbackAmountPence,
  student,
}: {
  cadence: CreateInvoiceInput['billingCadence'];
  family: BillableFamily | undefined;
  fallbackAmountPence: number;
  student: BillableStudent;
}): number {
  const summary = studentYearSummary(family, student.id);
  if (!summary) return fallbackAmountPence;
  if (cadence === 'Annual') return summary.leftToInvoiceAmountPence;
  if (summary.leftToInvoiceAmountPence <= 0) return 0;
  return Math.min(fallbackAmountPence, summary.leftToInvoiceAmountPence);
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
  const date = new Date(`${issuedOn}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + 14);
  return date.toISOString().slice(0, 10);
}

function defaultTerm(issuedOn: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
    .format(new Date(`${issuedOn}T00:00:00.000Z`))
    .toUpperCase();
}

function defaultLineFormForStudent(
  student: BillableStudent,
  amountPence: number,
  cadence: CreateInvoiceInput['billingCadence'],
  family?: BillableFamily,
): LineForm {
  return {
    studentId: student.id,
    description: `${cadenceLabels[cadence]} school fee - ${student.fullName}`,
    quantity: '1',
    unitAmount: penceToPoundsInput(
      defaultAmountForStudent({
        cadence,
        family,
        fallbackAmountPence: amountPence,
        student,
      }),
    ),
  };
}

function lineFormsForStudents(
  family: BillableFamily | undefined,
  students: readonly BillableStudent[],
  amountPence: number,
  cadence: CreateInvoiceInput['billingCadence'],
): LineForm[] {
  if (students.length === 0) {
    return [
      {
        studentId: null,
        description: `${cadenceLabels[cadence]} school fee`,
        quantity: '1',
        unitAmount: penceToPoundsInput(amountPence),
      },
    ];
  }
  return students.map((student) =>
    defaultLineFormForStudent(student, amountPence, cadence, family),
  );
}

function isUntouchedPlaceholderLine(
  line: LineForm,
  amountPence: number,
  cadence: CreateInvoiceInput['billingCadence'],
): boolean {
  return (
    line.studentId === null &&
    line.description === `${cadenceLabels[cadence]} school fee` &&
    line.quantity === '1' &&
    parsePenceInput(line.unitAmount) === amountPence
  );
}

function selectedStudentsForFamily(
  family: BillableFamily | undefined,
  studentIds: readonly string[],
): BillableStudent[] {
  return studentIds
    .map((studentId) => family?.students.find((student) => student.id === studentId))
    .filter((student): student is BillableStudent => Boolean(student));
}

function manualDiscountPresetCode(
  discount: ManualDiscountForm,
  selectedStudents: readonly BillableStudent[],
): string | null {
  if (!discount.studentId) return null;
  const childIndex = selectedStudents.findIndex((student) => student.id === discount.studentId);
  return childIndex >= 0 ? schoolFeeDiscountChildIndexPresetCode(childIndex) : null;
}

function lineFormsForSelectedStudents(
  current: readonly LineForm[],
  family: BillableFamily | undefined,
  studentIds: readonly string[],
  amountPence: number,
  cadence: CreateInvoiceInput['billingCadence'],
): LineForm[] {
  const childLines = selectedStudentsForFamily(family, studentIds).map(
    (student) =>
      current.find((line) => line.studentId === student.id) ??
      defaultLineFormForStudent(student, amountPence, cadence, family),
  );
  const manualLines = current.filter(
    (line) =>
      line.studentId === null &&
      (childLines.length === 0 || !isUntouchedPlaceholderLine(line, amountPence, cadence)),
  );
  return [...childLines, ...manualLines];
}

function parsedLineItemsForForms(lines: readonly LineForm[]) {
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
    .filter(
      (line): line is { description: string; quantity: number; unitAmountPence: number } =>
        line !== null,
    );
}

function discountInputsForForm({
  manualDiscounts,
  presets,
  selectedPresetCodes,
  selectedStudents,
}: {
  manualDiscounts: readonly ManualDiscountForm[];
  presets: readonly DiscountPreset[];
  selectedPresetCodes: readonly string[];
  selectedStudents: readonly BillableStudent[];
}): SchoolFeeDiscountInput[] {
  const studentCount = selectedStudents.length;
  const presetCodes =
    studentCount <= 1
      ? selectedPresetCodes.filter((code) => code !== siblingDiscountCode)
      : selectedPresetCodes;
  const presetDiscounts: SchoolFeeDiscountInput[] = [];
  presetCodes.forEach((code) => {
    const preset = presets.find((candidate) => candidate.code === code);
    if (preset) {
      presetDiscounts.push({
        label: preset.label,
        kind: 'Preset' as const,
        presetCode: preset.code,
        percentBps: preset.percentBps,
        amountPence: null,
      });
    }
  });

  const manual: SchoolFeeDiscountInput[] = [];
  manualDiscounts.forEach((discount) => {
    if (!discount.label.trim()) return;
    const presetCode = manualDiscountPresetCode(discount, selectedStudents);
    if (discount.type === 'percent') {
      const percentBps = parsePercentBps(discount.value);
      if (percentBps !== null) {
        manual.push({
          label: discount.label.trim(),
          kind: 'ManualPercent',
          presetCode,
          percentBps,
          amountPence: null,
        });
      }
      return;
    }

    const amountPence = parsePenceInput(discount.value);
    if (amountPence !== null) {
      manual.push({
        label: discount.label.trim(),
        kind: 'ManualFixed',
        presetCode,
        percentBps: null,
        amountPence,
      });
    }
  });
  return [...presetDiscounts, ...manual];
}

function familyKeyForInvoice(
  families: readonly BillableFamily[],
  invoice: InvoiceDto | undefined,
): string {
  if (!invoice) return '';
  const invoiceStudentIds = invoice.students.map((student) => student.id);
  if (invoiceStudentIds.length === 0) return '';
  const family = families.find((candidate) =>
    invoiceStudentIds.every((studentId) =>
      candidate.students.some((student) => student.id === studentId),
    ),
  );
  return family?.familyKey ?? '';
}

function lineFormsForInvoice(invoice: InvoiceDto | undefined): LineForm[] {
  if (!invoice) return [];
  return invoice.lineItems.map((line, index) => ({
    studentId: invoice.students[index]?.id ?? null,
    description: line.description,
    quantity: String(line.quantity),
    unitAmount: penceToPoundsInput(line.unitAmountPence),
  }));
}

function selectedPresetCodesForInvoice(
  invoice: InvoiceDto | undefined,
  presets: readonly DiscountPreset[],
): string[] {
  if (!invoice) return [];
  const presetCodes = new Set<string>(presets.map((preset) => preset.code));
  return invoice.discounts
    .filter(
      (discount) =>
        !discount.optedOut &&
        discount.kind === 'Preset' &&
        discount.presetCode &&
        presetCodes.has(discount.presetCode),
    )
    .map((discount) => discount.presetCode)
    .filter((code): code is string => code !== null);
}

function childIndexFromPresetCode(presetCode: string | null): number | null {
  if (!presetCode?.startsWith(SCHOOL_FEE_DISCOUNT_CHILD_INDEX_PREFIX)) return null;
  const rawIndex = presetCode.slice(SCHOOL_FEE_DISCOUNT_CHILD_INDEX_PREFIX.length);
  if (!/^[0-9]+$/u.test(rawIndex)) return null;
  return Number(rawIndex);
}

function manualDiscountFormsForInvoice(
  invoice: InvoiceDto | undefined,
  presets: readonly DiscountPreset[],
): ManualDiscountForm[] {
  if (!invoice) return [];
  const presetCodes = new Set<string>(presets.map((preset) => preset.code));
  return invoice.discounts
    .filter(
      (discount) =>
        !(
          discount.kind === 'Preset' &&
          discount.presetCode &&
          presetCodes.has(discount.presetCode)
        ),
    )
    .map((discount) => {
      const childIndex = childIndexFromPresetCode(discount.presetCode);
      return {
        id: discount.id,
        label: discount.label,
        studentId: childIndex === null ? '' : (invoice.students[childIndex]?.id ?? ''),
        type: discount.kind === 'ManualFixed' ? ('fixed' as const) : ('percent' as const),
        value:
          discount.kind === 'ManualFixed'
            ? penceToPoundsInput(discount.amountPence ?? 0)
            : String((discount.percentBps ?? 0) / 100),
      };
    });
}

function FamilyYearSummary({
  currentSubtotalPence,
  family,
}: {
  currentSubtotalPence: number;
  family: BillableFamily;
}) {
  const summary = family.yearSummary;
  const overInvoiceAmountPence = Math.max(
    currentSubtotalPence - summary.leftToInvoiceAmountPence,
    0,
  );

  return (
    <section aria-label={`${family.familyLabel} fee summary`} className="invoice-family-summary">
      <div>
        <span>{summary.cycleLabel}</span>
        <strong>{formatPence(summary.adjustedAnnualAmountPence)}</strong>
      </div>
      <div>
        <span>Confirmed paid</span>
        <strong>{formatPence(summary.paidAmountPence)}</strong>
      </div>
      <div>
        <span>Already invoiced</span>
        <strong>{formatPence(summary.issuedAmountPence)}</strong>
      </div>
      <div>
        <span>Left to pay</span>
        <strong>{formatPence(summary.remainingAmountPence)}</strong>
      </div>
      <div>
        <span>Left to invoice</span>
        <strong>{formatPence(summary.leftToInvoiceAmountPence)}</strong>
      </div>
      {summary.paymentPendingAmountPence > 0 ? (
        <p>Payment pending confirmation: {formatPence(summary.paymentPendingAmountPence)}</p>
      ) : null}
      {summary.children.length > 0 ? (
        <div className="invoice-family-summary__children">
          {summary.children.map((child) => (
            <div className="invoice-family-summary__child" key={child.studentId}>
              <strong>{child.studentName}</strong>
              <small>
                {child.chargeableMonths} months - {formatPence(child.remainingAmountPence)} left to
                pay
              </small>
              <small>{formatPence(child.leftToInvoiceAmountPence)} left to invoice</small>
            </div>
          ))}
        </div>
      ) : null}
      {overInvoiceAmountPence > 0 ? (
        <p className="invoice-family-summary__warning">
          Draft subtotal before discounts is {formatPence(overInvoiceAmountPence)} above the amount
          left to invoice.
        </p>
      ) : null}
    </section>
  );
}

function AdminInvoiceFormModal({
  families,
  feeConfig,
  initialInvoice,
  mode,
  presets,
  onClose,
  onSubmit,
  pending,
  serverError,
}: {
  families: readonly BillableFamily[];
  feeConfig: FeeConfig;
  initialInvoice?: InvoiceDto;
  mode: 'create' | 'edit';
  presets: readonly DiscountPreset[];
  onClose: () => void;
  onSubmit: (input: CreateInvoiceInput) => void;
  pending: boolean;
  serverError?: string | null;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const initialIssuedOn = initialInvoice?.issuedOn ?? today;
  const [familyKey, setFamilyKey] = useState(familyKeyForInvoice(families, initialInvoice));
  const [familyLabel, setFamilyLabel] = useState(initialInvoice?.familyLabel ?? '');
  const [schoolYear, setSchoolYear] = useState(
    String(initialInvoice?.schoolYear ?? feeConfig.schoolYear),
  );
  const [billingCadence, setBillingCadence] = useState<CreateInvoiceInput['billingCadence']>(
    initialInvoice?.billingCadence ?? 'Monthly',
  );
  const [invoiceNumber, setInvoiceNumber] = useState(
    initialInvoice?.invoiceNumber ?? defaultInvoiceNumber(),
  );
  const [issuedOn, setIssuedOn] = useState(initialIssuedOn);
  const [dueOn, setDueOn] = useState(initialInvoice?.dueOn ?? defaultDueDate(initialIssuedOn));
  const [term, setTerm] = useState(initialInvoice?.term ?? defaultTerm(initialIssuedOn));
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>(
    initialInvoice?.students.map((student) => student.id) ?? [],
  );
  const [lineItems, setLineItems] = useState<LineForm[]>(lineFormsForInvoice(initialInvoice));
  const [selectedPresetCodes, setSelectedPresetCodes] = useState<string[]>(
    selectedPresetCodesForInvoice(initialInvoice, presets),
  );
  const [manualDiscounts, setManualDiscounts] = useState<ManualDiscountForm[]>(
    manualDiscountFormsForInvoice(initialInvoice, presets),
  );
  const [discountExplanation, setDiscountExplanation] = useState(
    initialInvoice?.discountExplanation ?? SCHOOL_FEE_DISCOUNT_EXPLANATION,
  );
  const [error, setError] = useState<string | null>(null);
  const familyEffectReady = useRef(false);
  const billingDefaults = useRef({ amountPence: 0, cadence: billingCadence });
  const isEdit = mode === 'edit';

  const selectedFamily = useMemo(
    () => families.find((family) => family.familyKey === familyKey),
    [families, familyKey],
  );
  const selectedFormStudents = useMemo(
    () => selectedStudentsForFamily(selectedFamily, selectedStudentIds),
    [selectedFamily, selectedStudentIds],
  );
  const baseAmountPence = cadenceAmount(feeConfig, billingCadence);
  const subtotal = useMemo(
    () =>
      lineItems.reduce((sum, line) => {
        const amount = parsePenceInput(line.unitAmount);
        const quantity = Number(line.quantity);
        return amount === null || !Number.isInteger(quantity) ? sum : sum + amount * quantity;
      }, 0),
    [lineItems],
  );
  const discountBreakdownPreview = useMemo(() => {
    if (!selectedFamily || selectedStudentIds.length === 0) return [];
    const previewLines = parsedLineItemsForForms(
      lineFormsForSelectedStudents(
        lineItems,
        selectedFamily,
        selectedStudentIds,
        baseAmountPence,
        billingCadence,
      ),
    );
    if (previewLines.length < selectedStudentIds.length) return [];
    const discounts = discountInputsForForm({
      manualDiscounts,
      presets,
      selectedPresetCodes,
      selectedStudents: selectedFormStudents,
    });
    if (discounts.length === 0) return [];
    const childLineAmountsPence = previewLines
      .slice(0, selectedStudentIds.length)
      .map((line) => line.quantity * line.unitAmountPence);
    try {
      return calculateSchoolFeeFamilyDiscounts({
        subtotalAmountPence: previewLines.reduce(
          (sum, line) => sum + line.quantity * line.unitAmountPence,
          0,
        ),
        studentCount: selectedStudentIds.length,
        childLineAmountsPence,
        discounts,
      }).childBreakdowns;
    } catch {
      return [];
    }
  }, [
    baseAmountPence,
    billingCadence,
    lineItems,
    manualDiscounts,
    presets,
    selectedFamily,
    selectedFormStudents,
    selectedPresetCodes,
    selectedStudentIds,
  ]);
  const canSubmit = Boolean(selectedFamily && selectedStudentIds.length > 0 && familyLabel.trim());
  billingDefaults.current = { amountPence: baseAmountPence, cadence: billingCadence };

  useEffect(() => {
    if (!familyEffectReady.current) {
      familyEffectReady.current = true;
      return;
    }
    if (!familyKey) {
      setFamilyLabel('');
      setSelectedStudentIds([]);
      setLineItems([]);
      setSelectedPresetCodes([]);
      setManualDiscounts([]);
      return;
    }
    if (!selectedFamily) {
      setFamilyLabel('');
      setSelectedStudentIds([]);
      setLineItems([]);
      setSelectedPresetCodes([]);
      setManualDiscounts([]);
      return;
    }
    setFamilyLabel(selectedFamily.familyLabel);
    setSelectedStudentIds(selectedFamily.students.map((student) => student.id));
    const defaults = billingDefaults.current;
    setLineItems(
      lineFormsForStudents(
        selectedFamily,
        selectedFamily.students,
        defaults.amountPence,
        defaults.cadence,
      ),
    );
    if (selectedFamily.students.length <= 1) {
      setSelectedPresetCodes((current) => current.filter((code) => code !== siblingDiscountCode));
    }
  }, [familyKey, selectedFamily]);

  useEffect(() => {
    setManualDiscounts((current) => {
      const fallbackStudentId = selectedStudentIds[0] ?? '';
      const hasStaleStudent = current.some(
        (discount) => discount.studentId && !selectedStudentIds.includes(discount.studentId),
      );
      if (!hasStaleStudent) return current;
      return current.map((discount) => {
        if (!discount.studentId || selectedStudentIds.includes(discount.studentId)) return discount;
        return { ...discount, studentId: fallbackStudentId };
      });
    });
  }, [selectedStudentIds]);

  function updateSelectedStudent(studentId: string, checked: boolean) {
    const nextStudentIds = checked
      ? [...new Set([...selectedStudentIds, studentId])]
      : selectedStudentIds.filter((candidate) => candidate !== studentId);
    setSelectedStudentIds(nextStudentIds);
    setLineItems((current) =>
      lineFormsForSelectedStudents(
        current,
        selectedFamily,
        nextStudentIds,
        baseAmountPence,
        billingCadence,
      ),
    );
    if (nextStudentIds.length <= 1) {
      setSelectedPresetCodes((current) => current.filter((code) => code !== siblingDiscountCode));
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
    const selectedStudents = selectedStudentsForFamily(selectedFamily, selectedStudentIds);
    const submitLineItems = lineFormsForSelectedStudents(
      lineItems,
      selectedFamily,
      selectedStudentIds,
      baseAmountPence,
      billingCadence,
    );
    const parsedLines = submitLineItems.map((line) => {
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
    });
    if (parsedLines.some((line) => line === null)) {
      setError('Each line needs a description, quantity, and amount.');
      return;
    }
    const validLineItems = parsedLines.filter(
      (line): line is { description: string; quantity: number; unitAmountPence: number } =>
        line !== null,
    );
    if (validLineItems.length < selectedStudentIds.length) {
      setError('Generated invoices need one line item per child.');
      return;
    }
    const selectedDiscountPresetCodes =
      selectedStudentIds.length <= 1
        ? selectedPresetCodes.filter((code) => code !== siblingDiscountCode)
        : selectedPresetCodes;
    const discounts = selectedDiscountPresetCodes.map((code) => {
      const preset = presets.find((candidate) => candidate.code === code);
      if (!preset) return null;
      return {
        label: preset.label,
        kind: 'Preset' as const,
        presetCode: preset.code,
        percentBps: preset.percentBps,
        amountPence: null,
      };
    });
    const manual = manualDiscounts.map((discount) => {
      if (!discount.label.trim()) return null;
      if (!discount.studentId) return null;
      if (
        discount.studentId &&
        !selectedStudents.some((student) => student.id === discount.studentId)
      )
        return null;
      const presetCode = manualDiscountPresetCode(discount, selectedStudents);
      if (discount.type === 'percent') {
        const percentBps = parsePercentBps(discount.value);
        return percentBps === null
          ? null
          : {
              label: discount.label.trim(),
              kind: 'ManualPercent' as const,
              presetCode,
              percentBps,
              amountPence: null,
            };
      }
      const amountPence = parsePenceInput(discount.value);
      return amountPence === null
        ? null
        : {
            label: discount.label.trim(),
            kind: 'ManualFixed' as const,
            presetCode,
            percentBps: null,
            amountPence,
          };
    });
    if ([...discounts, ...manual].some((discount) => discount === null)) {
      setError('Discounts need a label, child, and valid percentage or amount.');
      return;
    }
    if (!discountExplanation.trim()) {
      setError('Discount explanation is required.');
      return;
    }
    setError(null);
    onSubmit({
      schoolYear: year,
      billingCadence,
      studentIds: selectedStudentIds,
      familyLabel: familyLabel.trim() || selectedFamily.familyLabel,
      invoiceNumber: invoiceNumber.trim(),
      issuedOn,
      dueOn,
      term: term.trim() || null,
      lineItems: validLineItems,
      discounts: [...discounts, ...manual].filter(
        (discount): discount is NonNullable<(typeof discounts)[number] | (typeof manual)[number]> =>
          discount !== null,
      ),
      discountExplanation: discountExplanation.trim(),
    });
  }

  return (
    <div aria-modal="true" className="invoice-modal invoice-modal--wide" role="dialog">
      <button
        aria-label={isEdit ? 'Close invoice editor' : 'Close invoice creator'}
        className="invoice-modal__backdrop"
        onClick={onClose}
        type="button"
      />
      <form className="invoice-modal__panel" onSubmit={submit}>
        <header className="invoice-modal__header invoice-modal__header--navy">
          <span>
            <ReceiptText aria-hidden="true" size={19} />
          </span>
          <div>
            <p>{isEdit ? 'Edit Invoice' : 'Create Invoice'}</p>
            <h2>{isEdit ? 'Update learning centre fees' : 'Compose learning centre fees'}</h2>
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
                    const nextCadence = event.target.value as CreateInvoiceInput['billingCadence'];
                    const nextAmountPence = cadenceAmount(feeConfig, nextCadence);
                    setBillingCadence(nextCadence);
                    setLineItems((current) =>
                      lineFormsForSelectedStudents(
                        current,
                        selectedFamily,
                        selectedStudentIds,
                        nextAmountPence,
                        nextCadence,
                      ),
                    );
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
              <Field label="Issued" required>
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
                  setError(null);
                  setFamilyKey(event.target.value);
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
                onChange={(event) => {
                  setFamilyLabel(event.target.value);
                }}
                disabled={!selectedFamily}
                value={familyLabel}
              />
            </Field>
            <div className="invoice-child-list">
              {selectedFamily?.students.map((student) => {
                const summary = studentYearSummary(selectedFamily, student.id);
                return (
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
                      <small>
                        {student.yearGroup}
                        {summary
                          ? ` - ${String(summary.chargeableMonths)} months - ${formatPence(
                              summary.remainingAmountPence,
                            )} left to pay - ${formatPence(
                              summary.leftToInvoiceAmountPence,
                            )} left to invoice`
                          : ''}
                      </small>
                    </span>
                  </label>
                );
              })}
            </div>
            {selectedFamily ? (
              <FamilyYearSummary currentSubtotalPence={subtotal} family={selectedFamily} />
            ) : null}
          </section>

          <section className="invoice-create-section invoice-create-section--wide">
            <div className="invoice-review-lines__header">
              <h3>Line items</h3>
              <Button
                disabled={!selectedFamily}
                onClick={() => {
                  setLineItems((current) => [
                    ...current,
                    {
                      studentId: null,
                      description: '',
                      quantity: '1',
                      unitAmount: penceToPoundsInput(baseAmountPence),
                    },
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
            {lineItems.map((line, index) => {
              const breakdown = discountBreakdownPreview.find(
                (candidate) => candidate.childIndex === index,
              );
              const appliedDiscounts =
                breakdown?.discounts.filter((discount) => discount.appliedAmountPence > 0) ?? [];
              return (
                <div
                  className="invoice-review-line-group"
                  key={`${line.description}-${String(index)}`}
                >
                  <div className="invoice-review-line">
                    <TextInput
                      aria-label="Line item description"
                      onChange={(event) => {
                        setLineItems((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, description: event.target.value }
                              : item,
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
                            itemIndex === index
                              ? { ...item, unitAmount: event.target.value }
                              : item,
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
                  {breakdown && appliedDiscounts.length > 0 ? (
                    <div className="invoice-review-line-discounts">
                      {appliedDiscounts.map((discount) => (
                        <span key={`${discount.label}-${String(index)}`}>
                          {discount.label}{' '}
                          <strong>-{formatPence(discount.appliedAmountPence)}</strong>
                        </span>
                      ))}
                      <span>
                        Net for child <strong>{formatPence(breakdown.totalAmountPence)}</strong>
                      </span>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </section>

          <section className="invoice-create-section invoice-create-section--wide">
            <h3>Discounts</h3>
            <div className="invoice-preset-grid">
              {presets.map((preset) => {
                const presetDisabled =
                  !selectedFamily ||
                  (preset.code === siblingDiscountCode && selectedStudentIds.length <= 1);
                return (
                  <label key={preset.code}>
                    <input
                      checked={!presetDisabled && selectedPresetCodes.includes(preset.code)}
                      disabled={presetDisabled}
                      onChange={(event) => {
                        if (presetDisabled) return;
                        setSelectedPresetCodes((current) =>
                          event.target.checked
                            ? [...new Set([...current, preset.code])]
                            : current.filter((code) => code !== preset.code),
                        );
                      }}
                      type="checkbox"
                    />
                    <span>
                      <strong>{preset.label}</strong>
                      <small>
                        {preset.code === siblingDiscountCode
                          ? '25% on additional children'
                          : `${String(preset.percentBps / 100)}%`}
                      </small>
                    </span>
                  </label>
                );
              })}
            </div>
            <Field label="Discount explanation" required>
              <textarea
                className="input invoice-discount-explanation"
                onChange={(event) => {
                  setDiscountExplanation(event.target.value);
                }}
                rows={5}
                value={discountExplanation}
              />
            </Field>
            {manualDiscounts.map((discount) => (
              <div className="invoice-manual-discount" key={discount.id}>
                <TextInput
                  aria-label="Manual discount label"
                  onChange={(event) => {
                    setManualDiscounts((current) =>
                      current.map((item) =>
                        item.id === discount.id ? { ...item, label: event.target.value } : item,
                      ),
                    );
                  }}
                  placeholder="Manual discount label"
                  value={discount.label}
                />
                <SelectInput
                  aria-label="Apply manual discount to"
                  disabled={selectedFormStudents.length === 0}
                  onChange={(event) => {
                    setManualDiscounts((current) =>
                      current.map((item) =>
                        item.id === discount.id ? { ...item, studentId: event.target.value } : item,
                      ),
                    );
                  }}
                  value={discount.studentId}
                >
                  <option disabled value="">
                    Select child
                  </option>
                  {selectedFormStudents.map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.fullName}
                    </option>
                  ))}
                </SelectInput>
                <SelectInput
                  aria-label="Manual discount type"
                  onChange={(event) => {
                    setManualDiscounts((current) =>
                      current.map((item) =>
                        item.id === discount.id
                          ? { ...item, type: event.target.value as ManualDiscountForm['type'] }
                          : item,
                      ),
                    );
                  }}
                  value={discount.type}
                >
                  <option value="percent">Percent</option>
                  <option value="fixed">Fixed amount</option>
                </SelectInput>
                <TextInput
                  aria-label="Manual discount value"
                  inputMode="decimal"
                  onChange={(event) => {
                    setManualDiscounts((current) =>
                      current.map((item) =>
                        item.id === discount.id ? { ...item, value: event.target.value } : item,
                      ),
                    );
                  }}
                  placeholder={discount.type === 'percent' ? '10' : '25.00'}
                  value={discount.value}
                />
                <button
                  aria-label="Remove manual discount"
                  onClick={() => {
                    setManualDiscounts((current) =>
                      current.filter((item) => item.id !== discount.id),
                    );
                  }}
                  type="button"
                >
                  <X aria-hidden="true" size={16} />
                </button>
              </div>
            ))}
            <Button
              disabled={!selectedFamily}
              onClick={() => {
                setManualDiscounts((current) => [
                  ...current,
                  {
                    id: `manual-${String(Date.now())}`,
                    label: '',
                    studentId: selectedStudentIds[0] ?? '',
                    type: 'percent',
                    value: '',
                  },
                ]);
              }}
              size="sm"
              type="button"
              variant="secondary"
            >
              <Plus aria-hidden="true" size={14} />
              Add manual discount
            </Button>
          </section>
        </div>

        {error || serverError ? (
          <p className="invoice-form-error invoice-form-error--modal">{error ?? serverError}</p>
        ) : null}
        <footer className="invoice-modal__footer">
          <span className="invoice-create-subtotal">Subtotal {formatPence(subtotal)}</span>
          <Button onClick={onClose} type="button" variant="ghost">
            Cancel
          </Button>
          <Button disabled={!canSubmit} pending={pending} type="submit">
            {isEdit ? 'Update PDF invoice' : 'Generate PDF invoice'}
          </Button>
        </footer>
      </form>
    </div>
  );
}

export function AdminInvoiceCreateModal(
  props: Omit<Parameters<typeof AdminInvoiceFormModal>[0], 'initialInvoice' | 'mode'>,
) {
  return <AdminInvoiceFormModal {...props} mode="create" />;
}

export function AdminInvoiceEditModal(
  props: Omit<Parameters<typeof AdminInvoiceFormModal>[0], 'mode'> & {
    initialInvoice: InvoiceDto;
  },
) {
  return <AdminInvoiceFormModal {...props} mode="edit" />;
}
