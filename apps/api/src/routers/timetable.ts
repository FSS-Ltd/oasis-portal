import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import {
  REGISTRATION_LEVELS,
  TIMETABLE_COLOURS,
  TIMETABLE_DAYS,
  TIMETABLE_SLOT_KINDS,
  findScheduleIssues,
  type TimetableColour,
  type TimetableDay,
  type TimetableRegistrationLevel,
  type TimetableSlotInput,
} from '@oasis/domain';
import { Buffer } from 'node:buffer';
import type { AppContext } from '../context.js';
import { generateTimetablePdf } from '../reports/timetable-pdf.js';
import {
  createAndAssignTimetableSubject,
  loadHeadTimetableWorkspace,
  loadStudentTimetableDraft,
  saveStudentTimetableDraft,
  saveTimetableSchedule,
} from '../services/timetable-data.js';
import {
  findPublishedTimetableForHead,
  findPublishedTimetableForParent,
  findPublishedTimetableForStudent,
  publishStudentTimetable,
} from '../services/timetable-publications.js';
import {
  loadTeachingTerms,
  requireTeachingTerm,
  type TeachingTerm,
} from '../services/timetable-terms.js';
import { authedProcedure, roleProcedure, router } from '../trpc.js';

const termKeySchema = z.string().regex(/^\d{4}-\d{2}-term-[1-6]$/u, 'Choose a valid term');
const registrationLevelSchema = z.enum(REGISTRATION_LEVELS);
const slotSchema = z
  .object({
    id: z.string().trim().min(1).optional(),
    kind: z.enum(TIMETABLE_SLOT_KINDS),
    label: z.string().trim().min(1, 'Enter a slot label').max(50),
    startMinutes: z.number().int().min(0).max(1_439),
    endMinutes: z.number().int().min(1).max(1_440),
  })
  .strict();
const saveScheduleInput = z
  .object({
    termKey: termKeySchema,
    registrationLevel: registrationLevelSchema,
    slots: z.array(slotSchema).min(1, 'Add at least one timetable slot').max(16),
  })
  .strict()
  .superRefine((input, context) => {
    for (const issue of findScheduleIssues(input.slots)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          issue.message === 'Starts before the previous slot ends'
            ? 'Timetable slots overlap'
            : issue.message,
        path: ['slots', issue.position],
      });
    }
  });
const workspaceInput = z
  .object({ termKey: termKeySchema, registrationLevel: registrationLevelSchema })
  .strict();
const studentTermInput = z
  .object({ termKey: termKeySchema, studentId: z.string().trim().min(1) })
  .strict();
const saveDraftInput = studentTermInput
  .extend({
    entries: z
      .array(
        z
          .object({
            day: z.enum(TIMETABLE_DAYS),
            slotId: z.string().trim().min(1),
            subjectId: z.string().trim().min(1),
          })
          .strict(),
      )
      .max(64),
  })
  .strict();
const addSubjectInput = z
  .object({ studentId: z.string().trim().min(1), name: z.string().trim().min(1).max(100) })
  .strict();
const publishInput = studentTermInput
  .extend({ acknowledgeUnassigned: z.boolean().default(false) })
  .strict();
const publishedReaderInput = z
  .object({ studentId: z.string().trim().min(1), termKey: termKeySchema.optional() })
  .strict();
const studentPublishedInput = z.object({ termKey: termKeySchema.optional() }).strict();
const publicationInput = z.object({ publicationId: z.string().trim().min(1) }).strict();

export interface TimetableScheduleSlotView extends TimetableSlotInput {
  id: string;
  position: number;
}

export interface TimetableScheduleView {
  id: string;
  registrationLevel: TimetableRegistrationLevel;
  slots: TimetableScheduleSlotView[];
  termKey: string;
}

export interface TimetableChildSummary {
  firstName: string;
  fullName: string;
  id: string;
  latestPublicationId: string | null;
  registrationLevel: TimetableRegistrationLevel;
  status: 'Draft' | 'Published' | 'NotStarted';
}

export interface TimetableHeadWorkspace {
  children: TimetableChildSummary[];
  defaultSlots: readonly TimetableSlotInput[];
  progress: { done: number; total: number };
  registrationLevel: TimetableRegistrationLevel;
  schedule: TimetableScheduleView | null;
  term: TeachingTerm;
}

export interface TimetableSubjectView {
  code: string;
  colour: TimetableColour;
  id: string;
  name: string;
}

export interface StudentTimetableDraftView {
  entries: Array<{ day: TimetableDay; slotId: string; subjectId: string }>;
  latestPublication: { id: string; publishedAt: Date } | null;
  student: {
    firstName: string;
    fullName: string;
    id: string;
    registrationLevel: TimetableRegistrationLevel;
  };
  subjects: TimetableSubjectView[];
  timetableId: string | null;
}

export interface TimetablePublicationEntryView {
  day: TimetableDay;
  endMinutes: number;
  slotKind: 'Lesson' | 'Break';
  slotLabel: string;
  slotPosition: number;
  startMinutes: number;
  subjectColour: TimetableColour | null;
  subjectId: string | null;
  subjectName: string | null;
}

export interface TimetablePublicationView {
  entries: TimetablePublicationEntryView[];
  id: string;
  publishedAt: Date;
  registrationLevel: TimetableRegistrationLevel;
  studentFirstName: string;
  studentId: string;
  termEndsOn: Date;
  termKey: string;
  termLabel: string;
  termStartsOn: Date;
}

