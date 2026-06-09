import { randomUUID } from 'node:crypto';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import {
  isFullAdmin,
  rowsForMerit,
  schoolYearStorageAliases,
  type SessionUser,
} from '@oasis/domain';
import type { AppContext, RlsTx } from '../context.js';
import { assertStudentPortalAccess } from '../lib/student-portal-access.js';
import {
  assertUploadedHomeworkSubmissionImages,
  homeworkSubmissionBucket,
  type UploadedHomeworkSubmissionImage,
} from '../services/homework-submission-storage.js';
import { createStudentNotifications } from '../services/student-notifications.js';
import { authedProcedure, fullAdminProcedure, roleProcedure, router } from '../trpc.js';

type AuthedContext = AppContext & { user: SessionUser };
type HomeworkSubmissionMethod = 'UploadImage' | 'InPerson';

interface HomeworkBandRow {
  yearGroupBand: {
    id: string;
    name: string;
    standardYears: string[];
    colour: string;
    active: boolean;
    sortOrder?: number;
  };
}

interface HomeworkImageRow {
  id: string;
  originalFileNameEnc: string;
  mimeType: string;
  sizeBytes: number;
  storageBucket: string;
  storagePathEnc: string;
  createdAt: Date;
}

interface HomeworkSubmissionRow {
  id: string;
  assignmentId: string;
  studentId: string;
  submittedAt: Date | null;
  reviewedAt: Date | null;
  reviewedById: string | null;
  scorePercent: number | null;
  commentsEnc: string | null;
  meritAmount: number;
  behaviourEntryId: string | null;
  createdAt: Date;
  updatedAt: Date;
  images?: HomeworkImageRow[];
  student?: {
    id: string;
    active: boolean;
    fullNameEnc: string;
    yearGroup: string;
  };
}

interface HomeworkAssignmentRow {
  id: string;
  title: string;
  descriptionEnc: string;
  dueDate: Date;
  submissionMethod: HomeworkSubmissionMethod;
  allYearGroupBands: boolean;
  active: boolean;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
  bands?: HomeworkBandRow[];
  submissions?: HomeworkSubmissionRow[];
}

interface ActiveStudentRow {
  id: string;
  userId: string | null;
  fullNameEnc: string;
  yearGroup: string;
  active: boolean;
  createdAt?: Date;
}

const MAX_HOMEWORK_IMAGE_BYTES = 10 * 1024 * 1024;
const HOMEWORK_IMAGE_EXTENSIONS = ['.jpeg', '.jpg', '.png', '.webp'] as const;
type HomeworkImageExtension = (typeof HOMEWORK_IMAGE_EXTENSIONS)[number];

const homeworkImageMimeByExtension: Record<HomeworkImageExtension, string> = {
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

const submissionMethodSchema = z.enum(['UploadImage', 'InPerson']);
const homeworkImageMetadataInput = z.object({
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().min(1).max(120),
  sizeBytes: z.number().int().positive(),
});
const homeworkImageInput = homeworkImageMetadataInput.extend({
  storageBucket: z.string().trim().min(1).max(120),
  storagePath: z.string().trim().min(1).max(512),
});
const createAssignmentInput = z
  .object({
    allYearGroupBands: z.boolean(),
    description: z.string().trim().min(1).max(5000),
    dueDate: z.coerce.date(),
    submissionMethod: submissionMethodSchema,
    title: z.string().trim().min(1).max(160),
    yearGroupBandIds: z.array(z.string().min(1)).max(50).default([]),
  })
  .refine((input) => input.allYearGroupBands || input.yearGroupBandIds.length > 0, {
    message: 'Select at least one year group band, or assign to all bands.',
    path: ['yearGroupBandIds'],
  });
const prepareUploadInput = z.object({
  assignmentId: z.string().min(1),
  files: z.array(homeworkImageMetadataInput).min(1).max(1),
  studentId: z.string().min(1).optional(),
});
const submitUploadInput = z.object({
  assignmentId: z.string().min(1),
  image: homeworkImageInput,
});
const reviewSubmissionInput = z.object({
  assignmentId: z.string().min(1),
  comments: z.string().trim().max(5000).optional(),
  image: homeworkImageInput.optional(),
  meritAmount: z.number().int().min(0).max(500).default(0),
  scorePercent: z.number().int().min(0).max(100),
  studentId: z.string().min(1),
});
const imageIdInput = z.object({ imageId: z.string().min(1) });

function decryptRequired(
  decrypt: (value: string | null | undefined) => string | null,
  value: string | null | undefined,
  label: string,
): string {
  const decrypted = decrypt(value);
  if (!decrypted) {
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `${label} decrypt failed` });
  }
  return decrypted;
}

