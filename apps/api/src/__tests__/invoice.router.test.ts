import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  SCHOOL_FEE_DISCOUNT_EXPLANATION,
  schoolFeeDiscountChildIndexPresetCode,
  type SessionUser,
} from '@oasis/domain';
import type { AppContext, RlsTx } from '../context.js';
import { createInvoiceRouter } from '../routers/invoice.js';
import { router } from '../trpc.js';

type InvoiceStatus = 'Draft' | 'Unpaid' | 'PaymentPending' | 'Paid';
type BillingCadence = 'Annual' | 'Term' | 'Monthly';
type DiscountKind = 'Preset' | 'ManualPercent' | 'ManualFixed';

interface StoredInvoice {
  id: string;
  invoiceNumber: string | null;
  studentId: string | null;
  status: InvoiceStatus;
  schoolYear: number | null;
  billingCadence: BillingCadence | null;
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
  pdfBytesEnc: string;
  extractedTextEnc: string | null;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}

interface StoredInvoiceStudent {
  invoiceId: string;
  studentId: string;
  position: number;
}

interface StoredDiscount {
  id: string;
  invoiceId: string;
  position: number;
  labelEnc: string;
  kind: DiscountKind;
  presetCode: string | null;
  percentBps: number | null;
  amountPence: number | null;
  baseAmountPence: number;
  appliedAmountPence: number;
  optedOutAt: Date | null;
  optedOutById: string | null;
  createdAt: Date;
}

interface StoredLine {
  id: string;
  invoiceId: string;
  position: number;
  descriptionEnc: string;
  quantity: number;
  unitAmountPence: number;
  totalAmountPence: number;
  createdAt: Date;
}

interface StoredStudent {
  id: string;
  active: boolean;
  fullNameEnc: string;
  yearGroup: string;
  enrolmentDate: Date;
  createdAt: Date;
}

interface StoredGuardian {
  userId: string;
  studentId: string;
}

interface StoredFeeConfig {
  schoolYear: number;
  annualAmountPence: number;
  termAmountPence: number;
  monthlyAmountPence: number;
}

interface FakeInvoiceFindManyArgs {
  where?: {
    id?: { in: string[] };
    studentId?: { in: string[] };
    status?: { not: InvoiceStatus };
    OR?: Array<{ id?: { in: string[] }; studentId?: { in: string[] } }>;
  };
}

interface FakeInvoiceFindUniqueArgs {
  where: { id: string };
}

interface FakeInvoiceFindFirstArgs {
  where?: {
    invoiceNumber?: string | null;
    NOT?: { id?: string };
  };
}

interface FakeInvoiceCreateArgs {
  data: {
    status: InvoiceStatus;
    invoiceNumber?: string | null;
    studentId?: string | null;
    schoolYear?: number | null;
    billingCadence?: BillingCadence | null;
    familyLabelEnc?: string | null;
    term?: string | null;
    issuedOn?: Date | null;
    dueOn?: Date | null;
    paidAt?: Date | null;
    subtotalAmountPence?: number;
    discountAmountPence?: number;
    totalAmountPence?: number;
    discountExplanationEnc?: string | null;
    originalFileNameEnc: string;
    fileMimeType: string;
    fileSizeBytes: number;
    pdfBytesEnc: string;
    extractedTextEnc: string | null;
    createdById: string;
    lineItems?: { create: FakeLineCreateInput[] };
    students?: { create: Array<{ studentId: string; position: number }> };
    discounts?: { create: FakeDiscountCreateInput[] };
  };
}

interface FakeLineCreateInput {
  position: number;
  descriptionEnc: string;
  quantity: number;
  unitAmountPence: number;
  totalAmountPence: number;
}

interface FakeDiscountCreateInput {
  position: number;
  labelEnc: string;
  kind: DiscountKind;
  presetCode: string | null;
  percentBps: number | null;
  amountPence: number | null;
  baseAmountPence: number;
  appliedAmountPence: number;
}

interface FakeInvoiceUpdateArgs {
  where: { id: string };
  data: Partial<
    Pick<
      StoredInvoice,
      | 'invoiceNumber'
      | 'studentId'
      | 'status'
      | 'term'
      | 'issuedOn'
      | 'dueOn'
      | 'paidAt'
      | 'totalAmountPence'
    >
  > & {
    schoolYear?: number | null;
    billingCadence?: BillingCadence | null;
    familyLabelEnc?: string | null;
    subtotalAmountPence?: number;
    discountAmountPence?: number;
    discountExplanationEnc?: string | null;
    parentMarkedPaidAt?: Date | null;
    parentMarkedPaidById?: string | null;
    paymentConfirmedAt?: Date | null;
    paymentConfirmedById?: string | null;
    originalFileNameEnc?: string;
    fileMimeType?: string;
    fileSizeBytes?: number;
    pdfBytesEnc?: string;
    extractedTextEnc?: string | null;
    lineItems?: {
      deleteMany: object;
      create: FakeLineCreateInput[];
    };
    students?: {
      deleteMany: object;
      create: Array<{ studentId: string; position: number }>;
    };
    discounts?: {
      deleteMany: object;
      create?: FakeDiscountCreateInput[];
    };
  };
}

interface FakeAuditCreateArgs {
  data: {
    userId: string;
    action: string;
    entity: string;
    entityId?: string | null;
    meta?: Record<string, unknown>;
  };
}

const financeUser: SessionUser = {
  id: 'cfinance000000000001',
  role: 'Supervisor',
  tags: ['finance-admin'],
  requires2fa: false,
};

const untaggedStaffUser: SessionUser = {
  ...financeUser,
  id: 'cstaff0000000000001',
  tags: [],
};

const supervisorParentUser: SessionUser = {
  id: 'csupervisorparent01',
  role: 'Supervisor',
  tags: [],
  requires2fa: false,
};

const parentUser: SessionUser = {
  id: 'cparent000000000001',
  role: 'Parent',
  tags: [],
  requires2fa: false,
};

const secondParentUser: SessionUser = {
  id: 'cparent000000000002',
  role: 'Parent',
  tags: [],
  requires2fa: false,
};

const unlinkedParentUser: SessionUser = {
  id: 'cparent000000000003',
  role: 'Parent',
  tags: [],
  requires2fa: false,
};

const linkedStudentId = 'cstudent000000000001';
const otherStudentId = 'cstudent000000000002';
const thirdStudentId = 'cstudent000000000003';
const fourthStudentId = 'cstudent000000000004';
const invoiceId = 'cinvoice00000000001';
const discountId = 'cdiscount0000000001';

function encrypt(value: string): string {
  return `enc:${value}`;
}

function decrypt(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.replace(/^enc:/u, '');
}

function makeStudent(input: Pick<StoredStudent, 'id'> & Partial<StoredStudent>): StoredStudent {
  const names: Record<string, string> = {
    [linkedStudentId]: 'Talia Parent',
    [otherStudentId]: 'Other Child',
    [thirdStudentId]: 'Third Child',
    [fourthStudentId]: 'Fourth Child',
  };
  return {
    active: true,
    fullNameEnc: encrypt(names[input.id] ?? 'Other Child'),
    yearGroup: 'Y9',
    enrolmentDate: new Date('2026-01-12T00:00:00.000Z'),
    createdAt: new Date('2026-05-01T08:00:00.000Z'),
    ...input,
  };
}

