import { describe, expect, it } from 'vitest';
import type { SessionUser } from '@oasis/domain';
import type { AppContext, RlsTx } from '../context.js';
import { incidentRouter } from '../routers/incident.js';
import { router } from '../trpc.js';

const supervisorUser: SessionUser = {
  id: 'u_supervisor',
  role: 'Supervisor',
  tags: [],
  requires2fa: false,
};
const otherSupervisorUser: SessionUser = {
  id: 'u_other_supervisor',
  role: 'Supervisor',
  tags: [],
  requires2fa: false,
};
const headUser: SessionUser = { id: 'u_head', role: 'Head', tags: [], requires2fa: false };
const pastorUser: SessionUser = { id: 'u_pastor', role: 'Pastor', tags: [], requires2fa: false };
const parentUser: SessionUser = { id: 'u_parent', role: 'Parent', tags: [], requires2fa: false };
const otherParentUser: SessionUser = {
  id: 'u_other_parent',
  role: 'Parent',
  tags: [],
  requires2fa: false,
};

type IncidentStatus = 'Draft' | 'HeadReview' | 'Escalated' | 'SignedOff' | 'Archived';
type ParentCopyStatus = 'Draft' | 'Generated' | 'Shared' | 'Archived';

interface StoredIncident {
  id: string;
  reportNumber: string;
  type: string;
  severity: string;
  confidentiality: string;
  status: IncidentStatus;
  occurredAt: Date;
  locationEnc: string;
  activityEnc: string | null;
  offSite: boolean;
  factualAccountEnc: string;
  directDisclosureEnc: string | null;
  immediateActionsEnc: string | null;
  witnessesEnc: string | null;
  injurySustained: boolean;
  bodyAreaEnc: string | null;
  firstAidGiven: boolean;
  firstAiderId: string | null;
  emergencyServicesContacted: boolean;
  hospitalTreatment: boolean;
  parentCarerNotified: boolean;
  parentNotifiedAt: Date | null;
  medicalNotesEnc: string | null;
  dslNotified: boolean;
  headSignOffRequired: boolean;
  pastorPrincipalEscalation: boolean;
  ladoConsidered: boolean;
  socialCarePoliceReferral: boolean;
  riddorCheck: boolean;
  dataSharingReasonEnc: string | null;
  parentVisibilityRequested: boolean;
  recordedById: string;
  signedOffById: string | null;
  signedOffAt: Date | null;
  escalatedById: string | null;
  escalatedAt: Date | null;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface StoredParentCopy {
  id: string;
  reportId: string;
  studentId: string;
  status: ParentCopyStatus;
  parentSummaryEnc: string;
  redactionsEnc: string | null;
  attachmentsIncludedEnc: string | null;
  sharingReasonEnc: string | null;
  pdfBytesEnc: string | null;
  pdfFileNameEnc: string | null;
  generatedById: string | null;
  generatedAt: Date | null;
  sharedById: string | null;
  sharedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface StoredRecipient {
  copyId: string;
  guardianId: string;
  acknowledgedAt: Date | null;
  downloadedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface StoredIncidentStaff {
  id: string;
  reportId: string;
  userId: string;
  kind: 'StaffInvolved' | 'Witness';
  roleLabelEnc: string | null;
  position: number;
  createdAt: Date;
}

function encrypt(value: string | null | undefined): string | null {
  if (!value) return null;
  return `enc:${value}`;
}

function decrypt(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.replace(/^enc:/u, '');
}

function makeFakeDb() {
  const now = new Date('2026-05-28T10:00:00.000Z');
  const students = [
    {
      id: 's_child_1',
      active: true,
      fullNameEnc: encrypt('Joshua Johnson') ?? '',
      yearGroup: 'Y9',
    },
    {
      id: 's_child_2',
      active: true,
      fullNameEnc: encrypt('Amelia Carter') ?? '',
      yearGroup: 'Y8',
    },
  ];
  const users = [
    {
      id: supervisorUser.id,
      active: true,
      fullNameEnc: encrypt('Supervisor User') ?? '',
      role: supervisorUser.role,
    },
    {
      id: otherSupervisorUser.id,
      active: true,
      fullNameEnc: encrypt('Other Supervisor') ?? '',
      role: otherSupervisorUser.role,
    },
    {
      id: headUser.id,
      active: true,
      fullNameEnc: encrypt('Head User') ?? '',
      role: headUser.role,
    },
    {
      id: pastorUser.id,
      active: true,
      fullNameEnc: encrypt('Pastor User') ?? '',
      role: pastorUser.role,
    },
  ];
  const guardians = [
    { id: 'g_1', userId: parentUser.id, studentId: 's_child_1' },
    { id: 'g_2', userId: supervisorUser.id, studentId: 's_child_1' },
  ];
  const incidents: StoredIncident[] = [];
  const incidentStudents: Array<{ reportId: string; studentId: string; position: number }> = [];
  const incidentStaff: StoredIncidentStaff[] = [];
  const parentCopies: StoredParentCopy[] = [];
  const recipients: StoredRecipient[] = [];
  const auditRows: unknown[] = [];

  function includeIncident(row: StoredIncident) {
    const recorder = users.find((user) => user.id === row.recordedById);
    return {
      ...row,
      recordedBy: recorder ?? null,
      signedOffBy: row.signedOffById
        ? (users.find((user) => user.id === row.signedOffById) ?? null)
        : null,
      escalatedBy: row.escalatedById
        ? (users.find((user) => user.id === row.escalatedById) ?? null)
        : null,
      firstAider: row.firstAiderId
        ? (users.find((user) => user.id === row.firstAiderId) ?? null)
        : null,
      students: incidentStudents
        .filter((link) => link.reportId === row.id)
        .map((link) => ({
          ...link,
          student: students.find((student) => student.id === link.studentId),
        })),
      staff: incidentStaff
        .filter((link) => link.reportId === row.id)
        .map((link) => ({
          ...link,
          user: users.find((user) => user.id === link.userId),
        })),
      attachments: [],
      parentCopies: parentCopies.filter((copy) => copy.reportId === row.id),
      events: [],
    };
  }

  function includeRecipient(row: StoredRecipient) {
    const copy = parentCopies.find((parentCopy) => parentCopy.id === row.copyId);
    const report = copy ? incidents.find((incident) => incident.id === copy.reportId) : undefined;
    const student = copy
      ? students.find((candidate) => candidate.id === copy.studentId)
      : undefined;
    return {
      ...row,
      copy: copy && report && student ? { ...copy, report, student } : undefined,
    };
  }

  return {
    $enc: { encrypt, decrypt },
    auditRows,
    incidentReport: {
      count: () => incidents.length,
      create: ({ data }: { data: Record<string, unknown> }) => {
        const row: StoredIncident = {
          id: 'ir_1',
          reportNumber: String(data.reportNumber),
          type: String(data.type),
          severity: String(data.severity),
          confidentiality: String(data.confidentiality),
          status: 'Draft',
          occurredAt: data.occurredAt as Date,
          locationEnc: String(data.locationEnc),
          activityEnc: (data.activityEnc as string | null) ?? null,
          offSite: Boolean(data.offSite),
          factualAccountEnc: String(data.factualAccountEnc),
          directDisclosureEnc: (data.directDisclosureEnc as string | null) ?? null,
          immediateActionsEnc: (data.immediateActionsEnc as string | null) ?? null,
          witnessesEnc: (data.witnessesEnc as string | null) ?? null,
          injurySustained: Boolean(data.injurySustained),
          bodyAreaEnc: (data.bodyAreaEnc as string | null) ?? null,
          firstAidGiven: Boolean(data.firstAidGiven),
          firstAiderId: (data.firstAiderId as string | null) ?? null,
          emergencyServicesContacted: Boolean(data.emergencyServicesContacted),
          hospitalTreatment: Boolean(data.hospitalTreatment),
          parentCarerNotified: Boolean(data.parentCarerNotified),
          parentNotifiedAt: (data.parentNotifiedAt as Date | null) ?? null,
          medicalNotesEnc: (data.medicalNotesEnc as string | null) ?? null,
          dslNotified: Boolean(data.dslNotified),
          headSignOffRequired: Boolean(data.headSignOffRequired),
          pastorPrincipalEscalation: Boolean(data.pastorPrincipalEscalation),
          ladoConsidered: Boolean(data.ladoConsidered),
          socialCarePoliceReferral: Boolean(data.socialCarePoliceReferral),
          riddorCheck: Boolean(data.riddorCheck),
          dataSharingReasonEnc: (data.dataSharingReasonEnc as string | null) ?? null,
          parentVisibilityRequested: Boolean(data.parentVisibilityRequested),
          recordedById: String(data.recordedById),
          signedOffById: null,
          signedOffAt: null,
          escalatedById: null,
          escalatedAt: null,
          archivedAt: null,
          createdAt: now,
          updatedAt: now,
        };
        incidents.push(row);
        const nestedStudents = data.students as
          | { createMany?: { data?: Array<{ studentId: string; position: number }> } }
          | undefined;
        for (const link of nestedStudents?.createMany?.data ?? []) {
          incidentStudents.push({ reportId: row.id, ...link });
        }
        const nestedStaff = data.staff as
          | {
              createMany?: {
                data?: Array<{
                  userId: string;
                  kind: StoredIncidentStaff['kind'];
                  position: number;
                }>;
              };
            }
          | undefined;
        for (const link of nestedStaff?.createMany?.data ?? []) {
          incidentStaff.push({
            id: `irs_${String(incidentStaff.length + 1)}`,
            reportId: row.id,
            roleLabelEnc: null,
            createdAt: now,
            ...link,
          });
        }
        return includeIncident(row);
      },
      findMany: () => incidents.map(includeIncident),
      findUnique: ({ where }: { where: { id: string } }) => {
        const row = incidents.find((incident) => incident.id === where.id);
        return row ? includeIncident(row) : null;
      },
      update: ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const row = incidents.find((incident) => incident.id === where.id);
        if (!row) throw new Error('incident not found');
        const { staff, students, ...scalars } = data;
        Object.assign(row, scalars, { updatedAt: now });
        const nestedStudents = students as
          | {
              deleteMany?: unknown;
              createMany?: { data?: Array<{ studentId: string; position: number }> };
            }
          | undefined;
        if (nestedStudents?.deleteMany !== undefined) {
          for (let index = incidentStudents.length - 1; index >= 0; index -= 1) {
            if (incidentStudents[index]?.reportId === row.id) incidentStudents.splice(index, 1);
          }
        }
        for (const link of nestedStudents?.createMany?.data ?? []) {
          incidentStudents.push({ reportId: row.id, ...link });
        }

        const nestedStaff = staff as
          | {
              deleteMany?: unknown;
              createMany?: {
                data?: Array<{
                  userId: string;
                  kind: StoredIncidentStaff['kind'];
                  position: number;
                }>;
              };
            }
          | undefined;
        if (nestedStaff?.deleteMany !== undefined) {
          for (let index = incidentStaff.length - 1; index >= 0; index -= 1) {
            if (incidentStaff[index]?.reportId === row.id) incidentStaff.splice(index, 1);
          }
        }
        for (const link of nestedStaff?.createMany?.data ?? []) {
          incidentStaff.push({
            id: `irs_${String(incidentStaff.length + 1)}`,
            reportId: row.id,
            roleLabelEnc: null,
            createdAt: now,
            ...link,
          });
        }
        return includeIncident(row);
      },
      delete: ({ where }: { where: { id: string } }) => {
        const index = incidents.findIndex((incident) => incident.id === where.id);
        if (index < 0) throw new Error('incident not found');
        const row = incidents[index];
        if (!row) throw new Error('incident not found');
        incidents.splice(index, 1);
        for (let linkIndex = incidentStudents.length - 1; linkIndex >= 0; linkIndex -= 1) {
          if (incidentStudents[linkIndex]?.reportId === where.id) {
            incidentStudents.splice(linkIndex, 1);
          }
        }
        for (let linkIndex = incidentStaff.length - 1; linkIndex >= 0; linkIndex -= 1) {
          if (incidentStaff[linkIndex]?.reportId === where.id) {
            incidentStaff.splice(linkIndex, 1);
          }
        }
        return includeIncident(row);
      },
    },
    incidentReportParentCopy: {
      create: ({ data }: { data: Record<string, unknown> }) => {
        const row: StoredParentCopy = {
          id: 'ipc_1',
          reportId: String(data.reportId),
          studentId: String(data.studentId),
          status: String(data.status) as ParentCopyStatus,
          parentSummaryEnc: String(data.parentSummaryEnc),
          redactionsEnc: (data.redactionsEnc as string | null) ?? null,
          attachmentsIncludedEnc: (data.attachmentsIncludedEnc as string | null) ?? null,
          sharingReasonEnc: (data.sharingReasonEnc as string | null) ?? null,
          pdfBytesEnc: (data.pdfBytesEnc as string | null) ?? null,
          pdfFileNameEnc: (data.pdfFileNameEnc as string | null) ?? null,
          generatedById: (data.generatedById as string | null) ?? null,
          generatedAt: (data.generatedAt as Date | null) ?? null,
          sharedById: null,
          sharedAt: null,
          createdAt: now,
          updatedAt: now,
        };
        parentCopies.push(row);
        return row;
      },
      findUnique: ({
        where,
      }: {
        where: { id?: string; reportId_studentId?: { reportId: string; studentId: string } };
      }) => {
        return where.id
          ? (parentCopies.find((copy) => copy.id === where.id) ?? null)
          : (parentCopies.find(
              (copy) =>
                copy.reportId === where.reportId_studentId?.reportId &&
                copy.studentId === where.reportId_studentId.studentId,
            ) ?? null);
      },
      update: ({ where, data }: { where: { id: string }; data: Partial<StoredParentCopy> }) => {
        const row = parentCopies.find((copy) => copy.id === where.id);
        if (!row) throw new Error('copy not found');
        Object.assign(row, data, { updatedAt: now });
        return row;
      },
      findMany: () => parentCopies,
    },
    incidentReportParentRecipient: {
      createMany: ({ data }: { data: StoredRecipient[] }) => {
        recipients.push(
          ...data.map((recipient) => ({
            ...recipient,
            acknowledgedAt: recipient.acknowledgedAt ?? null,
            downloadedAt: recipient.downloadedAt ?? null,
            createdAt: recipient.createdAt,
            updatedAt: recipient.updatedAt,
          })),
        );
        return { count: data.length };
      },
      findMany: ({ where }: { where?: { guardianId?: string; copyId?: string } } = {}) =>
        recipients
          .filter(
            (recipient) =>
              (!where?.guardianId || recipient.guardianId === where.guardianId) &&
              (!where?.copyId || recipient.copyId === where.copyId),
          )
          .map(includeRecipient),
      findUnique: ({
        where,
      }: {
        where: { copyId_guardianId: { copyId: string; guardianId: string } };
      }) => {
        const recipient =
          recipients.find(
            (candidate) =>
              candidate.copyId === where.copyId_guardianId.copyId &&
              candidate.guardianId === where.copyId_guardianId.guardianId,
          ) ?? null;
        return recipient ? includeRecipient(recipient) : null;
      },
      update: ({
        where,
        data,
      }: {
        where: { copyId_guardianId: { copyId: string; guardianId: string } };
        data: Partial<StoredRecipient>;
      }) => {
        const row = recipients.find(
          (recipient) =>
            recipient.copyId === where.copyId_guardianId.copyId &&
            recipient.guardianId === where.copyId_guardianId.guardianId,
        );
        if (!row) throw new Error('recipient not found');
        Object.assign(row, data, { updatedAt: now });
        return row;
      },
    },
    incidentReportEvent: { create: ({ data }: { data: unknown }) => data },
    student: {
      findMany: ({ where }: { where: { id?: { in?: string[] }; active?: boolean } }) =>
        students.filter(
          (student) =>
            (!where.active || student.active) &&
            (!where.id?.in || where.id.in.includes(student.id)),
        ),
    },
    user: {
      findMany: ({
        where,
      }: {
        where?: { id?: { in?: string[] }; active?: boolean; role?: { in?: string[] } };
      } = {}) =>
        users.filter(
          (user) =>
            (!where?.active || user.active) &&
            (!where?.id?.in || where.id.in.includes(user.id)) &&
            (!where?.role?.in || where.role.in.includes(user.role)),
        ),
    },
    guardian: {
      findMany: ({
        where,
      }: { where?: { userId?: string; studentId?: string | { in?: string[] } } } = {}) =>
        guardians.filter((guardian) => {
          const studentFilter = where?.studentId;
          const studentMatches =
            !studentFilter ||
            (typeof studentFilter === 'string'
              ? guardian.studentId === studentFilter
              : Boolean(studentFilter.in?.includes(guardian.studentId)));
          return (!where?.userId || guardian.userId === where.userId) && studentMatches;
        }),
    },
    auditLog: {
      create: (args: unknown) => {
        auditRows.push(args);
        return args;
      },
    },
  };
}

function makeCaller(user: SessionUser) {
  const db = makeFakeDb();
  const caller = createIncidentCaller(db, user);
  return { caller, db };
}

function createIncidentCaller(db: ReturnType<typeof makeFakeDb>, user: SessionUser) {
  const appRouter = router({ incident: incidentRouter });
  return appRouter.createCaller({
    db,
    user,
    withRls: async <T>(fn: (tx: RlsTx) => Promise<T>) => fn(db as unknown as RlsTx),
  } as unknown as AppContext);
}

interface PdfTextItem {
  str: string;
}

interface PdfTextContent {
  items: PdfTextItem[];
}

interface PdfPageProxy {
  getTextContent: () => Promise<PdfTextContent>;
}

interface PdfDocumentProxy {
  destroy: () => Promise<void> | void;
  getPage: (pageNumber: number) => Promise<PdfPageProxy>;
  numPages: number;
}

interface PdfLoadingTask {
  promise: Promise<PdfDocumentProxy>;
}

interface PdfJsModule {
  getDocument: (input: {
    data: Uint8Array;
    disableFontFace: boolean;
    isEvalSupported: boolean;
    useSystemFonts: boolean;
  }) => PdfLoadingTask;
}

function ensurePdfDomFallbacks(): void {
  if (!('DOMMatrix' in globalThis)) {
    class TestDOMMatrix {
      inverse(): this {
        return this;
      }
      multiply(): this {
        return this;
      }
      multiplySelf(): this {
        return this;
      }
      preMultiplySelf(): this {
        return this;
      }
      scale(): this {
        return this;
      }
      scaleSelf(): this {
        return this;
      }
      translate(): this {
        return this;
      }
      translateSelf(): this {
        return this;
      }
    }
    Object.defineProperty(globalThis, 'DOMMatrix', { configurable: true, value: TestDOMMatrix });
  }

  if (!('ImageData' in globalThis)) {
    class TestImageData {
      colorSpace: PredefinedColorSpace = 'srgb';
      data: Uint8ClampedArray;
      height: number;
      width: number;

      constructor(width: number, height: number) {
        this.width = width;
        this.height = height;
        this.data = new Uint8ClampedArray(width * height * 4);
      }
    }
    Object.defineProperty(globalThis, 'ImageData', { configurable: true, value: TestImageData });
  }

  if (!('Path2D' in globalThis)) {
    class TestPath2D {
      addPath(): void {}
    }
    Object.defineProperty(globalThis, 'Path2D', { configurable: true, value: TestPath2D });
  }
}

async function extractPdfText(pdfBase64: string): Promise<string> {
  ensurePdfDomFallbacks();
  const pdfjs = (await import('pdfjs-dist/legacy/build/pdf.mjs')) as unknown as PdfJsModule;
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(Buffer.from(pdfBase64, 'base64')),
    disableFontFace: true,
    isEvalSupported: false,
    useSystemFonts: false,
  });
  const pdf = await loadingTask.promise;
  try {
    const pages: string[] = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      pages.push(content.items.map((item) => item.str).join(' '));
    }
    return pages.join('\n');
  } finally {
    await pdf.destroy();
  }
}