function safeOriginalFileName(value: string): string {
  const fileName = value.replaceAll('\\', '/').split('/').pop()?.replace(/\0/gu, '').trim();
  return fileName?.replace(/^\.+/u, '').trim() || 'homework-image';
}

function homeworkImageExtension(fileName: string): HomeworkImageExtension | null {
  const lowerName = fileName.toLowerCase();
  return HOMEWORK_IMAGE_EXTENSIONS.find((candidate) => lowerName.endsWith(candidate)) ?? null;
}

function safeStorageFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/gu, '-').replace(/-+/gu, '-');
}

function storagePathForHomeworkImage(
  userId: string,
  studentId: string,
  assignmentId: string,
  fileName: string,
): string {
  return `homework/${userId}/${studentId}/${assignmentId}/${randomUUID()}-${safeStorageFileName(
    fileName,
  )}`;
}

function validateHomeworkImageMetadata(
  input: z.infer<typeof homeworkImageMetadataInput>,
): Pick<UploadedHomeworkSubmissionImage, 'fileName' | 'mimeType' | 'sizeBytes'> {
  const fileName = safeOriginalFileName(input.fileName);
  const extension = homeworkImageExtension(fileName);
  if (!extension) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'unsupported homework image type' });
  }

  const mimeType = input.mimeType.toLowerCase();
  if (mimeType !== homeworkImageMimeByExtension[extension]) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'homework image type mismatch' });
  }
  if (input.sizeBytes > MAX_HOMEWORK_IMAGE_BYTES) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'homework image is too large' });
  }

  return { fileName, mimeType, sizeBytes: input.sizeBytes };
}

function assertHomeworkStorageTarget(
  input: Pick<UploadedHomeworkSubmissionImage, 'storageBucket' | 'storagePath'>,
  userId: string,
  studentId: string,
  assignmentId: string,
): void {
  if (input.storageBucket !== homeworkSubmissionBucket()) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'invalid homework image bucket' });
  }
  const expectedPrefix = `homework/${userId}/${studentId}/${assignmentId}/`;
  if (
    !input.storagePath.startsWith(expectedPrefix) ||
    input.storagePath.includes('..') ||
    input.storagePath.startsWith('/') ||
    input.storagePath.endsWith('/')
  ) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'invalid homework image path' });
  }
}

function prepareHomeworkImage(
  input: z.infer<typeof homeworkImageMetadataInput>,
  userId: string,
  studentId: string,
  assignmentId: string,
): UploadedHomeworkSubmissionImage {
  const metadata = validateHomeworkImageMetadata(input);
  return {
    ...metadata,
    storageBucket: homeworkSubmissionBucket(),
    storagePath: storagePathForHomeworkImage(userId, studentId, assignmentId, metadata.fileName),
  };
}

function validateUploadedHomeworkImage(
  input: z.infer<typeof homeworkImageInput>,
  userId: string,
  studentId: string,
  assignmentId: string,
): UploadedHomeworkSubmissionImage {
  const metadata = validateHomeworkImageMetadata(input);
  const image = {
    ...metadata,
    storageBucket: input.storageBucket,
    storagePath: input.storagePath,
  };
  assertHomeworkStorageTarget(image, userId, studentId, assignmentId);
  return image;
}

function yearAliases(yearGroup: string): string[] {
  return schoolYearStorageAliases(yearGroup);
}

function studentMatchesAssignment(
  student: ActiveStudentRow,
  assignment: HomeworkAssignmentRow,
): boolean {
  if (!assignment.active || !student.active) return false;
  if (assignment.allYearGroupBands) return true;
  const aliases = yearAliases(student.yearGroup);
  return (assignment.bands ?? []).some((band) =>
    band.yearGroupBand.standardYears.some((year) => aliases.includes(year)),
  );
}

function mapBand(row: HomeworkBandRow) {
  return {
    id: row.yearGroupBand.id,
    name: row.yearGroupBand.name,
    standardYears: row.yearGroupBand.standardYears,
    colour: row.yearGroupBand.colour,
  };
}

