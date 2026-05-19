import { Buffer } from 'node:buffer';
import { TRPCError } from '@trpc/server';
import type { Prisma, SchoolFeeInvoiceStatus } from '@oasis/db';
import {
  AccessDeniedError,
  invoiceTotalPence,
  parseSchoolFeeInvoiceText,
  requireCanManageInvoices,
  requireOwnChild,
  schoolFeeInvoiceDisplayStatus,
  type ParsedSchoolFeeInvoice,
  type SchoolFeeInvoiceDisplayStatus,
  type SchoolFeeInvoiceLineInput,
  type SessionUser,
} from '@oasis/domain';
import { z } from 'zod';
import type { AppContext, RlsTx } from '../context.js';
import { authedProcedure, router } from '../trpc.js';

const MAX_PDF_BYTES = 10 * 1024 * 1024;
const invoiceAdminStatusFilters = ['All', 'Draft', 'Unpaid', 'Overdue', 'Paid'] as const;
const parentStatusFilters = ['All', 'Unpaid', 'Overdue', 'Paid'] as const;

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
} | null;

type InvoiceRow = {
  id: string;
  invoiceNumber: string | null;
  studentId: string | null;
  status: SchoolFeeInvoiceStatus;
  term: string | null;
  issuedOn: Date | null;
  dueOn: Date | null;
  paidAt: Date | null;
  totalAmountPence: number;
  originalFileNameEnc: string;
  fileMimeType: string;
  fileSizeBytes: number;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
  student: InvoiceStudentRow;
  lineItems: InvoiceLineRow[];
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

export interface SchoolFeeInvoiceDto {
  id: string;
  invoiceNumber: string | null;
  studentId: string | null;
  studentName: string | null;
  studentYearGroup: string | null;
  status: SchoolFeeInvoiceStatus;
  displayStatus: SchoolFeeInvoiceDisplayStatus;
  term: string | null;
  issuedOn: string | null;
  dueOn: string | null;
  paidAt: Date | null;
  totalAmountPence: number;
  originalFileName: string;
  fileSizeBytes: number;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
  lineItems: SchoolFeeInvoiceLineDto[];
}

export interface SchoolFeeInvoiceStatsDto {
  totalCount: number;
  draftCount: number;
  unpaidCount: number;
  overdueCount: number;
  paidCount: number;
  outstandingAmountPence: number;
  overdueAmountPence: number;
}

export interface BillableStudentDto {
  id: string;
  fullName: string;
  yearGroup: string;
}

const invoiceLineInput = z.object({
  description: z.string().trim().min(1).max(240),
  quantity: z.number().int().min(1).max(999),
  unitAmountPence: z.number().int().min(0).max(5_000_000),
});

const uploadDraftInput = z.object({
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().min(1).max(120),
  sizeBytes: z.number().int().positive().max(MAX_PDF_BYTES),
  pdfBase64: z.string().min(1),
});

const publishDraftInput = z.object({
  invoiceId: z.string().cuid(),
  studentId: z.string().cuid(),
  invoiceNumber: z.string().trim().min(1).max(80),
  issuedOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/u)
    .nullable(),
  dueOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u),
  term: z.string().trim().min(1).max(80).nullable(),
  lineItems: z.array(invoiceLineInput).min(1).max(50),
});

