import { canUseLinkedChildGuardianAccess, type SessionUser } from './rbac.js';

export const SCHOOL_FEE_INVOICE_STATUSES = ['Draft', 'Unpaid', 'PaymentPending', 'Paid'] as const;
export type SchoolFeeInvoiceStatus = (typeof SCHOOL_FEE_INVOICE_STATUSES)[number];
export type SchoolFeeInvoiceDisplayStatus = SchoolFeeInvoiceStatus | 'Overdue';
export const SCHOOL_FEE_BILLING_CADENCES = ['Annual', 'Term', 'Monthly'] as const;
export type SchoolFeeBillingCadence = (typeof SCHOOL_FEE_BILLING_CADENCES)[number];
export const SCHOOL_FEE_DISCOUNT_KINDS = ['Preset', 'ManualPercent', 'ManualFixed'] as const;
export type SchoolFeeDiscountKind = (typeof SCHOOL_FEE_DISCOUNT_KINDS)[number];

export const SCHOOL_FEE_DISCOUNT_EXPLANATION =
  'Our discount structure is designed to be both fair and generous. If you qualify for any of the discounts, such as being a church leader, Oasis Supervisor, volunteer, Fountain church member, or enrolling sibling discount - that discount will be applied in full. If your family qualifies for multiple discounts, we apply the largest discount in full. Only one discount will be applied per child. Sibling discount will only be applied on one of the children. This approach ensures meaningful support for engaged families while keeping the learning centre sustainable for all.';

export const SCHOOL_FEE_SIBLING_DISCOUNT_CODE = 'sibling';
export const SCHOOL_FEE_DISCOUNT_CHILD_INDEX_PREFIX = 'child-index:';
export const SCHOOL_FEE_MAX_DISCOUNTS_PER_FAMILY = 3;
export const SCHOOL_FEE_MAX_DISCOUNTED_CHILDREN = 3;

export const SCHOOL_FEE_DISCOUNT_PRESETS = [
  { code: SCHOOL_FEE_SIBLING_DISCOUNT_CODE, label: 'Sibling discount', percentBps: 2500 },
  { code: 'church-leader', label: 'Church Leaders / Oasis Supervisors', percentBps: 2000 },
  {
    code: 'volunteer-tither',
    label: 'Fountain Church Volunteers / Oasis Parent Volunteers / Tithers',
    percentBps: 1500,
  },
  { code: 'church-member', label: 'Fountain Church Member', percentBps: 1000 },
] as const;

export function canUseLinkedChildInvoiceAccess(user: Pick<SessionUser, 'role'>): boolean {
  return canUseLinkedChildGuardianAccess(user);
}

export interface SchoolFeeYearFeeConfigInput {
  annualAmountPence: number;
  termAmountPence: number;
  monthlyAmountPence: number;
}

export interface SchoolFeeBillingCycle {
  schoolYear: number;
  startsOn: string;
  endsOn: string;
  label: string;
}

export interface SchoolFeeChargeablePeriod {
  schoolYear: number;
  cycleStartsOn: string;
  cycleEndsOn: string;
  chargeableStartsOn: string | null;
  chargeableEndsOn: string | null;
  chargeableMonths: number;
}

export interface SchoolFeeStudentProrationInput {
  studentId: string;
  enrolmentDate: Date | string;
}

export interface SchoolFeeStudentProratedFee {
  studentId: string;
  enrolmentDate: string;
  annualAmountPence: number;
  proratedAnnualAmountPence: number;
  chargeablePeriod: SchoolFeeChargeablePeriod;
}

export interface SchoolFeeInvoiceLineInput {
  description: string;
  quantity: number;
  unitAmountPence: number;
}

export interface SchoolFeeDiscountInput {
  label: string;
  kind: SchoolFeeDiscountKind;
  presetCode?: string | null;
  percentBps: number | null;
  amountPence: number | null;
  optedOut?: boolean;
}

export type ParsedSchoolFeeInvoiceDiscount = SchoolFeeDiscountInput;

export interface SchoolFeeAppliedDiscount extends SchoolFeeDiscountInput {
  baseAmountPence: number;
  appliedAmountPence: number;
}

export interface SchoolFeeChildDiscountBreakdown {
  childIndex: number;
  lineAmountPence: number;
  discountAmountPence: number;
  totalAmountPence: number;
  discounts: SchoolFeeAppliedDiscount[];
}

export interface SchoolFeeDiscountCalculation {
  discounts: SchoolFeeAppliedDiscount[];
  discountAmountPence: number;
  totalAmountPence: number;
  childBreakdowns: SchoolFeeChildDiscountBreakdown[];
}

export interface SchoolFeeFamilyDiscountInput {
  subtotalAmountPence: number;
  studentCount: number;
  childLineAmountsPence: readonly number[];
  discounts: readonly SchoolFeeDiscountInput[];
}

