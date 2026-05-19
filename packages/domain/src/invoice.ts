export const SCHOOL_FEE_INVOICE_STATUSES = ['Draft', 'Unpaid', 'Paid'] as const;
export type SchoolFeeInvoiceStatus = (typeof SCHOOL_FEE_INVOICE_STATUSES)[number];
export type SchoolFeeInvoiceDisplayStatus = SchoolFeeInvoiceStatus | 'Overdue';

export interface SchoolFeeInvoiceLineInput {
  description: string;
  quantity: number;
  unitAmountPence: number;
}

export interface ParsedSchoolFeeInvoice {
  invoiceNumber: string | null;
  issuedOn: string | null;
  dueOn: string | null;
  term: string | null;
  lineItems: SchoolFeeInvoiceLineInput[];
  totalAmountPence: number | null;
}

const moneyPattern = /(?:£\s*)?([0-9][0-9,]*(?:\.[0-9]{2})?)/u;
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

export function schoolFeeInvoiceDisplayStatus(
  status: SchoolFeeInvoiceStatus,
  dueOn: Date | string | null,
  now: Date = new Date(),
): SchoolFeeInvoiceDisplayStatus {
  if (status !== 'Unpaid' || !dueOn) return status;
  return dateKey(dueOn) < dateKey(now) ? 'Overdue' : 'Unpaid';
}

export function parseSchoolFeeInvoiceText(text: string): ParsedSchoolFeeInvoice {
  const compactText = text.replace(/\s+/gu, ' ').trim();
  const lines = text
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);
  const totalAmountPence = parseTotalAmountPence(lines, compactText);
  const lineItems = parseLineItems(lines);

  if (lineItems.length === 0 && totalAmountPence !== null) {
    lineItems.push({
      description: 'Imported invoice total',
      quantity: 1,
      unitAmountPence: totalAmountPence,
    });
  }

  return {
    invoiceNumber: parseInvoiceNumber(compactText),
    issuedOn: parseIssuedDate(compactText),
    dueOn: parseDueDate(compactText),
    term: parseTerm(compactText),
    lineItems,
    totalAmountPence,
  };
}

function dateKey(value: Date | string): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/u.test(value)) return value;
  return new Date(value).toISOString().slice(0, 10);
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
  return parseDateAfterLabel(text, ['issued', 'invoice date', 'date']);
}

function parseDueDate(text: string): string | null {
  return parseDateAfterLabel(text, ['due date', 'payment due', 'due']);
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
  return canonical?.[1] ?? null;
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

function parseLineItems(lines: readonly string[]): SchoolFeeInvoiceLineInput[] {
  const parsed: SchoolFeeInvoiceLineInput[] = [];
  for (const line of lines) {
    if (parsed.length >= 20) break;
    if (shouldSkipLineItem(line)) continue;
    const item = parseLineItem(line);
    if (item) parsed.push(item);
  }
  return parsed;
}

function shouldSkipLineItem(line: string): boolean {
  return (
    /^\s*term\s*[:-]/iu.test(line) ||
    /^\s*(Spring|Summer|Autumn)\s+Term(?:\s+[0-9]+)?\s*$/iu.test(line) ||
    /\b(invoice|issued|due|total|balance|subtotal|vat|tax|amount due|paid)\b/iu.test(line)
  );
}

function parseLineItem(line: string): SchoolFeeInvoiceLineInput | null {
  const amountMatch = /(.+?)\s+(?:£\s*)?([0-9][0-9,]*(?:\.[0-9]{2})?)$/u.exec(line);
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