const invoiceIdInput = z.object({
  invoiceId: z.string().cuid(),
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
  student: { select: { id: true, fullNameEnc: true, yearGroup: true } },
  lineItems: { orderBy: { position: 'asc' as const } },
} satisfies Prisma.SchoolFeeInvoiceInclude;

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

function mapInvoice(ctx: AuthedContext, invoice: InvoiceRow, now: Date): SchoolFeeInvoiceDto {
  return {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    studentId: invoice.studentId,
    studentName: invoice.student
      ? decryptRequired(ctx.db.$enc.decrypt, invoice.student.fullNameEnc, 'student name')
      : null,
    studentYearGroup: invoice.student?.yearGroup ?? null,
    status: invoice.status,
    displayStatus: schoolFeeInvoiceDisplayStatus(invoice.status, invoice.dueOn, now),
    term: invoice.term,
    issuedOn: dateOnly(invoice.issuedOn),
    dueOn: dateOnly(invoice.dueOn),
    paidAt: invoice.paidAt,
    totalAmountPence: invoice.totalAmountPence,
    originalFileName: decryptRequired(
      ctx.db.$enc.decrypt,
      invoice.originalFileNameEnc,
      'invoice file name',
    ),
    fileSizeBytes: invoice.fileSizeBytes,
    createdById: invoice.createdById,
    createdAt: invoice.createdAt,
    updatedAt: invoice.updatedAt,
    lineItems: invoice.lineItems.map((line) => ({
      id: line.id,
      position: line.position,
      description: decryptRequired(
        ctx.db.$enc.decrypt,
        line.descriptionEnc,
        'invoice line description',
      ),
      quantity: line.quantity,
      unitAmountPence: line.unitAmountPence,
      totalAmountPence: line.totalAmountPence,
    })),
  };
}

function invoiceMatchesSearch(invoice: SchoolFeeInvoiceDto, search: string | undefined): boolean {
  if (!search) return true;
  const query = normalizeText(search);
  return [
    invoice.invoiceNumber,
    invoice.studentName,
    invoice.studentYearGroup,
    invoice.term,
    invoice.originalFileName,
    ...invoice.lineItems.map((line) => line.description),
  ].some((value) => value !== null && normalizeText(value).includes(query));
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
      if (invoice.status === 'Paid') stats.paidCount += 1;
      if (invoice.displayStatus === 'Overdue') {
        stats.overdueCount += 1;
        stats.overdueAmountPence += invoice.totalAmountPence;
      } else if (invoice.status === 'Unpaid') {
        stats.unpaidCount += 1;
      }
      if (invoice.status === 'Unpaid') {
        stats.outstandingAmountPence += invoice.totalAmountPence;
      }
      return stats;
    },
    {
      totalCount: 0,
      draftCount: 0,
      unpaidCount: 0,
      overdueCount: 0,
      paidCount: 0,
      outstandingAmountPence: 0,
      overdueAmountPence: 0,
    },
  );
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

async function assertActiveStudent(tx: RlsTx, studentId: string): Promise<void> {
  const student = await tx.student.findUnique({
    where: { id: studentId },
    select: { id: true, active: true },
  });
  if (!student?.active) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'student not found' });
  }
}

