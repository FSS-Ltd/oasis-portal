import { randomUUID } from 'node:crypto';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import type { IncidentEventType, Prisma } from '@oasis/db';
import {
  AccessDeniedError,
  INCIDENT_CONFIDENTIALITIES,
  INCIDENT_SEVERITIES,
  INCIDENT_TYPES,
  assertIncidentTransition,
  canOverrideIncidentParentVisibility,
  canUseLinkedChildIncidentAccess,
  incidentParentCopyIsVisible,
  nextIncidentStatus,
  requireCanCreateIncidentReport,
  requireCanEscalateIncidentReport,
  requireCanShareIncidentParentCopy,
  requireCanSignOffIncidentReport,
  type IncidentParentCopyStatus,
  type IncidentReportStatus,
  type SessionUser,
} from '@oasis/domain';
import type { AppContext, RlsTx } from '../context.js';
import { generateIncidentParentPdf } from '../incidents/incident-report-pdf.js';
import {
  decryptOptionalText,
  decryptRequiredText,
  encryptOptionalText,
} from '../lib/encrypted-text.js';
import { authedProcedure, router } from '../trpc.js';

type AuthedContext = AppContext & { user: SessionUser };
type IncidentRlsReadClient = Pick<
  RlsTx,
  | 'incidentReport'
  | 'incidentReportAttachment'
  | 'incidentReportParentCopy'
  | 'incidentReportParentRecipient'
  | 'incidentReportStaff'
  | 'incidentReportStudent'
  | 'student'
  | 'user'
>;
type IncidentRlsEventClient = Pick<RlsTx, 'incidentReportEvent'>;

const INCIDENT_STAFF_ROLES = [
  'Head',
  'Principal',
  'Pastor',
  'HeadOfDiscipline',
  'ClubsAdmin',
  'Supervisor',
] as const;

const INCIDENT_TYPE_LABELS = {
  AccidentFirstAid: 'Accident / first aid',
  BehaviourIncident: 'Behaviour incident',
  BullyingPeerOnPeer: 'Bullying / peer-on-peer abuse',
  MedicalMedication: 'Medical / medication',
  NearMiss: 'Near miss',
  OffSiteTrip: 'Off-site trip',
  OnlineSafety: 'Online safety',
  PhysicalIntervention: 'Physical intervention',
  SafeguardingConcern: 'Safeguarding concern',
} as const satisfies Record<(typeof INCIDENT_TYPES)[number], string>;

const INCIDENT_SEVERITY_LABELS = {
  Critical: 'Critical',
  High: 'High',
  Low: 'Low',
  Medium: 'Medium',
} as const satisfies Record<(typeof INCIDENT_SEVERITIES)[number], string>;

const INCIDENT_CONFIDENTIALITY_LABELS = {
  HeadDsl: 'Head / DSL',
  ParentViewableAfterSignOff: 'Parent viewable after sign-off',
  StaffOnly: 'Staff only',
} as const satisfies Record<(typeof INCIDENT_CONFIDENTIALITIES)[number], string>;

interface IncidentStudentLink {
  studentId: string;
  position: number;
  student?: {
    id: string;
    fullNameEnc: string;
    yearGroup: string;
  } | null;
}

interface IncidentStaffLink {
  id: string;
  userId: string;
  kind: 'StaffInvolved' | 'Witness';
  roleLabelEnc: string | null;
  position: number;
  user?: {
    id: string;
    fullNameEnc: string;
    role: SessionUser['role'];
  } | null;
}

interface IncidentAttachmentRow {
  id: string;
  originalFileNameEnc: string;
  mimeType: string;
  sizeBytes: number;
  storageBucket: string;
  storagePathEnc: string;
  position: number;
}

interface IncidentParentCopyRow {
  id: string;
  reportId: string;
  studentId: string;
  status: IncidentParentCopyStatus;
  parentSummaryEnc: string;
  redactionsEnc: string | null;
  attachmentsIncludedEnc: string | null;
  sharingReasonEnc: string | null;
  pdfBytesEnc: string | null;
  pdfFileNameEnc: string | null;
  generatedAt: Date | null;
  sharedAt: Date | null;
  recipients?: IncidentParentRecipientRow[];
  report?: IncidentReportRow;
  student?: {
    id: string;
    fullNameEnc: string;
    yearGroup: string;
  };
}

interface IncidentParentRecipientRow {
  copyId: string;
  guardianId: string;
  acknowledgedAt: Date | null;
  downloadedAt: Date | null;
  copy?: IncidentParentCopyRow;
}

interface IncidentReportRow {
  id: string;
  reportNumber: string;
  type: string;
  severity: string;
  confidentiality: string;
  status: IncidentReportStatus;
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
  recordedBy?: { id: string; fullNameEnc: string; role: SessionUser['role'] } | null;
  signedOffBy?: { id: string; fullNameEnc: string; role: SessionUser['role'] } | null;
  escalatedBy?: { id: string; fullNameEnc: string; role: SessionUser['role'] } | null;
  firstAider?: { id: string; fullNameEnc: string; role: SessionUser['role'] } | null;
  students?: IncidentStudentLink[];
  staff?: IncidentStaffLink[];
  attachments?: IncidentAttachmentRow[];
  parentCopies?: IncidentParentCopyRow[];
}