export interface ParsedSchoolFeeInvoice {
  invoiceNumber: string | null;
  familyLabel: string | null;
  issuedOn: string | null;
  dueOn: string | null;
  term: string | null;
  lineItems: SchoolFeeInvoiceLineInput[];
  discounts: ParsedSchoolFeeInvoiceDiscount[];
  totalAmountPence: number | null;
}

const moneyPattern = /(?:£\s*)?([0-9][0-9,]*(?:\.[0-9]{2})?)/u;
const issuedDateLabels = ['issued', 'invoice date', 'date'] as const;
const dueDateLabels = ['due date', 'payment due', 'due'] as const;
const invoiceMetadataWordsPattern =
  /\b(invoice|child|fee|discount|amount|total|payment|reference|frequency)\b/iu;
const monthNumbers: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

export function lineItemTotalPence(input: SchoolFeeInvoiceLineInput): number {
  if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
    throw new Error('invoice line quantity must be a positive integer');
  }
  if (!Number.isInteger(input.unitAmountPence) || input.unitAmountPence < 0) {
    throw new Error('invoice line unit amount must be a non-negative integer');
  }
  return input.quantity * input.unitAmountPence;
}

export function invoiceTotalPence(lines: readonly SchoolFeeInvoiceLineInput[]): number {
  if (lines.length === 0) {
    throw new Error('invoice must contain at least one line item');
  }
  return lines.reduce((sum, line) => sum + lineItemTotalPence(line), 0);
}

export function schoolFeeCadenceAmountPence(
  config: SchoolFeeYearFeeConfigInput,
  cadence: SchoolFeeBillingCadence,
): number {
  if (cadence === 'Annual') return config.annualAmountPence;
  if (cadence === 'Term') return config.termAmountPence;
  return config.monthlyAmountPence;
}

export function schoolFeeBillingCycle(schoolYear: number): SchoolFeeBillingCycle {
  if (!Number.isInteger(schoolYear) || schoolYear < 2020 || schoolYear > 2100) {
    throw new Error('school year must be a valid cycle end year');
  }
  const startYear = schoolYear - 1;
  return {
    schoolYear,
    startsOn: `${String(startYear)}-09-01`,
    endsOn: `${String(schoolYear)}-08-31`,
    label: `Sep ${String(startYear)} - Aug ${String(schoolYear)}`,
  };
}

export function activeSchoolFeeYear(referenceDate: Date = new Date()): number {
  const month = referenceDate.getUTCMonth() + 1;
  return month >= 9 ? referenceDate.getUTCFullYear() + 1 : referenceDate.getUTCFullYear();
}

export function schoolFeeChargeablePeriod(
  schoolYear: number,
  enrolmentDate: Date | string,
): SchoolFeeChargeablePeriod {
  const cycle = schoolFeeBillingCycle(schoolYear);
  const enrolmentKey = dateKey(enrolmentDate);
  const cycleStart = parseDateKey(cycle.startsOn);
  const cycleEnd = parseDateKey(cycle.endsOn);
  const enrolmentMonthStart = monthStart(parseDateKey(enrolmentKey));
  const transitionStart =
    schoolYear === 2026 && enrolmentKey < '2026-02-01' ? parseDateKey('2026-02-01') : null;
  const start = maxDate(transitionStart ?? cycleStart, cycleStart, enrolmentMonthStart);

  if (start.getTime() > cycleEnd.getTime()) {
    return {
      schoolYear,
      cycleStartsOn: cycle.startsOn,
      cycleEndsOn: cycle.endsOn,
      chargeableStartsOn: null,
      chargeableEndsOn: null,
      chargeableMonths: 0,
    };
  }

  return {
    schoolYear,
    cycleStartsOn: cycle.startsOn,
    cycleEndsOn: cycle.endsOn,
    chargeableStartsOn: dateKey(start),
    chargeableEndsOn: cycle.endsOn,
    chargeableMonths: inclusiveMonthCount(start, cycleEnd),
  };
}

export function schoolFeeProratedAnnualAmountPence(
  annualAmountPence: number,
  chargeableMonths: number,
): number {
  if (!Number.isInteger(annualAmountPence) || annualAmountPence < 0) {
    throw new Error('annual fee must be a non-negative integer');
  }
  if (!Number.isInteger(chargeableMonths) || chargeableMonths < 0 || chargeableMonths > 12) {
    throw new Error('chargeable months must be between 0 and 12');
  }
  return Math.round((annualAmountPence * chargeableMonths) / 12);
}

