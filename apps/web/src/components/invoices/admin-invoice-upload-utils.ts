import { parseSchoolFeeInvoiceText } from '@oasis/domain';
import type { RouterInputs, RouterOutputs } from '@/lib/trpc';

export type BillableFamily = RouterOutputs['invoice']['listBillableFamilies'][number];
export type FeeConfig = RouterOutputs['invoice']['listFeeConfig'];
export type PublishDraftInput = RouterInputs['invoice']['publishDraft'];
export type PublishBillingCadence = NonNullable<PublishDraftInput['billingCadence']>;

export interface UploadLineItem {
  description: string;
  quantity: number;
  unitAmountPence: number;
}

export interface UploadDiscount {
  label: string;
  kind: 'Preset' | 'ManualPercent' | 'ManualFixed';
  presetCode?: string | null;
  percentBps: number | null;
  amountPence: number | null;
}

export interface UploadParsedInvoice {
  invoiceNumber: string | null;
  familyLabel?: string | null;
  issuedOn: string | null;
  dueOn: string | null;
  term: string | null;
  totalAmountPence: number | null;
  lineItems: UploadLineItem[];
  discounts: UploadDiscount[];
}

export interface UploadDraftResponse {
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

export interface LineForm {
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
  getDocument: (input: { data: Uint8Array; isEvalSupported: boolean }) => {
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

function isUploadDiscount(value: unknown): value is UploadDiscount {
  if (!isRecord(value)) return false;
  return (
    typeof value.label === 'string' &&
    (value.kind === 'Preset' || value.kind === 'ManualPercent' || value.kind === 'ManualFixed') &&
    (value.presetCode === undefined ||
      value.presetCode === null ||
      typeof value.presetCode === 'string') &&
    (value.percentBps === null || typeof value.percentBps === 'number') &&
    (value.amountPence === null || typeof value.amountPence === 'number')
  );
}

function isParsedInvoice(value: unknown): value is UploadParsedInvoice {
  if (!isRecord(value)) return false;
  return (
    Array.isArray(value.lineItems) &&
    value.lineItems.every(isUploadLineItem) &&
    Array.isArray(value.discounts) &&
    value.discounts.every(isUploadDiscount)
  );
}

export function isUploadResponse(value: unknown): value is UploadDraftResponse {
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

export async function parseInvoiceFromPdfFile(file: File): Promise<UploadParsedInvoice> {
  ensurePromiseWithResolvers();
  const pdfjs = (await import('pdfjs-dist/legacy/webpack.mjs')) as BrowserPdfJs;
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
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

export function parsedInvoiceFromUpload(
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
    discounts: parsed?.discounts ?? [],
  };
}

export function uploadErrorMessage(value: unknown): string {
  if (isRecord(value) && typeof value.error === 'string') return value.error;
  return 'Invoice PDF could not be uploaded.';
}

function penceToPoundsInput(amountPence: number): string {
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
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(issuedOn)) return '';
  const date = new Date(`${issuedOn}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + 14);
  return date.toISOString().slice(0, 10);
}

export function defaultTerm(issuedOn: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(issuedOn)) return '';
  return new Intl.DateTimeFormat('en-GB', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
    .format(new Date(`${issuedOn}T00:00:00.000Z`))
    .toUpperCase();
}

export function lineFormsFromParsed(lines: readonly UploadLineItem[]): LineForm[] {
  return lines.map((line) => ({
    description: line.description,
    quantity: String(line.quantity),
    unitAmount: penceToPoundsInput(line.unitAmountPence),
  }));
}

export function parsedLineItemsForForms(lines: readonly LineForm[]): UploadLineItem[] {
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

export function findFamilyForParsed(
  families: readonly BillableFamily[],
  parsed: UploadParsedInvoice,
): BillableFamily | null {
  const ranked = families
    .map((family) => ({ family, score: familyScore(family, parsed) }))
    .sort((left, right) => right.score - left.score);
  const best = ranked[0];
  return best && best.score > 0 ? best.family : null;
}

export function studentIdsForParsedLines(
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