function makeInvoice(input: Pick<StoredInvoice, 'id'> & Partial<StoredInvoice>): StoredInvoice {
  return {
    invoiceNumber: 'INV-2026-001',
    studentId: linkedStudentId,
    status: 'Unpaid',
    schoolYear: 2026,
    billingCadence: 'Monthly',
    familyLabelEnc: encrypt('Parent family'),
    term: 'Summer Term 1',
    issuedOn: new Date('2026-05-01T00:00:00.000Z'),
    dueOn: new Date('2026-05-30T00:00:00.000Z'),
    paidAt: null,
    subtotalAmountPence: 42000,
    discountAmountPence: 0,
    totalAmountPence: 42000,
    discountExplanationEnc: null,
    parentMarkedPaidAt: null,
    parentMarkedPaidById: null,
    paymentConfirmedAt: null,
    paymentConfirmedById: null,
    originalFileNameEnc: encrypt('invoice.pdf'),
    fileMimeType: 'application/pdf',
    fileSizeBytes: 12,
    pdfBytesEnc: encrypt('JVBERi0xLjQK'),
    extractedTextEnc: encrypt('Invoice text'),
    createdById: financeUser.id,
    createdAt: new Date('2026-05-01T08:00:00.000Z'),
    updatedAt: new Date('2026-05-01T08:00:00.000Z'),
    ...input,
  };
}

function makeLine(input: Pick<StoredLine, 'invoiceId'> & Partial<StoredLine>): StoredLine {
  return {
    id: `cline${String(Math.random()).slice(2, 10)}`,
    position: 1,
    descriptionEnc: encrypt('Tuition'),
    quantity: 1,
    unitAmountPence: 42000,
    totalAmountPence: 42000,
    createdAt: new Date('2026-05-01T08:00:00.000Z'),
    ...input,
  };
}

function makeInvoiceStudent(input: StoredInvoiceStudent): StoredInvoiceStudent {
  return input;
}

function makeDiscount(
  input: Pick<StoredDiscount, 'invoiceId'> & Partial<StoredDiscount>,
): StoredDiscount {
  return {
    id: discountId,
    position: 1,
    labelEnc: encrypt('Sibling discount'),
    kind: 'Preset',
    presetCode: 'sibling',
    percentBps: 2500,
    amountPence: null,
    baseAmountPence: 10500,
    appliedAmountPence: 10500,
    optedOutAt: null,
    optedOutById: null,
    createdAt: new Date('2026-05-01T08:00:00.000Z'),
    ...input,
  };
}