export function schoolFeeStudentProratedFees({
  schoolYear,
  annualAmountPence,
  students,
}: {
  schoolYear: number;
  annualAmountPence: number;
  students: readonly SchoolFeeStudentProrationInput[];
}): SchoolFeeStudentProratedFee[] {
  return students.map((student) => {
    const enrolmentDate = dateKey(student.enrolmentDate);
    const chargeablePeriod = schoolFeeChargeablePeriod(schoolYear, enrolmentDate);
    return {
      studentId: student.studentId,
      enrolmentDate,
      annualAmountPence,
      proratedAnnualAmountPence: schoolFeeProratedAnnualAmountPence(
        annualAmountPence,
        chargeablePeriod.chargeableMonths,
      ),
      chargeablePeriod,
    };
  });
}

export function schoolFeeDiscountChildIndexPresetCode(childIndex: number): string {
  if (!Number.isInteger(childIndex) || childIndex < 0) {
    throw new Error('discount child index must be a non-negative integer');
  }
  return `${SCHOOL_FEE_DISCOUNT_CHILD_INDEX_PREFIX}${String(childIndex)}`;
}

export function schoolFeeDiscountChildScopedPresetCode(
  childIndex: number,
  presetCode: string | null,
): string {
  const childScope = schoolFeeDiscountChildIndexPresetCode(childIndex);
  return presetCode ? `${childScope}|${presetCode}` : childScope;
}

export function calculateSchoolFeeDiscounts(
  subtotalAmountPence: number,
  discounts: readonly SchoolFeeDiscountInput[],
): SchoolFeeDiscountCalculation {
  if (!Number.isInteger(subtotalAmountPence) || subtotalAmountPence < 0) {
    throw new Error('invoice subtotal must be a non-negative integer');
  }

  const applied = discounts.map<SchoolFeeAppliedDiscount>((discount) => {
    const baseAmountPence = discount.optedOut
      ? 0
      : discountBaseAmountPence(subtotalAmountPence, discount);
    return { ...discount, baseAmountPence, appliedAmountPence: 0 };
  });

  const eligibleIndexes = applied
    .map((discount, index) => ({ discount, index }))
    .filter(({ discount }) => !discount.optedOut && discount.baseAmountPence > 0)
    .sort((left, right) => right.discount.baseAmountPence - left.discount.baseAmountPence)
    .slice(0, SCHOOL_FEE_MAX_DISCOUNTS_PER_FAMILY);

  let remaining = subtotalAmountPence;
  eligibleIndexes.forEach(({ discount, index }, order) => {
    if (remaining <= 0) return;
    const rawAmount =
      order === 0 ? discount.baseAmountPence : Math.round(discount.baseAmountPence * 0.25);
    const appliedAmountPence = Math.min(rawAmount, remaining);
    applied[index] = { ...discount, appliedAmountPence };
    remaining -= appliedAmountPence;
  });

  const discountAmountPence = subtotalAmountPence - remaining;
  return {
    discounts: applied,
    discountAmountPence,
    totalAmountPence: subtotalAmountPence - discountAmountPence,
    childBreakdowns: [],
  };
}

export function calculateSchoolFeeFamilyDiscounts({
  subtotalAmountPence,
  studentCount,
  childLineAmountsPence,
  discounts,
}: SchoolFeeFamilyDiscountInput): SchoolFeeDiscountCalculation {
  if (!Number.isInteger(subtotalAmountPence) || subtotalAmountPence < 0) {
    throw new Error('invoice subtotal must be a non-negative integer');
  }
  if (!Number.isInteger(studentCount) || studentCount <= 0) {
    throw new Error('invoice must contain at least one child');
  }
  if (childLineAmountsPence.length < studentCount) {
    throw new Error('generated invoices need one line item per child');
  }

  const hasSiblingDiscount = discounts.some(
    (discount) => isSiblingDiscount(discount) && !discount.optedOut,
  );
  if (studentCount === 1 && hasSiblingDiscount) {
    throw new Error('sibling discount requires at least two children');
  }
  assertUniqueDiscountsPerChild(discounts);

  const applied = discounts.map<SchoolFeeAppliedDiscount>((discount) => ({
    ...discount,
    baseAmountPence: 0,
    appliedAmountPence: 0,
  }));
  const childAmounts = childLineAmountsPence.slice(0, studentCount);
  const familyDiscountIndexes = familyEligibleDiscountIndexes(childAmounts, discounts);
  const childBreakdowns: SchoolFeeChildDiscountBreakdown[] = [];
  childAmounts.forEach((childAmountPence, childIndex) => {
    if (!Number.isInteger(childAmountPence) || childAmountPence < 0) {
      throw new Error('child line amount must be a non-negative integer');
    }
    const childDiscounts = discounts.map((discount, discountIndex) => {
      if (
        childIndex >= SCHOOL_FEE_MAX_DISCOUNTED_CHILDREN ||
        !familyDiscountIndexes.has(discountIndex) ||
        shouldSkipDiscountForChild(discount, childIndex)
      ) {
        return { ...discount, optedOut: true };
      }
      return discount;
    });
    const childCalculation = calculateSchoolFeeDiscounts(childAmountPence, childDiscounts);
    childBreakdowns.push({
      childIndex,
      lineAmountPence: childAmountPence,
      discountAmountPence: childCalculation.discountAmountPence,
      totalAmountPence: childCalculation.totalAmountPence,
      discounts: childCalculation.discounts,
    });
    childCalculation.discounts.forEach((discount, index) => {
      const existing = applied[index];
      if (!existing) return;
      applied[index] = {
        ...existing,
        baseAmountPence: existing.baseAmountPence + discount.baseAmountPence,
        appliedAmountPence: existing.appliedAmountPence + discount.appliedAmountPence,
      };
    });
  });

  const rawDiscountAmountPence = applied.reduce(
    (sum, discount) => sum + discount.appliedAmountPence,
    0,
  );
  const discountAmountPence = Math.min(rawDiscountAmountPence, subtotalAmountPence);
  return {
    discounts: applied,
    discountAmountPence,
    totalAmountPence: subtotalAmountPence - discountAmountPence,
    childBreakdowns,
  };
}