const incidentTypeSchema = z.enum(INCIDENT_TYPES);
const incidentSeveritySchema = z.enum(INCIDENT_SEVERITIES);
const incidentConfidentialitySchema = z.enum(INCIDENT_CONFIDENTIALITIES);
const reportIdInput = z.object({ reportId: z.string().min(1) });
const copyIdInput = z.object({ copyId: z.string().min(1) });

const incidentDraftInput = z.object({
  type: incidentTypeSchema,
  severity: incidentSeveritySchema,
  confidentiality: incidentConfidentialitySchema.default('StaffOnly'),
  occurredAt: z.coerce.date(),
  location: z.string().trim().min(1).max(240),
  activity: z.string().trim().max(240).optional(),
  offSite: z.boolean().default(false),
  studentIds: z.array(z.string().min(1)).min(1).max(20),
  staffIds: z.array(z.string().min(1)).max(20).default([]),
  factualAccount: z.string().trim().min(1).max(6000),
  directDisclosure: z.string().trim().max(3000).optional(),
  immediateActions: z.string().trim().max(3000).optional(),
  witnesses: z.string().trim().max(2000).optional(),
  witnessStaffIds: z.array(z.string().min(1)).max(20).default([]),
  injurySustained: z.boolean().default(false),
  bodyArea: z.string().trim().max(240).optional(),
  firstAidGiven: z.boolean().default(false),
  firstAiderId: z.string().min(1).optional(),
  emergencyServicesContacted: z.boolean().default(false),
  hospitalTreatment: z.boolean().default(false),
  parentCarerNotified: z.boolean().default(false),
  parentNotifiedAt: z.coerce.date().optional(),
  medicalNotes: z.string().trim().max(3000).optional(),
  dslNotified: z.boolean().default(false),
  headSignOffRequired: z.boolean().default(false),
  pastorPrincipalEscalation: z.boolean().default(false),
  ladoConsidered: z.boolean().default(false),
  socialCarePoliceReferral: z.boolean().default(false),
  riddorCheck: z.boolean().default(false),
  dataSharingReason: z.string().trim().max(2000).optional(),
  parentVisibilityRequested: z.boolean().default(false),
});

const incidentUpdateInput = incidentDraftInput.extend({
  reportId: z.string().min(1),
});

const parentCopyInput = z.object({
  reportId: z.string().min(1),
  studentId: z.string().min(1),
  parentSummary: z.string().trim().min(1).max(3000),
  redactions: z.string().trim().max(2000).optional(),
  attachmentsIncluded: z.string().trim().max(2000).optional(),
  sharingReason: z.string().trim().min(1).max(2000),
  overrideVisibility: z.boolean().default(false),
});

const shareParentCopyInput = copyIdInput.extend({
  overrideVisibility: z.boolean().default(false),
});

const attachmentMetadataInput = z.object({
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().min(1).max(120),
  sizeBytes: z
    .number()
    .int()
    .positive()
    .max(10 * 1024 * 1024),
});

const prepareAttachmentsInput = z.object({
  attachments: z.array(attachmentMetadataInput).min(1).max(10),
});

function toForbidden(error: AccessDeniedError): TRPCError {
  return new TRPCError({ code: 'FORBIDDEN', message: error.message, cause: error });
}

function requireIncidentCreator(user: SessionUser): void {
  try {
    requireCanCreateIncidentReport(user);
  } catch (error) {
    if (error instanceof AccessDeniedError) throw toForbidden(error);
    throw error;
  }
}

function requireIncidentSignOff(user: SessionUser): void {
  try {
    requireCanSignOffIncidentReport(user);
  } catch (error) {
    if (error instanceof AccessDeniedError) throw toForbidden(error);
    throw error;
  }
}

function requireIncidentEscalation(user: SessionUser): void {
  try {
    requireCanEscalateIncidentReport(user);
  } catch (error) {
    if (error instanceof AccessDeniedError) throw toForbidden(error);
    throw error;
  }
}

function requireParentCopyShare(user: SessionUser): void {
  try {
    requireCanShareIncidentParentCopy(user);
  } catch (error) {
    if (error instanceof AccessDeniedError) throw toForbidden(error);
    throw error;
  }
}

function requireLinkedChildIncidentAccess(user: SessionUser): void {
  if (!canUseLinkedChildIncidentAccess(user)) {
    throw toForbidden(
      new AccessDeniedError('incident parent copies require linked-child guardian access'),
    );
  }
}

function assertOwnDraft(
  user: SessionUser,
  report: Pick<IncidentReportRow, 'recordedById' | 'status'>,
  action: 'delete' | 'submit' | 'update',
): void {
  if (report.status !== 'Draft') {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `only draft incidents can be ${action === 'submit' ? 'submitted' : `${action}d`}`,
    });
  }
  if (report.recordedById !== user.id) {
    throw toForbidden(new AccessDeniedError('only the report creator can manage draft incidents'));
  }
}

