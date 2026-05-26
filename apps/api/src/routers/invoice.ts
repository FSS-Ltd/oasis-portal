import { Buffer } from 'node:buffer';
import { TRPCError } from '@trpc/server';
import type {
  Prisma,
  SchoolFeeBillingCadence,
  SchoolFeeInvoiceDiscountKind,
  SchoolFeeInvoiceStatus,
} from '@oasis/db';
import {
  AccessDeniedError,
  activeSchoolFeeYear,
  calculateSchoolFeeDiscounts,
  calculateSchoolFeeFamilyDiscounts,
  canUseLinkedChildInvoiceAccess,
  invoiceTotalPence,
  lineItemTotalPence,
  parseSchoolFeeInvoiceText,
  requireCanManageInvoices,
  SCHOOL_FEE_BILLING_CADENCES,
  SCHOOL_FEE_DISCOUNT_EXPLANATION,
  SCHOOL_FEE_DISCOUNT_KINDS,
  SCHOOL_FEE_DISCOUNT_PRESETS,
  SCHOOL_FEE_SIBLING_DISCOUNT_CODE,
  schoolFeeBillingCycle,
  schoolFeeStudentProratedFees,
  schoolFeeInvoiceDisplayStatus,
  type ParsedSchoolFeeInvoice,
  type SchoolFeeDiscountInput,
  type SchoolFeeInvoiceDisplayStatus,
  type SchoolFeeInvoiceLineInput,
  type SessionUser,
} from '@oasis/domain';
import { z } from 'zod';
import {
  generateSchoolFeeInvoicePdf,
  type GenerateSchoolFeeInvoicePdfInput,
  type GeneratedInvoiceLine,
} from '../invoices/school-fee-pdf.js';
import type { AppContext, RlsTx } from '../context.js';
import { authedProcedure, router } from '../trpc.js';

const MAX_PDF_BYTES = 10 * 1024 * 1024;
const DEFAULT_2026_FEE_CONFIG = {
  schoolYear: 2026,
  annualAmountPence: 294_000,
  termAmountPence: 98_000,
  monthlyAmountPence: 24_500,
};
const invoiceAdminStatusFilters = [
  'All',
  'Draft',
  'Unpaid',
  'PaymentPending',
  'Overdue',
  'Paid',
] as const;
const parentStatusFilters = ['All', 'Unpaid', 'PaymentPending', 'Overdue', 'Paid'] as const;

type AuthedContext = AppContext & { user: SessionUser };
type PdfTextExtractor = (pdfBytes: Uint8Array) => Promise<string>;

interface InvoiceRouterDeps {
  extractPdfText?: PdfTextExtractor;
}

type InvoiceLineRow = {
  id: string;
  position: number;
  descriptionEnc: string;
  quantity: number;
  unitAmountPence: number;
  totalAmountPence: number;
};

type InvoiceStudentRow = {
  id: string;
  fullNameEnc: string;
  yearGroup: string;
  enrolmentDate: Date;
} | null;

type InvoiceStudentLinkRow = {
  studentId: string;
  position: number;
  student: Exclude<InvoiceStudentRow, null>;
};

type InvoiceDiscountRow = {
  id: string;
  position: number;
  labelEnc: string;
  kind: SchoolFeeInvoiceDiscountKind;
  presetCode: string | null;
  percentBps: number | null;
  amountPence: number | null;
  baseAmountPence: number;
  appliedAmountPence: number;
  optedOutAt: Date | null;
  optedOutById: string | null;
  createdAt: Date;
};

type InvoiceRow = {
  id: string;
  invoiceNumber: string | null;
  studentId: string | null;
  status: SchoolFeeInvoiceStatus;
  schoolYear: number | null;
  billingCadence: SchoolFeeBillingCadence | null;
  familyLabelEnc: string | null;
  term: string | null;
  issuedOn: Date | null;
  dueOn: Date | null;
  paidAt: Date | null;
  subtotalAmountPence: number;
  discountAmountPence: number;
  totalAmountPence: number;
  discountExplanationEnc: string | null;
  parentMarkedPaidAt: Date | null;
  parentMarkedPaidById: string | null;
  paymentConfirmedAt: Date | null;
  paymentConfirmedById: string | null;
  originalFileNameEnc: string;
  fileMimeType: string;
  fileSizeBytes: number;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
  student: InvoiceStudentRow;
  students?: InvoiceStudentLinkRow[];
  lineItems: InvoiceLineRow[];
  discounts?: InvoiceDiscountRow[];
};

type InvoiceDownloadRow = Pick<
  InvoiceRow,
  | 'id'
  | 'studentId'
  | 'status'
  | 'invoiceNumber'
  | 'originalFileNameEnc'
  | 'fileMimeType'
  | 'fileSizeBytes'
> & {
  pdfBytesEnc: string;
};

export interface SchoolFeeInvoiceLineDto {
  id: string;
  position: number;
  description: string;
  quantity: number;
  unitAmountPence: number;
  totalAmountPence: number;
}

export interface SchoolFeeInvoiceStudentDto {
  id: string;
  fullName: string;
  yearGroup: string;
  enrolmentDate: string;
}

export interface SchoolFeeInvoiceDiscountDto {
  id: string;
  position: number;
  label: string;
  kind: SchoolFeeInvoiceDiscountKind;
  presetCode: string | null;
  percentBps: number | null;
  amountPence: number | null;
  baseAmountPence: number;
  appliedAmountPence: number;
  optedOut: boolean;
  canOptOut: boolean;
}

export interface SchoolFeeInvoiceChildDiscountDto {
  id: string;
  label: string;
  appliedAmountPence: number;
  optedOut: boolean;
}

export interface SchoolFeeInvoiceChildDiscountBreakdownDto {
  childIndex: number;
  studentId: string | null;
  studentName: string | null;
  lineItemId: string | null;
  lineAmountPence: number;
  discountAmountPence: number;
  totalAmountPence: number;
  discounts: SchoolFeeInvoiceChildDiscountDto[];
}

export interface SchoolFeeInvoiceDto {
  id: string;
  invoiceNumber: string | null;
  studentId: string | null;
  studentName: string | null;
  studentYearGroup: string | null;
  students: SchoolFeeInvoiceStudentDto[];
  status: SchoolFeeInvoiceStatus;
  displayStatus: SchoolFeeInvoiceDisplayStatus;
  schoolYear: number | null;
  billingCadence: SchoolFeeBillingCadence | null;
  familyLabel: string | null;
  term: string | null;
  issuedOn: string | null;
  dueOn: string | null;
  paidAt: Date | null;
  subtotalAmountPence: number;
  discountAmountPence: number;
  totalAmountPence: number;
  discountExplanation: string;
  canEdit: boolean;
  parentMarkedPaidAt: Date | null;
  parentMarkedPaidById: string | null;
  paymentConfirmedAt: Date | null;
  paymentConfirmedById: string | null;
  originalFileName: string;
  fileSizeBytes: number;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
  lineItems: SchoolFeeInvoiceLineDto[];
  discounts: SchoolFeeInvoiceDiscountDto[];
  discountBreakdowns: SchoolFeeInvoiceChildDiscountBreakdownDto[];
}

export interface SchoolFeeInvoiceStatsDto {
  totalCount: number;
  draftCount: number;
  unpaidCount: number;
  paymentPendingCount: number;
  overdueCount: number;
  paidCount: number;
  outstandingAmountPence: number;
  overdueAmountPence: number;
  paidAmountPence: number;
  remainingAmountPence: number;
}

export interface BillableStudentDto {
  id: string;
  fullName: string;
  yearGroup: string;
  enrolmentDate: string;
}

export interface BillableFamilyDto {
  familyKey: string;
  familyLabel: string;
  students: BillableStudentDto[];
  guardians: {
    id: string;
    fullName: string;
    email: string;
  }[];
  yearSummary: SchoolFeeFamilyYearSummaryDto;
}

export interface SchoolFeeYearFeeConfigDto {
  schoolYear: number;
  cycleLabel: string;
  cycleStartsOn: string;
  cycleEndsOn: string;
  annualAmountPence: number;
  termAmountPence: number;
  monthlyAmountPence: number;
}

export interface SchoolFeeStudentYearSummaryDto {
  studentId: string;
  studentName: string;
  yearGroup: string;
  enrolmentDate: string;
  chargeableStartsOn: string | null;
  chargeableEndsOn: string | null;
  chargeableMonths: number;
  grossAnnualAmountPence: number;
  adjustedAnnualAmountPence: number;
  discountAmountPence: number;
  issuedAmountPence: number;
  paidAmountPence: number;
  paymentPendingAmountPence: number;
  overdueAmountPence: number;
  remainingAmountPence: number;
  leftToInvoiceAmountPence: number;
}

export interface SchoolFeeFamilyYearSummaryDto {
  schoolYear: number;
  cycleLabel: string;
  cycleStartsOn: string;
  cycleEndsOn: string;
  annualAmountPence: number;
  adjustedAnnualAmountPence: number;
  discountAmountPence: number;
  issuedAmountPence: number;
  paidAmountPence: number;
  paymentPendingAmountPence: number;
  overdueAmountPence: number;
  remainingAmountPence: number;
  leftToInvoiceAmountPence: number;
  invoiceCount: number;
  children: SchoolFeeStudentYearSummaryDto[];
}

const invoiceLineInput = z.object({
  description: z.string().trim().min(1).max(240),
  quantity: z.number().int().min(1).max(999),
  unitAmountPence: z.number().int().min(0).max(5_000_000),
});

const invoiceDiscountInput = z.object({
  label: z.string().trim().min(1).max(160),
  kind: z.enum(SCHOOL_FEE_DISCOUNT_KINDS),
  presetCode: z.string().trim().min(1).max(80).nullable().optional(),
  percentBps: z.number().int().min(0).max(10_000).nullable().optional(),
  amountPence: z.number().int().min(0).max(5_000_000).nullable().optional(),
});

const discountExplanationInput = z
  .string()
  .trim()
  .min(1)
  .max(1_200)
  .default(SCHOOL_FEE_DISCOUNT_EXPLANATION);

const uploadDraftInput = z.object({
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().min(1).max(120),
  sizeBytes: z.number().int().positive().max(MAX_PDF_BYTES),
  pdfBase64: z.string().min(1),
});

const publishDraftInput = z
  .object({
    invoiceId: z.string().cuid(),
    studentId: z.string().cuid().optional(),
    studentIds: z
      .array(z.string().cuid())
      .min(1)
      .max(20)
      .refine((ids) => new Set(ids).size === ids.length, 'Each student can only be added once.')
      .optional(),
    familyLabel: z.string().trim().min(1).max(160).nullable().optional(),
    schoolYear: z.number().int().min(2020).max(2100).nullable().optional(),
    billingCadence: z.enum(SCHOOL_FEE_BILLING_CADENCES).nullable().optional(),
    invoiceNumber: z.string().trim().min(1).max(80),
    issuedOn: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/u)
      .nullable(),
    dueOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u),
    term: z.string().trim().min(1).max(80).nullable(),
    lineItems: z.array(invoiceLineInput).min(1).max(50),
  })
  .refine((input) => input.studentId || input.studentIds?.length, {
    message: 'Select at least one child.',
    path: ['studentIds'],
  });