function assertUniqueDiscountsPerChild(discounts: readonly SchoolFeeDiscountInput[]): void {
  const seenChildren = new Set<number>();
  for (const discount of discounts) {
    if (discount.optedOut) continue;
    const childIndex = schoolFeeDiscountChildIndex(discount);
    if (childIndex === null) continue;
    if (seenChildren.has(childIndex)) {
      throw new Error('each child can only receive one discount');
    }
    seenChildren.add(childIndex);
  }
}

export function schoolFeeInvoiceDisplayStatus(
  status: SchoolFeeInvoiceStatus,
  dueOn: Date | string | null,
  now: Date = new Date(),
): SchoolFeeInvoiceDisplayStatus {
  if (status !== 'Unpaid' || !dueOn) return status;
  return dateKey(dueOn) < dateKey(now) ? 'Overdue' : 'Unpaid';
}

function discountBaseAmountPence(
  subtotalAmountPence: number,
  discount: SchoolFeeDiscountInput,
): number {
  if (discount.kind === 'ManualFixed') {
    const amountPence = discount.amountPence ?? 0;
    if (!Number.isInteger(amountPence) || amountPence < 0) {
      throw new Error('manual fixed discount amount must be a non-negative integer');
    }
    return Math.min(amountPence, subtotalAmountPence);
  }

  const percentBps = discount.percentBps ?? 0;
  if (!Number.isInteger(percentBps) || percentBps < 0 || percentBps > 10_000) {
    throw new Error('discount percentage must be between 0 and 100%');
  }
  return Math.round((subtotalAmountPence * percentBps) / 10_000);
}

function isSiblingDiscount(discount: SchoolFeeDiscountInput): boolean {
  return (
    discount.presetCode === SCHOOL_FEE_SIBLING_DISCOUNT_CODE ||
    discount.presetCode?.endsWith(`|${SCHOOL_FEE_SIBLING_DISCOUNT_CODE}`) === true
  );
}

function familyEligibleDiscountIndexes(
  childAmountsPence: readonly number[],
  discounts: readonly SchoolFeeDiscountInput[],
): Set<number> {
  const totals = discounts.map((discount, discountIndex) => {
    const baseAmountPence = childAmountsPence.reduce((sum, childAmountPence, childIndex) => {
      if (
        childIndex >= SCHOOL_FEE_MAX_DISCOUNTED_CHILDREN ||
        discount.optedOut ||
        shouldSkipDiscountForChild(discount, childIndex)
      ) {
        return sum;
      }
      return sum + discountBaseAmountPence(childAmountPence, discount);
    }, 0);
    return { discountIndex, baseAmountPence };
  });
  return new Set(
    totals
      .filter((total) => total.baseAmountPence > 0)
      .sort((left, right) => right.baseAmountPence - left.baseAmountPence)
      .slice(0, SCHOOL_FEE_MAX_DISCOUNTS_PER_FAMILY)
      .map((total) => total.discountIndex),
  );
}

function shouldSkipDiscountForChild(discount: SchoolFeeDiscountInput, childIndex: number): boolean {
  const childScopeIndex = schoolFeeDiscountChildIndex(discount);
  if (childScopeIndex !== null && childScopeIndex !== childIndex) return true;
  if (isSiblingDiscount(discount) && childIndex === 0) return true;
  return discount.kind === 'ManualFixed' && childScopeIndex === null && childIndex > 0;
}