async function assertParentInvoiceAccess(
  ctx: AuthedContext,
  invoice: Pick<InvoiceDownloadRow, 'id' | 'studentId' | 'status'>,
): Promise<void> {
  if (ctx.user.role !== 'Parent' || invoice.status === 'Draft' || !invoice.studentId) {
    return auditPermissionDenied(
      ctx,
      'invoice.downloadPdf',
      new AccessDeniedError('invoice download requires parent access or finance-admin'),
      invoice.id,
    );
  }
  const studentId = invoice.studentId;

  const guardian = await ctx.db.guardian.findUnique({
    where: { userId_studentId: { userId: ctx.user.id, studentId } },
    select: { studentId: true },
  });

  try {
    requireOwnChild(ctx.user, studentId, guardian ? [guardian.studentId] : []);
  } catch (err) {
    if (err instanceof AccessDeniedError) {
      await auditPermissionDenied(ctx, 'invoice.downloadPdf', err, invoice.id);
    }
    throw err;
  }
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

      const invoices = rows
        .map((invoice) => mapInvoice(ctx, invoice, now))
        .filter((invoice) => invoiceMatchesAdminStatus(invoice, input?.status ?? 'All'))
        .filter((invoice) => invoiceMatchesSearch(invoice, input?.search));

      await auditInvoiceDecrypt(ctx, 'invoice.listAdmin', invoices.length);
      return { invoices, stats: calculateStats(invoices) };
    }),

    listBillableStudents: authedProcedure.query(async ({ ctx }) => {
      await requireInvoiceManager(ctx, 'invoice.listBillableStudents');

      const students = await ctx.withRls((tx) =>
        tx.student.findMany({
          where: { active: true },
          orderBy: [{ yearGroup: 'asc' }, { createdAt: 'desc' }],
          select: { id: true, fullNameEnc: true, yearGroup: true },
        }),
      );
      const rows = students.map((student) => ({
        id: student.id,
        fullName: decryptRequired(ctx.db.$enc.decrypt, student.fullNameEnc, 'student name'),
        yearGroup: student.yearGroup,
      })) satisfies BillableStudentDto[];

      await auditStudentDecrypt(ctx, 'invoice.listBillableStudents', rows.length);
      return rows;
    }),

    listParent: authedProcedure.input(parentListInput).query(async ({ ctx, input }) => {
      if (ctx.user.role !== 'Parent') {
        await auditPermissionDenied(
          ctx,
          'invoice.listParent',
          new AccessDeniedError('parent invoice list requires Parent role'),
        );
      }

      const guardians = await ctx.db.guardian.findMany({
        where: { userId: ctx.user.id },
        select: { studentId: true },
      });
      const studentIds = guardians.map((guardian) => guardian.studentId);
      if (studentIds.length === 0) {
        return { invoices: [], stats: calculateStats([]) };
      }

      const now = new Date();
      const rows = (await ctx.withRls((tx) =>
        tx.schoolFeeInvoice.findMany({
          where: {
            studentId: { in: studentIds },
            status: { not: 'Draft' },
          },
          include: invoiceInclude,
          orderBy: [{ dueOn: 'asc' }, { createdAt: 'desc' }],
        }),
      )) as InvoiceRow[];

      const invoices = rows
        .map((invoice) => mapInvoice(ctx, invoice, now))
        .filter((invoice) => invoiceMatchesParentStatus(invoice, input?.status ?? 'All'))
        .filter((invoice) => invoiceMatchesSearch(invoice, input?.search));

      await auditInvoiceDecrypt(ctx, 'invoice.listParent', invoices.length);
      return { invoices, stats: calculateStats(invoices) };
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
            originalFileNameEnc: ctx.db.$enc.encrypt(originalFileName),
            fileMimeType: 'application/pdf',
            fileSizeBytes: pdfBytes.length,
            pdfBytesEnc: ctx.db.$enc.encrypt(pdfBytes.toString('base64')),
            extractedTextEnc: extractedText ? ctx.db.$enc.encrypt(extractedText) : null,
            createdById: ctx.user.id,
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

      let totalAmountPence: number;
      try {
        totalAmountPence = invoiceTotalPence(input.lineItems);
      } catch (err) {
        asBadRequest(err);
      }

      const invoice = (await ctx.withRls(async (tx) => {
        await loadDraftForPublishing(tx, input.invoiceId);
        await assertActiveStudent(tx, input.studentId);

        const updated = await tx.schoolFeeInvoice.update({
          where: { id: input.invoiceId },
          data: {
            invoiceNumber: input.invoiceNumber,
            studentId: input.studentId,
            status: 'Unpaid',
            term: input.term,
            issuedOn: parseDateInput(input.issuedOn),
            dueOn: parseDateInput(input.dueOn),
            paidAt: null,
            totalAmountPence,
            lineItems: {
              deleteMany: {},
              create: input.lineItems.map((line, index) => ({
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
            action: 'Update',
            entity: 'SchoolFeeInvoice',
            entityId: updated.id,
            meta: {
              source: 'invoice.publishDraft',
              studentId: input.studentId,
              invoiceNumber: input.invoiceNumber,
              totalAmountPence,
            },
          },
        });

        return updated;
      })) as InvoiceRow;

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

        const updated = await tx.schoolFeeInvoice.update({
          where: { id: input.invoiceId },
          data: { status: 'Paid', paidAt: new Date() },
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
          data: { status: 'Unpaid', paidAt: null },
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