const createGeneratedInput = z.object({
  schoolYear: z.number().int().min(2020).max(2100),
  billingCadence: z.enum(SCHOOL_FEE_BILLING_CADENCES),
  studentIds: z
    .array(z.string().cuid())
    .min(1)
    .max(20)
    .refine((ids) => new Set(ids).size === ids.length, 'Each student can only be added once.'),
  familyLabel: z.string().trim().min(1).max(160),
  invoiceNumber: z.string().trim().min(1).max(80),
  issuedOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/u)
    .nullable(),
  dueOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u),
  term: z.string().trim().min(1).max(100).nullable(),
  lineItems: z.array(invoiceLineInput).min(1).max(50),
  discounts: z.array(invoiceDiscountInput).max(20).default([]),
  discountExplanation: discountExplanationInput,
});

const updateGeneratedInput = createGeneratedInput.extend({
  invoiceId: z.string().cuid(),
});

const feeConfigInput = z.object({
  schoolYear: z.number().int().min(2020).max(2100),
  annualAmountPence: z.number().int().min(0).max(10_000_000),
  termAmountPence: z.number().int().min(0).max(10_000_000),
  monthlyAmountPence: z.number().int().min(0).max(10_000_000),
});

const schoolYearInput = z
  .object({
    schoolYear: z.number().int().min(2020).max(2100).default(activeSchoolFeeYear),
  })
  .optional();

const invoiceIdInput = z.object({
  invoiceId: z.string().cuid(),
});

const discountOptOutInput = z.object({
  invoiceId: z.string().cuid(),
  discountId: z.string().cuid(),
  optedOut: z.boolean(),
});

const adminListInput = z
  .object({
    status: z.enum(invoiceAdminStatusFilters).default('All'),
    search: z.string().trim().max(120).optional(),
  })
  .optional();

const parentListInput = z
  .object({
    status: z.enum(parentStatusFilters).default('All'),
    search: z.string().trim().max(120).optional(),
  })
  .optional();

const invoiceInclude = {
  student: { select: { id: true, fullNameEnc: true, yearGroup: true, enrolmentDate: true } },
  students: {
    orderBy: { position: 'asc' as const },
    include: {
      student: { select: { id: true, fullNameEnc: true, yearGroup: true, enrolmentDate: true } },
    },
  },
  lineItems: { orderBy: { position: 'asc' as const } },
  discounts: { orderBy: { position: 'asc' as const } },
} satisfies Prisma.SchoolFeeInvoiceInclude;

const feeConfigSelect = {
  schoolYear: true,
  annualAmountPence: true,
  termAmountPence: true,
  monthlyAmountPence: true,
} satisfies Prisma.SchoolFeeYearFeeConfigSelect;

function asBadRequest(err: unknown): never {
  throw new TRPCError({
    code: 'BAD_REQUEST',
    message: err instanceof Error ? err.message : 'invalid invoice',
    cause: err instanceof Error ? err : undefined,
  });
}

async function auditPermissionDenied(
  ctx: AuthedContext,
  entity: string,
  denied: AccessDeniedError,
  entityId?: string,
): Promise<never> {
  await ctx.db.auditLog.create({
    data: {
      userId: ctx.user.id,
      action: 'PermissionDenied',
      entity,
      entityId: entityId ?? null,
      meta: { role: ctx.user.role, reason: denied.message },
    },
  });
  throw new TRPCError({ code: 'FORBIDDEN', message: denied.message, cause: denied });
}

async function requireInvoiceManager(
  ctx: AuthedContext,
  entity: string,
  entityId?: string,
): Promise<void> {
  try {
    requireCanManageInvoices(ctx.user);
  } catch (err) {
    if (err instanceof AccessDeniedError) {
      await auditPermissionDenied(ctx, entity, err, entityId);
    }
    throw err;
  }
}

function decryptRequired(
  decrypt: AppContext['db']['$enc']['decrypt'],
  ciphertext: string | null | undefined,
  fieldName: string,
): string {
  const plaintext = decrypt(ciphertext);
  if (plaintext === null) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: `missing decrypted ${fieldName}`,
    });
  }
  return plaintext;
}

function decryptOptional(
  decrypt: AppContext['db']['$enc']['decrypt'],
  ciphertext: string | null | undefined,
): string | null {
  return ciphertext ? decrypt(ciphertext) : null;
}

function dateOnly(value: Date | null): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

function parseDateInput(value: string | null): Date | null {
  return value ? new Date(`${value}T00:00:00.000Z`) : null;
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase();
}

function safeOriginalFileName(value: string): string {
  const fileName = value.replaceAll('\\', '/').split('/').pop()?.replace(/\0/gu, '').trim();
  return fileName || 'invoice.pdf';
}

function decodePdfInput(input: z.infer<typeof uploadDraftInput>): Buffer {
  const pdfBytes = Buffer.from(input.pdfBase64, 'base64');
  if (
    pdfBytes.length === 0 ||
    pdfBytes.length > MAX_PDF_BYTES ||
    pdfBytes.length !== input.sizeBytes
  ) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'invalid PDF upload size' });
  }
  const isPdfMime = input.mimeType.toLowerCase() === 'application/pdf';
  const isPdfName = input.fileName.toLowerCase().endsWith('.pdf');
  const hasPdfMagic = pdfBytes.subarray(0, 5).toString('utf8') === '%PDF-';
  if ((!isPdfMime && !isPdfName) || !hasPdfMagic) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'only PDF invoices can be uploaded' });
  }
  return pdfBytes;
}

function lineData(line: SchoolFeeInvoiceLineInput, position: number) {
  return {
    position,
    quantity: line.quantity,
    unitAmountPence: line.unitAmountPence,
    totalAmountPence: line.quantity * line.unitAmountPence,
  };
}

function lineInputFromRow(ctx: AuthedContext, line: InvoiceLineRow): GeneratedInvoiceLine {
  return {
    description: decryptRequired(
      ctx.db.$enc.decrypt,
      line.descriptionEnc,
      'invoice line description',
    ),
    quantity: line.quantity,
    unitAmountPence: line.unitAmountPence,
    totalAmountPence: line.totalAmountPence,
  };
}

function lineDtoFromRow(ctx: AuthedContext, line: InvoiceLineRow): SchoolFeeInvoiceLineDto {
  return {
    id: line.id,
    position: line.position,
    ...lineInputFromRow(ctx, line),
  };
}

function discountDtoFromRow(
  ctx: AuthedContext,
  discount: InvoiceDiscountRow,
  invoiceStatus: SchoolFeeInvoiceStatus,
): SchoolFeeInvoiceDiscountDto {
  return {
    id: discount.id,
    position: discount.position,
    label: decryptRequired(ctx.db.$enc.decrypt, discount.labelEnc, 'invoice discount label'),
    kind: discount.kind,
    presetCode: discount.presetCode,
    percentBps: discount.percentBps,
    amountPence: discount.amountPence,
    baseAmountPence: discount.baseAmountPence,
    appliedAmountPence: discount.appliedAmountPence,
    optedOut: discount.optedOutAt !== null,
    canOptOut: invoiceStatus === 'Unpaid',
  };
}

function mapStudentRows(ctx: AuthedContext, invoice: InvoiceRow): SchoolFeeInvoiceStudentDto[] {
  const linked = (invoice.students ?? []).map((link) => ({
    id: link.student.id,
    fullName: decryptRequired(ctx.db.$enc.decrypt, link.student.fullNameEnc, 'student name'),
    yearGroup: link.student.yearGroup,
    enrolmentDate: dateOnly(link.student.enrolmentDate) ?? '',
  }));
  if (linked.length > 0) return linked;
  return invoice.student
    ? [
        {
          id: invoice.student.id,
          fullName: decryptRequired(
            ctx.db.$enc.decrypt,
            invoice.student.fullNameEnc,
            'student name',
          ),
          yearGroup: invoice.student.yearGroup,
          enrolmentDate: dateOnly(invoice.student.enrolmentDate) ?? '',
        },
      ]
    : [];
}

function discountExplanationFromRow(ctx: AuthedContext, invoice: InvoiceRow): string {
  return (
    decryptOptional(ctx.db.$enc.decrypt, invoice.discountExplanationEnc) ??
    SCHOOL_FEE_DISCOUNT_EXPLANATION
  );
}

function mapInvoice(ctx: AuthedContext, invoice: InvoiceRow, now: Date): SchoolFeeInvoiceDto {
  const students = mapStudentRows(ctx, invoice);
  const primaryStudent = students[0] ?? null;
  const lineItems = invoice.lineItems.map((line) => lineDtoFromRow(ctx, line));
  const discounts = (invoice.discounts ?? []).map((discount) =>
    discountDtoFromRow(ctx, discount, invoice.status),
  );
  return {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    studentId: invoice.studentId ?? primaryStudent?.id ?? null,
    studentName:
      students.length > 0 ? students.map((student) => student.fullName).join(', ') : null,
    studentYearGroup:
      students.length > 0
        ? uniqueValues(students.map((student) => student.yearGroup)).join(', ')
        : null,
    students,
    status: invoice.status,
    displayStatus: schoolFeeInvoiceDisplayStatus(invoice.status, invoice.dueOn, now),
    schoolYear: invoice.schoolYear,
    billingCadence: invoice.billingCadence,
    familyLabel: decryptOptional(ctx.db.$enc.decrypt, invoice.familyLabelEnc),
    term: invoice.term,
    issuedOn: dateOnly(invoice.issuedOn),
    dueOn: dateOnly(invoice.dueOn),
    paidAt: invoice.paidAt,
    subtotalAmountPence: invoice.subtotalAmountPence || invoice.totalAmountPence,
    discountAmountPence: invoice.discountAmountPence,
    totalAmountPence: invoice.totalAmountPence,
    discountExplanation: discountExplanationFromRow(ctx, invoice),
    canEdit: invoice.status === 'Draft' || invoice.status === 'Unpaid',
    parentMarkedPaidAt: invoice.parentMarkedPaidAt,
    parentMarkedPaidById: invoice.parentMarkedPaidById,
    paymentConfirmedAt: invoice.paymentConfirmedAt,
    paymentConfirmedById: invoice.paymentConfirmedById,
    originalFileName: decryptRequired(
      ctx.db.$enc.decrypt,
      invoice.originalFileNameEnc,
      'invoice file name',
    ),
    fileSizeBytes: invoice.fileSizeBytes,
    createdById: invoice.createdById,
    createdAt: invoice.createdAt,
    updatedAt: invoice.updatedAt,
    lineItems,
    discounts,
    discountBreakdowns: invoiceChildDiscountBreakdowns(invoice, students, lineItems, discounts),
  };
}