function schoolFeeDiscountChildIndex(discount: SchoolFeeDiscountInput): number | null {
  const code = discount.presetCode;
  if (!code?.startsWith(SCHOOL_FEE_DISCOUNT_CHILD_INDEX_PREFIX)) return null;
  const rawIndex = code.slice(SCHOOL_FEE_DISCOUNT_CHILD_INDEX_PREFIX.length).split('|', 1)[0];
  if (!rawIndex || !/^[0-9]+$/u.test(rawIndex)) return null;
  const index = Number(rawIndex);
  return Number.isSafeInteger(index) ? index : null;
}

export function parseSchoolFeeInvoiceText(text: string): ParsedSchoolFeeInvoice {
  const compactText = text.replace(/\s+/gu, ' ').trim();
  const lines = text
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);
  const totalAmountPence = parseTotalAmountPence(lines, compactText);
  const { discounts, lineItems } = parseInvoiceRows(lines);
  const issuedOn = parseIssuedDate(compactText);
  const dueOn = parseDueDate(compactText, issuedOn);

  if (lineItems.length === 0 && totalAmountPence !== null) {
    lineItems.push({
      description: 'Imported invoice total',
      quantity: 1,
      unitAmountPence: totalAmountPence,
    });
  }

  return {
    invoiceNumber: parseInvoiceNumber(compactText),
    familyLabel: parseFamilyLabel(lines),
    issuedOn,
    dueOn,
    term: parseTerm(compactText),
    lineItems,
    discounts,
    totalAmountPence,
  };
}

function dateKey(value: Date | string): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/u.test(value)) return value;
  return new Date(value).toISOString().slice(0, 10);
}

function parseDateKey(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function monthStart(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1));
}

function maxDate(...values: Date[]): Date {
  return new Date(Math.max(...values.map((value) => value.getTime())));
}

function inclusiveMonthCount(start: Date, end: Date): number {
  return (
    (end.getUTCFullYear() - start.getUTCFullYear()) * 12 +
    end.getUTCMonth() -
    start.getUTCMonth() +
    1
  );
}

function parseMoneyPence(value: string): number | null {
  const match = moneyPattern.exec(value);
  if (!match) return null;
  const amountText = match[1];
  if (!amountText) return null;
  const normalized = amountText.replaceAll(',', '');
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.round(parsed * 100);
}

function parseInvoiceNumber(text: string): string | null {
  const labelled =
    /\b(?:invoice\s*(?:no\.?|number|#)\s*[:#-]?|invoice\s*[:#-]|inv\s*#\s*[:#-]?)\s*([A-Z0-9][A-Z0-9/-]{2,})\b/iu.exec(
      text,
    );
  if (labelled?.[1]) return labelled[1].toUpperCase();
  const standalone = /\bINV-[0-9]{4}-[0-9]{2,}\b/iu.exec(text);
  return standalone?.[0].toUpperCase() ?? null;
}

function parseIssuedDate(text: string): string | null {
  return parseDateAfterLabel(text, issuedDateLabels) ?? parseFirstDateValue(text);
}

function parseDueDate(text: string, issuedOn: string | null): string | null {
  const labelled = parseDateAfterLabel(text, dueDateLabels);
  if (labelled) return labelled;
  if (!issuedOn) return null;
  const withinDays = /\bwithin\s+([0-9]{1,2})\s+days\b/iu.exec(text);
  if (!withinDays?.[1]) return null;
  const days = Number(withinDays[1]);
  if (!Number.isInteger(days) || days <= 0 || days > 60) return null;
  const date = parseDateKey(issuedOn);
  date.setUTCDate(date.getUTCDate() + days);
  return dateKey(date);
}

function parseDateAfterLabel(text: string, labels: readonly string[]): string | null {
  for (const label of labels) {
    const escaped = label.replaceAll(' ', '\\s+');
    const match = new RegExp(
      `\\b${escaped}\\b\\s*[:\\-]?\\s*([0-9]{4}-[0-9]{2}-[0-9]{2}|[0-9]{1,2}[\\s\\-/][A-Za-z]{3,9}[\\s\\-/][0-9]{2,4}|[0-9]{1,2}[\\-/][0-9]{1,2}[\\-/][0-9]{2,4})`,
      'iu',
    ).exec(text);
    const rawDate = match?.[1];
    const parsed = rawDate ? parseDateValue(rawDate) : null;
    if (parsed) return parsed;
  }
  return null;
}

function parseDateValue(value: string): string | null {
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/u.test(trimmed)) return trimmed;

  const numeric = /^([0-9]{1,2})[/-]([0-9]{1,2})[/-]([0-9]{2,4})$/u.exec(trimmed);
  if (numeric?.[1] && numeric[2] && numeric[3]) {
    return datePartsToKey(Number(numeric[3]), Number(numeric[2]), Number(numeric[1]));
  }

  const named = /^([0-9]{1,2})[\s/-]([A-Za-z]{3,9})[\s/-]([0-9]{2,4})$/u.exec(trimmed);
  if (named?.[1] && named[2] && named[3]) {
    const month = monthNumbers[named[2].toLowerCase()];
    if (!month) return null;
    return datePartsToKey(Number(named[3]), month, Number(named[1]));
  }

  return null;
}

