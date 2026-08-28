import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Prisma } from '@oasis/db';
import { describe, expect, it, vi } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import {
  SCHOOL_FEE_DISCOUNT_EXPLANATION,
  schoolFeeDiscountChildIndexPresetCode,
  type SessionUser,
} from '@oasis/domain';
import type { AppContext, RlsTx } from '../context.js';
import { generateSchoolFeeInvoicePdf } from '../invoices/school-fee-pdf.js';
import { INVOICE_PAYMENT_NOTIFICATION_EMAIL_SUBJECT, type EmailClient } from '../lib/email.js';
import { createInvoiceRouter } from '../routers/invoice.js';
import { router } from '../trpc.js';
import {
  decryptTestValue as decrypt,
  encryptTestValue as encrypt,
} from './helpers/test-encryption.js';

type InvoiceStatus = 'Draft' | 'Unpaid' | 'PaymentPending' | 'Paid';
type BillingCadence = 'Annual' | 'Term' | 'Monthly';
type DiscountKind = 'Preset' | 'ManualPercent' | 'ManualFixed';
type InvoiceKind = 'SchoolFee' | 'Manual';

interface StoredInvoice {
  id: string;
  invoiceNumber: string | null;
  studentId: string | null;
  status: InvoiceStatus;
  kind: InvoiceKind;
  invoiceTitleEnc: string | null;
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

interface StoredUser {
  id: string;
  role: SessionUser['role'];
  active: boolean;
  fullNameEnc: string;
  emailEnc: string;
  createdAt: Date;
}

interface FakeGuardianFindManyArgs {
  where: {
    userId?: string | { in: string[] };
    studentId?: string;
  };
  select?: {
    userId?: boolean;
    studentId?: boolean;
  };
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
    kind?: InvoiceKind;
    schoolYear?: number;
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

interface FakeUserFindManyArgs {
  where?: {
    active?: boolean;
    role?: SessionUser['role'];
  };
  orderBy?: { createdAt: 'asc' | 'desc' };
}

interface FakeInvoiceCreateArgs {
  data: {
    status: InvoiceStatus;
    invoiceNumber?: string | null;
    studentId?: string | null;
    kind?: InvoiceKind;
    invoiceTitleEnc?: string | null;
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
  where: {
    id: string;
    kind?: InvoiceKind;
    status?: InvoiceStatus | { in: InvoiceStatus[] };
  };
  data: Partial<
    Pick<
      StoredInvoice,
      | 'invoiceNumber'
      | 'studentId'
      | 'status'
      | 'kind'
      | 'invoiceTitleEnc'
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

const principalUser: SessionUser = {
  id: 'cprincipal0000000001',
  role: 'Principal',
  tags: [],
  requires2fa: false,
};

const pastorUser: SessionUser = {
  id: 'cpastor000000000001',
  role: 'Pastor',
  tags: [],
  requires2fa: false,
};

const headUser: SessionUser = {
  id: 'chead00000000000001',
  role: 'Head',
  tags: [],
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
const manualInvoiceInput = {
  invoiceTitle: 'Sign-up fee',
  amountPence: 15_000,
  studentIds: [linkedStudentId, otherStudentId],
  familyLabel: 'Parent family',
  invoiceNumber: 'OLC-MANUAL-001',
  issuedOn: '2026-08-27',
  dueOn: '2026-09-10',
};

function makePdfInput(lineCount: number): Parameters<typeof generateSchoolFeeInvoicePdf>[0] {
  const lineItems = Array.from({ length: lineCount }, (_, index) => ({
    description: `Charge for child ${String(index + 1)}`,
    quantity: 1,
    unitAmountPence: 15_000,
    totalAmountPence: 15_000,
  }));
  return {
    documentTitle: 'Invoice',
    billingLabel: 'Sign-up fee',
    invoiceNumber: `OLC-MANUAL-${String(lineCount).padStart(3, '0')}`,
    issuedOn: new Date('2026-08-27T00:00:00.000Z'),
    dueOn: new Date('2026-09-10T00:00:00.000Z'),
    billTo: 'Parent family',
    familyLabel: null,
    students: lineItems.map((_, index) => ({
      name: `Child ${String(index + 1)}`,
      yearGroup: 'Y9',
    })),
    schoolYear: null,
    billingCadence: null,
    term: null,
    subtotalAmountPence: 15_000 * lineCount,
    discountAmountPence: 0,
    totalAmountPence: 15_000 * lineCount,
    discountExplanation: '',
    paymentReference: `OLC-MANUAL-${String(lineCount).padStart(3, '0')}`,
    lineItems,
    discounts: [],
    discountBreakdowns: [],
  };
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

function makeUser(input: Pick<StoredUser, 'id' | 'role'> & Partial<StoredUser>): StoredUser {
  return {
    active: true,
    fullNameEnc: encrypt(`${input.role} User`),
    emailEnc: encrypt(`${input.id}@example.com`),
    createdAt: new Date('2026-05-01T08:00:00.000Z'),
    ...input,
  };
}

function makeInvoice(input: Pick<StoredInvoice, 'id'> & Partial<StoredInvoice>): StoredInvoice {
  return {
    invoiceNumber: 'INV-2026-001',
    studentId: linkedStudentId,
    status: 'Unpaid',
    kind: 'SchoolFee',
    invoiceTitleEnc: null,
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
  initialUsers = [],
  initialGuardians = [{ userId: parentUser.id, studentId: linkedStudentId }],
  initialInvoices = [],
  initialLines = [],
  initialInvoiceStudents,
  initialDiscounts = [],
  decryptImpl = decrypt,
  beforeInvoiceCreate,
  beforeInvoiceUpdate,
}: {
  initialStudents?: StoredStudent[];
  initialUsers?: StoredUser[];
  initialGuardians?: StoredGuardian[];
  initialInvoices?: StoredInvoice[];
  initialLines?: StoredLine[];
  initialInvoiceStudents?: StoredInvoiceStudent[];
  initialDiscounts?: StoredDiscount[];
  decryptImpl?: (value: string | null | undefined) => string | null;
  beforeInvoiceCreate?: () => void;
  beforeInvoiceUpdate?: (invoice: StoredInvoice) => void;
} = {}) {
  const students = initialStudents ?? [
    makeStudent({ id: linkedStudentId }),
    makeStudent({ id: otherStudentId }),
  ];
  const users = [...initialUsers];
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
    if (where.kind && invoice.kind !== where.kind) return false;
    if (where.schoolYear !== undefined && invoice.schoolYear !== where.schoolYear) return false;
    if (where.status?.not && invoice.status === where.status.not) return false;
    return true;
  }

  const db = {
    $enc: {
      encrypt: vi.fn(encrypt),
      decrypt: vi.fn(decryptImpl),
      blindIndex: vi.fn((value: string) => value.toLowerCase()),
    },
    user: {
      findMany: vi.fn((args: FakeUserFindManyArgs = {}) => {
        const rows = users
          .filter((user) =>
            args.where?.active === undefined ? true : user.active === args.where.active,
          )
          .filter((user) => (args.where?.role ? user.role === args.where.role : true));
        if (args.orderBy?.createdAt === 'desc') {
          return [...rows].sort(
            (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
          );
        }
        return [...rows].sort(
          (left, right) => left.createdAt.getTime() - right.createdAt.getTime(),
        );
      }),
    },
    guardian: {
      findMany: vi.fn(({ where }: FakeGuardianFindManyArgs) =>
        guardians.filter((guardian) => {
          if (where.userId) {
            const matchesUser =
              typeof where.userId === 'string'
                ? guardian.userId === where.userId
                : where.userId.in.includes(guardian.userId);
            if (!matchesUser) return false;
          }
          if (where.studentId && guardian.studentId !== where.studentId) return false;
          return true;
        }),
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
        beforeInvoiceCreate?.();
        const created = makeInvoice({
          id: `cinvoicenew000000${String(invoiceSequence++).padStart(2, '0')}`,
          invoiceNumber: data.invoiceNumber ?? null,
          studentId: data.studentId ?? null,
          status: data.status,
          kind: data.kind ?? 'SchoolFee',
          invoiceTitleEnc: data.invoiceTitleEnc ?? null,
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
        beforeInvoiceUpdate?.(invoice);
        const statusMatches =
          where.status === undefined ||
          (typeof where.status === 'string'
            ? invoice.status === where.status
            : where.status.in.includes(invoice.status));
        if ((where.kind && invoice.kind !== where.kind) || !statusMatches) {
          throw new Prisma.PrismaClientKnownRequestError('Record not found', {
            code: 'P2025',
            clientVersion: 'test',
          });
        }
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

  return { db, users, invoices, lines, invoiceStudents, discounts, feeConfigs };
}

function makeFakeEmailClient(result = { id: 'invoice_email_123' }) {
  const send = vi.fn<EmailClient['send']>().mockResolvedValue(result);
  const client: EmailClient = { send };
  return { client, send };
}

function createCaller(
  user: SessionUser,
  fakeDb = makeFakeDb(),
  useDefaultExtractor = false,
  emailClient?: EmailClient,
) {
  const testRouter = router({
    invoice: createInvoiceRouter(
      useDefaultExtractor
        ? emailClient
          ? { emailClient }
          : undefined
        : {
            ...(emailClient ? { emailClient } : {}),
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

  it('publishes uploaded draft discounts as exact child-scoped fixed discounts', async () => {
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
          unitAmountPence: 24500,
        },
        {
          description: 'Learning centre fees - Other Child',
          quantity: 1,
          unitAmountPence: 24500,
        },
      ],
      discounts: [
        {
          label: 'Church leader + Member',
          kind: 'ManualFixed',
          presetCode: schoolFeeDiscountChildIndexPresetCode(0),
          percentBps: null,
          amountPence: 5513,
        },
        {
          label: 'Sibling, Leader & Member',
          kind: 'ManualFixed',
          presetCode: schoolFeeDiscountChildIndexPresetCode(1),
          percentBps: null,
          amountPence: 7963,
        },
      ],
    });

    expect(published).toMatchObject({
      status: 'Unpaid',
      subtotalAmountPence: 49000,
      discountAmountPence: 13476,
      totalAmountPence: 35524,
    });
    expect(published.discounts).toEqual([
      expect.objectContaining({
        label: 'Church leader + Member',
        kind: 'ManualFixed',
        presetCode: schoolFeeDiscountChildIndexPresetCode(0),
        amountPence: 5513,
        appliedAmountPence: 5513,
      }),
      expect.objectContaining({
        label: 'Sibling, Leader & Member',
        kind: 'ManualFixed',
        presetCode: schoolFeeDiscountChildIndexPresetCode(1),
        amountPence: 7963,
        appliedAmountPence: 7963,
      }),
    ]);
    expect(published.discountBreakdowns.map((breakdown) => breakdown.totalAmountPence)).toEqual([
      18987, 16537,
    ]);
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

  it('shows active-year non-draft family payment progress when creating invoices', async () => {
    const paidInvoice = makeInvoice({
      id: invoiceId,
      status: 'Paid',
      dueOn: new Date('2026-12-31T00:00:00.000Z'),
      discountAmountPence: 2450,
      totalAmountPence: 22050,
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
    const manualInvoice = makeInvoice({
      id: 'cinvoice00000000004',
      invoiceNumber: 'OLC-MANUAL-001',
      kind: 'Manual',
      status: 'Paid',
      subtotalAmountPence: 15000,
      totalAmountPence: 15000,
      paidAt: new Date('2026-05-17T08:00:00.000Z'),
      paymentConfirmedAt: new Date('2026-05-17T08:00:00.000Z'),
      paymentConfirmedById: financeUser.id,
    });
    const offYearInvoice = makeInvoice({
      id: 'cinvoice00000000005',
      invoiceNumber: 'OLC-2025-001',
      schoolYear: 2025,
      status: 'Paid',
      subtotalAmountPence: 31000,
      totalAmountPence: 31000,
      paidAt: new Date('2026-05-18T08:00:00.000Z'),
      paymentConfirmedAt: new Date('2026-05-18T08:00:00.000Z'),
      paymentConfirmedById: financeUser.id,
    });
    const draftInvoice = makeInvoice({
      id: 'cinvoice00000000006',
      invoiceNumber: null,
      status: 'Draft',
      subtotalAmountPence: 32000,
      totalAmountPence: 32000,
    });
    const fakeDb = makeFakeDb({
      initialInvoices: [
        paidInvoice,
        pendingInvoice,
        unpaidInvoice,
        manualInvoice,
        offYearInvoice,
        draftInvoice,
      ],
      initialDiscounts: [
        makeDiscount({
          invoiceId: paidInvoice.id,
          labelEnc: encrypt('Fountain Church Member'),
          kind: 'Preset',
          presetCode: 'church-member',
          percentBps: 1000,
          amountPence: null,
          baseAmountPence: 2450,
          appliedAmountPence: 2450,
        }),
      ],
    });
    const { caller } = createCaller(financeUser, fakeDb);

    const families = await caller.invoice.listBillableFamilies();
    const parentFamily = families.find((family) =>
      family.students.some((student) => student.id === linkedStudentId),
    );

    expect(
      fakeDb.db.schoolFeeInvoice.findMany.mock.calls.some(
        ([args]) =>
          args?.where?.kind === 'SchoolFee' &&
          args.where.schoolYear === 2026 &&
          args.where.status?.not === 'Draft',
      ),
    ).toBe(true);
    expect(parentFamily?.yearSummary).toMatchObject({
      schoolYear: 2026,
      cycleLabel: 'Sep 2025 - Aug 2026',
      annualAmountPence: 171500,
      adjustedAnnualAmountPence: 154350,
      issuedAmountPence: 144550,
      paidAmountPence: 22050,
      paymentPendingAmountPence: 24500,
      remainingAmountPence: 132300,
      leftToInvoiceAmountPence: 9800,
      grossIssuedAmountPence: 147000,
      grossPaidAmountPence: 24500,
      grossRemainingAmountPence: 147000,
      grossLeftToInvoiceAmountPence: 24500,
      invoiceCount: 3,
    });
    expect(parentFamily?.yearSummary.children).toEqual([
      expect.objectContaining({
        studentId: linkedStudentId,
        chargeableStartsOn: '2026-02-01',
        chargeableMonths: 7,
        adjustedAnnualAmountPence: 154350,
        remainingAmountPence: 132300,
        leftToInvoiceAmountPence: 9800,
        grossRemainingAmountPence: 147000,
        grossLeftToInvoiceAmountPence: 24500,
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

  it('keeps manual and off-year invoices visible without including them in active school-fee totals', async () => {
    const manualInvoice = makeInvoice({
      id: invoiceId,
      invoiceNumber: 'OLC-MANUAL-001',
      kind: 'Manual',
      invoiceTitleEnc: encrypt('Sign-up fee'),
      status: 'Unpaid',
      subtotalAmountPence: 15000,
      totalAmountPence: 15000,
    });
    const schoolFeeInvoice = makeInvoice({
      id: 'cinvoice00000000002',
      invoiceNumber: 'OLC0011',
      kind: 'SchoolFee',
      status: 'Unpaid',
      subtotalAmountPence: 24500,
      totalAmountPence: 24500,
    });
    const offYearInvoice = makeInvoice({
      id: 'cinvoice00000000003',
      invoiceNumber: 'OLC-2025-001',
      schoolYear: 2025,
      status: 'Paid',
      subtotalAmountPence: 31000,
      totalAmountPence: 31000,
      paidAt: new Date('2026-05-14T08:00:00.000Z'),
      paymentConfirmedAt: new Date('2026-05-14T08:00:00.000Z'),
      paymentConfirmedById: financeUser.id,
    });
    const draftInvoice = makeInvoice({
      id: 'cinvoice00000000004',
      invoiceNumber: null,
      status: 'Draft',
      subtotalAmountPence: 32000,
      totalAmountPence: 32000,
    });
    const fakeDb = makeFakeDb({
      initialStudents: [
        makeStudent({
          id: linkedStudentId,
          enrolmentDate: new Date('2026-08-01T00:00:00.000Z'),
        }),
      ],
      initialGuardians: [{ userId: parentUser.id, studentId: linkedStudentId }],
      initialInvoices: [manualInvoice, schoolFeeInvoice, offYearInvoice, draftInvoice],
      initialLines: [
        makeLine({
          invoiceId: manualInvoice.id,
          unitAmountPence: 15000,
          totalAmountPence: 15000,
        }),
        makeLine({
          invoiceId: schoolFeeInvoice.id,
          unitAmountPence: 24500,
          totalAmountPence: 24500,
        }),
        makeLine({
          invoiceId: offYearInvoice.id,
          unitAmountPence: 31000,
          totalAmountPence: 31000,
        }),
        makeLine({
          invoiceId: draftInvoice.id,
          unitAmountPence: 32000,
          totalAmountPence: 32000,
        }),
      ],
    });
    const { caller } = createCaller(parentUser, fakeDb);

    const parentList = await caller.invoice.listParent({ status: 'All' });

    expect(
      fakeDb.db.schoolFeeInvoice.findMany.mock.calls.some(
        ([args]) =>
          args?.where?.kind === 'SchoolFee' &&
          args.where.schoolYear === 2026 &&
          args.where.status?.not === 'Draft',
      ),
    ).toBe(true);
    expect(parentList.invoices).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          invoiceNumber: 'OLC-MANUAL-001',
          kind: 'Manual',
          invoiceTitle: 'Sign-up fee',
        }),
        expect.objectContaining({
          invoiceNumber: schoolFeeInvoice.invoiceNumber,
          kind: 'SchoolFee',
        }),
        expect.objectContaining({
          invoiceNumber: offYearInvoice.invoiceNumber,
          kind: 'SchoolFee',
          schoolYear: 2025,
        }),
      ]),
    );
    expect(parentList.invoices.map((invoice) => invoice.id)).not.toContain(draftInvoice.id);
    expect(parentList.stats.totalCount).toBe(1);
    expect(parentList.stats.outstandingAmountPence).toBe(24_500);
    expect(parentList.yearSummary).toMatchObject({
      issuedAmountPence: 24500,
      paidAmountPence: 0,
      remainingAmountPence: 24500,
      leftToInvoiceAmountPence: 0,
      invoiceCount: 1,
    });
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
    expect(decrypt(fakeDb.invoices[0]?.extractedTextEnc)).toContain('School Fee Invoice');
    expect(decrypt(fakeDb.invoices[0]?.extractedTextEnc)).toContain(
      'Invoice for Learning Centre Fees',
    );
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

  it('creates a manual family invoice charged per child with linked-parent access', async () => {
    const fakeDb = makeFakeDb({
      initialGuardians: [
        { userId: parentUser.id, studentId: linkedStudentId },
        { userId: parentUser.id, studentId: otherStudentId },
      ],
    });
    const { caller: adminCaller } = createCaller(financeUser, fakeDb);

    const invoice = await adminCaller.invoice.createManual(manualInvoiceInput);

    expect(invoice).toMatchObject({
      kind: 'Manual',
      invoiceTitle: 'Sign-up fee',
      subtotalAmountPence: 30_000,
      discountAmountPence: 0,
      totalAmountPence: 30_000,
    });
    expect(invoice.lineItems).toEqual([
      expect.objectContaining({
        description: 'Sign-up fee - Talia Parent',
        totalAmountPence: 15_000,
      }),
      expect.objectContaining({
        description: 'Sign-up fee - Other Child',
        totalAmountPence: 15_000,
      }),
    ]);
    expect(fakeDb.invoiceStudents).toEqual([
      { invoiceId: invoice.id, studentId: linkedStudentId, position: 1 },
      { invoiceId: invoice.id, studentId: otherStudentId, position: 2 },
    ]);
    expect(fakeDb.discounts).toEqual([]);
    expect(decrypt(fakeDb.invoices[0]?.invoiceTitleEnc)).toBe('Sign-up fee');
    expect(decrypt(fakeDb.invoices[0]?.extractedTextEnc)).toContain('Invoice\n');
    expect(decrypt(fakeDb.invoices[0]?.extractedTextEnc)).toContain('Sign-up fee');
    expect(decrypt(fakeDb.invoices[0]?.extractedTextEnc)).not.toContain('School Fee Invoice');
    expect(decrypt(fakeDb.invoices[0]?.extractedTextEnc)).not.toContain('School fees');
    expect(decrypt(fakeDb.invoices[0]?.extractedTextEnc)).not.toContain(
      SCHOOL_FEE_DISCOUNT_EXPLANATION,
    );

    const { caller: linkedParentCaller } = createCaller(parentUser, fakeDb);
    const emptySchoolFeeStats = {
      totalCount: 0,
      unpaidCount: 0,
      paymentPendingCount: 0,
      paidCount: 0,
      paidAmountPence: 0,
    };
    const emptySchoolFeeSummary = {
      issuedAmountPence: 0,
      paidAmountPence: 0,
      remainingAmountPence: 343000,
      leftToInvoiceAmountPence: 343000,
      invoiceCount: 0,
    };
    const linkedList = await linkedParentCaller.invoice.listParent({ status: 'All' });
    expect(linkedList.invoices).toEqual([
      expect.objectContaining({ id: invoice.id, kind: 'Manual', invoiceTitle: 'Sign-up fee' }),
    ]);
    expect(linkedList.stats).toMatchObject(emptySchoolFeeStats);
    expect(linkedList.yearSummary).toMatchObject(emptySchoolFeeSummary);
    const download = await linkedParentCaller.invoice.downloadPdf({ invoiceId: invoice.id });
    expect(Buffer.from(download.pdfBase64, 'base64').subarray(0, 5).toString('utf8')).toBe('%PDF-');

    const { caller: unlinkedParentCaller } = createCaller(unlinkedParentUser, fakeDb);
    await expect(unlinkedParentCaller.invoice.listParent({ status: 'All' })).resolves.toMatchObject(
      {
        invoices: [],
      },
    );
    await expect(
      unlinkedParentCaller.invoice.downloadPdf({ invoiceId: invoice.id }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(
      unlinkedParentCaller.invoice.parentMarkPaid({ invoiceId: invoice.id }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });

    await expect(
      linkedParentCaller.invoice.parentMarkPaid({ invoiceId: invoice.id }),
    ).resolves.toMatchObject({ status: 'PaymentPending', kind: 'Manual' });
    const pendingList = await linkedParentCaller.invoice.listParent({ status: 'All' });
    expect(pendingList.invoices).toEqual([
      expect.objectContaining({ id: invoice.id, kind: 'Manual', status: 'PaymentPending' }),
    ]);
    expect(pendingList.stats).toMatchObject(emptySchoolFeeStats);
    expect(pendingList.yearSummary).toMatchObject(emptySchoolFeeSummary);

    await expect(
      adminCaller.invoice.confirmPayment({ invoiceId: invoice.id }),
    ).resolves.toMatchObject({ status: 'Paid', kind: 'Manual' });
    const paidList = await linkedParentCaller.invoice.listParent({ status: 'All' });
    expect(paidList.invoices).toEqual([
      expect.objectContaining({ id: invoice.id, kind: 'Manual', status: 'Paid' }),
    ]);
    expect(paidList.stats).toMatchObject(emptySchoolFeeStats);
    expect(paidList.yearSummary).toMatchObject(emptySchoolFeeSummary);
  });

  it('rejects invalid manual invoice inputs, duplicate numbers, and mixed families', async () => {
    const existingInvoice = makeInvoice({
      id: invoiceId,
      invoiceNumber: manualInvoiceInput.invoiceNumber,
    });
    const fakeDb = makeFakeDb({
      initialGuardians: [
        { userId: parentUser.id, studentId: linkedStudentId },
        { userId: secondParentUser.id, studentId: otherStudentId },
      ],
      initialInvoices: [existingInvoice],
    });
    const { caller: adminCaller } = createCaller(financeUser, fakeDb);

    await expect(
      adminCaller.invoice.createManual({ ...manualInvoiceInput, invoiceTitle: '   ' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    await expect(
      adminCaller.invoice.createManual({ ...manualInvoiceInput, amountPence: 0 }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    await expect(adminCaller.invoice.createManual(manualInvoiceInput)).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'selected students must belong to one family',
    });

    const singleFamilyInput = {
      ...manualInvoiceInput,
      studentIds: [linkedStudentId],
    };
    await expect(adminCaller.invoice.createManual(singleFamilyInput)).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'invoice number already exists',
    });
  });

  it('returns the duplicate-number contract when a manual create loses the unique-write race', async () => {
    const fakeDb = makeFakeDb({
      initialGuardians: [
        { userId: parentUser.id, studentId: linkedStudentId },
        { userId: parentUser.id, studentId: otherStudentId },
      ],
      beforeInvoiceCreate: () => {
        throw new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: 'test',
          meta: { target: ['invoiceNumber'] },
        });
      },
    });
    const { caller: adminCaller } = createCaller(financeUser, fakeDb);

    await expect(adminCaller.invoice.createManual(manualInvoiceInput)).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'invoice number already exists',
    });
  });

  it('edits only unpaid manual invoices and preserves the manual invoice kind', async () => {
    const fakeDb = makeFakeDb({
      initialGuardians: [
        { userId: parentUser.id, studentId: linkedStudentId },
        { userId: parentUser.id, studentId: otherStudentId },
      ],
    });
    const { caller: adminCaller } = createCaller(financeUser, fakeDb);
    const created = await adminCaller.invoice.createManual(manualInvoiceInput);

    const updated = await adminCaller.invoice.updateManual({
      ...manualInvoiceInput,
      invoiceId: created.id,
      invoiceTitle: 'Registration fee',
      amountPence: 20_000,
      invoiceNumber: 'OLC-MANUAL-001-REV',
    });

    expect(updated).toMatchObject({
      kind: 'Manual',
      invoiceTitle: 'Registration fee',
      invoiceNumber: 'OLC-MANUAL-001-REV',
      subtotalAmountPence: 40_000,
      totalAmountPence: 40_000,
    });
    expect(updated.lineItems.map((line) => line.totalAmountPence)).toEqual([20_000, 20_000]);
    expect(decrypt(fakeDb.invoices[0]?.extractedTextEnc)).toContain('Registration fee');
    expect(fakeDb.invoices[0]?.kind).toBe('Manual');

    await expect(
      adminCaller.invoice.updateGenerated({
        invoiceId: created.id,
        schoolYear: 2026,
        billingCadence: 'Monthly',
        studentIds: [linkedStudentId, otherStudentId],
        familyLabel: 'Parent family',
        invoiceNumber: 'OLC-SCHOOL-FEE-REV',
        issuedOn: '2026-08-27',
        dueOn: '2026-09-10',
        term: 'AUTUMN 2026',
        lineItems: [
          { description: 'Fee - Talia Parent', quantity: 1, unitAmountPence: 20_000 },
          { description: 'Fee - Other Child', quantity: 1, unitAmountPence: 20_000 },
        ],
        discounts: [],
        discountExplanation: SCHOOL_FEE_DISCOUNT_EXPLANATION,
      }),
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'only school fee invoices can be edited',
    });

    const { caller: parentCaller } = createCaller(parentUser, fakeDb);
    await parentCaller.invoice.parentMarkPaid({ invoiceId: created.id });
    await expect(
      adminCaller.invoice.updateManual({
        ...manualInvoiceInput,
        invoiceId: created.id,
        invoiceNumber: 'OLC-MANUAL-PENDING',
      }),
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'only draft and unpaid invoices can be edited',
    });

    await adminCaller.invoice.confirmPayment({ invoiceId: created.id });
    await expect(
      adminCaller.invoice.updateManual({
        ...manualInvoiceInput,
        invoiceId: created.id,
        invoiceNumber: 'OLC-MANUAL-PAID',
      }),
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'only draft and unpaid invoices can be edited',
    });
  });

  it('does not allow a school-fee invoice to be edited through the manual route', async () => {
    const schoolFeeInvoice = makeInvoice({ id: invoiceId });
    const fakeDb = makeFakeDb({ initialInvoices: [schoolFeeInvoice] });
    const { caller: adminCaller } = createCaller(financeUser, fakeDb);

    await expect(
      adminCaller.invoice.updateManual({
        ...manualInvoiceInput,
        invoiceId: schoolFeeInvoice.id,
        studentIds: [linkedStudentId],
      }),
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'only manual invoices can be edited',
    });
  });

  it('does not publish a manual draft through the school-fee route', async () => {
    const manualDraft = makeInvoice({ id: invoiceId, status: 'Draft', kind: 'Manual' });
    const fakeDb = makeFakeDb({ initialInvoices: [manualDraft] });
    const { caller: adminCaller } = createCaller(financeUser, fakeDb);

    await expect(
      adminCaller.invoice.publishDraft({
        invoiceId: manualDraft.id,
        studentId: linkedStudentId,
        invoiceNumber: 'OLC-MANUAL-DRAFT',
        issuedOn: '2026-08-27',
        dueOn: '2026-09-10',
        term: null,
        lineItems: [{ description: 'Fee', quantity: 1, unitAmountPence: 15_000 }],
      }),
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'only school fee drafts can be published',
    });
  });

  it('does not overwrite a payment status that changes while a manual edit is prepared', async () => {
    let interceptUpdate = false;
    const fakeDb = makeFakeDb({
      initialGuardians: [
        { userId: parentUser.id, studentId: linkedStudentId },
        { userId: parentUser.id, studentId: otherStudentId },
      ],
      beforeInvoiceUpdate: (invoice) => {
        if (!interceptUpdate) return;
        interceptUpdate = false;
        invoice.status = 'PaymentPending';
      },
    });
    const { caller: adminCaller } = createCaller(financeUser, fakeDb);
    const created = await adminCaller.invoice.createManual(manualInvoiceInput);
    interceptUpdate = true;

    await expect(
      adminCaller.invoice.updateManual({
        ...manualInvoiceInput,
        invoiceId: created.id,
        invoiceTitle: 'Late edit',
      }),
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'only draft and unpaid invoices can be edited',
    });
    expect(fakeDb.invoices[0]?.status).toBe('PaymentPending');
    expect(decrypt(fakeDb.invoices[0]?.invoiceTitleEnc)).toBe('Sign-up fee');
  });

  it('returns the duplicate-number contract when a manual edit loses the unique-write race', async () => {
    let interceptUpdate = false;
    const fakeDb = makeFakeDb({
      initialGuardians: [
        { userId: parentUser.id, studentId: linkedStudentId },
        { userId: parentUser.id, studentId: otherStudentId },
      ],
      beforeInvoiceUpdate: () => {
        if (!interceptUpdate) return;
        interceptUpdate = false;
        throw new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: 'test',
          meta: { target: ['invoiceNumber'] },
        });
      },
    });
    const { caller: adminCaller } = createCaller(financeUser, fakeDb);
    const created = await adminCaller.invoice.createManual(manualInvoiceInput);
    interceptUpdate = true;

    await expect(
      adminCaller.invoice.updateManual({
        ...manualInvoiceInput,
        invoiceId: created.id,
        invoiceNumber: 'OLC-MANUAL-RACE',
      }),
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'invoice number already exists',
    });
  });

  it('itemizes every selected child when a manual invoice needs continuation pages', async () => {
    const studentIds = Array.from(
      { length: 20 },
      (_, index) => `cmanualstudent${String(index + 1).padStart(6, '0')}`,
    );
    const fakeDb = makeFakeDb({
      initialStudents: studentIds.map((id) => makeStudent({ id })),
      initialGuardians: studentIds.map((studentId) => ({
        userId: parentUser.id,
        studentId,
      })),
    });
    const { caller: adminCaller } = createCaller(financeUser, fakeDb);

    const created = await adminCaller.invoice.createManual({
      ...manualInvoiceInput,
      studentIds,
      invoiceNumber: 'OLC-MANUAL-020',
    });
    const pdf = await PDFDocument.load(
      Buffer.from(decrypt(fakeDb.invoices[0]?.pdfBytesEnc) ?? '', 'base64'),
    );

    expect(created.lineItems).toHaveLength(20);
    expect(created.totalAmountPence).toBe(300_000);
    expect(pdf.getPageCount()).toBe(2);
  });

  it.each([8, 20])(
    'keeps the visible total above the payment panel for %i-child manual PDFs',
    async (lineCount) => {
      const generated = await generateSchoolFeeInvoicePdf(makePdfInput(lineCount));
      const pages = await extractPdfPageTextItems(generated.bytes);
      const primaryTotal = pages[0]?.find((item) => item.text === 'Total');

      expect(primaryTotal).toBeDefined();
      expect(primaryTotal?.y).toBeGreaterThan(280);
      expect(
        pages.flatMap((page) => page).filter((item) => item.text.startsWith('Charge for child')),
      ).toHaveLength(lineCount);
    },
  );

  it('renders discounts and per-child net amounts for school-fee lines on continuation pages', async () => {
    const input = makePdfInput(9);
    input.documentTitle = 'School Fee Invoice';
    input.billingLabel = 'Invoice for Learning Centre Fees';
    input.schoolYear = 2026;
    input.billingCadence = 'Monthly';
    input.term = 'AUGUST 2026';
    input.discountAmountPence = 1_000;
    input.totalAmountPence = input.subtotalAmountPence - input.discountAmountPence;
    input.discountExplanation = SCHOOL_FEE_DISCOUNT_EXPLANATION;
    input.discounts = [
      {
        label: 'Ninth child discount',
        baseAmountPence: 15_000,
        appliedAmountPence: 1_000,
        optedOut: false,
      },
    ];
    input.discountBreakdowns = [
      {
        childIndex: 8,
        discountAmountPence: 1_000,
        totalAmountPence: 14_000,
        discounts: [{ label: 'Ninth child discount', appliedAmountPence: 1_000 }],
      },
    ];

    const generated = await generateSchoolFeeInvoicePdf(input);
    const pages = await extractPdfPageTextItems(generated.bytes);
    const continuationText = pages.slice(1).flatMap((page) => page.map((item) => item.text));

    expect(continuationText).toContain('Discount - Ninth child discount');
    expect(continuationText).toContain('-£10.00');
    expect(continuationText).toContain('Net for child');
    expect(continuationText).toContain('£140.00');
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
    expect(parentList.yearSummary).toMatchObject({
      adjustedAnnualAmountPence: 300125,
      discountAmountPence: 42875,
      paidAmountPence: 24500,
      remainingAmountPence: 275625,
    });
  });

  it('counts fully credited monthly invoices without reducing the annual fee target', async () => {
    const creditInvoices = Array.from({ length: 4 }, (_value, index) =>
      makeInvoice({
        id: `cinvoicecredit00000${String(index + 1)}`,
        invoiceNumber: `OLC-CREDIT-${String(index + 1)}`,
        status: 'Unpaid',
        studentId: null,
        issuedOn: new Date(`2026-0${String(index + 2)}-01T00:00:00.000Z`),
        dueOn: new Date(`2026-0${String(index + 2)}-12T00:00:00.000Z`),
        subtotalAmountPence: 49000,
        discountAmountPence: 49000,
        totalAmountPence: 0,
      }),
    );
    const fakeDb = makeFakeDb({
      initialStudents: [
        makeStudent({ id: linkedStudentId, enrolmentDate: new Date('2026-02-01T00:00:00.000Z') }),
        makeStudent({ id: otherStudentId, enrolmentDate: new Date('2026-02-01T00:00:00.000Z') }),
      ],
      initialGuardians: [
        { userId: parentUser.id, studentId: linkedStudentId },
        { userId: parentUser.id, studentId: otherStudentId },
      ],
      initialInvoices: creditInvoices,
      initialInvoiceStudents: creditInvoices.flatMap((invoice) => [
        { invoiceId: invoice.id, studentId: linkedStudentId, position: 1 },
        { invoiceId: invoice.id, studentId: otherStudentId, position: 2 },
      ]),
      initialLines: creditInvoices.flatMap((invoice) => [
        makeLine({
          invoiceId: invoice.id,
          position: 1,
          descriptionEnc: encrypt('Monthly fee - Talia Parent'),
          unitAmountPence: 24500,
          totalAmountPence: 24500,
        }),
        makeLine({
          id: `cline${invoice.id}2`,
          invoiceId: invoice.id,
          position: 2,
          descriptionEnc: encrypt('Monthly fee - Other Child'),
          unitAmountPence: 24500,
          totalAmountPence: 24500,
        }),
      ]),
      initialDiscounts: creditInvoices.flatMap((invoice) => [
        makeDiscount({
          id: `cdiscount${invoice.id}1`,
          invoiceId: invoice.id,
          labelEnc: encrypt('Portal thank-you credit - Talia Parent'),
          kind: 'ManualFixed',
          presetCode: schoolFeeDiscountChildIndexPresetCode(0),
          percentBps: null,
          amountPence: 24500,
          baseAmountPence: 24500,
          appliedAmountPence: 24500,
        }),
        makeDiscount({
          id: `cdiscount${invoice.id}2`,
          invoiceId: invoice.id,
          position: 2,
          labelEnc: encrypt('Portal thank-you credit - Other Child'),
          kind: 'ManualFixed',
          presetCode: schoolFeeDiscountChildIndexPresetCode(1),
          percentBps: null,
          amountPence: 24500,
          baseAmountPence: 24500,
          appliedAmountPence: 24500,
        }),
      ]),
    });
    const { caller: parentCaller } = createCaller(parentUser, fakeDb);

    const parentList = await parentCaller.invoice.listParent({ status: 'All' });

    expect(parentList.yearSummary).toMatchObject({
      annualAmountPence: 343000,
      adjustedAnnualAmountPence: 343000,
      paidAmountPence: 196000,
      remainingAmountPence: 147000,
      leftToInvoiceAmountPence: 147000,
    });
    expect(parentList.stats.outstandingAmountPence).toBe(147000);
    expect(parentList.stats.paidAmountPence).toBe(196000);
    expect(parentList.yearSummary.children).toEqual([
      expect.objectContaining({
        studentId: linkedStudentId,
        chargeableStartsOn: '2026-02-01',
        chargeableMonths: 7,
        paidAmountPence: 98000,
        remainingAmountPence: 73500,
        leftToInvoiceAmountPence: 73500,
      }),
      expect.objectContaining({
        studentId: otherStudentId,
        chargeableStartsOn: '2026-02-01',
        chargeableMonths: 7,
        paidAmountPence: 98000,
        remainingAmountPence: 73500,
        leftToInvoiceAmountPence: 73500,
      }),
    ]);
  });

  it('counts paid invoice manual credits as settled annual coverage', async () => {
    const paidInvoice = makeInvoice({
      id: invoiceId,
      status: 'Paid',
      studentId: linkedStudentId,
      subtotalAmountPence: 24500,
      discountAmountPence: 5000,
      totalAmountPence: 19500,
      paidAt: new Date('2026-05-15T08:00:00.000Z'),
      paymentConfirmedAt: new Date('2026-05-15T08:00:00.000Z'),
      paymentConfirmedById: financeUser.id,
    });
    const fakeDb = makeFakeDb({
      initialInvoices: [paidInvoice],
      initialLines: [
        makeLine({ invoiceId: paidInvoice.id, unitAmountPence: 24500, totalAmountPence: 24500 }),
      ],
      initialDiscounts: [
        makeDiscount({
          invoiceId: paidInvoice.id,
          labelEnc: encrypt('Pastoral credit'),
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

    const parentList = await parentCaller.invoice.listParent({ status: 'All' });

    expect(parentList.stats.paidAmountPence).toBe(24500);
    expect(parentList.stats.remainingAmountPence).toBe(147000);
    expect(parentList.yearSummary).toMatchObject({
      adjustedAnnualAmountPence: 171500,
      paidAmountPence: 24500,
      remainingAmountPence: 147000,
      leftToInvoiceAmountPence: 147000,
    });
  });

  it('tracks gross paid coverage before annual discounts', async () => {
    const paidInvoice = makeInvoice({
      id: invoiceId,
      status: 'Paid',
      studentId: linkedStudentId,
      subtotalAmountPence: 24500,
      discountAmountPence: 2450,
      totalAmountPence: 22050,
      paidAt: new Date('2026-05-15T08:00:00.000Z'),
      paymentConfirmedAt: new Date('2026-05-15T08:00:00.000Z'),
      paymentConfirmedById: financeUser.id,
    });
    const fakeDb = makeFakeDb({
      initialInvoices: [paidInvoice],
      initialLines: [
        makeLine({ invoiceId: paidInvoice.id, unitAmountPence: 24500, totalAmountPence: 24500 }),
      ],
      initialDiscounts: [
        makeDiscount({
          invoiceId: paidInvoice.id,
          labelEnc: encrypt('Fountain Church Member'),
          kind: 'Preset',
          presetCode: 'church-member',
          percentBps: 1000,
          amountPence: null,
          baseAmountPence: 2450,
          appliedAmountPence: 2450,
        }),
      ],
    });
    const { caller: parentCaller } = createCaller(parentUser, fakeDb);

    const parentList = await parentCaller.invoice.listParent({ status: 'All' });

    expect(parentList.yearSummary).toMatchObject({
      annualAmountPence: 171500,
      adjustedAnnualAmountPence: 154350,
      discountAmountPence: 17150,
      paidAmountPence: 22050,
      remainingAmountPence: 132300,
      grossPaidAmountPence: 24500,
      grossRemainingAmountPence: 147000,
      grossLeftToInvoiceAmountPence: 147000,
    });
    expect(parentList.stats).toMatchObject({
      paidAmountPence: 22050,
      grossPaidAmountPence: 24500,
      grossOutstandingAmountPence: 147000,
      grossRemainingAmountPence: 147000,
    });
  });

  it('summarises active-year non-draft student finance for Pastor and Principal only', async () => {
    const paidInvoice = makeInvoice({
      id: invoiceId,
      status: 'Paid',
      studentId: linkedStudentId,
      subtotalAmountPence: 24500,
      discountAmountPence: 2450,
      totalAmountPence: 22050,
      paidAt: new Date('2026-05-15T08:00:00.000Z'),
      paymentConfirmedAt: new Date('2026-05-15T08:00:00.000Z'),
      paymentConfirmedById: financeUser.id,
    });
    const pendingInvoice = makeInvoice({
      id: 'cinvoice00000000002',
      invoiceNumber: 'INV-2026-002',
      status: 'PaymentPending',
      studentId: linkedStudentId,
      subtotalAmountPence: 10000,
      totalAmountPence: 10000,
      parentMarkedPaidAt: new Date('2026-05-18T08:00:00.000Z'),
      parentMarkedPaidById: parentUser.id,
    });
    const overdueInvoice = makeInvoice({
      id: 'cinvoice00000000003',
      invoiceNumber: 'INV-2026-003',
      status: 'Unpaid',
      studentId: linkedStudentId,
      dueOn: new Date('2026-05-01T00:00:00.000Z'),
      subtotalAmountPence: 5000,
      totalAmountPence: 5000,
    });
    const unpaidInvoice = makeInvoice({
      id: 'cinvoice00000000004',
      invoiceNumber: 'INV-2026-004',
      status: 'Unpaid',
      studentId: linkedStudentId,
      dueOn: new Date('2026-12-31T00:00:00.000Z'),
      subtotalAmountPence: 7000,
      totalAmountPence: 7000,
    });
    const siblingInvoice = makeInvoice({
      id: 'cinvoice00000000005',
      invoiceNumber: 'INV-2026-005',
      status: 'Paid',
      studentId: otherStudentId,
      subtotalAmountPence: 24500,
      discountAmountPence: 4900,
      totalAmountPence: 19600,
      paidAt: new Date('2026-05-17T08:00:00.000Z'),
      paymentConfirmedAt: new Date('2026-05-17T08:00:00.000Z'),
      paymentConfirmedById: financeUser.id,
    });
    const manualInvoice = makeInvoice({
      id: 'cinvoice00000000006',
      invoiceNumber: 'OLC-MANUAL-001',
      kind: 'Manual',
      status: 'Paid',
      studentId: linkedStudentId,
      subtotalAmountPence: 15000,
      totalAmountPence: 15000,
      paidAt: new Date('2026-05-18T08:00:00.000Z'),
      paymentConfirmedAt: new Date('2026-05-18T08:00:00.000Z'),
      paymentConfirmedById: financeUser.id,
    });
    const offYearInvoice = makeInvoice({
      id: 'cinvoice00000000007',
      invoiceNumber: 'OLC-2025-001',
      schoolYear: 2025,
      status: 'Paid',
      studentId: linkedStudentId,
      subtotalAmountPence: 31000,
      totalAmountPence: 31000,
      paidAt: new Date('2026-05-19T08:00:00.000Z'),
      paymentConfirmedAt: new Date('2026-05-19T08:00:00.000Z'),
      paymentConfirmedById: financeUser.id,
    });
    const draftInvoice = makeInvoice({
      id: 'cinvoice00000000008',
      invoiceNumber: null,
      status: 'Draft',
      studentId: linkedStudentId,
      subtotalAmountPence: 32000,
      totalAmountPence: 32000,
    });
    const fakeDb = makeFakeDb({
      initialGuardians: [
        { userId: parentUser.id, studentId: linkedStudentId },
        { userId: parentUser.id, studentId: otherStudentId },
      ],
      initialInvoices: [
        paidInvoice,
        pendingInvoice,
        overdueInvoice,
        unpaidInvoice,
        siblingInvoice,
        manualInvoice,
        offYearInvoice,
        draftInvoice,
      ],
      initialLines: [
        makeLine({ invoiceId: paidInvoice.id, unitAmountPence: 24500, totalAmountPence: 24500 }),
        makeLine({
          id: 'cline000000000002',
          invoiceId: pendingInvoice.id,
          unitAmountPence: 10000,
          totalAmountPence: 10000,
        }),
        makeLine({
          id: 'cline000000000003',
          invoiceId: overdueInvoice.id,
          unitAmountPence: 5000,
          totalAmountPence: 5000,
        }),
        makeLine({
          id: 'cline000000000004',
          invoiceId: unpaidInvoice.id,
          unitAmountPence: 7000,
          totalAmountPence: 7000,
        }),
        makeLine({
          id: 'cline000000000005',
          invoiceId: siblingInvoice.id,
          unitAmountPence: 24500,
          totalAmountPence: 24500,
        }),
        makeLine({
          id: 'cline000000000006',
          invoiceId: manualInvoice.id,
          unitAmountPence: 15000,
          totalAmountPence: 15000,
        }),
        makeLine({
          id: 'cline000000000007',
          invoiceId: offYearInvoice.id,
          unitAmountPence: 31000,
          totalAmountPence: 31000,
        }),
        makeLine({
          id: 'cline000000000008',
          invoiceId: draftInvoice.id,
          unitAmountPence: 32000,
          totalAmountPence: 32000,
        }),
      ],
      initialDiscounts: [
        makeDiscount({
          invoiceId: paidInvoice.id,
          labelEnc: encrypt('Fountain Church Member'),
          kind: 'Preset',
          presetCode: 'church-member',
          percentBps: 1000,
          amountPence: null,
          baseAmountPence: 2450,
          appliedAmountPence: 2450,
        }),
        makeDiscount({
          id: 'cdiscount0000000002',
          invoiceId: siblingInvoice.id,
          labelEnc: encrypt('Church Leaders / Oasis Supervisors'),
          kind: 'Preset',
          presetCode: 'church-leader',
          percentBps: 2000,
          amountPence: null,
          baseAmountPence: 4900,
          appliedAmountPence: 4900,
        }),
      ],
    });
    const { caller: principalCaller } = createCaller(principalUser, fakeDb);
    const { caller: pastorCaller } = createCaller(pastorUser, fakeDb);
    const { caller: headCaller } = createCaller(headUser, fakeDb);
    const { caller: financeCaller } = createCaller(financeUser, fakeDb);

    const summary = await principalCaller.invoice.studentFinanceSummary({
      studentId: linkedStudentId,
    });

    expect(
      fakeDb.db.schoolFeeInvoice.findMany.mock.calls.some(
        ([args]) =>
          args?.where?.kind === 'SchoolFee' &&
          args.where.schoolYear === 2026 &&
          args.where.status?.not === 'Draft',
      ),
    ).toBe(true);
    expect(
      await pastorCaller.invoice.studentFinanceSummary({ studentId: linkedStudentId }),
    ).toEqual(summary);
    expect(summary).toMatchObject({
      studentId: linkedStudentId,
      grossAnnualAmountPence: 171500,
      adjustedAnnualAmountPence: 132912,
      discountAmountPence: 38588,
      grossIssuedAmountPence: 46500,
      grossPaidAmountPence: 24500,
      grossPaymentPendingAmountPence: 10000,
      grossOverdueAmountPence: 5000,
      grossUnpaidAmountPence: 7000,
      grossRemainingAmountPence: 147000,
      grossLeftToInvoiceAmountPence: 125000,
      invoiceCount: 4,
      paidCount: 1,
      paymentPendingCount: 1,
      overdueCount: 1,
      unpaidCount: 1,
    });
    await expect(
      headCaller.invoice.studentFinanceSummary({ studentId: linkedStudentId }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(
      financeCaller.invoice.studentFinanceSummary({ studentId: linkedStudentId }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('does not count unpaid non-zero invoices as settled annual coverage', async () => {
    const unpaidInvoice = makeInvoice({
      id: invoiceId,
      status: 'Unpaid',
      studentId: linkedStudentId,
      subtotalAmountPence: 24500,
      totalAmountPence: 24500,
    });
    const fakeDb = makeFakeDb({
      initialInvoices: [unpaidInvoice],
      initialLines: [
        makeLine({ invoiceId: unpaidInvoice.id, unitAmountPence: 24500, totalAmountPence: 24500 }),
      ],
    });
    const { caller: parentCaller } = createCaller(parentUser, fakeDb);

    const parentList = await parentCaller.invoice.listParent({ status: 'All' });

    expect(parentList.stats.paidAmountPence).toBe(0);
    expect(parentList.stats.outstandingAmountPence).toBe(171500);
    expect(parentList.yearSummary).toMatchObject({
      adjustedAnnualAmountPence: 171500,
      paidAmountPence: 0,
      remainingAmountPence: 171500,
      leftToInvoiceAmountPence: 147000,
    });
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

  it('notifies active pastors when a parent marks an invoice paid', async () => {
    const ownInvoice = makeInvoice({
      id: invoiceId,
      familyLabelEnc: encrypt('Parent family'),
      invoiceNumber: 'INV-2026-001',
      totalAmountPence: 24500,
      subtotalAmountPence: 24500,
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
      ],
      initialUsers: [
        makeUser({
          id: 'cpastor000000000101',
          role: 'Pastor',
          fullNameEnc: encrypt('Pastor One'),
          emailEnc: encrypt('pastor.one@example.com'),
          createdAt: new Date('2026-05-01T08:00:00.000Z'),
        }),
        makeUser({
          id: 'cpastor000000000102',
          role: 'Pastor',
          fullNameEnc: encrypt('Pastor Two'),
          emailEnc: encrypt('pastor.two@example.com'),
          createdAt: new Date('2026-05-01T09:00:00.000Z'),
        }),
        makeUser({
          id: 'cpastor000000000103',
          role: 'Pastor',
          active: false,
          emailEnc: encrypt('inactive.pastor@example.com'),
        }),
        makeUser({
          id: financeUser.id,
          role: financeUser.role,
          emailEnc: encrypt('finance@example.com'),
        }),
      ],
    });
    const email = makeFakeEmailClient();
    const { caller } = createCaller(parentUser, fakeDb, false, email.client);

    const pending = await caller.invoice.parentMarkPaid({ invoiceId });

    expect(pending.status).toBe('PaymentPending');
    expect(email.send).toHaveBeenCalledTimes(2);
    expect(email.send.mock.calls.map(([payload]) => payload.to)).toEqual([
      'pastor.one@example.com',
      'pastor.two@example.com',
    ]);
    const firstEmail = email.send.mock.calls[0]?.[0];
    if (!firstEmail) throw new Error('expected pastor notification email');
    expect(firstEmail.subject).toBe(INVOICE_PAYMENT_NOTIFICATION_EMAIL_SUBJECT);
    expect(firstEmail.text).toContain('The Parent family has marked Invoice INV-2026-001 as paid.');
    expect(firstEmail.text).toContain('It is awaiting your confirmation in Oasis Portal.');
    expect(firstEmail.text).not.toContain('Talia Parent');
    expect(firstEmail.text).not.toContain('Monthly fee');
    expect(firstEmail.text).not.toContain('24500');

    const emailAudits = fakeDb.db.auditLog.create.mock.calls
      .map(([args]) => args)
      .filter((args) => args.data.entity === 'Email');
    expect(emailAudits).toHaveLength(2);
    expect(emailAudits.map((args) => args.data.meta?.['toUserId'])).toEqual([
      'cpastor000000000101',
      'cpastor000000000102',
    ]);
    expect(emailAudits[0]?.data.meta).toMatchObject({
      source: 'invoice.parentMarkPaid.notification',
      emailStatus: 'Sent',
      invoiceId,
      invoiceStatus: 'PaymentPending',
      subject: INVOICE_PAYMENT_NOTIFICATION_EMAIL_SUBJECT,
      toRole: 'Pastor',
    });
    const auditJson = JSON.stringify(fakeDb.db.auditLog.create.mock.calls);
    expect(auditJson).not.toContain('Parent family');
    expect(auditJson).not.toContain('Monthly fee');
    expect(auditJson).not.toContain('24500');
  });

  it('does not notify pastors when parent mark-paid is rejected', async () => {
    const pendingInvoice = makeInvoice({
      id: invoiceId,
      status: 'PaymentPending',
      parentMarkedPaidAt: new Date('2026-05-02T08:00:00.000Z'),
      parentMarkedPaidById: parentUser.id,
    });
    const fakeDb = makeFakeDb({
      initialInvoices: [pendingInvoice],
      initialLines: [makeLine({ invoiceId: pendingInvoice.id })],
      initialUsers: [
        makeUser({
          id: 'cpastor000000000101',
          role: 'Pastor',
          emailEnc: encrypt('pastor.one@example.com'),
        }),
      ],
    });
    const email = makeFakeEmailClient();
    const { caller } = createCaller(parentUser, fakeDb, false, email.client);

    await expect(caller.invoice.parentMarkPaid({ invoiceId })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'only unpaid invoices can be marked paid',
    });

    expect(email.send).not.toHaveBeenCalled();
    expect(fakeDb.invoices[0]?.status).toBe('PaymentPending');
  });

  it('keeps the pending payment when pastor notification delivery fails', async () => {
    const ownInvoice = makeInvoice({ id: invoiceId, familyLabelEnc: encrypt('Parent family') });
    const fakeDb = makeFakeDb({
      initialInvoices: [ownInvoice],
      initialLines: [makeLine({ invoiceId: ownInvoice.id })],
      initialUsers: [
        makeUser({
          id: 'cpastor000000000101',
          role: 'Pastor',
          fullNameEnc: encrypt('Pastor One'),
          emailEnc: encrypt('pastor.one@example.com'),
        }),
      ],
    });
    const email = makeFakeEmailClient();
    email.send.mockRejectedValueOnce(new Error('resend unavailable'));
    const { caller } = createCaller(parentUser, fakeDb, false, email.client);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      await expect(caller.invoice.parentMarkPaid({ invoiceId })).resolves.toMatchObject({
        status: 'PaymentPending',
      });
    } finally {
      errorSpy.mockRestore();
    }

    expect(fakeDb.invoices[0]?.status).toBe('PaymentPending');
    expect(email.send).toHaveBeenCalledTimes(1);
    const failedEmailAudit = fakeDb.db.auditLog.create.mock.calls
      .map(([args]) => args)
      .find(
        (args) =>
          args.data.entity === 'SchoolFeeInvoice' &&
          args.data.meta?.['source'] === 'invoice.parentMarkPaid.notification',
      );
    expect(failedEmailAudit?.data.meta).toMatchObject({
      emailStatus: 'Failed',
      invoiceId,
      invoiceStatus: 'PaymentPending',
      toUserId: 'cpastor000000000101',
      toRole: 'Pastor',
    });
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

interface PdfPageTextItem {
  text: string;
  y: number;
}

interface PdfJsTextItem {
  str: string;
  transform: number[];
}

interface PdfJsModule {
  getDocument(options: {
    data: Uint8Array;
    disableFontFace: boolean;
    isEvalSupported: boolean;
    useSystemFonts: boolean;
  }): {
    promise: Promise<{
      numPages: number;
      getPage(pageNumber: number): Promise<{
        getTextContent(): Promise<{ items: PdfJsTextItem[] }>;
      }>;
      destroy(): Promise<void>;
    }>;
  };
}

type PromiseWithResolvers<T> = {
  promise: Promise<T>;
  resolve(value: T | PromiseLike<T>): void;
  reject(reason?: unknown): void;
};

function ensurePromiseWithResolvers(): void {
  const promiseWithResolvers = Promise as PromiseConstructor & {
    withResolvers?: <T>() => PromiseWithResolvers<T>;
  };
  if (promiseWithResolvers.withResolvers) return;

  promiseWithResolvers.withResolvers = <T>(): PromiseWithResolvers<T> => {
    let resolve!: (value: T | PromiseLike<T>) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((resolvePromise, rejectPromise) => {
      resolve = resolvePromise;
      reject = rejectPromise;
    });
    return { promise, resolve, reject };
  };
}

async function extractPdfPageTextItems(bytes: Uint8Array): Promise<PdfPageTextItem[][]> {
  ensurePromiseWithResolvers();
  const pdfjs = (await import('pdfjs-dist/legacy/build/pdf.mjs')) as unknown as PdfJsModule;
  const pdf = await pdfjs.getDocument({
    data: bytes.slice(),
    disableFontFace: true,
    isEvalSupported: false,
    useSystemFonts: false,
  }).promise;
  try {
    const pages: PdfPageTextItem[][] = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      pages.push(
        content.items.map((item) => ({
          text: item.str,
          y: item.transform[5] ?? 0,
        })),
      );
    }
    return pages;
  } finally {
    await pdf.destroy();
  }
}