function makeFakeDb({
  initialStudents,
  initialGuardians = [{ userId: parentUser.id, studentId: linkedStudentId }],
  initialInvoices = [],
  initialLines = [],
  initialInvoiceStudents,
  initialDiscounts = [],
  decryptImpl = decrypt,
}: {
  initialStudents?: StoredStudent[];
  initialGuardians?: StoredGuardian[];
  initialInvoices?: StoredInvoice[];
  initialLines?: StoredLine[];
  initialInvoiceStudents?: StoredInvoiceStudent[];
  initialDiscounts?: StoredDiscount[];
  decryptImpl?: (value: string | null | undefined) => string | null;
} = {}) {
  const students = initialStudents ?? [
    makeStudent({ id: linkedStudentId }),
    makeStudent({ id: otherStudentId }),
  ];
  const guardians = [...initialGuardians];
  const invoices = [...initialInvoices];
  const lines = [...initialLines];
  const invoiceStudents =
    initialInvoiceStudents ??
    initialInvoices
      .filter((invoice) => invoice.studentId !== null)
      .map((invoice) =>
        makeInvoiceStudent({
          invoiceId: invoice.id,
          studentId: invoice.studentId ?? linkedStudentId,
          position: 1,
        }),
      );
  const discounts = [...initialDiscounts];
  const feeConfigs: StoredFeeConfig[] = [
    {
      schoolYear: 2026,
      annualAmountPence: 294000,
      termAmountPence: 98000,
      monthlyAmountPence: 24500,
    },
  ];
  let invoiceSequence = 1;
  let discountSequence = 1;

  function invoiceRow(invoice: StoredInvoice) {
    return {
      ...invoice,
      student: invoice.studentId
        ? (students.find((student) => student.id === invoice.studentId) ?? null)
        : null,
      students: invoiceStudents
        .filter((link) => link.invoiceId === invoice.id)
        .sort((left, right) => left.position - right.position)
        .map((link) => ({
          ...link,
          student:
            students.find((student) => student.id === link.studentId) ??
            makeStudent({ id: link.studentId }),
        })),
      lineItems: lines
        .filter((line) => line.invoiceId === invoice.id)
        .sort((left, right) => left.position - right.position),
      discounts: discounts
        .filter((discount) => discount.invoiceId === invoice.id)
        .sort((left, right) => left.position - right.position),
    };
  }

  function matchesWhere(invoice: StoredInvoice, where: FakeInvoiceFindManyArgs['where']): boolean {
    if (!where) return true;
    if (where.OR) {
      const matchesOr = where.OR.some((clause) => matchesWhere(invoice, clause));
      if (!matchesOr) return false;
    }
    if (where.id && !where.id.in.includes(invoice.id)) return false;
    if (
      where.studentId &&
      (invoice.studentId === null || !where.studentId.in.includes(invoice.studentId))
    ) {
      return false;
    }
    if (where.status?.not && invoice.status === where.status.not) return false;
    return true;
  }

  const db = {
    $enc: {
      encrypt: vi.fn(encrypt),
      decrypt: vi.fn(decryptImpl),
      blindIndex: vi.fn((value: string) => value.toLowerCase()),
    },
    guardian: {
      findMany: vi.fn(({ where }: { where: { userId: string } }) =>
        guardians.filter((guardian) => guardian.userId === where.userId),
      ),
      findUnique: vi.fn(
        ({ where }: { where: { userId_studentId: { userId: string; studentId: string } } }) =>
          guardians.find(
            (guardian) =>
              guardian.userId === where.userId_studentId.userId &&
              guardian.studentId === where.userId_studentId.studentId,
          ) ?? null,
      ),
    },
    student: {
      findUnique: vi.fn(({ where }: { where: { id: string } }) => {
        const student = students.find((candidate) => candidate.id === where.id);
        return student ? { id: student.id, active: student.active } : null;
      }),
      findMany: vi.fn(
        (
          args: {
            where?: { active?: boolean; id?: { in: string[] } };
            select?: { guardians?: unknown };
          } = {},
        ) =>
          students
            .filter((student) =>
              args.where?.active === undefined ? true : student.active === args.where.active,
            )
            .filter((student) => (args.where?.id ? args.where.id.in.includes(student.id) : true))
            .map((student) => {
              const base = {
                id: student.id,
                fullNameEnc: student.fullNameEnc,
                yearGroup: student.yearGroup,
                enrolmentDate: student.enrolmentDate,
                createdAt: student.createdAt,
              };
              if (!args.select?.guardians) return base;
              return {
                ...base,
                guardians: guardians
                  .filter((guardian) => guardian.studentId === student.id)
                  .map((guardian) => ({
                    userId: guardian.userId,
                    user: {
                      id: guardian.userId,
                      fullNameEnc: encrypt(
                        guardian.userId === secondParentUser.id ? 'Second Parent' : 'Talia Parent',
                      ),
                      emailEnc: encrypt(`${guardian.userId}@example.com`),
                    },
                  })),
              };
            }),
      ),
    },
    schoolFeeYearFeeConfig: {
      findUnique: vi.fn(
        ({ where }: { where: { schoolYear: number } }) =>
          feeConfigs.find((config) => config.schoolYear === where.schoolYear) ?? null,
      ),
      upsert: vi.fn(
        ({
          where,
          create,
          update,
        }: {
          where: { schoolYear: number };
          create: StoredFeeConfig;
          update: Omit<StoredFeeConfig, 'schoolYear'>;
        }) => {
          const existing = feeConfigs.find((config) => config.schoolYear === where.schoolYear);
          if (existing) {
            Object.assign(existing, update);
            return existing;
          }
          feeConfigs.push(create);
          return create;
        },
      ),
    },
    schoolFeeInvoiceStudent: {
      findMany: vi.fn(
        ({ where }: { where: { studentId?: { in: string[] }; invoiceId?: string } }) =>
          invoiceStudents.filter((link) => {
            if (where.invoiceId && link.invoiceId !== where.invoiceId) return false;
            if (where.studentId && !where.studentId.in.includes(link.studentId)) return false;
            return true;
          }),
      ),
      findFirst: vi.fn(
        ({ where }: { where: { invoiceId: string; studentId?: { in: string[] } } }) =>
          invoiceStudents.find((link) => {
            if (link.invoiceId !== where.invoiceId) return false;
            if (where.studentId && !where.studentId.in.includes(link.studentId)) return false;
            return true;
          }) ?? null,
      ),
    },
    schoolFeeInvoiceDiscount: {
      update: vi.fn(({ where, data }: { where: { id: string }; data: Partial<StoredDiscount> }) => {
        const discount = discounts.find((candidate) => candidate.id === where.id);
        if (!discount) throw new Error('discount not found');
        Object.assign(discount, data);
        return discount;
      }),
    },
    schoolFeeInvoice: {
      findMany: vi.fn((args: FakeInvoiceFindManyArgs = {}) => {
        return invoices.filter((invoice) => matchesWhere(invoice, args.where)).map(invoiceRow);
      }),
      findUnique: vi.fn(({ where }: FakeInvoiceFindUniqueArgs) => {
        const invoice = invoices.find((candidate) => candidate.id === where.id);
        return invoice ? invoiceRow(invoice) : null;
      }),
      findFirst: vi.fn((args: FakeInvoiceFindFirstArgs = {}) => {
        const invoice = invoices.find((candidate) => {
          if (
            args.where?.invoiceNumber !== undefined &&
            candidate.invoiceNumber !== args.where.invoiceNumber
          ) {
            return false;
          }
          if (args.where?.NOT?.id && candidate.id === args.where.NOT.id) return false;
          return true;
        });
        return invoice ? invoiceRow(invoice) : null;
      }),
      create: vi.fn(({ data }: FakeInvoiceCreateArgs) => {
        const created = makeInvoice({
          id: `cinvoicenew000000${String(invoiceSequence++).padStart(2, '0')}`,
          invoiceNumber: data.invoiceNumber ?? null,
          studentId: data.studentId ?? null,
          status: data.status,
          schoolYear: data.schoolYear ?? null,
          billingCadence: data.billingCadence ?? null,
          familyLabelEnc: data.familyLabelEnc ?? null,
          term: data.term ?? null,
          issuedOn: data.issuedOn ?? null,
          dueOn: data.dueOn ?? null,
          paidAt: data.paidAt ?? null,
          subtotalAmountPence: data.subtotalAmountPence ?? data.totalAmountPence ?? 0,
          discountAmountPence: data.discountAmountPence ?? 0,
          totalAmountPence: data.totalAmountPence ?? 0,
          discountExplanationEnc: data.discountExplanationEnc ?? null,
          originalFileNameEnc: data.originalFileNameEnc,
          fileMimeType: data.fileMimeType,
          fileSizeBytes: data.fileSizeBytes,
          pdfBytesEnc: data.pdfBytesEnc,
          extractedTextEnc: data.extractedTextEnc,
          createdById: data.createdById,
        });
        invoices.push(created);
        if (data.lineItems) {
          lines.push(
            ...data.lineItems.create.map((line, index) =>
              makeLine({
                ...line,
                id: `clinecreated${String(index + 1).padStart(2, '0')}`,
                invoiceId: created.id,
              }),
            ),
          );
        }
        if (data.students) {
          invoiceStudents.push(
            ...data.students.create.map((link) => ({
              invoiceId: created.id,
              studentId: link.studentId,
              position: link.position,
            })),
          );
        }
        if (data.discounts) {
          discounts.push(
            ...data.discounts.create.map((discount) =>
              makeDiscount({
                ...discount,
                id: `cdiscountnew00000${String(discountSequence++).padStart(2, '0')}`,
                invoiceId: created.id,
              }),
            ),
          );
        }
        return invoiceRow(created);
      }),
      update: vi.fn(({ where, data }: FakeInvoiceUpdateArgs) => {
        const invoice = invoices.find((candidate) => candidate.id === where.id);
        if (!invoice) throw new Error('invoice not found');
        Object.assign(invoice, {
          ...data,
          lineItems: undefined,
          students: undefined,
          discounts: undefined,
          updatedAt: new Date('2026-05-02T08:00:00.000Z'),
        });
        if (data.lineItems) {
          for (let index = lines.length - 1; index >= 0; index -= 1) {
            if (lines[index]?.invoiceId === invoice.id) lines.splice(index, 1);
          }
          lines.push(
            ...data.lineItems.create.map((line, index) =>
              makeLine({
                ...line,
                id: `clinepublished${String(index + 1).padStart(2, '0')}`,
                invoiceId: invoice.id,
              }),
            ),
          );
        }
        if (data.students) {
          for (let index = invoiceStudents.length - 1; index >= 0; index -= 1) {
            if (invoiceStudents[index]?.invoiceId === invoice.id) invoiceStudents.splice(index, 1);
          }
          invoiceStudents.push(
            ...data.students.create.map((link) => ({
              invoiceId: invoice.id,
              studentId: link.studentId,
              position: link.position,
            })),
          );
        }
        if (data.discounts) {
          for (let index = discounts.length - 1; index >= 0; index -= 1) {
            if (discounts[index]?.invoiceId === invoice.id) discounts.splice(index, 1);
          }
          if (data.discounts.create) {
            discounts.push(
              ...data.discounts.create.map((discount) =>
                makeDiscount({
                  ...discount,
                  id: `cdiscountupdated${String(discountSequence++).padStart(2, '0')}`,
                  invoiceId: invoice.id,
                }),
              ),
            );
          }
        }
        return invoiceRow(invoice);
      }),
      delete: vi.fn(({ where }: FakeInvoiceFindUniqueArgs) => {
        const index = invoices.findIndex((candidate) => candidate.id === where.id);
        if (index < 0) throw new Error('invoice not found');
        const [deleted] = invoices.splice(index, 1);
        return deleted ? invoiceRow(deleted) : null;
      }),
    },
    auditLog: {
      create: vi.fn((args: FakeAuditCreateArgs) => args),
    },
  };

  return { db, invoices, lines, invoiceStudents, discounts, feeConfigs };
}