function assertParentVisibilityOverride(
  user: SessionUser,
  report: Pick<IncidentReportRow, 'status'>,
  overrideVisibility: boolean,
): void {
  if (report.status === 'SignedOff') return;
  if (!overrideVisibility || !canOverrideIncidentParentVisibility(user)) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message:
        'parent copies require signed-off incident reports unless senior visibility override is confirmed',
    });
  }
  if (report.status !== 'HeadReview' && report.status !== 'Escalated') {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'parent visibility override requires a report in Head review or escalation',
    });
  }
}

function encryptRequired(ctx: AuthedContext, value: string, entity: string): string {
  const encrypted = ctx.db.$enc.encrypt(value);
  if (!encrypted) {
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `${entity} encrypt failed` });
  }
  return encrypted;
}

function encryptOptional(ctx: AuthedContext, value: string | undefined): string | null {
  return encryptOptionalText(ctx.db.$enc, value);
}

function decryptRequired(
  decrypt: (value: string | null | undefined) => string | null,
  value: string,
  entity: string,
): string {
  return decryptRequiredText({ decrypt }, value, entity);
}

function decryptOptional(
  decrypt: (value: string | null | undefined) => string | null,
  value: string | null,
): string | null {
  return decryptOptionalText({ decrypt }, value);
}

async function assertActiveStudents(
  db: Pick<IncidentRlsReadClient, 'student'>,
  studentIds: readonly string[],
) {
  const uniqueStudentIds = [...new Set(studentIds)];
  const students = await db.student.findMany({
    where: { id: { in: uniqueStudentIds }, active: true },
    select: { id: true },
  });
  if (students.length !== uniqueStudentIds.length) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'one or more students were not found' });
  }
  return uniqueStudentIds;
}

async function assertActiveStaffUsers(
  db: Pick<IncidentRlsReadClient, 'user'>,
  staffIds: readonly string[],
) {
  const uniqueStaffIds = [...new Set(staffIds)];
  if (uniqueStaffIds.length === 0) return uniqueStaffIds;

  const staff = await db.user.findMany({
    where: { id: { in: uniqueStaffIds }, active: true, role: { in: [...INCIDENT_STAFF_ROLES] } },
    select: { id: true },
  });
  if (staff.length !== uniqueStaffIds.length) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'one or more staff witnesses were not found',
    });
  }
  return uniqueStaffIds;
}

async function loadIncident(
  db: Pick<IncidentRlsReadClient, 'incidentReport'>,
  reportId: string,
): Promise<IncidentReportRow> {
  const report = (await db.incidentReport.findUnique({
    where: { id: reportId },
    include: incidentInclude,
  })) as IncidentReportRow | null;
  if (!report) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'incident report not found' });
  }
  return report;
}

const incidentInclude = {
  recordedBy: { select: { id: true, fullNameEnc: true, role: true } },
  signedOffBy: { select: { id: true, fullNameEnc: true, role: true } },
  escalatedBy: { select: { id: true, fullNameEnc: true, role: true } },
  firstAider: { select: { id: true, fullNameEnc: true, role: true } },
  students: {
    orderBy: { position: 'asc' },
    include: { student: { select: { id: true, fullNameEnc: true, yearGroup: true } } },
  },
  staff: {
    orderBy: { position: 'asc' },
    include: { user: { select: { id: true, fullNameEnc: true, role: true } } },
  },
  attachments: { orderBy: { position: 'asc' } },
  parentCopies: { orderBy: { createdAt: 'desc' } },
} as const;