const draftInput = {
  type: 'AccidentFirstAid' as const,
  severity: 'Medium' as const,
  confidentiality: 'ParentViewableAfterSignOff' as const,
  occurredAt: new Date('2026-05-28T09:30:00.000Z'),
  location: 'Playground',
  activity: 'Break time',
  offSite: false,
  studentIds: ['s_child_1'],
  staffIds: [],
  factualAccount: 'Joshua slipped during break time.',
  directDisclosure: 'My knee hurts.',
  immediateActions: 'First aid provided and child monitored.',
  witnesses: '',
  injurySustained: true,
  bodyArea: 'Right knee',
  firstAidGiven: true,
  firstAiderId: undefined,
  emergencyServicesContacted: false,
  hospitalTreatment: false,
  parentCarerNotified: true,
  parentNotifiedAt: new Date('2026-05-28T10:00:00.000Z'),
  medicalNotes: 'Small graze cleaned and plaster applied.',
  dslNotified: false,
  headSignOffRequired: true,
  pastorPrincipalEscalation: false,
  ladoConsidered: false,
  socialCarePoliceReferral: false,
  riddorCheck: true,
  dataSharingReason: 'Parent needs first-aid record.',
  parentVisibilityRequested: true,
};

describe('incident router', () => {
  it('allows a supervisor to create and submit an incident for head review', async () => {
    const { caller } = makeCaller(supervisorUser);

    const draft = await caller.incident.createDraft(draftInput);
    expect(draft.status).toBe('Draft');
    expect(draft.reportNumber).toBe('IR-2026-001');
    expect(draft.students).toHaveLength(1);

    const submitted = await caller.incident.submitForHeadReview({ reportId: draft.id });
    expect(submitted.status).toBe('HeadReview');
  });

  it('allows the creator to update draft fields and people links', async () => {
    const { caller } = makeCaller(supervisorUser);
    const draft = await caller.incident.createDraft(draftInput);

    const updated = await caller.incident.updateDraft({
      ...draftInput,
      reportId: draft.id,
      location: 'Medical room',
      studentIds: ['s_child_2'],
      staffIds: [headUser.id],
      witnessStaffIds: [pastorUser.id],
      factualAccount: 'Joshua was taken to the medical room for assessment.',
      firstAiderId: headUser.id,
    });

    expect(updated.location).toBe('Medical room');
    expect(updated.factualAccount).toBe('Joshua was taken to the medical room for assessment.');
    expect(updated.firstAiderId).toBe(headUser.id);
    expect(updated.students).toEqual([
      expect.objectContaining({ studentId: 's_child_2', fullName: 'Amelia Carter' }),
    ]);
    expect(updated.staff).toEqual([
      expect.objectContaining({ kind: 'StaffInvolved', userId: headUser.id }),
      expect.objectContaining({ kind: 'Witness', userId: pastorUser.id }),
    ]);
  });

  it('allows the creator to delete a draft and removes it from staff lists', async () => {
    const { caller } = makeCaller(supervisorUser);
    const draft = await caller.incident.createDraft(draftInput);

    await expect(caller.incident.deleteDraft({ reportId: draft.id })).resolves.toMatchObject({
      id: draft.id,
      reportNumber: draft.reportNumber,
    });

    await expect(caller.incident.listStaff()).resolves.toEqual([]);
  });

  it('blocks non-creators from updating, submitting, or deleting draft incidents', async () => {
    const { caller, db } = makeCaller(supervisorUser);
    const draft = await caller.incident.createDraft(draftInput);
    const headCaller = createIncidentCaller(db, headUser);
    const otherSupervisorCaller = createIncidentCaller(db, otherSupervisorUser);

    await expect(
      headCaller.incident.updateDraft({
        ...draftInput,
        reportId: draft.id,
        location: 'Office',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(
      otherSupervisorCaller.incident.submitForHeadReview({ reportId: draft.id }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(headCaller.incident.deleteDraft({ reportId: draft.id })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('rejects draft update and delete after submission', async () => {
    const { caller } = makeCaller(supervisorUser);
    const draft = await caller.incident.createDraft(draftInput);
    await caller.incident.submitForHeadReview({ reportId: draft.id });

    await expect(
      caller.incident.updateDraft({
        ...draftInput,
        reportId: draft.id,
        location: 'Office',
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    await expect(caller.incident.deleteDraft({ reportId: draft.id })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
  });

  it('keeps parent copies hidden until sign-off and explicit sharing', async () => {
    const { caller: supervisorCaller, db } = makeCaller(supervisorUser);
    const draft = await supervisorCaller.incident.createDraft(draftInput);

    await expect(
      supervisorCaller.incident.generateParentCopy({
        reportId: draft.id,
        studentId: 's_child_1',
        parentSummary: 'Joshua slipped during break time.',
        redactions: '',
        attachmentsIncluded: '',
        sharingReason: 'Parent needs first-aid record.',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });

    await supervisorCaller.incident.submitForHeadReview({ reportId: draft.id });
    const headCaller = createIncidentCaller(db, headUser);
    await headCaller.incident.signOff({ reportId: draft.id });
    const copy = await headCaller.incident.generateParentCopy({
      reportId: draft.id,
      studentId: 's_child_1',
      parentSummary: 'Joshua slipped during break time.',
      redactions: 'Internal staff comments withheld.',
      attachmentsIncluded: 'None',
      sharingReason: 'Parent needs first-aid record.',
    });

    const parentCaller = createIncidentCaller(db, parentUser);
    expect(await parentCaller.incident.listParent()).toHaveLength(0);

    await headCaller.incident.shareParentCopy({ copyId: copy.id });
    const parentCopies = await parentCaller.incident.listParent();
    expect(parentCopies).toHaveLength(1);
    expect(parentCopies[0]?.requiresAcknowledgement).toBe(true);
  });

  it('records acknowledgement for linked guardians and denies unlinked parents', async () => {
    const { caller: supervisorCaller, db } = makeCaller(supervisorUser);
    const draft = await supervisorCaller.incident.createDraft(draftInput);
    await supervisorCaller.incident.submitForHeadReview({ reportId: draft.id });
    const headCaller = createIncidentCaller(db, headUser);
    await headCaller.incident.signOff({ reportId: draft.id });
    const copy = await headCaller.incident.generateParentCopy({
      reportId: draft.id,
      studentId: 's_child_1',
      parentSummary: 'Joshua slipped during break time.',
      redactions: '',
      attachmentsIncluded: '',
      sharingReason: 'Parent needs first-aid record.',
    });
    await headCaller.incident.shareParentCopy({ copyId: copy.id });

    const parentCaller = createIncidentCaller(db, parentUser);
    const acknowledged = await parentCaller.incident.acknowledgeParentCopy({ copyId: copy.id });
    expect(acknowledged.acknowledgedAt).toBeInstanceOf(Date);

    const download = await parentCaller.incident.downloadParentPdf({ copyId: copy.id });
    expect(Buffer.from(download.pdfBase64, 'base64').subarray(0, 5).toString('utf8')).toBe('%PDF-');
    const text = await extractPdfText(download.pdfBase64);
    expect(text).toContain('Incident classification');
    expect(text).toContain('Accident / first aid');
    expect(text).toContain('When and where');
    expect(text).toContain('Playground');
    expect(text).toContain('Factual account');
    expect(text).toContain('Joshua slipped during break time.');
    expect(text).toContain('Injury, first aid and medical');
    expect(text).toContain('Small graze cleaned and plaster applied.');
    expect(text).not.toContain('My knee hurts.');

    const otherParentCaller = createIncidentCaller(db, otherParentUser);
    await expect(
      otherParentCaller.incident.getParentCopy({ copyId: copy.id }),
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('allows linked-child supervisor guardians to use parent incident copies', async () => {
    const { caller: supervisorCaller, db } = makeCaller(supervisorUser);
    const draft = await supervisorCaller.incident.createDraft(draftInput);
    await supervisorCaller.incident.submitForHeadReview({ reportId: draft.id });
    const headCaller = createIncidentCaller(db, headUser);
    await headCaller.incident.signOff({ reportId: draft.id });
    const copy = await headCaller.incident.generateParentCopy({
      reportId: draft.id,
      studentId: 's_child_1',
      parentSummary: 'Joshua slipped during break time.',
      redactions: '',
      attachmentsIncluded: '',
      sharingReason: 'Parent needs first-aid record.',
    });
    await headCaller.incident.shareParentCopy({ copyId: copy.id });

    const copies = await supervisorCaller.incident.listParent();
    expect(copies).toHaveLength(1);
    expect(copies[0]?.studentId).toBe('s_child_1');

    await expect(
      supervisorCaller.incident.getParentCopy({ copyId: copy.id }),
    ).resolves.toMatchObject({
      id: copy.id,
      studentId: 's_child_1',
    });
    await expect(
      supervisorCaller.incident.acknowledgeParentCopy({ copyId: copy.id }),
    ).resolves.toMatchObject({
      copyId: copy.id,
      guardianId: supervisorUser.id,
    });
    await expect(
      supervisorCaller.incident.downloadParentPdf({ copyId: copy.id }),
    ).resolves.toMatchObject({
      mimeType: 'application/pdf',
    });
  });

  it('allows Pastor or Principal roles to handle escalated incidents', async () => {
    const { caller: supervisorCaller, db } = makeCaller(supervisorUser);
    const draft = await supervisorCaller.incident.createDraft(draftInput);
    await supervisorCaller.incident.submitForHeadReview({ reportId: draft.id });

    const pastorCaller = createIncidentCaller(db, pastorUser);
    const escalated = await pastorCaller.incident.escalate({ reportId: draft.id });
    expect(escalated.status).toBe('Escalated');
  });

  it('requires senior confirmation to share a parent copy before sign-off', async () => {
    const { caller: supervisorCaller, db } = makeCaller(supervisorUser);
    const draft = await supervisorCaller.incident.createDraft(draftInput);
    await supervisorCaller.incident.submitForHeadReview({ reportId: draft.id });
    const headCaller = createIncidentCaller(db, headUser);

    await expect(
      headCaller.incident.generateParentCopy({
        reportId: draft.id,
        studentId: 's_child_1',
        parentSummary: 'Joshua slipped during break time.',
        redactions: '',
        attachmentsIncluded: '',
        sharingReason: 'Parent needs first-aid record.',
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });

    const copy = await headCaller.incident.generateParentCopy({
      reportId: draft.id,
      studentId: 's_child_1',
      parentSummary: 'Joshua slipped during break time.',
      redactions: '',
      attachmentsIncluded: '',
      sharingReason: 'Parent needs first-aid record.',
      overrideVisibility: true,
    });

    await expect(headCaller.incident.shareParentCopy({ copyId: copy.id })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
    await expect(
      headCaller.incident.shareParentCopy({ copyId: copy.id, overrideVisibility: true }),
    ).resolves.toMatchObject({ status: 'Shared' });
  });
});