function mapImage(ctx: Pick<AppContext, 'db'>, image: HomeworkImageRow) {
  return {
    id: image.id,
    fileName: decryptRequired(
      ctx.db.$enc.decrypt,
      image.originalFileNameEnc,
      'homework image name',
    ),
    mimeType: image.mimeType,
    sizeBytes: image.sizeBytes,
    createdAt: image.createdAt,
  };
}

function mapAssignment(
  ctx: Pick<AppContext, 'db'>,
  assignment: HomeworkAssignmentRow,
  submission?: HomeworkSubmissionRow | null,
) {
  return {
    id: assignment.id,
    title: assignment.title,
    description: decryptRequired(
      ctx.db.$enc.decrypt,
      assignment.descriptionEnc,
      'homework description',
    ),
    dueDate: assignment.dueDate,
    submissionMethod: assignment.submissionMethod,
    allYearGroupBands: assignment.allYearGroupBands,
    active: assignment.active,
    bands: (assignment.bands ?? []).map(mapBand),
    submittedAt: submission?.submittedAt ?? null,
    reviewedAt: submission?.reviewedAt ?? null,
    scorePercent: submission?.scorePercent ?? null,
    comments: submission?.commentsEnc
      ? decryptRequired(ctx.db.$enc.decrypt, submission.commentsEnc, 'homework comments')
      : null,
    meritAmount: submission?.meritAmount ?? 0,
    images: (submission?.images ?? []).map((image) => mapImage(ctx, image)),
  };
}

function studentName(ctx: Pick<AppContext, 'db'>, student: Pick<ActiveStudentRow, 'fullNameEnc'>) {
  return decryptRequired(ctx.db.$enc.decrypt, student.fullNameEnc, 'student name');
}

async function loadOwnActiveStudent(ctx: AuthedContext): Promise<ActiveStudentRow> {
  const student = await ctx.db.student.findUnique({
    where: { userId: ctx.user.id },
    select: { id: true, userId: true, fullNameEnc: true, yearGroup: true, active: true },
  });
  if (!student?.active) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'student profile not found' });
  }
  return student;
}

async function loadActiveStudent(ctx: AuthedContext, studentId: string): Promise<ActiveStudentRow> {
  const student = (await ctx.db.student.findUnique({
    where: { id: studentId },
    select: {
      id: true,
      userId: true,
      fullNameEnc: true,
      yearGroup: true,
      active: true,
      createdAt: true,
    },
  })) as ActiveStudentRow | null;
  if (!student?.active) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'student not found' });
  }
  return student;
}

async function loadAssignment(
  ctx: AuthedContext,
  assignmentId: string,
): Promise<HomeworkAssignmentRow> {
  const assignment = (await ctx.db.homeworkAssignment.findUnique({
    where: { id: assignmentId },
    include: {
      bands: { include: { yearGroupBand: true } },
      submissions: { include: { images: true } },
    },
  })) as HomeworkAssignmentRow | null;
  if (!assignment?.active) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'homework assignment not found' });
  }
  return assignment;
}

function assertStudentAssigned(student: ActiveStudentRow, assignment: HomeworkAssignmentRow): void {
  if (!studentMatchesAssignment(student, assignment)) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'homework assignment not found' });
  }
}

async function listActiveAssignments(ctx: AuthedContext): Promise<HomeworkAssignmentRow[]> {
  return await ctx.db.homeworkAssignment.findMany({
    where: { active: true },
    include: {
      bands: { include: { yearGroupBand: true } },
      submissions: { include: { images: true } },
    },
    orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
  });
}