function invoiceChildDiscountBreakdowns(
  invoice: InvoiceRow,
  students: readonly SchoolFeeInvoiceStudentDto[],
  lineItems: readonly SchoolFeeInvoiceLineDto[],
  discounts: readonly SchoolFeeInvoiceDiscountDto[],
): SchoolFeeInvoiceChildDiscountBreakdownDto[] {
  if (lineItems.length === 0) return [];
  const studentCount = Math.min(
    students.length > 0 ? students.length : invoice.studentId ? 1 : 0,
    lineItems.length,
  );
  if (studentCount === 0) return [];

  const discountInputs = discounts.map((discount) => ({
    label: discount.label,
    kind: discount.kind,
    presetCode: discount.presetCode,
    percentBps: discount.percentBps,
    amountPence: discount.amountPence,
    optedOut: discount.optedOut,
  }));
  const childLineAmountsPence = lineItems
    .slice(0, studentCount)
    .map((line) => line.totalAmountPence);
  try {
    const calculation = calculateSchoolFeeFamilyDiscounts({
      subtotalAmountPence: invoice.subtotalAmountPence || invoice.totalAmountPence,
      studentCount,
      childLineAmountsPence,
      discounts: discountInputs,
    });
    return calculation.childBreakdowns.map((breakdown) => {
      const lineItem = lineItems[breakdown.childIndex] ?? null;
      const student = students[breakdown.childIndex] ?? null;
      return {
        childIndex: breakdown.childIndex,
        studentId: student?.id ?? invoice.studentId ?? null,
        studentName: student?.fullName ?? null,
        lineItemId: lineItem?.id ?? null,
        lineAmountPence: breakdown.lineAmountPence,
        discountAmountPence: breakdown.discountAmountPence,
        totalAmountPence: breakdown.totalAmountPence,
        discounts: breakdown.discounts
          .map((discount, index) => ({
            id: discounts[index]?.id ?? `${String(breakdown.childIndex)}-${String(index)}`,
            label: discount.label,
            appliedAmountPence: discount.appliedAmountPence,
            optedOut: Boolean(discount.optedOut),
          }))
          .filter((discount) => discount.appliedAmountPence > 0),
      };
    });
  } catch {
    return [];
  }
}

function invoiceMatchesSearch(invoice: SchoolFeeInvoiceDto, search: string | undefined): boolean {
  if (!search) return true;
  const query = normalizeText(search);
  const candidates: Array<string | null | undefined> = [
    invoice.invoiceNumber,
    invoice.studentName,
    invoice.studentYearGroup,
    invoice.familyLabel,
    invoice.billingCadence,
    invoice.term,
    invoice.originalFileName,
    invoice.discountExplanation,
    ...invoice.lineItems.map((line) => line.description),
    ...invoice.discounts.map((discount) => discount.label),
  ];
  return candidates.some(
    (value) => typeof value === 'string' && normalizeText(value).includes(query),
  );
}

function invoiceMatchesAdminStatus(
  invoice: SchoolFeeInvoiceDto,
  status: (typeof invoiceAdminStatusFilters)[number],
): boolean {
  if (status === 'All') return true;
  return status === 'Overdue' ? invoice.displayStatus === 'Overdue' : invoice.status === status;
}

function invoiceMatchesParentStatus(
  invoice: SchoolFeeInvoiceDto,
  status: (typeof parentStatusFilters)[number],
): boolean {
  if (status === 'All') return true;
  return status === 'Overdue' ? invoice.displayStatus === 'Overdue' : invoice.status === status;
}

function calculateStats(invoices: readonly SchoolFeeInvoiceDto[]): SchoolFeeInvoiceStatsDto {
  return invoices.reduce<SchoolFeeInvoiceStatsDto>(
    (stats, invoice) => {
      stats.totalCount += 1;
      if (invoice.status === 'Draft') stats.draftCount += 1;
      if (invoice.status === 'Paid') {
        stats.paidCount += 1;
        stats.paidAmountPence += invoice.totalAmountPence;
      }
      if (invoice.status === 'PaymentPending') {
        stats.paymentPendingCount += 1;
        stats.outstandingAmountPence += invoice.totalAmountPence;
        stats.remainingAmountPence += invoice.totalAmountPence;
      }
      if (invoice.displayStatus === 'Overdue') {
        stats.overdueCount += 1;
        stats.overdueAmountPence += invoice.totalAmountPence;
        stats.outstandingAmountPence += invoice.totalAmountPence;
      } else if (invoice.status === 'Unpaid') {
        stats.unpaidCount += 1;
        stats.outstandingAmountPence += invoice.totalAmountPence;
        stats.remainingAmountPence += invoice.totalAmountPence;
      }
      return stats;
    },
    {
      totalCount: 0,
      draftCount: 0,
      unpaidCount: 0,
      paymentPendingCount: 0,
      overdueCount: 0,
      paidCount: 0,
      outstandingAmountPence: 0,
      overdueAmountPence: 0,
      paidAmountPence: 0,
      remainingAmountPence: 0,
    },
  );
}

function latestParentYearDiscountInputs(
  invoices: readonly SchoolFeeInvoiceDto[],
  schoolYear: number,
  studentCount: number,
): SchoolFeeDiscountInput[] {
  const latestByKey = new Map<
    string,
    { invoiceUpdatedAt: Date; discount: SchoolFeeDiscountInput }
  >();
  invoices
    .filter((invoice) => invoice.schoolYear === schoolYear)
    .forEach((invoice) => {
      invoice.discounts.forEach((discount) => {
        if (studentCount <= 1 && discount.presetCode === SCHOOL_FEE_SIBLING_DISCOUNT_CODE) return;
        const key =
          discount.kind === 'Preset' && discount.presetCode
            ? discount.presetCode
            : `${discount.kind}:${discount.presetCode ?? 'all'}:${discount.label}`;
        const existing = latestByKey.get(key);
        if (existing && existing.invoiceUpdatedAt > invoice.updatedAt) return;
        latestByKey.set(key, {
          invoiceUpdatedAt: invoice.updatedAt,
          discount: {
            label: discount.label,
            kind: discount.kind,
            presetCode: discount.presetCode,
            percentBps: discount.percentBps,
            amountPence: discount.amountPence,
            optedOut: discount.optedOut,
          },
        });
      });
    });
  return [...latestByKey.values()].map((entry) => entry.discount);
}

function calculateFamilyYearSummary({
  feeConfig,
  invoices,
  schoolYear,
  students,
}: {
  feeConfig: SchoolFeeYearFeeConfigDto;
  invoices: readonly SchoolFeeInvoiceDto[];
  schoolYear: number;
  students: readonly BillableStudentDto[];
}): SchoolFeeFamilyYearSummaryDto {
  const cycle = schoolFeeBillingCycle(schoolYear);
  const uniqueStudents = uniqueStudentsById(students);
  if (uniqueStudents.length === 0) {
    return {
      schoolYear,
      cycleLabel: cycle.label,
      cycleStartsOn: cycle.startsOn,
      cycleEndsOn: cycle.endsOn,
      annualAmountPence: 0,
      adjustedAnnualAmountPence: 0,
      discountAmountPence: 0,
      issuedAmountPence: 0,
      paidAmountPence: 0,
      paymentPendingAmountPence: 0,
      overdueAmountPence: 0,
      remainingAmountPence: 0,
      leftToInvoiceAmountPence: 0,
      invoiceCount: 0,
      children: [],
    };
  }

  const studentFees = schoolFeeStudentProratedFees({
    schoolYear,
    annualAmountPence: feeConfig.annualAmountPence,
    students: uniqueStudents.map((student) => ({
      studentId: student.id,
      enrolmentDate: student.enrolmentDate,
    })),
  });
  const feeByStudentId = new Map(studentFees.map((fee) => [fee.studentId, fee]));
  const annualChildAmounts = uniqueStudents.map(
    (student) => feeByStudentId.get(student.id)?.proratedAnnualAmountPence ?? 0,
  );
  const annualSubtotalAmountPence = annualChildAmounts.reduce((sum, amount) => sum + amount, 0);
  const discountInputs = latestParentYearDiscountInputs(
    invoices,
    schoolYear,
    uniqueStudents.length,
  );
  const annualDiscountCalculation = calculateSchoolFeeFamilyDiscounts({
    subtotalAmountPence: annualSubtotalAmountPence,
    studentCount: uniqueStudents.length,
    childLineAmountsPence: annualChildAmounts,
    discounts: discountInputs,
  });
  const adjustedAnnualAmountPence = annualDiscountCalculation.totalAmountPence;
  const yearInvoices = invoices.filter((invoice) => invoice.schoolYear === schoolYear);
  const issuedAmountPence = yearInvoices.reduce(
    (sum, invoice) => sum + invoice.totalAmountPence,
    0,
  );
  const confirmedPaidAmountPence = Math.min(
    yearInvoices
      .filter((invoice) => invoice.status === 'Paid')
      .reduce((sum, invoice) => sum + invoice.totalAmountPence, 0),
    adjustedAnnualAmountPence,
  );
  const paymentPendingAmountPence = yearInvoices
    .filter((invoice) => invoice.status === 'PaymentPending')
    .reduce((sum, invoice) => sum + invoice.totalAmountPence, 0);
  const leftToPayAmountPence = Math.max(adjustedAnnualAmountPence - confirmedPaidAmountPence, 0);
  const overdueAmountPence = Math.min(
    yearInvoices
      .filter((invoice) => invoice.displayStatus === 'Overdue')
      .reduce((sum, invoice) => sum + invoice.totalAmountPence, 0),
    leftToPayAmountPence,
  );
  const children = uniqueStudents.map<SchoolFeeStudentYearSummaryDto>((student, index) => {
    const fee = feeByStudentId.get(student.id);
    const childDiscountBreakdown = annualDiscountCalculation.childBreakdowns[index];
    const grossAnnualAmountPence = fee?.proratedAnnualAmountPence ?? 0;
    const adjustedChildAmountPence =
      childDiscountBreakdown?.totalAmountPence ?? grossAnnualAmountPence;
    const issuedForChild = sumInvoiceAmountsForStudent(yearInvoices, student.id);
    const paidForChild = sumInvoiceAmountsForStudent(
      yearInvoices.filter((invoice) => invoice.status === 'Paid'),
      student.id,
    );
    const paymentPendingForChild = sumInvoiceAmountsForStudent(
      yearInvoices.filter((invoice) => invoice.status === 'PaymentPending'),
      student.id,
    );
    const remainingForChild = Math.max(adjustedChildAmountPence - paidForChild, 0);
    return {
      studentId: student.id,
      studentName: student.fullName,
      yearGroup: student.yearGroup,
      enrolmentDate: student.enrolmentDate,
      chargeableStartsOn: fee?.chargeablePeriod.chargeableStartsOn ?? null,
      chargeableEndsOn: fee?.chargeablePeriod.chargeableEndsOn ?? null,
      chargeableMonths: fee?.chargeablePeriod.chargeableMonths ?? 0,
      grossAnnualAmountPence,
      adjustedAnnualAmountPence: adjustedChildAmountPence,
      discountAmountPence: Math.max(grossAnnualAmountPence - adjustedChildAmountPence, 0),
      issuedAmountPence: issuedForChild,
      paidAmountPence: Math.min(paidForChild, adjustedChildAmountPence),
      paymentPendingAmountPence: paymentPendingForChild,
      overdueAmountPence: Math.min(
        sumInvoiceAmountsForStudent(
          yearInvoices.filter((invoice) => invoice.displayStatus === 'Overdue'),
          student.id,
        ),
        remainingForChild,
      ),
      remainingAmountPence: remainingForChild,
      leftToInvoiceAmountPence: Math.max(adjustedChildAmountPence - issuedForChild, 0),
    };
  });

  return {
    schoolYear,
    cycleLabel: cycle.label,
    cycleStartsOn: cycle.startsOn,
    cycleEndsOn: cycle.endsOn,
    annualAmountPence: annualSubtotalAmountPence,
    adjustedAnnualAmountPence,
    discountAmountPence: Math.max(annualSubtotalAmountPence - adjustedAnnualAmountPence, 0),
    issuedAmountPence,
    paidAmountPence: confirmedPaidAmountPence,
    paymentPendingAmountPence,
    overdueAmountPence,
    remainingAmountPence: leftToPayAmountPence,
    leftToInvoiceAmountPence: Math.max(adjustedAnnualAmountPence - issuedAmountPence, 0),
    invoiceCount: yearInvoices.length,
    children,
  };
}