function mapIncident(ctx: AuthedContext, report: IncidentReportRow) {
  const decrypt = ctx.db.$enc.decrypt;
  return {
    id: report.id,
    reportNumber: report.reportNumber,
    type: report.type,
    severity: report.severity,
    confidentiality: report.confidentiality,
    status: report.status,
    occurredAt: report.occurredAt,
    location: decryptRequired(decrypt, report.locationEnc, 'incident location'),
    activity: decryptOptional(decrypt, report.activityEnc),
    offSite: report.offSite,
    factualAccount: decryptRequired(decrypt, report.factualAccountEnc, 'incident account'),
    directDisclosure: decryptOptional(decrypt, report.directDisclosureEnc),
    immediateActions: decryptOptional(decrypt, report.immediateActionsEnc),
    witnesses: decryptOptional(decrypt, report.witnessesEnc),
    injurySustained: report.injurySustained,
    bodyArea: decryptOptional(decrypt, report.bodyAreaEnc),
    firstAidGiven: report.firstAidGiven,
    firstAiderId: report.firstAiderId,
    firstAiderName: report.firstAider
      ? decryptRequired(decrypt, report.firstAider.fullNameEnc, 'first aider PII')
      : null,
    emergencyServicesContacted: report.emergencyServicesContacted,
    hospitalTreatment: report.hospitalTreatment,
    parentCarerNotified: report.parentCarerNotified,
    parentNotifiedAt: report.parentNotifiedAt,
    medicalNotes: decryptOptional(decrypt, report.medicalNotesEnc),
    dslNotified: report.dslNotified,
    headSignOffRequired: report.headSignOffRequired,
    pastorPrincipalEscalation: report.pastorPrincipalEscalation,
    ladoConsidered: report.ladoConsidered,
    socialCarePoliceReferral: report.socialCarePoliceReferral,
    riddorCheck: report.riddorCheck,
    dataSharingReason: decryptOptional(decrypt, report.dataSharingReasonEnc),
    parentVisibilityRequested: report.parentVisibilityRequested,
    recordedById: report.recordedById,
    recordedByName: report.recordedBy
      ? decryptRequired(decrypt, report.recordedBy.fullNameEnc, 'recorder PII')
      : null,
    signedOffById: report.signedOffById,
    signedOffByName: report.signedOffBy
      ? decryptRequired(decrypt, report.signedOffBy.fullNameEnc, 'sign-off PII')
      : null,
    signedOffAt: report.signedOffAt,
    escalatedById: report.escalatedById,
    escalatedByName: report.escalatedBy
      ? decryptRequired(decrypt, report.escalatedBy.fullNameEnc, 'escalation PII')
      : null,
    escalatedAt: report.escalatedAt,
    createdAt: report.createdAt,
    updatedAt: report.updatedAt,
    students: (report.students ?? []).map((link) => ({
      studentId: link.studentId,
      position: link.position,
      fullName: link.student
        ? decryptRequired(decrypt, link.student.fullNameEnc, 'student PII')
        : 'Unknown student',
      yearGroup: link.student?.yearGroup ?? '',
    })),
    staff: (report.staff ?? []).map((link) => ({
      id: link.id,
      userId: link.userId,
      kind: link.kind,
      roleLabel: decryptOptional(decrypt, link.roleLabelEnc),
      name: link.user ? decryptRequired(decrypt, link.user.fullNameEnc, 'staff PII') : 'Staff',
      role: link.user?.role ?? null,
    })),
    attachments: (report.attachments ?? []).map((attachment) => ({
      id: attachment.id,
      fileName: decryptRequired(decrypt, attachment.originalFileNameEnc, 'attachment file name'),
      mimeType: attachment.mimeType,
      sizeBytes: attachment.sizeBytes,
    })),
    parentCopies: (report.parentCopies ?? []).map((copy) => mapParentCopySummary(ctx, copy)),
  };
}

function mapParentCopySummary(ctx: AuthedContext, copy: IncidentParentCopyRow) {
  const decrypt = ctx.db.$enc.decrypt;
  return {
    id: copy.id,
    reportId: copy.reportId,
    studentId: copy.studentId,
    status: copy.status,
    parentSummary: decryptRequired(decrypt, copy.parentSummaryEnc, 'parent summary'),
    redactions: decryptOptional(decrypt, copy.redactionsEnc),
    attachmentsIncluded: decryptOptional(decrypt, copy.attachmentsIncludedEnc),
    sharingReason: decryptOptional(decrypt, copy.sharingReasonEnc),
    generatedAt: copy.generatedAt,
    sharedAt: copy.sharedAt,
  };
}

function mapParentCopy(ctx: AuthedContext, recipient: IncidentParentRecipientRow) {
  const copy = recipient.copy;
  if (!copy?.report || !copy.student) {
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'incident copy is incomplete' });
  }
  return {
    ...mapParentCopySummary(ctx, copy),
    reportNumber: copy.report.reportNumber,
    type: copy.report.type,
    occurredAt: copy.report.occurredAt,
    firstAidGiven: copy.report.firstAidGiven,
    signedOffAt: copy.report.signedOffAt,
    studentName: decryptRequired(ctx.db.$enc.decrypt, copy.student.fullNameEnc, 'student PII'),
    yearGroup: copy.student.yearGroup,
    acknowledgedAt: recipient.acknowledgedAt,
    downloadedAt: recipient.downloadedAt,
    requiresAcknowledgement: recipient.acknowledgedAt === null,
  };
}

async function reportNumber(
  db: Pick<IncidentRlsReadClient, 'incidentReport'>,
  occurredAt: Date,
): Promise<string> {
  const year = occurredAt.getUTCFullYear();
  const count = await db.incidentReport.count({
    where: {
      occurredAt: {
        gte: new Date(`${String(year)}-01-01T00:00:00.000Z`),
        lt: new Date(`${String(year + 1)}-01-01T00:00:00.000Z`),
      },
    },
  });
  return `IR-${String(year)}-${String(count + 1).padStart(3, '0')}`;
}

function draftData(ctx: AuthedContext, input: z.infer<typeof incidentDraftInput>) {
  return {
    type: input.type,
    severity: input.severity,
    confidentiality: input.confidentiality,
    occurredAt: input.occurredAt,
    locationEnc: encryptRequired(ctx, input.location, 'incident location'),
    activityEnc: encryptOptional(ctx, input.activity),
    offSite: input.offSite,
    factualAccountEnc: encryptRequired(ctx, input.factualAccount, 'incident account'),
    directDisclosureEnc: encryptOptional(ctx, input.directDisclosure),
    immediateActionsEnc: encryptOptional(ctx, input.immediateActions),
    witnessesEnc: encryptOptional(ctx, input.witnesses),
    injurySustained: input.injurySustained,
    bodyAreaEnc: encryptOptional(ctx, input.bodyArea),
    firstAidGiven: input.firstAidGiven,
    firstAiderId: input.firstAiderId ?? null,
    emergencyServicesContacted: input.emergencyServicesContacted,
    hospitalTreatment: input.hospitalTreatment,
    parentCarerNotified: input.parentCarerNotified,
    parentNotifiedAt: input.parentNotifiedAt ?? null,
    medicalNotesEnc: encryptOptional(ctx, input.medicalNotes),
    dslNotified: input.dslNotified,
    headSignOffRequired: input.headSignOffRequired,
    pastorPrincipalEscalation: input.pastorPrincipalEscalation,
    ladoConsidered: input.ladoConsidered,
    socialCarePoliceReferral: input.socialCarePoliceReferral,
    riddorCheck: input.riddorCheck,
    dataSharingReasonEnc: encryptOptional(ctx, input.dataSharingReason),
    parentVisibilityRequested: input.parentVisibilityRequested,
  };
}