async function maybeCreateHomeworkMerit(
  ctx: AuthedContext,
  tx: RlsTx,
  input: {
    amount: number;
    assignment: HomeworkAssignmentRow;
    existing: HomeworkSubmissionRow | null;
    studentId: string;
  },
): Promise<string | null> {
  if (input.existing?.behaviourEntryId) {
    if (input.amount !== input.existing.meritAmount) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'homework merits cannot be changed after they are awarded',
      });
    }
    return input.existing.behaviourEntryId;
  }
  if (input.amount === 0) return null;

  const behaviour = await tx.behaviourEntry.create({
    data: {
      studentId: input.studentId,
      type: 'Merit',
      category: 'Homework',
      noteEnc: ctx.db.$enc.encrypt(`Homework: ${input.assignment.title}`),
      visibility: 'General',
      meritDelta: input.amount,
      recordedById: ctx.user.id,
    },
    select: { id: true },
  });

  await tx.meritLedger.createMany({
    data: rowsForMerit({
      studentId: input.studentId,
      amount: input.amount,
      reason: `Homework: ${input.assignment.title}`,
      behaviourEntryId: behaviour.id,
    }),
  });

  await createStudentNotifications(ctx, tx, {
    auditSource: 'homework.reviewSubmission.studentNotification',
    notifications: [
      {
        studentId: input.studentId,
        kind: 'MeritAward',
        title: 'Merits awarded',
        body: `You received ${String(input.amount)} merits for homework.`,
        sourceEntity: 'BehaviourEntry',
        sourceId: behaviour.id,
        createdById: ctx.user.id,
      },
    ],
  });

  return behaviour.id;
}