function parseFirstDateValue(text: string): string | null {
  const match =
    /\b([0-9]{4}-[0-9]{2}-[0-9]{2}|[0-9]{1,2}[\s\-/][A-Za-z]{3,9}[\s\-/][0-9]{2,4}|[0-9]{1,2}[/-][0-9]{1,2}[/-][0-9]{2,4})\b/u.exec(
      text,
    );
  return match?.[1] ? parseDateValue(match[1]) : null;
}

function datePartsToKey(yearInput: number, month: number, day: number): string | null {
  const year = yearInput < 100 ? 2000 + yearInput : yearInput;
  if (year < 2000 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date.toISOString().slice(0, 10);
}

function parseTerm(text: string): string | null {
  const schoolTerm = /\b(Spring|Summer|Autumn)\s+Term(?:\s+([0-9]+))?\b/iu.exec(text);
  if (schoolTerm?.[1]) {
    return `${titleCase(schoolTerm[1])} Term${schoolTerm[2] ? ` ${schoolTerm[2]}` : ''}`;
  }
  const canonical = /\b([0-9]{4}-(?:Spring|Summer|Autumn))\b/iu.exec(text);
  if (canonical?.[1]) return canonical[1];
  const monthly =
    /\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t|tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+([0-9]{4})\b/iu.exec(
      text,
    );
  if (!monthly?.[1] || !monthly[2]) return null;
  const month = monthNumbers[monthly[1].toLowerCase()];
  if (!month) return null;
  return `${monthName(month).toUpperCase()} ${monthly[2]}`;
}

function parseFamilyLabel(lines: readonly string[]): string | null {
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    const inlineMatch = /^(?:invoice\s+to|bill(?:ed)?\s+to)\s*:\s*(.+)$/iu.exec(line);
    if (inlineMatch?.[1]) return sanitizeFamilyLabel(inlineMatch[1]);

    if (!/^(?:invoice\s+to|bill(?:ed)?\s+to)\s*:?\s*$/iu.test(line)) continue;
    const next = lines
      .slice(index + 1, index + 5)
      .find((candidate) => candidate && isLikelyFamilyLabel(candidate));
    if (next) return sanitizeFamilyLabel(next);
  }
  return null;
}

function sanitizeFamilyLabel(value: string): string | null {
  const label = value.replace(/\s+/gu, ' ').trim();
  return isLikelyFamilyLabel(label) ? label : null;
}

function isLikelyFamilyLabel(value: string): boolean {
  const normalized = value.replace(/\s+/gu, ' ').trim();
  if (normalized.length < 2 || normalized.length > 160) return false;
  return !invoiceMetadataWordsPattern.test(normalized);
}

function titleCase(value: string): string {
  return `${value.slice(0, 1).toUpperCase()}${value.slice(1).toLowerCase()}`;
}

function parseTotalAmountPence(lines: readonly string[], text: string): number | null {
  for (const line of [...lines].reverse()) {
    if (/\b(total|amount due|balance due)\b/iu.test(line)) {
      const parsed = parseMoneyPence(line);
      if (parsed !== null) return parsed;
    }
  }
  const labelled =
    /\b(?:total|amount due|balance due)\b\s*[:£ ]+\s*([0-9][0-9,]*(?:\.[0-9]{2})?)/iu.exec(text);
  return labelled?.[1] ? parseMoneyPence(labelled[1]) : null;
}

function parseInvoiceRows(lines: readonly string[]): {
  lineItems: SchoolFeeInvoiceLineInput[];
  discounts: ParsedSchoolFeeInvoiceDiscount[];
} {
  const generatedInvoiceRows = parseGeneratedSchoolFeeRows(lines);
  if (generatedInvoiceRows.lineItems.length > 0) return generatedInvoiceRows;

  const childTableRows = parseChildTableRows(lines);
  if (childTableRows.lineItems.length > 0) return childTableRows;

  const parsed: SchoolFeeInvoiceLineInput[] = [];
  for (const line of lines) {
    if (parsed.length >= 20) break;
    if (shouldSkipLineItem(line)) continue;
    const item = parseLineItem(line);
    if (item) parsed.push(item);
  }
  return { lineItems: parsed, discounts: [] };
}