function uniqueStudentsById(students: readonly BillableStudentDto[]): BillableStudentDto[] {
  const byId = new Map<string, BillableStudentDto>();
  students.forEach((student) => {
    if (!byId.has(student.id)) byId.set(student.id, student);
  });
  return [...byId.values()];
}

function sumInvoiceAmountsForStudent(
  invoices: readonly SchoolFeeInvoiceDto[],
  studentId: string,
): number {
  return invoices.reduce((sum, invoice) => sum + invoiceAmountForStudent(invoice, studentId), 0);
}

function invoiceAmountForStudent(invoice: SchoolFeeInvoiceDto, studentId: string): number {
  const breakdown = invoice.discountBreakdowns.find(
    (candidate) => candidate.studentId === studentId,
  );
  if (breakdown) return breakdown.totalAmountPence;
  const invoiceStudentIds = new Set([
    ...invoice.students.map((student) => student.id),
    ...(invoice.studentId ? [invoice.studentId] : []),
  ]);
  if (invoiceStudentIds.size === 1 && invoiceStudentIds.has(studentId)) {
    return invoice.totalAmountPence;
  }
  return 0;
}

function calculateParentYearStats({
  feeConfig,
  invoices,
  schoolYear,
  students,
}: {
  feeConfig: SchoolFeeYearFeeConfigDto;
  invoices: readonly SchoolFeeInvoiceDto[];
  schoolYear: number;
  students: readonly BillableStudentDto[];
}): SchoolFeeInvoiceStatsDto {
  const invoiceStats = calculateStats(invoices);
  const uniqueStudents = uniqueStudentsById(students);
  if (uniqueStudents.length === 0) return invoiceStats;

  const summary = calculateFamilyYearSummary({
    feeConfig,
    invoices,
    schoolYear,
    students: uniqueStudents,
  });

  return {
    ...invoiceStats,
    outstandingAmountPence: summary.remainingAmountPence,
    overdueAmountPence: summary.overdueAmountPence,
    paidAmountPence: summary.paidAmountPence,
    remainingAmountPence: Math.max(summary.remainingAmountPence - summary.overdueAmountPence, 0),
  };
}

async function auditInvoiceDecrypt(
  ctx: AuthedContext,
  source: string,
  count: number,
): Promise<void> {
  if (count === 0) return;
  await ctx.db.auditLog.create({
    data: {
      userId: ctx.user.id,
      action: 'DecryptSensitive',
      entity: 'SchoolFeeInvoice',
      meta: { source, count },
    },
  });
}

async function auditStudentDecrypt(
  ctx: AuthedContext,
  source: string,
  count: number,
): Promise<void> {
  if (count === 0) return;
  await ctx.db.auditLog.create({
    data: {
      userId: ctx.user.id,
      action: 'DecryptPii',
      entity: 'Student',
      meta: { source, count },
    },
  });
}

async function defaultExtractPdfText(pdfBytes: Uint8Array): Promise<string> {
  ensurePromiseWithResolvers();

  type PdfTextItem = { str: string };
  type PdfPage = { getTextContent: () => Promise<{ items: unknown[] }> };
  type PdfDocument = { numPages: number; getPage: (pageNumber: number) => Promise<PdfPage> };
  type PdfJs = {
    getDocument: (input: {
      data: Uint8Array;
      disableWorker: boolean;
      isEvalSupported: boolean;
    }) => { promise: Promise<PdfDocument> };
  };

  try {
    const pdfjs = (await import('pdfjs-dist/legacy/build/pdf.mjs')) as PdfJs;
    const loadingTask = pdfjs.getDocument({
      data: pdfBytes,
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
          if (typeof item !== 'object' || item === null || !('str' in item)) return '';
          const candidate = item as PdfTextItem;
          return typeof candidate.str === 'string' ? candidate.str : '';
        })
        .filter(Boolean)
        .join('\n');
      if (pageText.trim()) textPages.push(pageText);
    }
    const extractedText = textPages.join('\n\n').trim();
    return extractedText || extractLiteralPdfText(pdfBytes);
  } catch {
    return extractLiteralPdfText(pdfBytes);
  }
}

interface PromiseWithResolversResult<T> {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
}

type PromiseConstructorWithResolvers = PromiseConstructor & {
  withResolvers?: <T>() => PromiseWithResolversResult<T>;
};

function ensurePromiseWithResolvers(): void {
  const promiseConstructor = Promise as PromiseConstructorWithResolvers;
  if (typeof promiseConstructor.withResolvers === 'function') return;

  Object.defineProperty(promiseConstructor, 'withResolvers', {
    configurable: true,
    writable: true,
    value: <T>(): PromiseWithResolversResult<T> => {
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

function extractLiteralPdfText(pdfBytes: Uint8Array): string {
  const pdfText = Buffer.from(pdfBytes).toString('latin1');
  const textMatches = pdfText.matchAll(/\((?:\\.|[^\\()])*\)\s*Tj/gu);
  const lines = [...textMatches]
    .map((match) => decodePdfLiteralString(match[0].replace(/\)\s*Tj$/u, '').slice(1)))
    .map((line) => line.trim())
    .filter(Boolean);
  return lines.join('\n');
}

function decodePdfLiteralString(value: string): string {
  return value
    .replace(/\\([nrtbf()\\])/gu, (_match, escaped: string) => {
      if (escaped === 'n') return '\n';
      if (escaped === 'r') return '\r';
      if (escaped === 't') return '\t';
      if (escaped === 'b') return '\b';
      if (escaped === 'f') return '\f';
      return escaped;
    })
    .replace(/\\([0-7]{1,3})/gu, (_match, octal: string) =>
      String.fromCharCode(Number.parseInt(octal, 8)),
    );
}

async function loadDraftForPublishing(tx: RlsTx, invoiceId: string) {
  const invoice = await tx.schoolFeeInvoice.findUnique({
    where: { id: invoiceId },
    select: { id: true, status: true },
  });
  if (!invoice) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'invoice not found' });
  }
  if (invoice.status !== 'Draft') {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'only draft invoices can be published' });
  }
}

async function assertActiveStudents(tx: RlsTx, studentIds: readonly string[]) {
  const students = await tx.student.findMany({
    where: { id: { in: [...studentIds] }, active: true },
    select: { id: true, fullNameEnc: true, yearGroup: true },
  });
  if (students.length !== studentIds.length) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'one or more students were not found' });
  }
  const byId = new Map(students.map((student) => [student.id, student]));
  return studentIds.map((studentId) => {
    const student = byId.get(studentId);
    if (!student) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'one or more students were not found' });
    }
    return student;
  });
}

async function assertInvoiceNumberAvailable(
  tx: RlsTx,
  invoiceNumber: string,
  currentInvoiceId?: string,
): Promise<void> {
  const existing = await tx.schoolFeeInvoice.findFirst({
    where: {
      invoiceNumber,
      ...(currentInvoiceId ? { NOT: { id: currentInvoiceId } } : {}),
    },
    select: { id: true },
  });
  if (existing) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'invoice number already exists' });
  }
}

async function parentStudentIds(ctx: AuthedContext): Promise<string[]> {
  const guardians = await ctx.db.guardian.findMany({
    where: { userId: ctx.user.id },
    select: { studentId: true },
  });
  return guardians.map((guardian) => guardian.studentId);
}

async function assertParentInvoiceAccess(
  ctx: AuthedContext,
  invoice: Pick<InvoiceDownloadRow, 'id' | 'studentId' | 'status'>,
): Promise<void> {
  if (!canUseLinkedChildInvoiceAccess(ctx.user) || invoice.status === 'Draft') {
    return auditPermissionDenied(
      ctx,
      'invoice.parentAccess',
      new AccessDeniedError('invoice access requires a linked child account'),
      invoice.id,
    );
  }

  const studentIds = await parentStudentIds(ctx);
  const legacyAccess = invoice.studentId ? studentIds.includes(invoice.studentId) : false;
  const link = await ctx.db.schoolFeeInvoiceStudent.findFirst({
    where: { invoiceId: invoice.id, studentId: { in: studentIds } },
    select: { invoiceId: true },
  });

  if (legacyAccess || link) return;

  await auditPermissionDenied(
    ctx,
    'invoice.parentAccess',
    new AccessDeniedError('invoice is not linked to this account'),
    invoice.id,
  );
}

function feeConfigDto(config: {
  schoolYear: number;
  annualAmountPence: number;
  termAmountPence: number;
  monthlyAmountPence: number;
}): SchoolFeeYearFeeConfigDto {
  const cycle = schoolFeeBillingCycle(config.schoolYear);
  return {
    ...config,
    cycleLabel: cycle.label,
    cycleStartsOn: cycle.startsOn,
    cycleEndsOn: cycle.endsOn,
  };
}

function defaultFeeConfig(schoolYear: number): SchoolFeeYearFeeConfigDto {
  const config =
    schoolYear === DEFAULT_2026_FEE_CONFIG.schoolYear
      ? DEFAULT_2026_FEE_CONFIG
      : {
          schoolYear,
          annualAmountPence: DEFAULT_2026_FEE_CONFIG.annualAmountPence,
          termAmountPence: DEFAULT_2026_FEE_CONFIG.termAmountPence,
          monthlyAmountPence: DEFAULT_2026_FEE_CONFIG.monthlyAmountPence,
        };
  return feeConfigDto(config);
}

async function loadSchoolFeeConfig(
  ctx: AuthedContext,
  schoolYear: number,
): Promise<SchoolFeeYearFeeConfigDto> {
  const config = await ctx.withRls((tx) =>
    tx.schoolFeeYearFeeConfig.findUnique({
      where: { schoolYear },
      select: feeConfigSelect,
    }),
  );
  return feeConfigDto(config ?? defaultFeeConfig(schoolYear));
}

function normalizeDiscountInput(
  input: z.infer<typeof invoiceDiscountInput>,
): SchoolFeeDiscountInput {
  if (input.kind === 'ManualFixed') {
    if (!input.amountPence || input.amountPence <= 0) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'fixed discounts need an amount' });
    }
    return {
      label: input.label,
      kind: input.kind,
      presetCode: input.presetCode ?? null,
      percentBps: null,
      amountPence: input.amountPence,
    };
  }

  const percentBps = input.percentBps ?? 0;
  if (percentBps <= 0) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'percentage discounts need a percentage' });
  }
  return {
    label: input.label,
    kind: input.kind,
    presetCode: input.presetCode ?? null,
    percentBps,
    amountPence: null,
  };
}