function draftStudentLinks(studentIds: readonly string[]) {
  return studentIds.map((studentId, index) => ({ studentId, position: index + 1 }));
}

function draftStaffLinks(staffIds: readonly string[], witnessStaffIds: readonly string[]) {
  return [
    ...staffIds.map((userId, index) => ({
      userId,
      kind: 'StaffInvolved' as const,
      position: index + 1,
    })),
    ...witnessStaffIds.map((userId, index) => ({
      userId,
      kind: 'Witness' as const,
      position: index + 1,
    })),
  ];
}

async function logEvent(
  db: IncidentRlsEventClient,
  actorId: string,
  reportId: string,
  type: IncidentEventType,
  meta?: Prisma.InputJsonObject,
) {
  await db.incidentReportEvent.create({
    data: {
      reportId,
      actorId,
      type,
      ...(meta ? { meta } : {}),
    },
  });
}

async function linkedGuardianIds(ctx: AuthedContext, studentId: string): Promise<string[]> {
  const guardians = await ctx.db.guardian.findMany({
    where: { studentId },
    select: { userId: true },
  });
  return [...new Set(guardians.map((guardian) => guardian.userId))];
}

async function assertParentRecipient(ctx: AuthedContext, copyId: string) {
  const recipient = await ctx.withRls(
    async (tx) =>
      (await tx.incidentReportParentRecipient.findUnique({
        where: { copyId_guardianId: { copyId, guardianId: ctx.user.id } },
        include: parentRecipientInclude,
      })) as IncidentParentRecipientRow | null,
  );

  if (!recipient?.copy || !incidentParentCopyIsVisible(recipient.copy.status)) {
    throw toForbidden(new AccessDeniedError('incident parent copy is not available'));
  }

  const linked = await ctx.db.guardian.findMany({
    where: { userId: ctx.user.id, studentId: recipient.copy.studentId },
    select: { id: true },
  });
  if (linked.length === 0) {
    throw toForbidden(new AccessDeniedError('parent is not linked to this student'));
  }

  return recipient;
}

const parentRecipientInclude = {
  copy: {
    include: {
      student: { select: { id: true, fullNameEnc: true, yearGroup: true } },
      report: true,
    },
  },
} as const;