function parseGeneratedSchoolFeeRows(lines: readonly string[]): {
  lineItems: SchoolFeeInvoiceLineInput[];
  discounts: ParsedSchoolFeeInvoiceDiscount[];
} {
  const startIndex = lines.findIndex((line) => /^description$/iu.test(line));
  if (startIndex < 0) return { lineItems: [], discounts: [] };
  const endIndex = lines.findIndex(
    (line, index) => index > startIndex && /^(?:subtotal|total|discounts)$/iu.test(line),
  );
  const tableLines = lines.slice(startIndex + 1, endIndex > startIndex ? endIndex : undefined);
  const parsed: SchoolFeeInvoiceLineInput[] = [];
  const discounts: ParsedSchoolFeeInvoiceDiscount[] = [];

  for (let index = 0; index < tableLines.length; index += 1) {
    const description = tableLines[index]?.replace(/\s+/gu, ' ').trim() ?? '';
    if (!isGeneratedSchoolFeeDescription(description)) continue;
    const childIndex = parsed.length;

    const nextFeeIndex = tableLines.findIndex(
      (line, candidateIndex) =>
        candidateIndex > index &&
        isGeneratedSchoolFeeDescription(line.replace(/\s+/gu, ' ').trim()),
    );
    const childLines = tableLines.slice(index + 1, nextFeeIndex > index ? nextFeeIndex : undefined);
    const netAmountPence = parseGeneratedNetAmountPence(childLines);
    const grossAmountPence = parseGeneratedGrossAmountPence(childLines);
    const amountPence = grossAmountPence ?? netAmountPence;

    if (amountPence !== null && amountPence > 0) {
      parsed.push({ description, quantity: 1, unitAmountPence: amountPence });
      const discount = parseGeneratedDiscount(childLines, childIndex, amountPence, netAmountPence);
      if (discount) discounts.push(discount);
    }
  }

  return { lineItems: parsed, discounts };
}

function isGeneratedSchoolFeeDescription(value: string): boolean {
  return /\b(?:monthly|termly|annual|learning centre|school)\s+.*\bfee\b/iu.test(value);
}

function parseGeneratedNetAmountPence(lines: readonly string[]): number | null {
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    if (!/^net\s+for\s+child\b/iu.test(line)) continue;
    const inlineAmount = parseMoneyPence(line);
    if (inlineAmount !== null) return inlineAmount;
    const nextAmount = lines
      .slice(index + 1)
      .find((candidate) => parseMoneyPence(candidate) !== null);
    return nextAmount ? parseMoneyPence(nextAmount) : null;
  }
  return null;
}

function parseGeneratedGrossAmountPence(lines: readonly string[]): number | null {
  for (let index = 0; index < lines.length - 2; index += 1) {
    const quantity = Number(lines[index]);
    if (!Number.isInteger(quantity) || quantity <= 0) continue;
    const amount = parseMoneyPence(lines[index + 2] ?? '');
    if (amount !== null) return amount;
  }
  return null;
}

function parseGeneratedDiscount(
  lines: readonly string[],
  childIndex: number,
  grossAmountPence: number,
  netAmountPence: number | null,
): ParsedSchoolFeeInvoiceDiscount | null {
  if (netAmountPence === null || netAmountPence >= grossAmountPence) return null;
  const amountPence = grossAmountPence - netAmountPence;
  const label =
    parseGeneratedDiscountLabel(lines) ?? `Imported invoice discount ${String(childIndex + 1)}`;
  return parsedFixedDiscount(label, childIndex, amountPence);
}

function parseGeneratedDiscountLabel(lines: readonly string[]): string | null {
  for (const line of lines) {
    const match = /^discount\s*-\s*(.+)$/iu.exec(line.replace(/\s+/gu, ' ').trim());
    if (match?.[1]) return sanitizeDiscountLabel(match[1]);
  }
  return null;
}