function discountCreateData(
  ctx: AuthedContext,
  discounts: readonly z.infer<typeof invoiceDiscountInput>[],
  subtotalAmountPence: number,
  childScope?: { studentCount: number; childLineAmountsPence: readonly number[] },
) {
  const normalized = discounts.map(normalizeDiscountInput);
  const calculation = childScope
    ? calculateSchoolFeeFamilyDiscounts({
        subtotalAmountPence,
        studentCount: childScope.studentCount,
        childLineAmountsPence: childScope.childLineAmountsPence,
        discounts: normalized,
      })
    : calculateSchoolFeeDiscounts(subtotalAmountPence, normalized);
  return {
    calculation,
    create: calculation.discounts.map((discount, index) => ({
      position: index + 1,
      labelEnc: ctx.db.$enc.encrypt(discount.label),
      kind: discount.kind,
      presetCode: discount.presetCode ?? null,
      percentBps: discount.percentBps,
      amountPence: discount.amountPence,
      baseAmountPence: discount.baseAmountPence,
      appliedAmountPence: discount.appliedAmountPence,
    })),
  };
}

function childLineAmountsPence(
  lines: readonly SchoolFeeInvoiceLineInput[],
  studentCount: number,
): number[] {
  if (lines.length < studentCount) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'generated invoices need one line item per child',
    });
  }
  return lines.slice(0, studentCount).map((line) => lineItemTotalPence(line));
}

function storedDiscountInputs(
  ctx: AuthedContext,
  discounts: readonly InvoiceDiscountRow[],
  patch?: { discountId: string; optedOut: boolean },
): SchoolFeeDiscountInput[] {
  return discounts.map((discount) => ({
    label: decryptRequired(ctx.db.$enc.decrypt, discount.labelEnc, 'invoice discount label'),
    kind: discount.kind,
    presetCode: discount.presetCode,
    percentBps: discount.percentBps,
    amountPence: discount.amountPence,
    optedOut: patch?.discountId === discount.id ? patch.optedOut : discount.optedOutAt !== null,
  }));
}

async function buildGeneratedInvoicePdf(
  ctx: AuthedContext,
  invoice: InvoiceRow,
): Promise<{ pdfBase64: string; extractedText: string; fileSizeBytes: number }> {
  const students = mapStudentRows(ctx, invoice);
  const invoiceNumber = invoice.invoiceNumber ?? 'School Fee Invoice';
  const lineItems = invoice.lineItems.map((line) => lineInputFromRow(ctx, line));
  const lineItemDtos = invoice.lineItems.map((line) => lineDtoFromRow(ctx, line));
  const discounts = (invoice.discounts ?? []).map((discount) =>
    discountDtoFromRow(ctx, discount, invoice.status),
  );
  const discountBreakdowns = invoiceChildDiscountBreakdowns(
    invoice,
    students,
    lineItemDtos,
    discounts,
  ).map((breakdown) => ({
    childIndex: breakdown.childIndex,
    discountAmountPence: breakdown.discountAmountPence,
    totalAmountPence: breakdown.totalAmountPence,
    discounts: breakdown.discounts.map((discount) => ({
      label: discount.label,
      appliedAmountPence: discount.appliedAmountPence,
    })),
  }));
  const pdfInput: GenerateSchoolFeeInvoicePdfInput = {
    invoiceNumber,
    issuedOn: invoice.issuedOn,
    dueOn: invoice.dueOn,
    billTo: decryptOptional(ctx.db.$enc.decrypt, invoice.familyLabelEnc) ?? 'Family',
    familyLabel: decryptOptional(ctx.db.$enc.decrypt, invoice.familyLabelEnc),
    students: students.map((student) => ({ name: student.fullName, yearGroup: student.yearGroup })),
    schoolYear: invoice.schoolYear,
    billingCadence: invoice.billingCadence,
    term: invoice.term,
    subtotalAmountPence: invoice.subtotalAmountPence,
    discountAmountPence: invoice.discountAmountPence,
    totalAmountPence: invoice.totalAmountPence,
    discountExplanation: discountExplanationFromRow(ctx, invoice),
    paymentReference: invoiceNumber,
    lineItems,
    discounts: discounts.map((discount) => ({
      label: discount.label,
      baseAmountPence: discount.baseAmountPence,
      appliedAmountPence: discount.appliedAmountPence,
      optedOut: discount.optedOut,
    })),
    discountBreakdowns,
  };
  const generated = await generateSchoolFeeInvoicePdf(pdfInput);
  return {
    pdfBase64: Buffer.from(generated.bytes).toString('base64'),
    extractedText: generated.extractedText,
    fileSizeBytes: generated.bytes.length,
  };
}