export const incidentRouter = router({
  listStaffOptions: authedProcedure.query(async ({ ctx }) => {
    requireIncidentCreator(ctx.user);
    const rows = await ctx.db.user.findMany({
      where: { active: true, role: { in: [...INCIDENT_STAFF_ROLES] } },
      orderBy: [{ role: 'asc' }, { createdAt: 'desc' }],
      select: { id: true, fullNameEnc: true, role: true },
    });

    await ctx.db.auditLog.create({
      data: {
        userId: ctx.user.id,
        action: 'DecryptPii',
        entity: 'User',
        meta: { count: rows.length, source: 'incident.listStaffOptions' },
      },
    });

    return rows.map((row) => ({
      id: row.id,
      fullName: decryptRequired(ctx.db.$enc.decrypt, row.fullNameEnc, 'staff PII'),
      role: row.role,
    }));
  }),

  listStaff: authedProcedure.query(async ({ ctx }) => {
    requireIncidentCreator(ctx.user);
    const rows = await ctx.withRls(
      async (tx) =>
        (await tx.incidentReport.findMany({
          orderBy: { updatedAt: 'desc' },
          include: incidentInclude,
        })) as IncidentReportRow[],
    );
    return rows.map((row) => mapIncident(ctx, row));
  }),

  getStaff: authedProcedure.input(reportIdInput).query(async ({ ctx, input }) => {
    requireIncidentCreator(ctx.user);
    const report = await ctx.withRls((tx) => loadIncident(tx, input.reportId));
    return mapIncident(ctx, report);
  }),

  createDraft: authedProcedure.input(incidentDraftInput).mutation(async ({ ctx, input }) => {
    requireIncidentCreator(ctx.user);
    const draft = draftData(ctx, input);
    const created = await ctx.withRls(async (tx) => {
      const studentIds = await assertActiveStudents(tx, input.studentIds);
      const staffIds = await assertActiveStaffUsers(tx, input.staffIds);
      const witnessStaffIds = await assertActiveStaffUsers(tx, input.witnessStaffIds);
      const row = (await tx.incidentReport.create({
        data: {
          reportNumber: await reportNumber(tx, input.occurredAt),
          ...draft,
          recordedById: ctx.user.id,
          students: {
            createMany: {
              data: draftStudentLinks(studentIds),
            },
          },
          staff: {
            createMany: {
              data: draftStaffLinks(staffIds, witnessStaffIds),
            },
          },
        },
        include: incidentInclude,
      })) as IncidentReportRow;
      await logEvent(tx, ctx.user.id, row.id, 'DraftSaved');
      return row;
    });
    await ctx.db.auditLog.create({
      data: {
        userId: ctx.user.id,
        action: 'Create',
        entity: 'IncidentReport',
        entityId: created.id,
        meta: { source: 'incident.createDraft', reportNumber: created.reportNumber },
      },
    });
    return mapIncident(ctx, created);
  }),

  updateDraft: authedProcedure.input(incidentUpdateInput).mutation(async ({ ctx, input }) => {
    requireIncidentCreator(ctx.user);
    const draft = draftData(ctx, input);
    const updated = await ctx.withRls(async (tx) => {
      const report = await loadIncident(tx, input.reportId);
      assertOwnDraft(ctx.user, report, 'update');
      const studentIds = await assertActiveStudents(tx, input.studentIds);
      const staffIds = await assertActiveStaffUsers(tx, input.staffIds);
      const witnessStaffIds = await assertActiveStaffUsers(tx, input.witnessStaffIds);
      const row = (await tx.incidentReport.update({
        where: { id: input.reportId },
        data: {
          ...draft,
          students: {
            deleteMany: {},
            createMany: { data: draftStudentLinks(studentIds) },
          },
          staff: {
            deleteMany: {},
            createMany: { data: draftStaffLinks(staffIds, witnessStaffIds) },
          },
        },
        include: incidentInclude,
      })) as IncidentReportRow;
      await logEvent(tx, ctx.user.id, row.id, 'DraftSaved', { source: 'incident.updateDraft' });
      return row;
    });
    await ctx.db.auditLog.create({
      data: {
        userId: ctx.user.id,
        action: 'Update',
        entity: 'IncidentReport',
        entityId: updated.id,
        meta: { source: 'incident.updateDraft', reportNumber: updated.reportNumber },
      },
    });
    return mapIncident(ctx, updated);
  }),

  submitForHeadReview: authedProcedure.input(reportIdInput).mutation(async ({ ctx, input }) => {
    requireIncidentCreator(ctx.user);
    const updated = await ctx.withRls(async (tx) => {
      const report = await loadIncident(tx, input.reportId);
      assertOwnDraft(ctx.user, report, 'submit');
      assertIncidentTransition(report.status, 'submitForHeadReview');
      const row = (await tx.incidentReport.update({
        where: { id: input.reportId },
        data: { status: nextIncidentStatus(report.status, 'submitForHeadReview') },
        include: incidentInclude,
      })) as IncidentReportRow;
      await logEvent(tx, ctx.user.id, row.id, 'SubmittedForHeadReview');
      return row;
    });
    return mapIncident(ctx, updated);
  }),

  deleteDraft: authedProcedure.input(reportIdInput).mutation(async ({ ctx, input }) => {
    requireIncidentCreator(ctx.user);
    const deleted = await ctx.withRls(async (tx) => {
      const report = await loadIncident(tx, input.reportId);
      assertOwnDraft(ctx.user, report, 'delete');
      await tx.incidentReport.delete({ where: { id: input.reportId } });
      return { id: report.id, reportNumber: report.reportNumber };
    });
    await ctx.db.auditLog.create({
      data: {
        userId: ctx.user.id,
        action: 'Delete',
        entity: 'IncidentReport',
        entityId: deleted.id,
        meta: { source: 'incident.deleteDraft', reportNumber: deleted.reportNumber },
      },
    });
    return deleted;
  }),

  signOff: authedProcedure.input(reportIdInput).mutation(async ({ ctx, input }) => {
    requireIncidentSignOff(ctx.user);
    const signedOffAt = new Date();
    const updated = await ctx.withRls(async (tx) => {
      const report = await loadIncident(tx, input.reportId);
      assertIncidentTransition(report.status, 'signOff');
      const row = (await tx.incidentReport.update({
        where: { id: input.reportId },
        data: {
          status: nextIncidentStatus(report.status, 'signOff'),
          signedOffById: ctx.user.id,
          signedOffAt,
        },
        include: incidentInclude,
      })) as IncidentReportRow;
      await logEvent(tx, ctx.user.id, row.id, 'SignedOff');
      return row;
    });
    return mapIncident(ctx, updated);
  }),

  escalate: authedProcedure.input(reportIdInput).mutation(async ({ ctx, input }) => {
    requireIncidentEscalation(ctx.user);
    const escalatedAt = new Date();
    const updated = await ctx.withRls(async (tx) => {
      const report = await loadIncident(tx, input.reportId);
      assertIncidentTransition(report.status, 'escalate');
      const row = (await tx.incidentReport.update({
        where: { id: input.reportId },
        data: {
          status: nextIncidentStatus(report.status, 'escalate'),
          escalatedById: ctx.user.id,
          escalatedAt,
        },
        include: incidentInclude,
      })) as IncidentReportRow;
      await logEvent(tx, ctx.user.id, row.id, 'Escalated');
      return row;
    });
    return mapIncident(ctx, updated);
  }),

  generateParentCopy: authedProcedure.input(parentCopyInput).mutation(async ({ ctx, input }) => {
    requireParentCopyShare(ctx.user);
    const report = await ctx.withRls((tx) => loadIncident(tx, input.reportId));
    assertParentVisibilityOverride(ctx.user, report, input.overrideVisibility);
    if (!report.students?.some((link) => link.studentId === input.studentId)) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'student is not on this incident' });
    }
    const student = report.students.find((link) => link.studentId === input.studentId)?.student;
    if (!student) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'student is not available' });
    }
    const childName = decryptRequired(ctx.db.$enc.decrypt, student.fullNameEnc, 'student PII');
    const pdf = await generateIncidentParentPdf({
      reportNumber: report.reportNumber,
      childName,
      incidentType: INCIDENT_TYPE_LABELS[report.type as (typeof INCIDENT_TYPES)[number]],
      severity: INCIDENT_SEVERITY_LABELS[report.severity as (typeof INCIDENT_SEVERITIES)[number]],
      confidentiality:
        INCIDENT_CONFIDENTIALITY_LABELS[
          report.confidentiality as (typeof INCIDENT_CONFIDENTIALITIES)[number]
        ],
      occurredAt: report.occurredAt,
      location: decryptRequired(ctx.db.$enc.decrypt, report.locationEnc, 'incident location'),
      activity: decryptOptional(ctx.db.$enc.decrypt, report.activityEnc),
      offSite: report.offSite,
      factualAccount: decryptRequired(
        ctx.db.$enc.decrypt,
        report.factualAccountEnc,
        'incident account',
      ),
      immediateActions: decryptOptional(ctx.db.$enc.decrypt, report.immediateActionsEnc),
      injurySustained: report.injurySustained,
      bodyArea: decryptOptional(ctx.db.$enc.decrypt, report.bodyAreaEnc),
      firstAidGiven: report.firstAidGiven,
      firstAiderName: report.firstAider
        ? decryptRequired(ctx.db.$enc.decrypt, report.firstAider.fullNameEnc, 'first aider PII')
        : null,
      emergencyServicesContacted: report.emergencyServicesContacted,
      hospitalTreatment: report.hospitalTreatment,
      parentCarerNotified: report.parentCarerNotified,
      parentNotifiedAt: report.parentNotifiedAt,
      medicalNotes: decryptOptional(ctx.db.$enc.decrypt, report.medicalNotesEnc),
      parentSummary: input.parentSummary,
      signedOffBy: report.signedOffBy
        ? decryptRequired(ctx.db.$enc.decrypt, report.signedOffBy.fullNameEnc, 'sign-off PII')
        : null,
      signedOffAt: report.signedOffAt,
      sharingReason: input.sharingReason,
    });
    const now = new Date();
    const data = {
      status: 'Generated' as const,
      parentSummaryEnc: encryptRequired(ctx, input.parentSummary, 'parent summary'),
      redactionsEnc: encryptOptional(ctx, input.redactions),
      attachmentsIncludedEnc: encryptOptional(ctx, input.attachmentsIncluded),
      sharingReasonEnc: encryptRequired(ctx, input.sharingReason, 'sharing reason'),
      pdfBytesEnc: encryptRequired(ctx, pdf.pdfBase64, 'incident parent PDF'),
      pdfFileNameEnc: encryptRequired(ctx, pdf.fileName, 'incident parent PDF file name'),
      generatedById: ctx.user.id,
      generatedAt: now,
    };
    const copy = await ctx.withRls(async (tx) => {
      const existing = (await tx.incidentReportParentCopy.findUnique({
        where: { reportId_studentId: { reportId: input.reportId, studentId: input.studentId } },
      })) as IncidentParentCopyRow | null;
      const row = existing
        ? ((await tx.incidentReportParentCopy.update({
            where: { id: existing.id },
            data,
          })) as IncidentParentCopyRow)
        : ((await tx.incidentReportParentCopy.create({
            data: {
              reportId: input.reportId,
              studentId: input.studentId,
              ...data,
            },
          })) as IncidentParentCopyRow);
      await logEvent(tx, ctx.user.id, input.reportId, 'ParentCopyGenerated', {
        copyId: row.id,
        overrideVisibility: report.status !== 'SignedOff',
      });
      return row;
    });
    return mapParentCopySummary(ctx, copy);
  }),

  shareParentCopy: authedProcedure.input(shareParentCopyInput).mutation(async ({ ctx, input }) => {
    requireParentCopyShare(ctx.user);
    const copy = await ctx.withRls(
      async (tx) =>
        (await tx.incidentReportParentCopy.findUnique({
          where: { id: input.copyId },
        })) as IncidentParentCopyRow | null,
    );
    if (!copy) throw new TRPCError({ code: 'NOT_FOUND', message: 'parent copy not found' });
    if (copy.status !== 'Generated' || !copy.pdfBytesEnc) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'generate the parent PDF before sharing',
      });
    }
    const report = await ctx.withRls((tx) => loadIncident(tx, copy.reportId));
    assertParentVisibilityOverride(ctx.user, report, input.overrideVisibility);
    const guardianIds = await linkedGuardianIds(ctx, copy.studentId);
    if (guardianIds.length === 0) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'no linked guardians found' });
    }
    const sharedAt = new Date();
    const updated = await ctx.withRls(async (tx) => {
      const row = (await tx.incidentReportParentCopy.update({
        where: { id: input.copyId },
        data: { status: 'Shared', sharedById: ctx.user.id, sharedAt },
      })) as IncidentParentCopyRow;
      await tx.incidentReportParentRecipient.createMany({
        data: guardianIds.map((guardianId) => ({
          copyId: input.copyId,
          guardianId,
        })),
        skipDuplicates: true,
      });
      await logEvent(tx, ctx.user.id, copy.reportId, 'ParentCopyShared', {
        copyId: input.copyId,
        guardianCount: guardianIds.length,
        overrideVisibility: report.status !== 'SignedOff',
      });
      return row;
    });
    return mapParentCopySummary(ctx, updated);
  }),

  listParent: authedProcedure.query(async ({ ctx }) => {
    requireLinkedChildIncidentAccess(ctx.user);
    const recipients = await ctx.withRls(
      async (tx) =>
        (await tx.incidentReportParentRecipient.findMany({
          where: { guardianId: ctx.user.id },
          include: parentRecipientInclude,
          orderBy: { createdAt: 'desc' },
        })) as IncidentParentRecipientRow[],
    );
    return recipients
      .filter((recipient) => recipient.copy && incidentParentCopyIsVisible(recipient.copy.status))
      .map((recipient) => mapParentCopy(ctx, recipient));
  }),

  getParentCopy: authedProcedure.input(copyIdInput).query(async ({ ctx, input }) => {
    requireLinkedChildIncidentAccess(ctx.user);
    return mapParentCopy(ctx, await assertParentRecipient(ctx, input.copyId));
  }),

  acknowledgeParentCopy: authedProcedure.input(copyIdInput).mutation(async ({ ctx, input }) => {
    requireLinkedChildIncidentAccess(ctx.user);
    await assertParentRecipient(ctx, input.copyId);
    const acknowledgedAt = new Date();
    const recipient = await ctx.withRls(
      async (tx) =>
        (await tx.incidentReportParentRecipient.update({
          where: { copyId_guardianId: { copyId: input.copyId, guardianId: ctx.user.id } },
          data: { acknowledgedAt },
        })) as IncidentParentRecipientRow,
    );
    await ctx.db.auditLog.create({
      data: {
        userId: ctx.user.id,
        action: 'Update',
        entity: 'IncidentReportParentRecipient',
        entityId: input.copyId,
        meta: { source: 'incident.acknowledgeParentCopy' },
      },
    });
    return {
      copyId: recipient.copyId,
      guardianId: recipient.guardianId,
      acknowledgedAt: recipient.acknowledgedAt,
    };
  }),

  downloadParentPdf: authedProcedure.input(copyIdInput).query(async ({ ctx, input }) => {
    requireLinkedChildIncidentAccess(ctx.user);
    const recipient = await assertParentRecipient(ctx, input.copyId);
    const copy = recipient.copy;
    if (!copy?.pdfBytesEnc || !copy.pdfFileNameEnc) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'parent PDF is not available' });
    }
    await ctx.withRls((tx) =>
      tx.incidentReportParentRecipient.update({
        where: { copyId_guardianId: { copyId: input.copyId, guardianId: ctx.user.id } },
        data: { downloadedAt: new Date() },
      }),
    );
    return {
      fileName: decryptRequired(ctx.db.$enc.decrypt, copy.pdfFileNameEnc, 'PDF file name'),
      mimeType: 'application/pdf' as const,
      pdfBase64: decryptRequired(ctx.db.$enc.decrypt, copy.pdfBytesEnc, 'parent PDF'),
    };
  }),

  prepareAttachments: authedProcedure.input(prepareAttachmentsInput).query(({ ctx, input }) => {
    requireIncidentCreator(ctx.user);
    const bucket = process.env['SUPABASE_INCIDENT_ATTACHMENTS_BUCKET'] ?? 'incident-attachments';
    return {
      bucket,
      attachments: input.attachments.map((attachment) => ({
        ...attachment,
        storageBucket: bucket,
        storagePath: `incidents/${ctx.user.id}/${randomUUID()}-${safeStorageFileName(attachment.fileName)}`,
      })),
    };
  }),

  downloadAttachment: authedProcedure
    .input(z.object({ attachmentId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      requireIncidentCreator(ctx.user);
      const attachment = await ctx.withRls(
        async (tx) =>
          (await tx.incidentReportAttachment.findUnique({
            where: { id: input.attachmentId },
          })) as IncidentAttachmentRow | null,
      );
      if (!attachment) throw new TRPCError({ code: 'NOT_FOUND', message: 'attachment not found' });
      return {
        storageBucket: attachment.storageBucket,
        storagePath: decryptRequired(
          ctx.db.$enc.decrypt,
          attachment.storagePathEnc,
          'storage path',
        ),
        fileName: decryptRequired(
          ctx.db.$enc.decrypt,
          attachment.originalFileNameEnc,
          'attachment file name',
        ),
      };
    }),
});

function safeStorageFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/gu, '-').replace(/-+/gu, '-');
}