export interface TimetablePdfDownload {
  fileName: string;
  mimeType: 'application/pdf';
  pdfBase64: string;
}

type AuthedContext = AppContext & { user: NonNullable<AppContext['user']> };

export interface TimetableRouterDeps {
  createAndAssignSubject(
    ctx: AuthedContext,
    input: z.infer<typeof addSubjectInput>,
  ): Promise<TimetableSubjectView>;
  downloadPdf(
    ctx: AuthedContext,
    input: z.infer<typeof publicationInput>,
  ): Promise<TimetablePdfDownload>;
  loadHeadWorkspace(
    ctx: AuthedContext,
    input: z.infer<typeof workspaceInput>,
  ): Promise<TimetableHeadWorkspace>;
  loadStudentDraft(
    ctx: AuthedContext,
    input: z.infer<typeof studentTermInput>,
  ): Promise<StudentTimetableDraftView>;
  loadTeachingTerms(db: AppContext['db']): Promise<TeachingTerm[]>;
  publicationForHead(
    ctx: AuthedContext,
    input: z.infer<typeof publicationInput>,
  ): Promise<TimetablePublicationView | null>;
  publish(
    ctx: AuthedContext,
    input: z.infer<typeof publishInput>,
  ): Promise<{ publication: TimetablePublicationView; unassignedLessonCount: number }>;
  publishedForParent(
    ctx: AuthedContext,
    input: z.infer<typeof publishedReaderInput>,
  ): Promise<TimetablePublicationView | null>;
  publishedForStudent(
    ctx: AuthedContext,
    input: z.infer<typeof studentPublishedInput>,
  ): Promise<TimetablePublicationView | null>;
  requireTeachingTerm(db: AppContext['db'], termKey: string): Promise<TeachingTerm>;
  saveDraft(
    ctx: AuthedContext,
    input: z.infer<typeof saveDraftInput>,
  ): Promise<{
    entries: Array<{ day: TimetableDay; slotId: string; subjectId: string }>;
    timetableId: string;
    unassignedLessonCount: number;
  }>;
  saveSchedule(
    ctx: AuthedContext,
    input: z.infer<typeof saveScheduleInput>,
  ): Promise<TimetableScheduleView>;
}

const defaultTimetableRouterDeps: TimetableRouterDeps = {
  loadTeachingTerms: (db) => loadTeachingTerms(db),
  requireTeachingTerm: (db, termKey) => requireTeachingTerm(db, termKey),
  loadHeadWorkspace: loadHeadTimetableWorkspace,
  loadStudentDraft: loadStudentTimetableDraft,
  saveSchedule: saveTimetableSchedule,
  saveDraft: saveStudentTimetableDraft,
  createAndAssignSubject: createAndAssignTimetableSubject,
  publish: publishStudentTimetable,
  publishedForParent: findPublishedTimetableForParent,
  publishedForStudent: findPublishedTimetableForStudent,
  publicationForHead: findPublishedTimetableForHead,
  downloadPdf: async (ctx, input) => {
    const publication = await findPublishedTimetableForHead(ctx, input);
    if (!publication) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Published timetable not found' });
    }
    const pdf = await generateTimetablePdf(publication);
    return {
      pdfBase64: Buffer.from(pdf.bytes).toString('base64'),
      fileName: pdf.fileName,
      mimeType: pdf.mimeType,
    };
  },
};

export function createTimetableRouter(deps: TimetableRouterDeps = defaultTimetableRouterDeps) {
  return router({
    terms: authedProcedure.query(({ ctx }) => deps.loadTeachingTerms(ctx.db)),

    headWorkspace: roleProcedure('Head')
      .input(workspaceInput)
      .query(({ ctx, input }) => deps.loadHeadWorkspace(ctx, input)),

    studentDraft: roleProcedure('Head')
      .input(studentTermInput)
      .query(({ ctx, input }) => deps.loadStudentDraft(ctx, input)),

    saveSchedule: roleProcedure('Head')
      .input(saveScheduleInput)
      .mutation(async ({ ctx, input }) => {
        await deps.requireTeachingTerm(ctx.db, input.termKey);
        return deps.saveSchedule(ctx, input);
      }),

    saveDraft: roleProcedure('Head')
      .input(saveDraftInput)
      .mutation(({ ctx, input }) => deps.saveDraft(ctx, input)),

    createAndAssignSubject: roleProcedure('Head')
      .input(addSubjectInput)
      .mutation(({ ctx, input }) => deps.createAndAssignSubject(ctx, input)),

    publish: roleProcedure('Head')
      .input(publishInput)
      .mutation(({ ctx, input }) => deps.publish(ctx, input)),

    publishedForParent: authedProcedure
      .input(publishedReaderInput)
      .query(({ ctx, input }) => deps.publishedForParent(ctx, input)),

    publishedForStudent: roleProcedure('Student')
      .input(studentPublishedInput)
      .query(({ ctx, input }) => deps.publishedForStudent(ctx, input)),

    publicationForHead: roleProcedure('Head')
      .input(publicationInput)
      .query(async ({ ctx, input }) => {
        const publication = await deps.publicationForHead(ctx, input);
        if (!publication) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Published timetable not found' });
        }
        return publication;
      }),

    downloadPdf: roleProcedure('Head')
      .input(publicationInput)
      .query(({ ctx, input }) => deps.downloadPdf(ctx, input)),
  });
}

export const timetableRouter = createTimetableRouter();
export const timetableColourSchema = z.enum(TIMETABLE_COLOURS);