function uniqueValues(values: readonly string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function familyNameFromStudentName(fullName: string): string {
  const words = fullName.trim().split(/\s+/u);
  return words.at(-1) ?? fullName.trim();
}

export function createInvoiceRouter(deps: InvoiceRouterDeps = {}) {
  const extractPdfText = deps.extractPdfText ?? defaultExtractPdfText;

  return router({
    listAdmin: authedProcedure.input(adminListInput).query(async ({ ctx, input }) => {
      await requireInvoiceManager(ctx, 'invoice.listAdmin');

      const now = new Date();
      const rows = (await ctx.withRls((tx) =>
        tx.schoolFeeInvoice.findMany({
          include: invoiceInclude,
          orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
        }),
      )) as InvoiceRow[];

      const mappedInvoices = rows.map((invoice) => mapInvoice(ctx, invoice, now));
      const invoices = mappedInvoices
        .filter((invoice) => invoiceMatchesAdminStatus(invoice, input?.status ?? 'All'))
        .filter((invoice) => invoiceMatchesSearch(invoice, input?.search));

      await auditInvoiceDecrypt(ctx, 'invoice.listAdmin', mappedInvoices.length);
      return { invoices, stats: calculateStats(mappedInvoices) };
    }),

    listFeeConfig: authedProcedure.input(schoolYearInput).query(async ({ ctx, input }) => {
      await requireInvoiceManager(ctx, 'invoice.listFeeConfig');
      const schoolYear = input?.schoolYear ?? activeSchoolFeeYear();
      return loadSchoolFeeConfig(ctx, schoolYear);
    }),

    upsertFeeConfig: authedProcedure.input(feeConfigInput).mutation(async ({ ctx, input }) => {
      await requireInvoiceManager(ctx, 'invoice.upsertFeeConfig');
      const config = await ctx.withRls(async (tx) => {
        const updated = await tx.schoolFeeYearFeeConfig.upsert({
          where: { schoolYear: input.schoolYear },
          create: input,
          update: {
            annualAmountPence: input.annualAmountPence,
            termAmountPence: input.termAmountPence,
            monthlyAmountPence: input.monthlyAmountPence,
          },
          select: feeConfigSelect,
        });
        await tx.auditLog.create({
          data: {
            userId: ctx.user.id,
            action: 'Update',
            entity: 'SchoolFeeYearFeeConfig',
            entityId: String(input.schoolYear),
            meta: { source: 'invoice.upsertFeeConfig' },
          },
        });
        return updated;
      });
      return feeConfigDto(config);
    }),

    discountPresets: authedProcedure.query(() => SCHOOL_FEE_DISCOUNT_PRESETS),

    listBillableStudents: authedProcedure.query(async ({ ctx }) => {
      await requireInvoiceManager(ctx, 'invoice.listBillableStudents');

      const students = await ctx.withRls((tx) =>
        tx.student.findMany({
          where: { active: true },
          orderBy: [{ yearGroup: 'asc' }, { createdAt: 'desc' }],
          select: { id: true, fullNameEnc: true, yearGroup: true, enrolmentDate: true },
        }),
      );
      const rows = students.map((student) => ({
        id: student.id,
        fullName: decryptRequired(ctx.db.$enc.decrypt, student.fullNameEnc, 'student name'),
        yearGroup: student.yearGroup,
        enrolmentDate: dateOnly(student.enrolmentDate) ?? '',
      })) satisfies BillableStudentDto[];

      await auditStudentDecrypt(ctx, 'invoice.listBillableStudents', rows.length);
      return rows;
    }),

    listBillableFamilies: authedProcedure.query(async ({ ctx }) => {
      await requireInvoiceManager(ctx, 'invoice.listBillableFamilies');

      const students = await ctx.withRls((tx) =>
        tx.student.findMany({
          where: { active: true },
          orderBy: [{ yearGroup: 'asc' }, { createdAt: 'desc' }],
          select: {
            id: true,
            fullNameEnc: true,
            yearGroup: true,
            enrolmentDate: true,
            guardians: {
              select: {
                userId: true,
                user: { select: { id: true, fullNameEnc: true, emailEnc: true } },
              },
            },
          },
        }),
      );

      const families = new Map<string, Omit<BillableFamilyDto, 'yearSummary'>>();
      for (const student of students) {
        const fullName = decryptRequired(ctx.db.$enc.decrypt, student.fullNameEnc, 'student name');
        const guardians = student.guardians.map((guardian) => ({
          id: guardian.user.id,
          fullName: decryptRequired(
            ctx.db.$enc.decrypt,
            guardian.user.fullNameEnc,
            'guardian name',
          ),
          email: decryptRequired(ctx.db.$enc.decrypt, guardian.user.emailEnc, 'guardian email'),
        }));
        const surname = familyNameFromStudentName(fullName);
        const familyKey =
          guardians.length > 0
            ? guardians
                .map((guardian) => guardian.id)
                .sort()
                .join('|')
            : `student:${surname.toLowerCase()}`;
        const existing = families.get(familyKey);
        const row =
          existing ??
          ({
            familyKey,
            familyLabel: `${surname} family`,
            students: [],
            guardians: [],
          } satisfies Omit<BillableFamilyDto, 'yearSummary'>);
        row.students.push({
          id: student.id,
          fullName,
          yearGroup: student.yearGroup,
          enrolmentDate: dateOnly(student.enrolmentDate) ?? '',
        });
        guardians.forEach((guardian) => {
          if (!row.guardians.some((candidate) => candidate.id === guardian.id)) {
            row.guardians.push(guardian);
          }
        });
        families.set(familyKey, row);
      }

      const familyRows = [...families.values()].sort((left, right) =>
        left.familyLabel.localeCompare(right.familyLabel),
      );
      const schoolYear = activeSchoolFeeYear();
      const feeConfig = await loadSchoolFeeConfig(ctx, schoolYear);
      const studentIds = familyRows.flatMap((family) =>
        family.students.map((student) => student.id),
      );
      const links =
        studentIds.length === 0
          ? []
          : await ctx.withRls((tx) =>
              tx.schoolFeeInvoiceStudent.findMany({
                where: { studentId: { in: studentIds } },
                select: { invoiceId: true, studentId: true },
              }),
            );
      const linkedInvoiceIds = [...new Set(links.map((link) => link.invoiceId))];
      const invoiceRows =
        studentIds.length === 0
          ? []
          : ((await ctx.withRls((tx) =>
              tx.schoolFeeInvoice.findMany({
                where: {
                  OR: [{ id: { in: linkedInvoiceIds } }, { studentId: { in: studentIds } }],
                  status: { not: 'Draft' },
                },
                include: invoiceInclude,
                orderBy: [{ dueOn: 'asc' }, { createdAt: 'desc' }],
              }),
            )) as InvoiceRow[]);
      const now = new Date();
      const mappedInvoices = invoiceRows.map((invoice) => mapInvoice(ctx, invoice, now));
      const invoicesByStudentId = new Map<string, SchoolFeeInvoiceDto[]>();
      mappedInvoices.forEach((invoice) => {
        const invoiceStudentIds = new Set([
          ...invoice.students.map((student) => student.id),
          ...(invoice.studentId ? [invoice.studentId] : []),
        ]);
        invoiceStudentIds.forEach((studentId) => {
          invoicesByStudentId.set(studentId, [
            ...(invoicesByStudentId.get(studentId) ?? []),
            invoice,
          ]);
        });
      });
      const rows: BillableFamilyDto[] = familyRows.map((family) => {
        const familyStudentIds = family.students.map((student) => student.id);
        const familyInvoices = new Map<string, SchoolFeeInvoiceDto>();
        familyStudentIds.forEach((studentId) => {
          invoicesByStudentId.get(studentId)?.forEach((invoice) => {
            familyInvoices.set(invoice.id, invoice);
          });
        });
        return {
          ...family,
          yearSummary: calculateFamilyYearSummary({
            feeConfig,
            invoices: [...familyInvoices.values()],
            schoolYear,
            students: family.students,
          }),
        };
      });
      await auditStudentDecrypt(ctx, 'invoice.listBillableFamilies', students.length);
      await auditInvoiceDecrypt(ctx, 'invoice.listBillableFamilies', mappedInvoices.length);
      return rows;
    }),

    listParent: authedProcedure.input(parentListInput).query(async ({ ctx, input }) => {
      if (!canUseLinkedChildInvoiceAccess(ctx.user)) {
        await auditPermissionDenied(
          ctx,
          'invoice.listParent',
          new AccessDeniedError('parent invoice list requires a linked child account'),
        );
      }

      const studentIds = await parentStudentIds(ctx);
      if (studentIds.length === 0) {
        const schoolYear = activeSchoolFeeYear();
        const feeConfig = defaultFeeConfig(schoolYear);
        return {
          invoices: [],
          stats: calculateStats([]),
          yearSummary: calculateFamilyYearSummary({
            feeConfig,
            invoices: [],
            schoolYear,
            students: [],
          }),
        };
      }

      const links = await ctx.db.schoolFeeInvoiceStudent.findMany({
        where: { studentId: { in: studentIds } },
        select: { invoiceId: true },
      });
      const linkedInvoiceIds = [...new Set(links.map((link) => link.invoiceId))];
      const now = new Date();
      const rows = (await ctx.withRls((tx) =>
        tx.schoolFeeInvoice.findMany({
          where: {
            OR: [{ id: { in: linkedInvoiceIds } }, { studentId: { in: studentIds } }],
            status: { not: 'Draft' },
          },
          include: invoiceInclude,
          orderBy: [{ dueOn: 'asc' }, { createdAt: 'desc' }],
        }),
      )) as InvoiceRow[];

      const mappedInvoices = rows.map((invoice) => mapInvoice(ctx, invoice, now));
      const invoices = mappedInvoices
        .filter((invoice) => invoiceMatchesParentStatus(invoice, input?.status ?? 'All'))
        .filter((invoice) => invoiceMatchesSearch(invoice, input?.search));
      const schoolYear = activeSchoolFeeYear();
      const feeConfig = await loadSchoolFeeConfig(ctx, schoolYear);
      const familyStudentIds = [
        ...new Set([
          ...studentIds,
          ...mappedInvoices.flatMap((invoice) => invoice.students.map((student) => student.id)),
        ]),
      ];
      const familyStudentRows =
        familyStudentIds.length === 0
          ? []
          : await ctx.withRls((tx) =>
              tx.student.findMany({
                where: { id: { in: familyStudentIds }, active: true },
                select: { id: true, fullNameEnc: true, yearGroup: true, enrolmentDate: true },
              }),
            );
      const familyStudents = familyStudentRows.map((student) => ({
        id: student.id,
        fullName: decryptRequired(ctx.db.$enc.decrypt, student.fullNameEnc, 'student name'),
        yearGroup: student.yearGroup,
        enrolmentDate: dateOnly(student.enrolmentDate) ?? '',
      })) satisfies BillableStudentDto[];

      await auditInvoiceDecrypt(ctx, 'invoice.listParent', mappedInvoices.length);
      await auditStudentDecrypt(ctx, 'invoice.listParent', familyStudents.length);
      const yearSummary = calculateFamilyYearSummary({
        feeConfig,
        invoices: mappedInvoices,
        schoolYear,
        students: familyStudents,
      });
      return {
        invoices,
        stats: calculateParentYearStats({
          feeConfig,
          invoices: mappedInvoices,
          schoolYear,
          students: familyStudents,
        }),
        yearSummary,
      };
    }),

    uploadDraft: authedProcedure.input(uploadDraftInput).mutation(async ({ ctx, input }) => {
      await requireInvoiceManager(ctx, 'invoice.uploadDraft');

      const pdfBytes = decodePdfInput(input);
      const originalFileName = safeOriginalFileName(input.fileName);
      const extractedText = await extractPdfText(new Uint8Array(pdfBytes));
      const parsed: ParsedSchoolFeeInvoice = extractedText
        ? parseSchoolFeeInvoiceText(extractedText)
        : {
            invoiceNumber: null,
            familyLabel: null,
            issuedOn: null,
            dueOn: null,
            term: null,
            lineItems: [],
            totalAmountPence: null,
          };

      const invoice = (await ctx.withRls(async (tx) => {
        const created = await tx.schoolFeeInvoice.create({
          data: {
            status: 'Draft',
            familyLabelEnc: parsed.familyLabel ? ctx.db.$enc.encrypt(parsed.familyLabel) : null,
            term: parsed.term,
            issuedOn: parseDateInput(parsed.issuedOn),
            dueOn: parseDateInput(parsed.dueOn),
            subtotalAmountPence: parsed.totalAmountPence ?? 0,
            discountAmountPence: 0,
            totalAmountPence: parsed.totalAmountPence ?? 0,
            originalFileNameEnc: ctx.db.$enc.encrypt(originalFileName),
            fileMimeType: 'application/pdf',
            fileSizeBytes: pdfBytes.length,
            pdfBytesEnc: ctx.db.$enc.encrypt(pdfBytes.toString('base64')),
            extractedTextEnc: extractedText ? ctx.db.$enc.encrypt(extractedText) : null,
            createdById: ctx.user.id,
            lineItems: {
              create: parsed.lineItems.map((line, index) => ({
                ...lineData(line, index + 1),
                descriptionEnc: ctx.db.$enc.encrypt(line.description),
              })),
            },
          },
          include: invoiceInclude,
        });
        await tx.auditLog.create({
          data: {
            userId: ctx.user.id,
            action: 'Create',
            entity: 'SchoolFeeInvoice',
            entityId: created.id,
            meta: {
              source: 'invoice.uploadDraft',
              fileSizeBytes: pdfBytes.length,
              parsedLineCount: parsed.lineItems.length,
            },
          },
        });
        return created;
      })) as InvoiceRow;

      return {
        invoice: mapInvoice(ctx, invoice, new Date()),
        parsed,
      };
    }),

    publishDraft: authedProcedure.input(publishDraftInput).mutation(async ({ ctx, input }) => {
      await requireInvoiceManager(ctx, 'invoice.publishDraft', input.invoiceId);
      const studentIds = input.studentIds ?? (input.studentId ? [input.studentId] : []);

      let totalAmountPence: number;
      try {
        totalAmountPence = invoiceTotalPence(input.lineItems);
      } catch (err) {
        asBadRequest(err);
      }

      const invoice = (await ctx.withRls(async (tx) => {
        await loadDraftForPublishing(tx, input.invoiceId);
        await assertActiveStudents(tx, studentIds);
        await assertInvoiceNumberAvailable(tx, input.invoiceNumber, input.invoiceId);

        const updated = await tx.schoolFeeInvoice.update({
          where: { id: input.invoiceId },
          data: {
            invoiceNumber: input.invoiceNumber,
            studentId: studentIds[0] ?? null,
            status: 'Unpaid',
            schoolYear: input.schoolYear ?? null,
            billingCadence: input.billingCadence ?? null,
            familyLabelEnc: input.familyLabel ? ctx.db.$enc.encrypt(input.familyLabel) : null,
            term: input.term,
            issuedOn: parseDateInput(input.issuedOn),
            dueOn: parseDateInput(input.dueOn),
            paidAt: null,
            subtotalAmountPence: totalAmountPence,
            discountAmountPence: 0,
            totalAmountPence,
            lineItems: {
              deleteMany: {},
              create: input.lineItems.map((line, index) => ({
                ...lineData(line, index + 1),
                descriptionEnc: ctx.db.$enc.encrypt(line.description),
              })),
            },
            students: {
              deleteMany: {},
              create: studentIds.map((studentId, index) => ({
                studentId,
                position: index + 1,
              })),
            },
            discounts: { deleteMany: {} },
          },
          include: invoiceInclude,
        });

        await tx.auditLog.create({
          data: {
            userId: ctx.user.id,
            action: 'Update',
            entity: 'SchoolFeeInvoice',
            entityId: updated.id,
            meta: {
              source: 'invoice.publishDraft',
              studentIds,
              schoolYear: input.schoolYear ?? null,
              billingCadence: input.billingCadence ?? null,
              invoiceNumber: input.invoiceNumber,
              totalAmountPence,
            },
          },
        });

        return updated;
      })) as InvoiceRow;

      return mapInvoice(ctx, invoice, new Date());
    }),

    createGenerated: authedProcedure
      .input(createGeneratedInput)
      .mutation(async ({ ctx, input }) => {
        await requireInvoiceManager(ctx, 'invoice.createGenerated');

        let subtotalAmountPence: number;
        try {
          subtotalAmountPence = invoiceTotalPence(input.lineItems);
        } catch (err) {
          asBadRequest(err);
        }
        let childAmounts: number[];
        try {
          childAmounts = childLineAmountsPence(input.lineItems, input.studentIds.length);
        } catch (err) {
          if (err instanceof TRPCError) throw err;
          asBadRequest(err);
        }
        const discountData = (() => {
          try {
            return discountCreateData(ctx, input.discounts, subtotalAmountPence, {
              studentCount: input.studentIds.length,
              childLineAmountsPence: childAmounts,
            });
          } catch (err) {
            if (err instanceof TRPCError) throw err;
            asBadRequest(err);
          }
        })();

        const invoice = await ctx.withRls(async (tx) => {
          const students = await assertActiveStudents(tx, input.studentIds);
          await assertInvoiceNumberAvailable(tx, input.invoiceNumber);
          const studentDtos = students.map((student) => ({
            name: decryptRequired(ctx.db.$enc.decrypt, student.fullNameEnc, 'student name'),
            yearGroup: student.yearGroup,
          }));
          const pdf = await generateSchoolFeeInvoicePdf({
            invoiceNumber: input.invoiceNumber,
            issuedOn: parseDateInput(input.issuedOn),
            dueOn: parseDateInput(input.dueOn),
            billTo: input.familyLabel,
            familyLabel: input.familyLabel,
            students: studentDtos,
            schoolYear: input.schoolYear,
            billingCadence: input.billingCadence,
            term: input.term,
            subtotalAmountPence,
            discountAmountPence: discountData.calculation.discountAmountPence,
            totalAmountPence: discountData.calculation.totalAmountPence,
            discountExplanation: input.discountExplanation,
            paymentReference: input.invoiceNumber,
            lineItems: input.lineItems.map((line) => ({
              ...line,
              totalAmountPence: line.quantity * line.unitAmountPence,
            })),
            discounts: discountData.calculation.discounts.map((discount) => ({
              label: discount.label,
              baseAmountPence: discount.baseAmountPence,
              appliedAmountPence: discount.appliedAmountPence,
              optedOut: Boolean(discount.optedOut),
            })),
            discountBreakdowns: discountData.calculation.childBreakdowns.map((breakdown) => ({
              childIndex: breakdown.childIndex,
              discountAmountPence: breakdown.discountAmountPence,
              totalAmountPence: breakdown.totalAmountPence,
              discounts: breakdown.discounts
                .filter((discount) => discount.appliedAmountPence > 0)
                .map((discount) => ({
                  label: discount.label,
                  appliedAmountPence: discount.appliedAmountPence,
                })),
            })),
          });
          const fileName = `${input.invoiceNumber}.pdf`;
          const created = await tx.schoolFeeInvoice.create({
            data: {
              invoiceNumber: input.invoiceNumber,
              studentId: input.studentIds[0] ?? null,
              status: 'Unpaid',
              schoolYear: input.schoolYear,
              billingCadence: input.billingCadence,
              familyLabelEnc: ctx.db.$enc.encrypt(input.familyLabel),
              term: input.term,
              issuedOn: parseDateInput(input.issuedOn),
              dueOn: parseDateInput(input.dueOn),
              paidAt: null,
              subtotalAmountPence,
              discountAmountPence: discountData.calculation.discountAmountPence,
              totalAmountPence: discountData.calculation.totalAmountPence,
              discountExplanationEnc: ctx.db.$enc.encrypt(input.discountExplanation),
              originalFileNameEnc: ctx.db.$enc.encrypt(fileName),
              fileMimeType: 'application/pdf',
              fileSizeBytes: pdf.bytes.length,
              pdfBytesEnc: ctx.db.$enc.encrypt(Buffer.from(pdf.bytes).toString('base64')),
              extractedTextEnc: ctx.db.$enc.encrypt(pdf.extractedText),
              createdById: ctx.user.id,
              lineItems: {
                create: input.lineItems.map((line, index) => ({
                  ...lineData(line, index + 1),
                  descriptionEnc: ctx.db.$enc.encrypt(line.description),
                })),
              },
              students: {
                create: input.studentIds.map((studentId, index) => ({
                  studentId,
                  position: index + 1,
                })),
              },
              discounts: { create: discountData.create },
            },
            include: invoiceInclude,
          });
          await tx.auditLog.create({
            data: {
              userId: ctx.user.id,
              action: 'Create',
              entity: 'SchoolFeeInvoice',
              entityId: created.id,
              meta: {
                source: 'invoice.createGenerated',
                studentIds: input.studentIds,
                schoolYear: input.schoolYear,
                billingCadence: input.billingCadence,
                subtotalAmountPence,
                discountAmountPence: discountData.calculation.discountAmountPence,
                totalAmountPence: discountData.calculation.totalAmountPence,
              },
            },
          });
          return created;
        });

        return mapInvoice(ctx, invoice, new Date());
      }),

    updateGenerated: authedProcedure
      .input(updateGeneratedInput)
      .mutation(async ({ ctx, input }) => {
        await requireInvoiceManager(ctx, 'invoice.updateGenerated', input.invoiceId);

        let subtotalAmountPence: number;
        try {
          subtotalAmountPence = invoiceTotalPence(input.lineItems);
        } catch (err) {
          asBadRequest(err);
        }
        let childAmounts: number[];
        try {
          childAmounts = childLineAmountsPence(input.lineItems, input.studentIds.length);
        } catch (err) {
          if (err instanceof TRPCError) throw err;
          asBadRequest(err);
        }
        const discountData = (() => {
          try {
            return discountCreateData(ctx, input.discounts, subtotalAmountPence, {
              studentCount: input.studentIds.length,
              childLineAmountsPence: childAmounts,
            });
          } catch (err) {
            if (err instanceof TRPCError) throw err;
            asBadRequest(err);
          }
        })();

        const invoice = await ctx.withRls(async (tx) => {
          const existing = await tx.schoolFeeInvoice.findUnique({
            where: { id: input.invoiceId },
            select: { id: true, status: true },
          });
          if (!existing) {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'invoice not found' });
          }
          if (existing.status !== 'Draft' && existing.status !== 'Unpaid') {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'only draft and unpaid invoices can be edited',
            });
          }

          const students = await assertActiveStudents(tx, input.studentIds);
          await assertInvoiceNumberAvailable(tx, input.invoiceNumber, input.invoiceId);
          const studentDtos = students.map((student) => ({
            name: decryptRequired(ctx.db.$enc.decrypt, student.fullNameEnc, 'student name'),
            yearGroup: student.yearGroup,
          }));
          const pdf = await generateSchoolFeeInvoicePdf({
            invoiceNumber: input.invoiceNumber,
            issuedOn: parseDateInput(input.issuedOn),
            dueOn: parseDateInput(input.dueOn),
            billTo: input.familyLabel,
            familyLabel: input.familyLabel,
            students: studentDtos,
            schoolYear: input.schoolYear,
            billingCadence: input.billingCadence,
            term: input.term,
            subtotalAmountPence,
            discountAmountPence: discountData.calculation.discountAmountPence,
            totalAmountPence: discountData.calculation.totalAmountPence,
            discountExplanation: input.discountExplanation,
            paymentReference: input.invoiceNumber,
            lineItems: input.lineItems.map((line) => ({
              ...line,
              totalAmountPence: line.quantity * line.unitAmountPence,
            })),
            discounts: discountData.calculation.discounts.map((discount) => ({
              label: discount.label,
              baseAmountPence: discount.baseAmountPence,
              appliedAmountPence: discount.appliedAmountPence,
              optedOut: Boolean(discount.optedOut),
            })),
            discountBreakdowns: discountData.calculation.childBreakdowns.map((breakdown) => ({
              childIndex: breakdown.childIndex,
              discountAmountPence: breakdown.discountAmountPence,
              totalAmountPence: breakdown.totalAmountPence,
              discounts: breakdown.discounts
                .filter((discount) => discount.appliedAmountPence > 0)
                .map((discount) => ({
                  label: discount.label,
                  appliedAmountPence: discount.appliedAmountPence,
                })),
            })),
          });
          const fileName = `${input.invoiceNumber}.pdf`;
          const updated = await tx.schoolFeeInvoice.update({
            where: { id: input.invoiceId },
            data: {
              invoiceNumber: input.invoiceNumber,
              studentId: input.studentIds[0] ?? null,
              status: existing.status,
              schoolYear: input.schoolYear,
              billingCadence: input.billingCadence,
              familyLabelEnc: ctx.db.$enc.encrypt(input.familyLabel),
              term: input.term,
              issuedOn: parseDateInput(input.issuedOn),
              dueOn: parseDateInput(input.dueOn),
              subtotalAmountPence,
              discountAmountPence: discountData.calculation.discountAmountPence,
              totalAmountPence: discountData.calculation.totalAmountPence,
              discountExplanationEnc: ctx.db.$enc.encrypt(input.discountExplanation),
              originalFileNameEnc: ctx.db.$enc.encrypt(fileName),
              fileMimeType: 'application/pdf',
              fileSizeBytes: pdf.bytes.length,
              pdfBytesEnc: ctx.db.$enc.encrypt(Buffer.from(pdf.bytes).toString('base64')),
              extractedTextEnc: ctx.db.$enc.encrypt(pdf.extractedText),
              parentMarkedPaidAt: null,
              parentMarkedPaidById: null,
              lineItems: {
                deleteMany: {},
                create: input.lineItems.map((line, index) => ({
                  ...lineData(line, index + 1),
                  descriptionEnc: ctx.db.$enc.encrypt(line.description),
                })),
              },
              students: {
                deleteMany: {},
                create: input.studentIds.map((studentId, index) => ({
                  studentId,
                  position: index + 1,
                })),
              },
              discounts: { deleteMany: {}, create: discountData.create },
            },
            include: invoiceInclude,
          });
          await tx.auditLog.create({
            data: {
              userId: ctx.user.id,
              action: 'Update',
              entity: 'SchoolFeeInvoice',
              entityId: updated.id,
              meta: {
                source: 'invoice.updateGenerated',
                studentIds: input.studentIds,
                schoolYear: input.schoolYear,
                billingCadence: input.billingCadence,
                subtotalAmountPence,
                discountAmountPence: discountData.calculation.discountAmountPence,
                totalAmountPence: discountData.calculation.totalAmountPence,
              },
            },
          });
          return updated;
        });

        return mapInvoice(ctx, invoice, new Date());
      }),

    markPaid: authedProcedure.input(invoiceIdInput).mutation(async ({ ctx, input }) => {
      await requireInvoiceManager(ctx, 'invoice.markPaid', input.invoiceId);

      const invoice = (await ctx.withRls(async (tx) => {
        const existing = await tx.schoolFeeInvoice.findUnique({
          where: { id: input.invoiceId },
          select: { id: true, status: true },
        });
        if (!existing) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'invoice not found' });
        }
        if (existing.status === 'Draft') {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'draft invoices cannot be paid' });
        }

        const now = new Date();
        const updated = await tx.schoolFeeInvoice.update({
          where: { id: input.invoiceId },
          data: {
            status: 'Paid',
            paidAt: now,
            paymentConfirmedAt: now,
            paymentConfirmedById: ctx.user.id,
          },
          include: invoiceInclude,
        });
        await tx.auditLog.create({
          data: {
            userId: ctx.user.id,
            action: 'Update',
            entity: 'SchoolFeeInvoice',
            entityId: updated.id,
            meta: { source: 'invoice.markPaid' },
          },
        });
        return updated;
      })) as InvoiceRow;

      return mapInvoice(ctx, invoice, new Date());
    }),

    markUnpaid: authedProcedure.input(invoiceIdInput).mutation(async ({ ctx, input }) => {
      await requireInvoiceManager(ctx, 'invoice.markUnpaid', input.invoiceId);

      const invoice = (await ctx.withRls(async (tx) => {
        const existing = await tx.schoolFeeInvoice.findUnique({
          where: { id: input.invoiceId },
          select: { id: true, status: true },
        });
        if (!existing) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'invoice not found' });
        }
        if (existing.status === 'Draft') {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'draft invoices cannot be unpaid' });
        }

        const updated = await tx.schoolFeeInvoice.update({
          where: { id: input.invoiceId },
          data: {
            status: 'Unpaid',
            paidAt: null,
            parentMarkedPaidAt: null,
            parentMarkedPaidById: null,
            paymentConfirmedAt: null,
            paymentConfirmedById: null,
          },
          include: invoiceInclude,
        });
        await tx.auditLog.create({
          data: {
            userId: ctx.user.id,
            action: 'Update',
            entity: 'SchoolFeeInvoice',
            entityId: updated.id,
            meta: { source: 'invoice.markUnpaid' },
          },
        });
        return updated;
      })) as InvoiceRow;

      return mapInvoice(ctx, invoice, new Date());
    }),

    parentMarkPaid: authedProcedure.input(invoiceIdInput).mutation(async ({ ctx, input }) => {
      const row = (await ctx.withRls((tx) =>
        tx.schoolFeeInvoice.findUnique({
          where: { id: input.invoiceId },
          select: {
            id: true,
            studentId: true,
            status: true,
            invoiceNumber: true,
            originalFileNameEnc: true,
            fileMimeType: true,
            fileSizeBytes: true,
          },
        }),
      )) as InvoiceDownloadRow | null;
      if (!row) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'invoice not found' });
      }
      await assertParentInvoiceAccess(ctx, row);
      if (row.status !== 'Unpaid') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'only unpaid invoices can be marked paid',
        });
      }

      const invoice = (await ctx.withRls(async (tx) => {
        const updated = await tx.schoolFeeInvoice.update({
          where: { id: input.invoiceId },
          data: {
            status: 'PaymentPending',
            parentMarkedPaidAt: new Date(),
            parentMarkedPaidById: ctx.user.id,
          },
          include: invoiceInclude,
        });
        await tx.auditLog.create({
          data: {
            userId: ctx.user.id,
            action: 'Update',
            entity: 'SchoolFeeInvoice',
            entityId: updated.id,
            meta: { source: 'invoice.parentMarkPaid' },
          },
        });
        return updated;
      })) as InvoiceRow;

      return mapInvoice(ctx, invoice, new Date());
    }),

    confirmPayment: authedProcedure.input(invoiceIdInput).mutation(async ({ ctx, input }) => {
      await requireInvoiceManager(ctx, 'invoice.confirmPayment', input.invoiceId);

      const invoice = (await ctx.withRls(async (tx) => {
        const existing = await tx.schoolFeeInvoice.findUnique({
          where: { id: input.invoiceId },
          select: { id: true, status: true },
        });
        if (!existing) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'invoice not found' });
        }
        if (existing.status !== 'PaymentPending') {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'only pending payments can be confirmed',
          });
        }
        const now = new Date();
        const updated = await tx.schoolFeeInvoice.update({
          where: { id: input.invoiceId },
          data: {
            status: 'Paid',
            paidAt: now,
            paymentConfirmedAt: now,
            paymentConfirmedById: ctx.user.id,
          },
          include: invoiceInclude,
        });
        await tx.auditLog.create({
          data: {
            userId: ctx.user.id,
            action: 'Update',
            entity: 'SchoolFeeInvoice',
            entityId: updated.id,
            meta: { source: 'invoice.confirmPayment' },
          },
        });
        return updated;
      })) as InvoiceRow;

      return mapInvoice(ctx, invoice, new Date());
    }),

    rejectPayment: authedProcedure.input(invoiceIdInput).mutation(async ({ ctx, input }) => {
      await requireInvoiceManager(ctx, 'invoice.rejectPayment', input.invoiceId);

      const invoice = (await ctx.withRls(async (tx) => {
        const existing = await tx.schoolFeeInvoice.findUnique({
          where: { id: input.invoiceId },
          select: { id: true, status: true },
        });
        if (!existing) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'invoice not found' });
        }
        if (existing.status !== 'PaymentPending') {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'only pending payments can be rejected',
          });
        }
        const updated = await tx.schoolFeeInvoice.update({
          where: { id: input.invoiceId },
          data: {
            status: 'Unpaid',
            parentMarkedPaidAt: null,
            parentMarkedPaidById: null,
            paidAt: null,
            paymentConfirmedAt: null,
            paymentConfirmedById: null,
          },
          include: invoiceInclude,
        });
        await tx.auditLog.create({
          data: {
            userId: ctx.user.id,
            action: 'Update',
            entity: 'SchoolFeeInvoice',
            entityId: updated.id,
            meta: { source: 'invoice.rejectPayment' },
          },
        });
        return updated;
      })) as InvoiceRow;

      return mapInvoice(ctx, invoice, new Date());
    }),

    setDiscountOptOut: authedProcedure
      .input(discountOptOutInput)
      .mutation(async ({ ctx, input }) => {
        const row = (await ctx.withRls((tx) =>
          tx.schoolFeeInvoice.findUnique({
            where: { id: input.invoiceId },
            select: {
              id: true,
              studentId: true,
              status: true,
              invoiceNumber: true,
              originalFileNameEnc: true,
              fileMimeType: true,
              fileSizeBytes: true,
            },
          }),
        )) as InvoiceDownloadRow | null;
        if (!row) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'invoice not found' });
        }
        await assertParentInvoiceAccess(ctx, row);
        if (row.status !== 'Unpaid') {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'discount choices can only be changed before payment is pending or paid',
          });
        }

        const invoice = (await ctx.withRls(async (tx) => {
          const existing = (await tx.schoolFeeInvoice.findUnique({
            where: { id: input.invoiceId },
            include: invoiceInclude,
          })) as InvoiceRow | null;
          if (!existing) {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'invoice not found' });
          }
          const existingDiscounts = existing.discounts ?? [];
          const target = existingDiscounts.find((discount) => discount.id === input.discountId);
          if (!target) {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'discount not found' });
          }

          const existingLineItems = existing.lineItems.map((line) => ({
            description: decryptRequired(
              ctx.db.$enc.decrypt,
              line.descriptionEnc,
              'invoice line description',
            ),
            quantity: line.quantity,
            unitAmountPence: line.unitAmountPence,
          }));
          const subtotalAmountPence = invoiceTotalPence(existingLineItems);
          const linkedStudentCount = existing.students?.length ?? 0;
          const studentCount =
            linkedStudentCount > 0 ? linkedStudentCount : existing.studentId ? 1 : 0;
          const calculation = (() => {
            try {
              return calculateSchoolFeeFamilyDiscounts({
                subtotalAmountPence,
                studentCount,
                childLineAmountsPence: childLineAmountsPence(existingLineItems, studentCount),
                discounts: storedDiscountInputs(ctx, existingDiscounts, {
                  discountId: input.discountId,
                  optedOut: input.optedOut,
                }),
              });
            } catch (err) {
              asBadRequest(err);
            }
          })();

          const optOutAt = input.optedOut ? new Date() : null;
          await tx.schoolFeeInvoiceDiscount.update({
            where: { id: input.discountId },
            data: {
              optedOutAt: optOutAt,
              optedOutById: input.optedOut ? ctx.user.id : null,
            },
          });
          for (const discount of calculation.discounts) {
            const source = existingDiscounts.find(
              (candidate) =>
                decryptRequired(
                  ctx.db.$enc.decrypt,
                  candidate.labelEnc,
                  'invoice discount label',
                ) === discount.label,
            );
            if (!source) continue;
            await tx.schoolFeeInvoiceDiscount.update({
              where: { id: source.id },
              data: {
                baseAmountPence: discount.baseAmountPence,
                appliedAmountPence: discount.appliedAmountPence,
              },
            });
          }

          const refreshed = (await tx.schoolFeeInvoice.update({
            where: { id: input.invoiceId },
            data: {
              subtotalAmountPence,
              discountAmountPence: calculation.discountAmountPence,
              totalAmountPence: calculation.totalAmountPence,
            },
            include: invoiceInclude,
          })) as InvoiceRow;
          const regenerated = await buildGeneratedInvoicePdf(ctx, refreshed);
          const updated = await tx.schoolFeeInvoice.update({
            where: { id: input.invoiceId },
            data: {
              fileSizeBytes: regenerated.fileSizeBytes,
              pdfBytesEnc: ctx.db.$enc.encrypt(regenerated.pdfBase64),
              extractedTextEnc: ctx.db.$enc.encrypt(regenerated.extractedText),
            },
            include: invoiceInclude,
          });
          await tx.auditLog.create({
            data: {
              userId: ctx.user.id,
              action: 'Update',
              entity: 'SchoolFeeInvoiceDiscount',
              entityId: input.discountId,
              meta: { source: 'invoice.setDiscountOptOut', optedOut: input.optedOut },
            },
          });
          return updated;
        })) as InvoiceRow;

        return mapInvoice(ctx, invoice, new Date());
      }),

    delete: authedProcedure.input(invoiceIdInput).mutation(async ({ ctx, input }) => {
      await requireInvoiceManager(ctx, 'invoice.delete', input.invoiceId);

      await ctx.withRls(async (tx) => {
        const existing = await tx.schoolFeeInvoice.findUnique({
          where: { id: input.invoiceId },
          select: { id: true, invoiceNumber: true },
        });
        if (!existing) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'invoice not found' });
        }
        await tx.schoolFeeInvoice.delete({ where: { id: input.invoiceId } });
        await tx.auditLog.create({
          data: {
            userId: ctx.user.id,
            action: 'Delete',
            entity: 'SchoolFeeInvoice',
            entityId: input.invoiceId,
            meta: { source: 'invoice.delete', invoiceNumber: existing.invoiceNumber },
          },
        });
      });

      return { id: input.invoiceId };
    }),

    downloadPdf: authedProcedure.input(invoiceIdInput).query(async ({ ctx, input }) => {
      const invoice: InvoiceDownloadRow | null = await ctx.withRls((tx) =>
        tx.schoolFeeInvoice.findUnique({
          where: { id: input.invoiceId },
          select: {
            id: true,
            studentId: true,
            status: true,
            invoiceNumber: true,
            originalFileNameEnc: true,
            fileMimeType: true,
            fileSizeBytes: true,
            pdfBytesEnc: true,
          },
        }),
      );

      if (!invoice) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'invoice not found' });
      }

      try {
        requireCanManageInvoices(ctx.user);
      } catch (err) {
        if (err instanceof AccessDeniedError) {
          await assertParentInvoiceAccess(ctx, invoice);
        } else {
          throw err;
        }
      }

      const pdfBase64 = decryptRequired(ctx.db.$enc.decrypt, invoice.pdfBytesEnc, 'invoice PDF');
      const fileName = decryptRequired(
        ctx.db.$enc.decrypt,
        invoice.originalFileNameEnc,
        'invoice file name',
      );
      await auditInvoiceDecrypt(ctx, 'invoice.downloadPdf', 1);

      return {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        fileName,
        mimeType: invoice.fileMimeType,
        fileSizeBytes: invoice.fileSizeBytes,
        pdfBase64,
      };
    }),
  });
}

export const invoiceRouter = createInvoiceRouter();