function parseChildTableRows(lines: readonly string[]): {
  lineItems: SchoolFeeInvoiceLineInput[];
  discounts: ParsedSchoolFeeInvoiceDiscount[];
} {
  const startIndex = lines.findIndex((line) => /^child$/iu.test(line));
  if (startIndex < 0) return { lineItems: [], discounts: [] };
  const endIndex = lines.findIndex(
    (line, index) => index > startIndex && /\btotal\s+amount\s+due\b/iu.test(line),
  );
  const tableLines = lines.slice(startIndex + 1, endIndex > startIndex ? endIndex : undefined);
  const parsed: SchoolFeeInvoiceLineInput[] = [];
  const discounts: ParsedSchoolFeeInvoiceDiscount[] = [];

  for (let index = 0; index < tableLines.length; index += 1) {
    const childName = tableLines[index];
    if (!childName || !looksLikeChildName(childName)) continue;
    const childIndex = parsed.length;

    const amountLines: string[] = [];
    const discountLabelLines: string[] = [];
    let nextIndex = index + 1;
    while (nextIndex < tableLines.length) {
      const candidate = tableLines[nextIndex];
      if (candidate && looksLikeChildName(candidate)) break;
      if (candidate && isChildTableMoneyLine(candidate)) {
        amountLines.push(candidate);
      } else if (candidate && !isChildTableHeaderLine(candidate)) {
        discountLabelLines.push(candidate);
      }
      nextIndex += 1;
    }

    const grossAmountPence = amountLines.length > 0 ? parseMoneyPence(amountLines[0] ?? '') : null;
    const netAmountPence =
      amountLines.length > 0 ? parseMoneyPence(amountLines.at(-1) ?? '') : null;
    const amountPence = grossAmountPence ?? netAmountPence;
    if (amountPence !== null && amountPence > 0) {
      parsed.push({
        description: `Learning centre fees - ${childName}`,
        quantity: 1,
        unitAmountPence: amountPence,
      });
      if (
        grossAmountPence !== null &&
        netAmountPence !== null &&
        netAmountPence < grossAmountPence
      ) {
        discounts.push(
          parsedFixedDiscount(
            parseChildTableDiscountLabel(discountLabelLines) ??
              `Imported invoice discount ${String(childIndex + 1)}`,
            childIndex,
            grossAmountPence - netAmountPence,
          ),
        );
      }
    }
    index = nextIndex - 1;
  }

  return { lineItems: parsed, discounts };
}

function parsedFixedDiscount(
  label: string,
  childIndex: number,
  amountPence: number,
): ParsedSchoolFeeInvoiceDiscount {
  return {
    label,
    kind: 'ManualFixed',
    presetCode: schoolFeeDiscountChildIndexPresetCode(childIndex),
    percentBps: null,
    amountPence,
  };
}

function isChildTableHeaderLine(value: string): boolean {
  return /^(?:base\s+monthly\s+fee|discount\s+applied|amount\s+due(?:\s*\(£\))?)$/iu.test(
    value.replace(/\s+/gu, ' ').trim(),
  );
}

function isChildTableMoneyLine(value: string): boolean {
  return value.includes('£') && parseMoneyPence(value) !== null;
}

function parseChildTableDiscountLabel(lines: readonly string[]): string | null {
  const joined = lines.join(' ');
  const withoutPercent = joined.replace(/\b[0-9]+(?:\.[0-9]+)?%\s*/gu, '');
  return sanitizeDiscountLabel(withoutPercent);
}

function sanitizeDiscountLabel(value: string): string | null {
  const label = value.replace(/[()]/gu, ' ').replace(/\s+/gu, ' ').trim();
  if (label.length < 2 || label.length > 160) return null;
  return label;
}

function looksLikeChildName(value: string): boolean {
  const normalized = value.replace(/\s+/gu, ' ').trim();
  if (!/^[\p{L}][\p{L}'-]+(?:\s+[\p{L}][\p{L}'-]+)+$/u.test(normalized)) return false;
  return !/\b(invoice|child|fee|discount|amount|total|payment|reference|frequency|leader|member)\b/iu.test(
    normalized,
  );
}

function shouldSkipLineItem(line: string): boolean {
  return (
    /^\s*term\s*[:-]/iu.test(line) ||
    /^\s*(Spring|Summer|Autumn)\s+Term(?:\s+[0-9]+)?\s*$/iu.test(line) ||
    /\b(invoice|issued|due|total|balance|subtotal|vat|tax|amount due|paid)\b/iu.test(line)
  );
}

function parseLineItem(line: string): SchoolFeeInvoiceLineInput | null {
  const amountMatch = /(.+?)\s+(£\s*[0-9][0-9,]*(?:\.[0-9]{2})?|[0-9][0-9,]*\.[0-9]{2})$/u.exec(
    line,
  );
  if (!amountMatch?.[1] || !amountMatch[2]) return null;
  const amountPence = parseMoneyPence(amountMatch[2]);
  if (amountPence === null || amountPence === 0) return null;

  const rawDescription = amountMatch[1].trim();
  const quantityMatch =
    /(?:\b|\()([0-9]{1,3})\s*(?:x|times|items|workbooks|\))\b/iu.exec(rawDescription) ??
    /(?:x|×)\s*([0-9]{1,3})\b/iu.exec(rawDescription);
  const quantity = quantityMatch?.[1] ? Number(quantityMatch[1]) : 1;
  if (!Number.isInteger(quantity) || quantity <= 0) return null;
  const unitAmountPence = Math.round(amountPence / quantity);
  const description = rawDescription.replace(/\s+/gu, ' ').trim();
  if (description.length < 2) return null;

  return { description, quantity, unitAmountPence };
}

function monthName(month: number): string {
  const names = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  return names[month - 1] ?? String(month);
}