export const homeworkRouter = router({
  createAssignment: fullAdminProcedure
    .input(createAssignmentInput)
    .mutation(async ({ ctx, input }) => {
      const bandIds = [...new Set(input.yearGroupBandIds)];
      if (!input.allYearGroupBands) {
        const bands = await ctx.db.yearGroupBand.findMany({
          where: { id: { in: bandIds }, active: true },
          select: { id: true },
        });
        if (bands.length !== bandIds.length) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'invalid year group band selected' });
        }
      }

      const assignment = (await ctx.withRls((tx) =>
        tx.homeworkAssignment.create({
          data: {
            title: input.title,
            descriptionEnc: ctx.db.$enc.encrypt(input.description),
            dueDate: input.dueDate,
            submissionMethod: input.submissionMethod,
            allYearGroupBands: input.allYearGroupBands,
            createdById: ctx.user.id,
            ...(input.allYearGroupBands
              ? {}
              : {
                  bands: {
                    create: bandIds.map((yearGroupBandId) => ({ yearGroupBandId })),
                  },
                }),
          },
          include: { bands: { include: { yearGroupBand: true } }, submissions: true },
        }),
      )) as HomeworkAssignmentRow;

      await ctx.db.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: 'Create',
          entity: 'HomeworkAssignment',
          entityId: assignment.id,
          meta: {
            source: 'homework.createAssignment',
            allYearGroupBands: input.allYearGroupBands,
            yearGroupBandIds: input.allYearGroupBands ? [] : bandIds,
          },
        },
      });

      return mapAssignment(ctx, assignment);
    }),

  adminAssignments: fullAdminProcedure.query(async ({ ctx }) => {
    const assignments = await listActiveAssignments(ctx);
    return assignments.map((assignment) => mapAssignment(ctx, assignment));
  }),

  reviewQueue: fullAdminProcedure.query(async ({ ctx }) => {
    const [assignments, students] = await Promise.all([
      listActiveAssignments(ctx),
      ctx.db.student.findMany({
        where: { active: true },
        select: {
          id: true,
          userId: true,
          fullNameEnc: true,
          yearGroup: true,
          active: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'asc' },
      }) as Promise<ActiveStudentRow[]>,
    ]);

    return assignments.flatMap((assignment) =>
      students
        .filter((student) => studentMatchesAssignment(student, assignment))
        .map((student) => {
          const submission =
            assignment.submissions?.find((item) => item.studentId === student.id) ?? null;
          return {
            assignment: mapAssignment(ctx, assignment, submission),
            assignmentId: assignment.id,
            dueDate: assignment.dueDate,
            reviewStatus: submission?.reviewedAt
              ? 'Reviewed'
              : submission?.submittedAt
                ? 'Submitted'
                : 'Awaiting',
            student: {
              id: student.id,
              fullName: studentName(ctx, student),
              yearGroup: student.yearGroup,
            },
            submissionId: submission?.id ?? null,
            submittedAt: submission?.submittedAt ?? null,
            reviewedAt: submission?.reviewedAt ?? null,
            scorePercent: submission?.scorePercent ?? null,
            meritAmount: submission?.meritAmount ?? 0,
          };
        }),
    );
  }),

  studentDue: roleProcedure('Student').query(async ({ ctx }) => {
    const student = await loadOwnActiveStudent(ctx);
    await assertStudentPortalAccess(ctx, { entity: 'homework.studentDue', studentId: student.id });
    const assignments = await ctx.withRls(() => listActiveAssignments(ctx));
    return assignments
      .filter((assignment) => studentMatchesAssignment(student, assignment))
      .map((assignment) => {
        const submission =
          assignment.submissions?.find((item) => item.studentId === student.id) ?? null;
        return { assignment, submission };
      })
      .filter(
        ({ submission }) => submission?.reviewedAt === undefined || submission.reviewedAt === null,
      )
      .map(({ assignment, submission }) => mapAssignment(ctx, assignment, submission));
  }),

  studentGraded: roleProcedure('Student').query(async ({ ctx }) => {
    const student = await loadOwnActiveStudent(ctx);
    await assertStudentPortalAccess(ctx, {
      entity: 'homework.studentGraded',
      studentId: student.id,
    });
    const rows = (await ctx.withRls((tx) =>
      tx.homeworkSubmission.findMany({
        where: { studentId: student.id, reviewedAt: { not: null } },
        include: {
          assignment: { include: { bands: { include: { yearGroupBand: true } } } },
          images: true,
        },
        orderBy: { reviewedAt: 'desc' },
      }),
    )) as Array<HomeworkSubmissionRow & { assignment: HomeworkAssignmentRow }>;

    return rows
      .filter((row) => row.assignment.active)
      .map((row) => mapAssignment(ctx, row.assignment, row));
  }),

  prepareUpload: authedProcedure.input(prepareUploadInput).mutation(async ({ ctx, input }) => {
    const assignment = await loadAssignment(ctx, input.assignmentId);
    const student = isFullAdmin(ctx.user)
      ? await loadActiveStudent(ctx, input.studentId ?? '')
      : await loadOwnActiveStudent(ctx);

    assertStudentAssigned(student, assignment);
    if (!isFullAdmin(ctx.user) && assignment.submissionMethod !== 'UploadImage') {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'homework must be handed in person' });
    }

    const images = input.files.map((file) =>
      prepareHomeworkImage(file, ctx.user.id, student.id, assignment.id),
    );

    return { bucket: homeworkSubmissionBucket(), images };
  }),

  submitUpload: roleProcedure('Student')
    .input(submitUploadInput)
    .mutation(async ({ ctx, input }) => {
      const student = await loadOwnActiveStudent(ctx);
      await assertStudentPortalAccess(ctx, {
        entity: 'homework.submitUpload',
        studentId: student.id,
      });
      const assignment = await loadAssignment(ctx, input.assignmentId);
      assertStudentAssigned(student, assignment);
      if (assignment.submissionMethod !== 'UploadImage') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'homework must be handed in person' });
      }

      const image = validateUploadedHomeworkImage(
        input.image,
        ctx.user.id,
        student.id,
        assignment.id,
      );
      await assertUploadedHomeworkSubmissionImages([image]);

      const submission = await ctx.withRls(async (tx) => {
        const now = new Date();
        const row = (await tx.homeworkSubmission.upsert({
          where: { assignmentId_studentId: { assignmentId: assignment.id, studentId: student.id } },
          create: {
            assignmentId: assignment.id,
            studentId: student.id,
            submittedAt: now,
          },
          update: { submittedAt: now },
          include: { images: true },
        })) as HomeworkSubmissionRow;
        await tx.homeworkSubmissionImage.create({
          data: {
            submissionId: row.id,
            uploadedById: ctx.user.id,
            originalFileNameEnc: ctx.db.$enc.encrypt(image.fileName),
            mimeType: image.mimeType,
            sizeBytes: image.sizeBytes,
            storageBucket: image.storageBucket,
            storagePathEnc: ctx.db.$enc.encrypt(image.storagePath),
          },
        });
        await tx.auditLog.create({
          data: {
            userId: ctx.user.id,
            action: 'Create',
            entity: 'HomeworkSubmission',
            entityId: row.id,
            meta: { source: 'homework.submitUpload', assignmentId: assignment.id },
          },
        });
        return row;
      });

      return mapAssignment(ctx, assignment, { ...submission, images: [] });
    }),

  reviewSubmission: fullAdminProcedure
    .input(reviewSubmissionInput)
    .mutation(async ({ ctx, input }) => {
      const assignment = await loadAssignment(ctx, input.assignmentId);
      const student = await loadActiveStudent(ctx, input.studentId);
      assertStudentAssigned(student, assignment);
      const image = input.image
        ? validateUploadedHomeworkImage(input.image, ctx.user.id, student.id, assignment.id)
        : null;
      if (image) await assertUploadedHomeworkSubmissionImages([image]);

      const reviewed = await ctx.withRls(async (tx) => {
        const existing = (await tx.homeworkSubmission.findFirst({
          where: { assignmentId: assignment.id, studentId: student.id },
          include: { images: true },
        })) as HomeworkSubmissionRow | null;
        const behaviourEntryId = await maybeCreateHomeworkMerit(ctx, tx, {
          amount: input.meritAmount,
          assignment,
          existing,
          studentId: student.id,
        });
        const now = new Date();
        const row = (await tx.homeworkSubmission.upsert({
          where: { assignmentId_studentId: { assignmentId: assignment.id, studentId: student.id } },
          create: {
            assignmentId: assignment.id,
            studentId: student.id,
            submittedAt: now,
            reviewedAt: now,
            reviewedById: ctx.user.id,
            scorePercent: input.scorePercent,
            commentsEnc: input.comments ? ctx.db.$enc.encrypt(input.comments) : null,
            meritAmount: input.meritAmount,
            behaviourEntryId,
          },
          update: {
            submittedAt: existing?.submittedAt ?? now,
            reviewedAt: now,
            reviewedById: ctx.user.id,
            scorePercent: input.scorePercent,
            commentsEnc: input.comments ? ctx.db.$enc.encrypt(input.comments) : null,
            meritAmount: input.meritAmount,
            behaviourEntryId,
          },
          include: { images: true },
        })) as HomeworkSubmissionRow;
        if (image) {
          await tx.homeworkSubmissionImage.create({
            data: {
              submissionId: row.id,
              uploadedById: ctx.user.id,
              originalFileNameEnc: ctx.db.$enc.encrypt(image.fileName),
              mimeType: image.mimeType,
              sizeBytes: image.sizeBytes,
              storageBucket: image.storageBucket,
              storagePathEnc: ctx.db.$enc.encrypt(image.storagePath),
            },
          });
        }
        await tx.auditLog.create({
          data: {
            userId: ctx.user.id,
            action: 'Update',
            entity: 'HomeworkSubmission',
            entityId: row.id,
            meta: {
              source: 'homework.reviewSubmission',
              assignmentId: assignment.id,
              studentId: student.id,
              scorePercent: input.scorePercent,
              meritAmount: input.meritAmount,
            },
          },
        });
        return row;
      });

      return {
        ...mapAssignment(ctx, assignment, reviewed),
        assignmentId: assignment.id,
        behaviourEntryId: reviewed.behaviourEntryId,
        studentId: student.id,
      };
    }),

  downloadImage: authedProcedure.input(imageIdInput).query(async ({ ctx, input }) => {
    const image = (await ctx.withRls((tx) =>
      tx.homeworkSubmissionImage.findFirst({
        where: { id: input.imageId },
        include: {
          submission: {
            include: {
              assignment: { include: { bands: { include: { yearGroupBand: true } } } },
              student: true,
            },
          },
        },
      }),
    )) as
      | (HomeworkImageRow & {
          submission: HomeworkSubmissionRow & {
            assignment: HomeworkAssignmentRow;
            student: ActiveStudentRow;
          };
        })
      | null;
    if (!image) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'homework image not found' });
    }

    if (!isFullAdmin(ctx.user)) {
      if (ctx.user.role !== 'Student' || image.submission.student.userId !== ctx.user.id) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'homework image not found' });
      }
    }

    await ctx.db.auditLog.create({
      data: {
        userId: ctx.user.id,
        action: 'ReadSensitive',
        entity: 'HomeworkSubmissionImage',
        entityId: image.id,
        meta: {
          source: 'homework.downloadImage',
          assignmentId: image.submission.assignmentId,
          studentId: image.submission.studentId,
        },
      },
    });

    return {
      imageId: image.id,
      fileName: decryptRequired(
        ctx.db.$enc.decrypt,
        image.originalFileNameEnc,
        'homework image name',
      ),
      mimeType: image.mimeType,
      sizeBytes: image.sizeBytes,
      storageBucket: image.storageBucket,
      storagePath: decryptRequired(
        ctx.db.$enc.decrypt,
        image.storagePathEnc,
        'homework image path',
      ),
    };
  }),
});