function createCaller(user: SessionUser, fakeDb = makeFakeDb(), useDefaultExtractor = false) {
  const testRouter = router({
    invoice: createInvoiceRouter(
      useDefaultExtractor
        ? undefined
        : {
            extractPdfText: () =>
              Promise.resolve(`
        Invoice No: INV-2026-011
        Issued: 01 May 2026
        Due date: 31 May 2026
        Summer Term 1 tuition £420.00
        Total £420.00
      `),
          },
    ),
  });
  const ctx = {
    db: fakeDb.db,
    user,
    requestId: 'test',
    withRls: async <T>(fn: (tx: RlsTx) => Promise<T>) => fn(fakeDb.db as unknown as RlsTx),
  } as unknown as AppContext;
  return { caller: testRouter.createCaller(ctx), fakeDb };
}

describe('invoiceRouter', () => {
  it('lets finance admins upload, publish, list, update, and delete invoices', async () => {
    const { caller, fakeDb } = createCaller(financeUser);
    const pdfBase64 = Buffer.from('%PDF-1.4\n').toString('base64');

    const draft = await caller.invoice.uploadDraft({
      fileName: 'may-fees.pdf',
      mimeType: 'application/pdf',
      sizeBytes: Buffer.from('%PDF-1.4\n').length,
      pdfBase64,
    });
    expect(draft.invoice.status).toBe('Draft');
    expect(draft.parsed.invoiceNumber).toBe('INV-2026-011');
    expect(draft.invoice.lineItems).toEqual([
      expect.objectContaining({
        description: 'Summer Term 1 tuition',
        quantity: 1,
        unitAmountPence: 42000,
      }),
    ]);

    const published = await caller.invoice.publishDraft({
      invoiceId: draft.invoice.id,
      studentId: linkedStudentId,
      invoiceNumber: 'INV-2026-011',
      issuedOn: '2026-05-01',
      dueOn: '2026-05-31',
      term: 'Summer Term 1',
      lineItems: [{ description: 'Summer Term 1 tuition', quantity: 1, unitAmountPence: 42000 }],
    });
    expect(published.status).toBe('Unpaid');
    expect(published.totalAmountPence).toBe(42000);

    const adminList = await caller.invoice.listAdmin({ status: 'All' });
    expect(adminList.invoices).toHaveLength(1);
    expect(adminList.invoices[0]?.lineItems[0]?.description).toBe('Summer Term 1 tuition');

    const paid = await caller.invoice.markPaid({ invoiceId: published.id });
    expect(paid.status).toBe('Paid');
    expect(paid.paidAt).toBeInstanceOf(Date);

    const unpaid = await caller.invoice.markUnpaid({ invoiceId: published.id });
    expect(unpaid.status).toBe('Unpaid');
    expect(unpaid.paidAt).toBeNull();

    await expect(caller.invoice.delete({ invoiceId: published.id })).resolves.toEqual({
      id: published.id,
    });
    expect(fakeDb.invoices).toHaveLength(0);
  });

  it('extracts prefill fields from the sample invoice PDF', async () => {
    const { caller } = createCaller(financeUser, makeFakeDb(), true);
    const pdfBytes = readFileSync(
      resolve(process.cwd(), '../../test-fixtures/invoices/oasis-example-school-fee-invoice.pdf'),
    );
    const promiseWithResolversDescriptor = Object.getOwnPropertyDescriptor(
      Promise,
      'withResolvers',
    );

    Object.defineProperty(Promise, 'withResolvers', {
      configurable: true,
      writable: true,
      value: undefined,
    });

    let draft!: Awaited<ReturnType<typeof caller.invoice.uploadDraft>>;
    try {
      draft = await caller.invoice.uploadDraft({
        fileName: 'oasis-example-school-fee-invoice.pdf',
        mimeType: 'application/pdf',
        sizeBytes: pdfBytes.length,
        pdfBase64: pdfBytes.toString('base64'),
      });
    } finally {
      if (promiseWithResolversDescriptor) {
        Object.defineProperty(Promise, 'withResolvers', promiseWithResolversDescriptor);
      } else {
        delete (Promise as PromiseConstructor & { withResolvers?: unknown }).withResolvers;
      }
    }

    expect(draft.parsed).toMatchObject({
      invoiceNumber: 'INV-2026-067',
      issuedOn: '2026-04-24',
      dueOn: '2026-05-15',
      term: 'Spring Term 2',
      totalAmountPence: 52250,
    });
    expect(draft.parsed.lineItems).toEqual([
      { description: 'Spring Term 2 tuition Y9', quantity: 1, unitAmountPence: 42000 },
      { description: 'PACE workbooks x5', quantity: 5, unitAmountPence: 750 },
      { description: 'Lunch programme half term', quantity: 1, unitAmountPence: 6500 },
    ]);
  }, 15_000);

  it('publishes uploaded drafts against multiple children', async () => {
    const { caller } = createCaller(financeUser);
    const pdfBase64 = Buffer.from('%PDF-1.4\n').toString('base64');

    const draft = await caller.invoice.uploadDraft({
      fileName: 'OLC0022.pdf',
      mimeType: 'application/pdf',
      sizeBytes: Buffer.from('%PDF-1.4\n').length,
      pdfBase64,
    });

    const published = await caller.invoice.publishDraft({
      invoiceId: draft.invoice.id,
      studentIds: [linkedStudentId, otherStudentId],
      familyLabel: 'Parent family',
      schoolYear: 2026,
      billingCadence: 'Monthly',
      invoiceNumber: 'OLC0022',
      issuedOn: '2026-05-21',
      dueOn: '2026-06-04',
      term: 'MAY 2026',
      lineItems: [
        {
          description: 'Learning centre fees - Talia Parent',
          quantity: 1,
          unitAmountPence: 18987,
        },
        {
          description: 'Learning centre fees - Other Child',
          quantity: 1,
          unitAmountPence: 16537,
        },
      ],
    });

    expect(published).toMatchObject({
      status: 'Unpaid',
      invoiceNumber: 'OLC0022',
      familyLabel: 'Parent family',
      schoolYear: 2026,
      billingCadence: 'Monthly',
      totalAmountPence: 35524,
    });
    expect(published.students.map((student) => student.id)).toEqual([
      linkedStudentId,
      otherStudentId,
    ]);
    expect(published.lineItems.map((line) => line.unitAmountPence)).toEqual([18987, 16537]);
  });

  it('blocks untagged staff from admin invoice procedures', async () => {
    const { caller, fakeDb } = createCaller(untaggedStaffUser);

    await expect(caller.invoice.listAdmin({ status: 'All' })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    const auditCall = fakeDb.db.auditLog.create.mock.calls[0]?.[0];
    expect(auditCall?.data.action).toBe('PermissionDenied');
    expect(auditCall?.data.entity).toBe('invoice.listAdmin');
  });

  it('shows family year payment progress when creating invoices', async () => {
    const paidInvoice = makeInvoice({
      id: invoiceId,
      status: 'Paid',
      dueOn: new Date('2026-12-31T00:00:00.000Z'),
      totalAmountPence: 24500,
      subtotalAmountPence: 24500,
      paidAt: new Date('2026-05-15T08:00:00.000Z'),
      paymentConfirmedAt: new Date('2026-05-15T08:00:00.000Z'),
      paymentConfirmedById: financeUser.id,
    });
    const pendingInvoice = makeInvoice({
      id: 'cinvoice00000000002',
      status: 'PaymentPending',
      dueOn: new Date('2026-12-31T00:00:00.000Z'),
      totalAmountPence: 24500,
      subtotalAmountPence: 24500,
      parentMarkedPaidAt: new Date('2026-05-16T08:00:00.000Z'),
      parentMarkedPaidById: parentUser.id,
    });
    const unpaidInvoice = makeInvoice({
      id: 'cinvoice00000000003',
      dueOn: new Date('2026-12-31T00:00:00.000Z'),
      totalAmountPence: 98000,
      subtotalAmountPence: 98000,
    });
    const fakeDb = makeFakeDb({ initialInvoices: [paidInvoice, pendingInvoice, unpaidInvoice] });
    const { caller } = createCaller(financeUser, fakeDb);

    const families = await caller.invoice.listBillableFamilies();
    const parentFamily = families.find((family) =>
      family.students.some((student) => student.id === linkedStudentId),
    );

    expect(parentFamily?.yearSummary).toMatchObject({
      schoolYear: 2026,
      cycleLabel: 'Sep 2025 - Aug 2026',
      adjustedAnnualAmountPence: 171500,
      issuedAmountPence: 147000,
      paidAmountPence: 24500,
      paymentPendingAmountPence: 24500,
      remainingAmountPence: 147000,
      leftToInvoiceAmountPence: 24500,
      invoiceCount: 3,
    });
    expect(parentFamily?.yearSummary.children).toEqual([
      expect.objectContaining({
        studentId: linkedStudentId,
        chargeableStartsOn: '2026-02-01',
        chargeableMonths: 7,
        adjustedAnnualAmountPence: 171500,
        leftToInvoiceAmountPence: 24500,
      }),
    ]);
  });

  it('scopes parent invoice lists and downloads to linked children only', async () => {
    const ownInvoice = makeInvoice({ id: invoiceId, studentId: linkedStudentId });
    const otherInvoice = makeInvoice({
      id: 'cinvoice00000000002',
      invoiceNumber: 'INV-2026-002',
      studentId: otherStudentId,
    });
    const draftInvoice = makeInvoice({
      id: 'cinvoice00000000003',
      invoiceNumber: null,
      studentId: linkedStudentId,
      status: 'Draft',
    });
    const fakeDb = makeFakeDb({
      initialInvoices: [ownInvoice, otherInvoice, draftInvoice],
      initialLines: [
        makeLine({ invoiceId: ownInvoice.id }),
        makeLine({ invoiceId: otherInvoice.id }),
        makeLine({ invoiceId: draftInvoice.id }),
      ],
    });
    const { caller } = createCaller(parentUser, fakeDb);

    const parentList = await caller.invoice.listParent({ status: 'All' });
    expect(parentList.invoices.map((invoice) => invoice.id)).toEqual([ownInvoice.id]);

    const download = await caller.invoice.downloadPdf({ invoiceId: ownInvoice.id });
    expect(download.pdfBase64).toBe('JVBERi0xLjQK');
    expect(download.fileName).toBe('invoice.pdf');
  });

  it('lets linked supervisor-parent users view only linked child fee invoices', async () => {
    const ownInvoice = makeInvoice({ id: invoiceId, studentId: linkedStudentId });
    const otherInvoice = makeInvoice({
      id: 'cinvoice00000000002',
      invoiceNumber: 'INV-2026-002',
      studentId: otherStudentId,
    });
    const draftInvoice = makeInvoice({
      id: 'cinvoice00000000003',
      invoiceNumber: null,
      studentId: linkedStudentId,
      status: 'Draft',
    });
    const fakeDb = makeFakeDb({
      initialGuardians: [{ userId: supervisorParentUser.id, studentId: linkedStudentId }],
      initialInvoices: [ownInvoice, otherInvoice, draftInvoice],
      initialLines: [
        makeLine({ invoiceId: ownInvoice.id }),
        makeLine({ invoiceId: otherInvoice.id }),
        makeLine({ invoiceId: draftInvoice.id }),
      ],
    });
    const { caller } = createCaller(supervisorParentUser, fakeDb);

    const parentList = await caller.invoice.listParent({ status: 'All' });
    expect(parentList.invoices.map((invoice) => invoice.id)).toEqual([ownInvoice.id]);

    const download = await caller.invoice.downloadPdf({ invoiceId: ownInvoice.id });
    expect(download.pdfBase64).toBe('JVBERi0xLjQK');

    await expect(caller.invoice.downloadPdf({ invoiceId: otherInvoice.id })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    await expect(caller.invoice.downloadPdf({ invoiceId: draftInvoice.id })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('creates generated family invoices for multiple children and linked parents', async () => {
    const fakeDb = makeFakeDb({
      initialGuardians: [
        { userId: parentUser.id, studentId: linkedStudentId },
        { userId: secondParentUser.id, studentId: otherStudentId },
      ],
    });
    const { caller: adminCaller } = createCaller(financeUser, fakeDb);

    const created = await adminCaller.invoice.createGenerated({
      schoolYear: 2026,
      billingCadence: 'Monthly',
      studentIds: [linkedStudentId, otherStudentId],
      familyLabel: 'Parent family',
      invoiceNumber: 'OLC0011',
      issuedOn: '2026-05-01',
      dueOn: '2026-05-15',
      term: 'MAY 2026',
      lineItems: [
        { description: 'Monthly fee - Talia Parent', quantity: 1, unitAmountPence: 24500 },
        { description: 'Monthly fee - Other Child', quantity: 1, unitAmountPence: 24500 },
      ],
      discounts: [
        {
          label: 'Sibling discount',
          kind: 'Preset',
          presetCode: 'sibling',
          percentBps: 2500,
          amountPence: null,
        },
        {
          label: 'Church Leaders / Oasis Supervisors',
          kind: 'Preset',
          presetCode: 'church-leader',
          percentBps: 2000,
          amountPence: null,
        },
      ],
    });

    expect(created.students.map((student) => student.id)).toEqual([
      linkedStudentId,
      otherStudentId,
    ]);
    expect(created.subtotalAmountPence).toBe(49000);
    expect(created.discountAmountPence).toBe(12250);
    expect(created.totalAmountPence).toBe(36750);
    expect(created.discounts.map((discount) => discount.appliedAmountPence)).toEqual([6125, 6125]);
    expect(
      created.discountBreakdowns.map((child) =>
        child.discounts.map((discount) => discount.appliedAmountPence),
      ),
    ).toEqual([[4900], [6125, 1225]]);
    expect(fakeDb.invoiceStudents).toEqual([
      { invoiceId: created.id, studentId: linkedStudentId, position: 1 },
      { invoiceId: created.id, studentId: otherStudentId, position: 2 },
    ]);

    const { caller: firstParentCaller } = createCaller(parentUser, fakeDb);
    const { caller: secondParentCaller } = createCaller(secondParentUser, fakeDb);
    const firstParentList = await firstParentCaller.invoice.listParent({ status: 'All' });
    const secondParentList = await secondParentCaller.invoice.listParent({ status: 'All' });
    expect(firstParentList.invoices.map((invoice) => invoice.id)).toEqual([created.id]);
    expect(secondParentList.invoices.map((invoice) => invoice.id)).toEqual([created.id]);

    const download = await firstParentCaller.invoice.downloadPdf({ invoiceId: created.id });
    expect(Buffer.from(download.pdfBase64, 'base64').subarray(0, 5).toString('utf8')).toBe('%PDF-');

    const { caller: unlinkedParentCaller } = createCaller(unlinkedParentUser, fakeDb);
    await expect(
      unlinkedParentCaller.invoice.downloadPdf({ invoiceId: created.id }),
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('uses capped discounts and prorated annual targets for generated invoices', async () => {
    const fakeDb = makeFakeDb({
      initialStudents: [
        makeStudent({ id: linkedStudentId }),
        makeStudent({ id: otherStudentId }),
        makeStudent({ id: thirdStudentId }),
        makeStudent({ id: fourthStudentId }),
      ],
      initialGuardians: [
        { userId: parentUser.id, studentId: linkedStudentId },
        { userId: parentUser.id, studentId: otherStudentId },
        { userId: parentUser.id, studentId: thirdStudentId },
        { userId: parentUser.id, studentId: fourthStudentId },
      ],
    });
    const { caller: adminCaller } = createCaller(financeUser, fakeDb);

    const created = await adminCaller.invoice.createGenerated({
      schoolYear: 2026,
      billingCadence: 'Annual',
      studentIds: [linkedStudentId, otherStudentId, thirdStudentId, fourthStudentId],
      familyLabel: 'Parent family',
      invoiceNumber: 'OLC0014',
      issuedOn: '2026-05-01',
      dueOn: '2026-05-15',
      term: '2026 SCHOOL YEAR',
      lineItems: [
        { description: 'Annual fee - Talia Parent', quantity: 1, unitAmountPence: 171500 },
        { description: 'Annual fee - Other Child', quantity: 1, unitAmountPence: 171500 },
        { description: 'Annual fee - Third Child', quantity: 1, unitAmountPence: 171500 },
        { description: 'Annual fee - Fourth Child', quantity: 1, unitAmountPence: 171500 },
      ],
      discounts: [
        {
          label: 'Sibling discount',
          kind: 'Preset',
          presetCode: 'sibling',
          percentBps: 2500,
          amountPence: null,
        },
        {
          label: 'Church Leaders / Oasis Supervisors',
          kind: 'Preset',
          presetCode: 'church-leader',
          percentBps: 2000,
          amountPence: null,
        },
        {
          label: 'Fountain Church Volunteers / Oasis Parent Volunteers / Tithers',
          kind: 'Preset',
          presetCode: 'volunteer-tither',
          percentBps: 1500,
          amountPence: null,
        },
        {
          label: 'Fountain Church Member',
          kind: 'Preset',
          presetCode: 'church-member',
          percentBps: 1000,
          amountPence: null,
        },
      ],
    });

    expect(created.subtotalAmountPence).toBe(686000);
    expect(created.discountAmountPence).toBe(156493);
    expect(created.totalAmountPence).toBe(529507);
    expect(created.discounts.map((discount) => discount.appliedAmountPence)).toEqual([
      85750, 51450, 19293, 0,
    ]);
    expect(created.discountBreakdowns.map((child) => child.totalAmountPence)).toEqual([
      130769, 113619, 113619, 171500,
    ]);
  });

  it('stores manual generated discounts against the selected child', async () => {
    const fakeDb = makeFakeDb();
    const { caller: adminCaller } = createCaller(financeUser, fakeDb);

    const created = await adminCaller.invoice.createGenerated({
      schoolYear: 2026,
      billingCadence: 'Monthly',
      studentIds: [linkedStudentId, otherStudentId],
      familyLabel: 'Parent family',
      invoiceNumber: 'OLC0013',
      issuedOn: '2026-05-01',
      dueOn: '2026-05-15',
      term: 'MAY 2026',
      lineItems: [
        { description: 'Monthly fee - Talia Parent', quantity: 1, unitAmountPence: 24500 },
        { description: 'Monthly fee - Other Child', quantity: 1, unitAmountPence: 24500 },
      ],
      discounts: [
        {
          label: 'Manual bursary',
          kind: 'ManualFixed',
          presetCode: schoolFeeDiscountChildIndexPresetCode(1),
          percentBps: null,
          amountPence: 5000,
        },
      ],
    });

    expect(created.discountAmountPence).toBe(5000);
    expect(created.totalAmountPence).toBe(44000);
    expect(created.discounts[0]?.presetCode).toBe(schoolFeeDiscountChildIndexPresetCode(1));
    expect(
      created.discountBreakdowns.map((child) =>
        child.discounts.map((discount) => discount.appliedAmountPence),
      ),
    ).toEqual([[], [5000]]);
  });

  it('rejects generated invoices with duplicate invoice numbers', async () => {
    const fakeDb = makeFakeDb({
      initialInvoices: [makeInvoice({ id: invoiceId, invoiceNumber: 'OLC0011' })],
    });
    const { caller: adminCaller } = createCaller(financeUser, fakeDb);

    await expect(
      adminCaller.invoice.createGenerated({
        schoolYear: 2026,
        billingCadence: 'Monthly',
        studentIds: [linkedStudentId],
        familyLabel: 'Parent family',
        invoiceNumber: 'OLC0011',
        issuedOn: '2026-05-01',
        dueOn: '2026-05-15',
        term: 'MAY 2026',
        lineItems: [
          { description: 'Monthly fee - Talia Parent', quantity: 1, unitAmountPence: 24500 },
        ],
        discounts: [],
      }),
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'invoice number already exists',
    });
    expect(fakeDb.invoices).toHaveLength(1);
  });

  it('rejects sibling discounts for generated invoices with one child', async () => {
    const fakeDb = makeFakeDb();
    const { caller: adminCaller } = createCaller(financeUser, fakeDb);

    await expect(
      adminCaller.invoice.createGenerated({
        schoolYear: 2026,
        billingCadence: 'Monthly',
        studentIds: [linkedStudentId],
        familyLabel: 'Parent family',
        invoiceNumber: 'OLC0012',
        issuedOn: '2026-05-01',
        dueOn: '2026-05-15',
        term: 'MAY 2026',
        lineItems: [
          { description: 'Monthly fee - Talia Parent', quantity: 1, unitAmountPence: 24500 },
        ],
        discounts: [
          {
            label: 'Sibling discount',
            kind: 'Preset',
            presetCode: 'sibling',
            percentBps: 2500,
            amountPence: null,
          },
        ],
      }),
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'sibling discount requires at least two children',
    });
  });

  it('calculates parent year totals from annual fees with family discounts', async () => {
    const paidInvoice = makeInvoice({
      id: invoiceId,
      status: 'Paid',
      totalAmountPence: 24500,
      subtotalAmountPence: 24500,
      paidAt: new Date('2026-05-15T08:00:00.000Z'),
      paymentConfirmedAt: new Date('2026-05-15T08:00:00.000Z'),
      paymentConfirmedById: financeUser.id,
    });
    const fakeDb = makeFakeDb({
      initialInvoices: [paidInvoice],
      initialLines: [
        makeLine({ invoiceId: paidInvoice.id, unitAmountPence: 24500, totalAmountPence: 24500 }),
      ],
      initialInvoiceStudents: [
        { invoiceId: paidInvoice.id, studentId: linkedStudentId, position: 1 },
        { invoiceId: paidInvoice.id, studentId: otherStudentId, position: 2 },
      ],
      initialDiscounts: [
        makeDiscount({
          invoiceId: paidInvoice.id,
          baseAmountPence: 6125,
          appliedAmountPence: 6125,
        }),
      ],
    });
    const { caller: parentCaller } = createCaller(parentUser, fakeDb);

    const parentList = await parentCaller.invoice.listParent({ status: 'All' });

    expect(parentList.stats.paidAmountPence).toBe(24500);
    expect(parentList.stats.outstandingAmountPence).toBe(275625);
    expect(parentList.stats.remainingAmountPence).toBe(275625);
    expect(parentList.stats.overdueAmountPence).toBe(0);
  });

  it('prorates parent owed totals for January and May enrolments', async () => {
    const paidInvoice = makeInvoice({
      id: invoiceId,
      status: 'Paid',
      studentId: linkedStudentId,
      totalAmountPence: 24500,
      subtotalAmountPence: 24500,
      paidAt: new Date('2026-05-15T08:00:00.000Z'),
      paymentConfirmedAt: new Date('2026-05-15T08:00:00.000Z'),
      paymentConfirmedById: financeUser.id,
    });
    const fakeDb = makeFakeDb({
      initialStudents: [
        makeStudent({ id: linkedStudentId, enrolmentDate: new Date('2026-01-12T00:00:00.000Z') }),
        makeStudent({ id: otherStudentId, enrolmentDate: new Date('2026-05-18T00:00:00.000Z') }),
      ],
      initialGuardians: [
        { userId: parentUser.id, studentId: linkedStudentId },
        { userId: parentUser.id, studentId: otherStudentId },
      ],
      initialInvoices: [paidInvoice],
      initialLines: [
        makeLine({ invoiceId: paidInvoice.id, unitAmountPence: 24500, totalAmountPence: 24500 }),
      ],
    });
    const { caller: parentCaller } = createCaller(parentUser, fakeDb);

    const parentList = await parentCaller.invoice.listParent({ status: 'All' });

    expect(parentList.stats.paidAmountPence).toBe(24500);
    expect(parentList.stats.outstandingAmountPence).toBe(245000);
    expect(parentList.stats.remainingAmountPence).toBe(245000);
    expect(parentList.yearSummary).toMatchObject({
      annualAmountPence: 269500,
      adjustedAnnualAmountPence: 269500,
      paidAmountPence: 24500,
      remainingAmountPence: 245000,
      leftToInvoiceAmountPence: 245000,
    });
    expect(parentList.yearSummary.children).toEqual([
      expect.objectContaining({
        studentId: linkedStudentId,
        chargeableStartsOn: '2026-02-01',
        chargeableMonths: 7,
        grossAnnualAmountPence: 171500,
        paidAmountPence: 24500,
        leftToInvoiceAmountPence: 147000,
      }),
      expect.objectContaining({
        studentId: otherStudentId,
        chargeableStartsOn: '2026-05-01',
        chargeableMonths: 4,
        grossAnnualAmountPence: 98000,
        paidAmountPence: 0,
        leftToInvoiceAmountPence: 98000,
      }),
    ]);
  });

  it('edits unpaid generated invoices and regenerates discount explanation text', async () => {
    const ownInvoice = makeInvoice({
      id: invoiceId,
      invoiceNumber: 'OLC0015',
      totalAmountPence: 24500,
      subtotalAmountPence: 24500,
      discountExplanationEnc: encrypt(SCHOOL_FEE_DISCOUNT_EXPLANATION),
    });
    const fakeDb = makeFakeDb({
      initialGuardians: [
        { userId: parentUser.id, studentId: linkedStudentId },
        { userId: parentUser.id, studentId: otherStudentId },
      ],
      initialInvoices: [ownInvoice],
      initialLines: [
        makeLine({ invoiceId: ownInvoice.id, unitAmountPence: 24500, totalAmountPence: 24500 }),
      ],
    });
    const { caller: adminCaller } = createCaller(financeUser, fakeDb);

    const updated = await adminCaller.invoice.updateGenerated({
      invoiceId,
      schoolYear: 2026,
      billingCadence: 'Monthly',
      studentIds: [linkedStudentId, otherStudentId],
      familyLabel: 'Parent family',
      invoiceNumber: 'OLC0015-REV',
      issuedOn: '2026-05-02',
      dueOn: '2026-05-20',
      term: 'MAY 2026',
      lineItems: [
        { description: 'Monthly fee - Talia Parent', quantity: 1, unitAmountPence: 24500 },
        { description: 'Monthly fee - Other Child', quantity: 1, unitAmountPence: 24500 },
      ],
      discounts: [
        {
          label: 'Sibling discount',
          kind: 'Preset',
          presetCode: 'sibling',
          percentBps: 2500,
          amountPence: null,
        },
      ],
      discountExplanation: 'Custom discount explanation for this invoice.',
    });

    expect(updated.invoiceNumber).toBe('OLC0015-REV');
    expect(updated.totalAmountPence).toBe(42875);
    expect(updated.discountExplanation).toBe('Custom discount explanation for this invoice.');
    expect(decrypt(fakeDb.invoices[0]?.extractedTextEnc)).toContain(
      'Custom discount explanation for this invoice.',
    );
    expect(
      Buffer.from(decrypt(fakeDb.invoices[0]?.pdfBytesEnc) ?? '', 'base64')
        .subarray(0, 5)
        .toString('utf8'),
    ).toBe('%PDF-');
  });

  it('rejects editing paid or payment-pending generated invoices', async () => {
    const paidInvoice = makeInvoice({ id: invoiceId, status: 'Paid' });
    const pendingInvoice = makeInvoice({
      id: 'cinvoice00000000002',
      invoiceNumber: 'OLC0016',
      status: 'PaymentPending',
      parentMarkedPaidAt: new Date('2026-05-16T08:00:00.000Z'),
      parentMarkedPaidById: parentUser.id,
    });
    const fakeDb = makeFakeDb({ initialInvoices: [paidInvoice, pendingInvoice] });
    const { caller: adminCaller } = createCaller(financeUser, fakeDb);
    const input = {
      schoolYear: 2026,
      billingCadence: 'Monthly' as const,
      studentIds: [linkedStudentId],
      familyLabel: 'Parent family',
      invoiceNumber: 'OLC0017',
      issuedOn: '2026-05-02',
      dueOn: '2026-05-20',
      term: 'MAY 2026',
      lineItems: [
        { description: 'Monthly fee - Talia Parent', quantity: 1, unitAmountPence: 24500 },
      ],
      discounts: [],
      discountExplanation: SCHOOL_FEE_DISCOUNT_EXPLANATION,
    };

    await expect(
      adminCaller.invoice.updateGenerated({ ...input, invoiceId: paidInvoice.id }),
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'only draft and unpaid invoices can be edited',
    });
    await expect(
      adminCaller.invoice.updateGenerated({ ...input, invoiceId: pendingInvoice.id }),
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'only draft and unpaid invoices can be edited',
    });
  });

  it('keeps parent marked payments pending until staff confirm or reject them', async () => {
    const ownInvoice = makeInvoice({
      id: invoiceId,
      totalAmountPence: 24500,
      subtotalAmountPence: 24500,
    });
    const fakeDb = makeFakeDb({
      initialInvoices: [ownInvoice],
      initialLines: [
        makeLine({ invoiceId: ownInvoice.id, unitAmountPence: 24500, totalAmountPence: 24500 }),
      ],
    });
    const { caller: parentCaller } = createCaller(parentUser, fakeDb);
    const { caller: adminCaller } = createCaller(financeUser, fakeDb);

    const pending = await parentCaller.invoice.parentMarkPaid({ invoiceId });
    expect(pending.status).toBe('PaymentPending');
    expect(pending.paidAt).toBeNull();

    const pendingParentList = await parentCaller.invoice.listParent({ status: 'All' });
    expect(pendingParentList.stats.paidAmountPence).toBe(0);
    expect(pendingParentList.stats.paymentPendingCount).toBe(1);
    expect(pendingParentList.stats.remainingAmountPence).toBe(171500);

    const paid = await adminCaller.invoice.confirmPayment({ invoiceId });
    expect(paid.status).toBe('Paid');
    expect(paid.paidAt).toBeInstanceOf(Date);
    const paidParentList = await parentCaller.invoice.listParent({ status: 'All' });
    expect(paidParentList.stats.paidAmountPence).toBe(24500);
    expect(paidParentList.stats.remainingAmountPence).toBe(147000);

    const rejectInvoice = makeInvoice({
      id: 'cinvoice00000000004',
      status: 'PaymentPending',
      parentMarkedPaidAt: new Date('2026-05-02T08:00:00.000Z'),
      parentMarkedPaidById: parentUser.id,
    });
    fakeDb.invoices.push(rejectInvoice);
    fakeDb.lines.push(makeLine({ invoiceId: rejectInvoice.id }));
    fakeDb.invoiceStudents.push({
      invoiceId: rejectInvoice.id,
      studentId: linkedStudentId,
      position: 1,
    });
    const rejected = await adminCaller.invoice.rejectPayment({ invoiceId: rejectInvoice.id });
    expect(rejected.status).toBe('Unpaid');
    expect(rejected.parentMarkedPaidAt).toBeNull();
  });

  it('lets parents opt out of discounts before payment is pending', async () => {
    const ownInvoice = makeInvoice({
      id: invoiceId,
      subtotalAmountPence: 49000,
      discountAmountPence: 11125,
      totalAmountPence: 37875,
      invoiceNumber: 'OLC0012',
      familyLabelEnc: encrypt('Parent family'),
    });
    const fakeDb = makeFakeDb({
      initialInvoices: [ownInvoice],
      initialLines: [
        makeLine({
          invoiceId: ownInvoice.id,
          descriptionEnc: encrypt('Monthly fee - Talia Parent'),
          unitAmountPence: 24500,
          totalAmountPence: 24500,
        }),
        makeLine({
          id: 'cline000000000002',
          invoiceId: ownInvoice.id,
          position: 2,
          descriptionEnc: encrypt('Monthly fee - Other Child'),
          unitAmountPence: 24500,
          totalAmountPence: 24500,
        }),
      ],
      initialInvoiceStudents: [
        { invoiceId: ownInvoice.id, studentId: linkedStudentId, position: 1 },
        { invoiceId: ownInvoice.id, studentId: otherStudentId, position: 2 },
      ],
      initialDiscounts: [
        makeDiscount({
          invoiceId: ownInvoice.id,
          baseAmountPence: 6125,
          appliedAmountPence: 6125,
        }),
        makeDiscount({
          id: 'cdiscount0000000002',
          invoiceId: ownInvoice.id,
          position: 2,
          labelEnc: encrypt('Pastor bursary'),
          kind: 'ManualFixed',
          presetCode: null,
          percentBps: null,
          amountPence: 5000,
          baseAmountPence: 5000,
          appliedAmountPence: 5000,
        }),
      ],
    });
    const { caller: parentCaller } = createCaller(parentUser, fakeDb);

    const updated = await parentCaller.invoice.setDiscountOptOut({
      invoiceId,
      discountId,
      optedOut: true,
    });

    expect(updated.discountAmountPence).toBe(5000);
    expect(updated.totalAmountPence).toBe(44000);
    expect(updated.discounts[0]?.optedOut).toBe(true);
    expect(
      Buffer.from(fakeDb.invoices[0]?.pdfBytesEnc.replace(/^enc:/u, '') ?? '', 'base64')
        .subarray(0, 5)
        .toString('utf8'),
    ).toBe('%PDF-');

    await parentCaller.invoice.parentMarkPaid({ invoiceId });
    await expect(
      parentCaller.invoice.setDiscountOptOut({ invoiceId, discountId, optedOut: false }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('does not decrypt PDF data before parent access checks pass', async () => {
    const decryptSpy = vi.fn(decrypt);
    const fakeDb = makeFakeDb({
      initialInvoices: [
        makeInvoice({
          id: invoiceId,
          invoiceNumber: 'INV-2026-009',
          studentId: otherStudentId,
        }),
      ],
      decryptImpl: decryptSpy,
    });
    const { caller } = createCaller(parentUser, fakeDb);

    await expect(caller.invoice.downloadPdf({ invoiceId })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    expect(decryptSpy).not.toHaveBeenCalled();
  });
});
