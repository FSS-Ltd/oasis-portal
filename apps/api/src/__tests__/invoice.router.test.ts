import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type { SessionUser } from '@oasis/domain';
import type { AppContext, RlsTx } from '../context.js';
import { createInvoiceRouter } from '../routers/invoice.js';
import { router } from '../trpc.js';

type InvoiceStatus = 'Draft' | 'Unpaid' | 'Paid';

interface StoredInvoice {
  id: string;
  invoiceNumber: string | null;
  studentId: string | null;
  status: InvoiceStatus;
  term: string | null;
  issuedOn: Date | null;
  dueOn: Date | null;
  paidAt: Date | null;
  totalAmountPence: number;
  originalFileNameEnc: string;
  fileMimeType: string;
  fileSizeBytes: number;
  pdfBytesEnc: string;
  extractedTextEnc: string | null;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
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
  createdAt: Date;
}

interface StoredGuardian {
  userId: string;
  studentId: string;
}

interface FakeInvoiceFindManyArgs {
  where?: {
    studentId?: { in: string[] };
    status?: { not: InvoiceStatus };
  };
}

interface FakeInvoiceFindUniqueArgs {
  where: { id: string };
}

interface FakeInvoiceCreateArgs {
  data: {
    status: InvoiceStatus;
    originalFileNameEnc: string;
    fileMimeType: string;
    fileSizeBytes: number;
    pdfBytesEnc: string;
    extractedTextEnc: string | null;
    createdById: string;
  };
}

interface FakeLineCreateInput {
  position: number;
  descriptionEnc: string;
  quantity: number;
  unitAmountPence: number;
  totalAmountPence: number;
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
    lineItems?: {
      deleteMany: object;
      create: FakeLineCreateInput[];
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

const parentUser: SessionUser = {
  id: 'cparent000000000001',
  role: 'Parent',
  tags: [],
  requires2fa: false,
};

const linkedStudentId = 'cstudent000000000001';
const otherStudentId = 'cstudent000000000002';
const invoiceId = 'cinvoice00000000001';

function encrypt(value: string): string {
  return `enc:${value}`;
}

function decrypt(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.replace(/^enc:/u, '');
}

function makeStudent(input: Pick<StoredStudent, 'id'> & Partial<StoredStudent>): StoredStudent {
  return {
    active: true,
    fullNameEnc: encrypt(input.id === linkedStudentId ? 'Talia Parent' : 'Other Child'),
    yearGroup: 'Y9',
    createdAt: new Date('2026-05-01T08:00:00.000Z'),
    ...input,
  };
}

function makeInvoice(input: Pick<StoredInvoice, 'id'> & Partial<StoredInvoice>): StoredInvoice {
  return {
    invoiceNumber: 'INV-2026-001',
    studentId: linkedStudentId,
    status: 'Unpaid',
    term: 'Summer Term 1',
    issuedOn: new Date('2026-05-01T00:00:00.000Z'),
    dueOn: new Date('2026-05-30T00:00:00.000Z'),
    paidAt: null,
    totalAmountPence: 42000,
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

function makeFakeDb({
  initialGuardians = [{ userId: parentUser.id, studentId: linkedStudentId }],
  initialInvoices = [],
  initialLines = [],
  decryptImpl = decrypt,
}: {
  initialGuardians?: StoredGuardian[];
  initialInvoices?: StoredInvoice[];
  initialLines?: StoredLine[];
  decryptImpl?: (value: string | null | undefined) => string | null;
} = {}) {
  const students = [makeStudent({ id: linkedStudentId }), makeStudent({ id: otherStudentId })];
  const guardians = [...initialGuardians];
  const invoices = [...initialInvoices];
  const lines = [...initialLines];
  let invoiceSequence = 1;

  function invoiceRow(invoice: StoredInvoice) {
    return {
      ...invoice,
      student: invoice.studentId
        ? (students.find((student) => student.id === invoice.studentId) ?? null)
        : null,
      lineItems: lines
        .filter((line) => line.invoiceId === invoice.id)
        .sort((left, right) => left.position - right.position),
    };
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
      findMany: vi.fn(() =>
        students
          .filter((student) => student.active)
          .map((student) => ({
            id: student.id,
            fullNameEnc: student.fullNameEnc,
            yearGroup: student.yearGroup,
          })),
      ),
    },
    schoolFeeInvoice: {
      findMany: vi.fn((args: FakeInvoiceFindManyArgs = {}) => {
        const where = args.where;
        return invoices
          .filter((invoice) =>
            where?.studentId
              ? invoice.studentId !== null && where.studentId.in.includes(invoice.studentId)
              : true,
          )
          .filter((invoice) => (where?.status?.not ? invoice.status !== where.status.not : true))
          .map(invoiceRow);
      }),
      findUnique: vi.fn(({ where }: FakeInvoiceFindUniqueArgs) => {
        const invoice = invoices.find((candidate) => candidate.id === where.id);
        return invoice ? invoiceRow(invoice) : null;
      }),
      create: vi.fn(({ data }: FakeInvoiceCreateArgs) => {
        const created = makeInvoice({
          id: `cinvoicenew000000${String(invoiceSequence++).padStart(2, '0')}`,
          invoiceNumber: null,
          studentId: null,
          status: data.status,
          term: null,
          issuedOn: null,
          dueOn: null,
          paidAt: null,
          totalAmountPence: 0,
          originalFileNameEnc: data.originalFileNameEnc,
          fileMimeType: data.fileMimeType,
          fileSizeBytes: data.fileSizeBytes,
          pdfBytesEnc: data.pdfBytesEnc,
          extractedTextEnc: data.extractedTextEnc,
          createdById: data.createdById,
        });
        invoices.push(created);
        return invoiceRow(created);
      }),
      update: vi.fn(({ where, data }: FakeInvoiceUpdateArgs) => {
        const invoice = invoices.find((candidate) => candidate.id === where.id);
        if (!invoice) throw new Error('invoice not found');
        Object.assign(invoice, {
          ...data,
          lineItems: undefined,
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

  return { db, invoices, lines };
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

    const draft = await caller.invoice.uploadDraft({
      fileName: 'oasis-example-school-fee-invoice.pdf',
      mimeType: 'application/pdf',
      sizeBytes: pdfBytes.length,
      pdfBase64: pdfBytes.toString('base64'),
    });

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
