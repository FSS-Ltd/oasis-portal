import { describe, expect, it, vi } from 'vitest';
import type { SessionUser } from '@oasis/domain';
import { makeTestContext } from './helpers/test-context.js';
import { homeworkRouter } from '../routers/homework.js';
import { router } from '../trpc.js';

vi.mock('../services/homework-submission-storage.js', () => ({
  homeworkSubmissionBucket: () => 'homework-submissions',
  assertUploadedHomeworkSubmissionImages: vi.fn().mockResolvedValue(undefined),
}));

const headUser: SessionUser = { id: 'u_head', role: 'Head', tags: [], requires2fa: false };
const primaryStudentUser: SessionUser = {
  id: 'u_student_primary',
  role: 'Student',
  tags: [],
  requires2fa: false,
};
const secondaryStudentUser: SessionUser = {
  id: 'u_student_secondary',
  role: 'Student',
  tags: [],
  requires2fa: false,
};

const primaryStudentId = 'ckhomeworkstudentprimary01';
const secondaryStudentId = 'ckhomeworkstudentsecondary';
const lowerBandId = 'ckhomeworkbandlower00001';
const secondaryBandId = 'ckhomeworkbandsecondary';

type SubmissionMethod = 'UploadImage' | 'InPerson';

interface StoredStudent {
  id: string;
  userId: string | null;
  fullNameEnc: string;
  yearGroup: string;
  active: boolean;
  createdAt: Date;
}

interface StoredYearGroupBand {
  id: string;
  name: string;
  standardYears: string[];
  colour: string;
  active: boolean;
  sortOrder: number;
}

interface StoredHomeworkAssignmentImage {
  id: string;
  assignmentId: string;
  uploadedById: string;
  originalFileNameEnc: string;
  mimeType: string;
  sizeBytes: number;
  storageBucket: string;
  storagePathEnc: string;
  createdAt: Date;
}

interface StoredHomeworkAssignment {
  id: string;
  title: string;
  descriptionEnc: string;
  dueDate: Date;
  submissionMethod: SubmissionMethod;
  allYearGroupBands: boolean;
  active: boolean;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
  bands: Array<{ yearGroupBand: StoredYearGroupBand }>;
  submissions: StoredHomeworkSubmission[];
  questionImages: StoredHomeworkAssignmentImage[];
}

interface StoredHomeworkSubmission {
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
  assignment?: StoredHomeworkAssignment;
  student?: StoredStudent;
  images?: StoredHomeworkSubmissionImage[];
}

interface StoredHomeworkSubmissionImage {
  id: string;
  submissionId: string;
  uploadedById: string;
  originalFileNameEnc: string;
  mimeType: string;
  sizeBytes: number;
  storageBucket: string;
  storagePathEnc: string;
  createdAt: Date;
}

interface FakeDb {
  $enc: {
    decrypt: ReturnType<typeof vi.fn>;
    encrypt: ReturnType<typeof vi.fn>;
  };
  auditLog: { create: ReturnType<typeof vi.fn> };
  behaviourEntry: { create: ReturnType<typeof vi.fn> };
  homeworkAssignment: {
    create: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  homeworkAssignmentBand: { deleteMany: ReturnType<typeof vi.fn> };
  homeworkAssignmentImage: {
    create: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
  };
  homeworkSubmission: {
    findFirst: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    upsert: ReturnType<typeof vi.fn>;
  };
  homeworkSubmissionImage: {
    create: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
  };
  meritLedger: { createMany: ReturnType<typeof vi.fn> };
  student: {
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
  };
  studentNotification: { createMany: ReturnType<typeof vi.fn> };
  studentPortalSettings: { findUnique: ReturnType<typeof vi.fn> };
  studentPortalUsageMinute: { count: ReturnType<typeof vi.fn> };
  yearGroupBand: { findMany: ReturnType<typeof vi.fn> };
  assignments: StoredHomeworkAssignment[];
  assignmentImages: StoredHomeworkAssignmentImage[];
  behaviourEntries: Array<{ id: string; studentId: string; meritDelta: number }>;
  images: StoredHomeworkSubmissionImage[];
  ledgerRows: Array<{ studentId: string; account: string; delta: number; reason: string }>;
  notifications: Array<{ studentId: string; title: string; sourceEntity: string | null }>;
  submissions: StoredHomeworkSubmission[];
}

function encrypt(value: string): string {
  return `enc:${value}`;
}

function decrypt(value: string | null | undefined): string | null {
  return value?.replace(/^enc:/u, '') ?? null;
}

function withAssignmentIncludes(
  assignment: StoredHomeworkAssignment,
  submissions: StoredHomeworkSubmission[],
  images: StoredHomeworkSubmissionImage[],
  assignmentImages: StoredHomeworkAssignmentImage[] = [],
): StoredHomeworkAssignment {
  return {
    ...assignment,
    questionImages: assignmentImages.filter((img) => img.assignmentId === assignment.id),
    submissions: submissions
      .filter((submission) => submission.assignmentId === assignment.id)
      .map((submission) => ({
        ...submission,
        assignment,
        images: images.filter((image) => image.submissionId === submission.id),
      })),
  };
}

function makeAssignment(input: {
  allYearGroupBands: boolean;
  bandIds?: string[];
  createdById?: string;
  description?: string;
  dueDate?: Date;
  id: string;
  method?: SubmissionMethod;
  title: string;
}): StoredHomeworkAssignment {
  const bands = defaultBands
    .filter((band) => input.bandIds?.includes(band.id))
    .map((yearGroupBand) => ({ yearGroupBand }));
  return {
    id: input.id,
    title: input.title,
    descriptionEnc: encrypt(input.description ?? 'Complete the assigned work.'),
    dueDate: input.dueDate ?? new Date('2026-06-20T00:00:00.000Z'),
    submissionMethod: input.method ?? 'UploadImage',
    allYearGroupBands: input.allYearGroupBands,
    active: true,
    createdById: input.createdById ?? headUser.id,
    createdAt: new Date('2026-06-01T09:00:00.000Z'),
    updatedAt: new Date('2026-06-01T09:00:00.000Z'),
    bands,
    submissions: [],
    questionImages: [],
  };
}

const defaultStudents: StoredStudent[] = [
  {
    id: primaryStudentId,
    userId: primaryStudentUser.id,
    fullNameEnc: encrypt('Primary Student'),
    yearGroup: 'Year 6',
    active: true,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  },
  {
    id: secondaryStudentId,
    userId: secondaryStudentUser.id,
    fullNameEnc: encrypt('Secondary Student'),
    yearGroup: 'Year 8',
    active: true,
    createdAt: new Date('2026-01-02T00:00:00.000Z'),
  },
];

const defaultBands: StoredYearGroupBand[] = [
  {
    id: lowerBandId,
    name: 'Lower',
    standardYears: ['Year 5', 'Year 6'],
    colour: '#5B90C5',
    active: true,
    sortOrder: 1,
  },
  {
    id: secondaryBandId,
    name: 'Secondary',
    standardYears: ['Year 7', 'Year 8'],
    colour: '#7D1C2C',
    active: true,
    sortOrder: 2,
  },
];

function makeSubmission(input: {
  assignmentId: string;
  id: string;
  reviewed?: boolean;
  scorePercent?: number;
  studentId: string;
}): StoredHomeworkSubmission {
  return {
    id: input.id,
    assignmentId: input.assignmentId,
    studentId: input.studentId,
    submittedAt: new Date('2026-06-10T10:00:00.000Z'),
    reviewedAt: input.reviewed ? new Date('2026-06-11T10:00:00.000Z') : null,
    reviewedById: input.reviewed ? headUser.id : null,
    scorePercent: input.scorePercent ?? null,
    commentsEnc: input.reviewed ? encrypt('Good work.') : null,
    meritAmount: 0,
    behaviourEntryId: null,
    createdAt: new Date('2026-06-10T10:00:00.000Z'),
    updatedAt: new Date('2026-06-10T10:00:00.000Z'),
  };
}

function makeFakeDb(input?: {
  assignments?: StoredHomeworkAssignment[];
  assignmentImages?: StoredHomeworkAssignmentImage[];
  images?: StoredHomeworkSubmissionImage[];
  submissions?: StoredHomeworkSubmission[];
}): FakeDb {
  const assignments = input?.assignments ?? [];
  const submissions = input?.submissions ?? [];
  const images = input?.images ?? [];
  const assignmentImages: StoredHomeworkAssignmentImage[] = input?.assignmentImages ?? [];
  const behaviourEntries: FakeDb['behaviourEntries'] = [];
  const ledgerRows: FakeDb['ledgerRows'] = [];
  const notifications: FakeDb['notifications'] = [];

  const db = {
    $enc: { encrypt: vi.fn(encrypt), decrypt: vi.fn(decrypt) },
    auditLog: { create: vi.fn().mockResolvedValue(undefined) },
    behaviourEntry: {
      create: vi.fn(({ data }: { data: { meritDelta: number; studentId: string } }) => {
        const entry = {
          id: `behaviour_${String(behaviourEntries.length + 1)}`,
          studentId: data.studentId,
          meritDelta: data.meritDelta,
        };
        behaviourEntries.push(entry);
        return Promise.resolve({ id: entry.id });
      }),
    },
    homeworkAssignment: {
      create: vi.fn(
        ({
          data,
        }: {
          data: {
            allYearGroupBands: boolean;
            bands?: { create: Array<{ yearGroupBandId: string }> };
            createdById: string;
            descriptionEnc: string;
            dueDate: Date;
            submissionMethod: SubmissionMethod;
            title: string;
          };
        }) => {
          const assignment = makeAssignment({
            allYearGroupBands: data.allYearGroupBands,
            createdById: data.createdById,
            description: decrypt(data.descriptionEnc) ?? '',
            dueDate: data.dueDate,
            id: `homework_${String(assignments.length + 1)}`,
            method: data.submissionMethod,
            title: data.title,
            ...(data.bands
              ? { bandIds: data.bands.create.map((band) => band.yearGroupBandId) }
              : {}),
          });
          assignments.push(assignment);
          return Promise.resolve(withAssignmentIncludes(assignment, submissions, images));
        },
      ),
      findFirst: vi.fn(({ where }: { where: { id: string } }) =>
        Promise.resolve(assignments.find((assignment) => assignment.id === where.id) ?? null),
      ),
      findMany: vi.fn(({ where }: { where?: { active?: boolean } } = {}) =>
        Promise.resolve(
          assignments
            .filter(
              (assignment) => where?.active === undefined || assignment.active === where.active,
            )
            .map((assignment) =>
              withAssignmentIncludes(assignment, submissions, images, assignmentImages),
            ),
        ),
      ),
      findUnique: vi.fn(({ where }: { where: { id: string } }) =>
        Promise.resolve(
          (() => {
            const assignment = assignments.find((item) => item.id === where.id);
            return assignment
              ? withAssignmentIncludes(assignment, submissions, images, assignmentImages)
              : null;
          })(),
        ),
      ),
      update: vi.fn(
        ({
          data,
          where,
        }: {
          data: {
            allYearGroupBands: boolean;
            bands?: { create: Array<{ yearGroupBandId: string }> };
            descriptionEnc: string;
            dueDate: Date;
            submissionMethod: SubmissionMethod;
            title: string;
          };
          where: { id: string };
        }) => {
          const assignment = assignments.find((item) => item.id === where.id);
          if (!assignment) return Promise.resolve(null);
          Object.assign(assignment, {
            title: data.title,
            descriptionEnc: data.descriptionEnc,
            dueDate: data.dueDate,
            submissionMethod: data.submissionMethod,
            allYearGroupBands: data.allYearGroupBands,
            bands: data.bands
              ? (() => {
                  const bands = data.bands;
                  return defaultBands
                    .filter((band) => bands.create.map((b) => b.yearGroupBandId).includes(band.id))
                    .map((yearGroupBand) => ({ yearGroupBand }));
                })()
              : assignment.bands,
            updatedAt: new Date(),
          });
          return Promise.resolve(
            withAssignmentIncludes(assignment, submissions, images, assignmentImages),
          );
        },
      ),
    },
    homeworkAssignmentBand: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    homeworkAssignmentImage: {
      create: vi.fn(
        ({
          data,
        }: {
          data: {
            assignmentId: string;
            uploadedById: string;
            originalFileNameEnc: string;
            mimeType: string;
            sizeBytes: number;
            storageBucket: string;
            storagePathEnc: string;
          };
        }) => {
          const img: StoredHomeworkAssignmentImage = {
            id: `assignment_image_${String(assignmentImages.length + 1)}`,
            assignmentId: data.assignmentId,
            uploadedById: data.uploadedById,
            originalFileNameEnc: data.originalFileNameEnc,
            mimeType: data.mimeType,
            sizeBytes: data.sizeBytes,
            storageBucket: data.storageBucket,
            storagePathEnc: data.storagePathEnc,
            createdAt: new Date('2026-06-12T10:00:00.000Z'),
          };
          assignmentImages.push(img);
          return Promise.resolve(img);
        },
      ),
      findFirst: vi.fn(({ where }: { where: { id: string } }) => {
        const img = assignmentImages.find((item) => item.id === where.id);
        const assignment = img
          ? assignments.find((item) => item.id === img.assignmentId)
          : undefined;
        return Promise.resolve(
          img && assignment
            ? {
                ...img,
                assignment: withAssignmentIncludes(
                  assignment,
                  submissions,
                  images,
                  assignmentImages,
                ),
              }
            : null,
        );
      }),
    },
    homeworkSubmission: {
      findFirst: vi.fn(
        ({
          where,
        }: {
          where: {
            assignmentId_studentId?: { assignmentId: string; studentId: string };
            id?: string;
          };
        }) => {
          const submission = where.assignmentId_studentId
            ? submissions.find(
                (item) =>
                  item.assignmentId === where.assignmentId_studentId?.assignmentId &&
                  item.studentId === where.assignmentId_studentId.studentId,
              )
            : submissions.find((item) => item.id === where.id);
          return Promise.resolve(
            submission
              ? {
                  ...submission,
                  assignment: assignments.find(
                    (assignment) => assignment.id === submission.assignmentId,
                  ),
                  student: defaultStudents.find((student) => student.id === submission.studentId),
                  images: images.filter((image) => image.submissionId === submission.id),
                }
              : null,
          );
        },
      ),
      findMany: vi.fn(() =>
        Promise.resolve(
          submissions.map((submission) => {
            const assignment = assignments.find((a) => a.id === submission.assignmentId);
            return {
              ...submission,
              assignment: assignment
                ? withAssignmentIncludes(assignment, submissions, images, assignmentImages)
                : undefined,
              student: defaultStudents.find((student) => student.id === submission.studentId),
              images: images.filter((image) => image.submissionId === submission.id),
            };
          }),
        ),
      ),
      upsert: vi.fn(
        ({
          create,
          update,
          where,
        }: {
          create: Partial<StoredHomeworkSubmission> & { assignmentId: string; studentId: string };
          update: Partial<StoredHomeworkSubmission>;
          where: { assignmentId_studentId: { assignmentId: string; studentId: string } };
        }) => {
          let submission = submissions.find(
            (item) =>
              item.assignmentId === where.assignmentId_studentId.assignmentId &&
              item.studentId === where.assignmentId_studentId.studentId,
          );
          if (!submission) {
            submission = makeSubmission({
              assignmentId: create.assignmentId,
              id: `submission_${String(submissions.length + 1)}`,
              studentId: create.studentId,
            });
            submission.submittedAt = create.submittedAt ?? null;
            submissions.push(submission);
          }
          Object.assign(submission, update, { updatedAt: new Date('2026-06-12T10:00:00.000Z') });
          return Promise.resolve({
            ...submission,
            assignment: assignments.find((assignment) => assignment.id === submission.assignmentId),
            student: defaultStudents.find((student) => student.id === submission.studentId),
            images: images.filter((image) => image.submissionId === submission.id),
          });
        },
      ),
    },
    homeworkSubmissionImage: {
      create: vi.fn(
        ({
          data,
        }: {
          data: {
            submissionId: string;
            uploadedById: string;
            originalFileNameEnc: string;
            mimeType: string;
            sizeBytes: number;
            storageBucket: string;
            storagePathEnc: string;
          };
        }) => {
          const image: StoredHomeworkSubmissionImage = {
            id: `image_${String(images.length + 1)}`,
            submissionId: data.submissionId,
            uploadedById: data.uploadedById,
            originalFileNameEnc: data.originalFileNameEnc,
            mimeType: data.mimeType,
            sizeBytes: data.sizeBytes,
            storageBucket: data.storageBucket,
            storagePathEnc: data.storagePathEnc,
            createdAt: new Date('2026-06-12T10:00:00.000Z'),
          };
          images.push(image);
          return Promise.resolve(image);
        },
      ),
      findFirst: vi.fn(({ where }: { where: { id: string } }) => {
        const image = images.find((item) => item.id === where.id);
        const submission = image
          ? submissions.find((item) => item.id === image.submissionId)
          : undefined;
        return Promise.resolve(
          image && submission
            ? {
                ...image,
                submission: {
                  ...submission,
                  assignment: assignments.find(
                    (assignment) => assignment.id === submission.assignmentId,
                  ),
                  student: defaultStudents.find((student) => student.id === submission.studentId),
                },
              }
            : null,
        );
      }),
    },
    meritLedger: {
      createMany: vi.fn(({ data }: { data: FakeDb['ledgerRows'] }) => {
        ledgerRows.push(...data);
        return Promise.resolve({ count: data.length });
      }),
    },
    student: {
      findMany: vi.fn(({ where }: { where?: { active?: boolean } } = {}) =>
        Promise.resolve(
          defaultStudents.filter(
            (student) => where?.active === undefined || student.active === where.active,
          ),
        ),
      ),
      findUnique: vi.fn(({ where }: { where: { id?: string; userId?: string } }) =>
        Promise.resolve(
          defaultStudents.find(
            (student) =>
              (where.id !== undefined && student.id === where.id) ||
              (where.userId !== undefined && student.userId === where.userId),
          ) ?? null,
        ),
      ),
    },
    studentNotification: {
      createMany: vi.fn(
        ({
          data,
        }: {
          data: Array<{ sourceEntity: string | null; studentId: string; title: string }>;
        }) => {
          notifications.push(...data);
          return Promise.resolve({ count: data.length });
        },
      ),
    },
    studentPortalSettings: { findUnique: vi.fn().mockResolvedValue(null) },
    studentPortalUsageMinute: { count: vi.fn().mockResolvedValue(0) },
    yearGroupBand: {
      findMany: vi.fn(({ where }: { where?: { id?: { in: string[] }; active?: boolean } } = {}) =>
        Promise.resolve(
          defaultBands.filter(
            (band) =>
              (where?.active === undefined || band.active === where.active) &&
              (where?.id?.in === undefined || where.id.in.includes(band.id)),
          ),
        ),
      ),
    },
    assignments,
    assignmentImages,
    behaviourEntries,
    images,
    ledgerRows,
    notifications,
    submissions,
  } satisfies FakeDb;

  return db;
}

function makeCaller(user: SessionUser | null, db = makeFakeDb()) {
  const appRouter = router({ homework: homeworkRouter });
  return appRouter.createCaller(
    makeTestContext({ db, requestId: 'req_homework_test', rls: { kind: 'db', db }, user }),
  );
}

describe('homework router', () => {
  it('lets heads create all-band and selected-band assignments', async () => {
    const db = makeFakeDb();
    const caller = makeCaller(headUser, db);

    await expect(
      caller.homework.createAssignment({
        allYearGroupBands: true,
        description: 'Read chapter one.',
        dueDate: new Date('2026-06-20T00:00:00.000Z'),
        submissionMethod: 'UploadImage',
        title: 'Reading',
        yearGroupBandIds: [],
      }),
    ).resolves.toMatchObject({ allYearGroupBands: true, title: 'Reading' });

    await expect(
      caller.homework.createAssignment({
        allYearGroupBands: false,
        description: 'Complete maths worksheet.',
        dueDate: new Date('2026-06-21T00:00:00.000Z'),
        submissionMethod: 'InPerson',
        title: 'Maths',
        yearGroupBandIds: [lowerBandId],
      }),
    ).resolves.toMatchObject({
      allYearGroupBands: false,
      bands: [{ id: lowerBandId, name: 'Lower' }],
      submissionMethod: 'InPerson',
    });
  });

  it('only lists due assignments matching the signed-in student year group bands', async () => {
    const allAssignment = makeAssignment({
      allYearGroupBands: true,
      id: 'homework_all',
      title: 'All students',
    });
    const lowerAssignment = makeAssignment({
      allYearGroupBands: false,
      bandIds: [lowerBandId],
      id: 'homework_lower',
      title: 'Lower band',
    });
    const secondaryAssignment = makeAssignment({
      allYearGroupBands: false,
      bandIds: [secondaryBandId],
      id: 'homework_secondary',
      title: 'Secondary band',
    });
    const db = makeFakeDb({
      assignments: [allAssignment, lowerAssignment, secondaryAssignment],
    });

    const due = await makeCaller(primaryStudentUser, db).homework.studentDue();

    expect(due.map((assignment) => assignment.id)).toEqual(['homework_all', 'homework_lower']);
    expect(due.every((assignment) => assignment.reviewedAt === null)).toBe(true);
  });

  it('rejects student image submission for in-person homework', async () => {
    const db = makeFakeDb({
      assignments: [
        makeAssignment({
          allYearGroupBands: true,
          id: 'homework_in_person',
          method: 'InPerson',
          title: 'Hand in book',
        }),
      ],
    });

    await expect(
      makeCaller(primaryStudentUser, db).homework.submitUpload({
        assignmentId: 'homework_in_person',
        image: {
          fileName: 'page.png',
          mimeType: 'image/png',
          sizeBytes: 12,
          storageBucket: 'homework-submissions',
          storagePath:
            'homework/u_student_primary/ckhomeworkstudentprimary01/homework_in_person/page.png',
        },
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('reviews homework, records a behaviour merit, and credits spend merits', async () => {
    const assignment = makeAssignment({
      allYearGroupBands: true,
      id: 'homework_upload',
      title: 'Bible copywork',
    });
    const db = makeFakeDb({ assignments: [assignment] });

    const reviewed = await makeCaller(headUser, db).homework.reviewSubmission({
      assignmentId: assignment.id,
      comments: 'Careful handwriting.',
      meritAmount: 5,
      scorePercent: 92,
      studentId: primaryStudentId,
    });

    expect(reviewed).toMatchObject({
      assignmentId: assignment.id,
      behaviourEntryId: 'behaviour_1',
      meritAmount: 5,
      scorePercent: 92,
      studentId: primaryStudentId,
    });
    expect(db.behaviourEntries).toEqual([
      { id: 'behaviour_1', studentId: primaryStudentId, meritDelta: 5 },
    ]);
    expect(db.ledgerRows).toEqual([
      {
        account: 'Spend',
        delta: 5,
        reason: 'Homework: Bible copywork',
        relatedEntryId: 'behaviour_1',
        studentId: primaryStudentId,
      },
    ]);
    expect(db.notifications).toMatchObject([
      {
        sourceEntity: 'BehaviourEntry',
        studentId: primaryStudentId,
        title: 'Merits awarded',
      },
    ]);
  });

  it('lets heads update an assignment title, description, and due date', async () => {
    const assignment = makeAssignment({
      allYearGroupBands: true,
      id: 'homework_update',
      title: 'Original title',
    });
    const db = makeFakeDb({ assignments: [assignment] });

    const updated = await makeCaller(headUser, db).homework.updateAssignment({
      id: assignment.id,
      allYearGroupBands: true,
      description: 'Updated description.',
      dueDate: new Date('2026-07-01T00:00:00.000Z'),
      submissionMethod: 'InPerson',
      title: 'Updated title',
      yearGroupBandIds: [],
    });

    expect(updated).toMatchObject({
      id: assignment.id,
      title: 'Updated title',
      description: 'Updated description.',
      submissionMethod: 'InPerson',
    });
    expect(db.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          action: 'Update',
          entity: 'HomeworkAssignment',
          entityId: assignment.id,
          userId: headUser.id,
          meta: expect.anything() as unknown,
        },
      }),
    );
    expect(db.homeworkAssignmentBand.deleteMany).toHaveBeenCalledWith({
      where: { assignmentId: assignment.id },
    });
  });

  it('rejects updateAssignment for an unknown or inactive assignment', async () => {
    const db = makeFakeDb();
    await expect(
      makeCaller(headUser, db).homework.updateAssignment({
        id: 'nonexistent',
        allYearGroupBands: true,
        description: 'Whatever.',
        dueDate: new Date('2026-07-01T00:00:00.000Z'),
        submissionMethod: 'UploadImage',
        title: 'Whatever',
        yearGroupBandIds: [],
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('lets heads prepare an assignment image upload', async () => {
    const assignment = makeAssignment({
      allYearGroupBands: true,
      id: 'homework_with_image',
      title: 'Science project',
    });
    const db = makeFakeDb({ assignments: [assignment] });

    const result = await makeCaller(headUser, db).homework.prepareAssignmentImageUpload({
      assignmentId: assignment.id,
      files: [{ fileName: 'questions.png', mimeType: 'image/png', sizeBytes: 512 }],
    });

    expect(result.bucket).toBe('homework-submissions');
    const firstImage = result.images[0];
    expect(firstImage).toMatchObject({
      fileName: 'questions.png',
      mimeType: 'image/png',
      sizeBytes: 512,
    });
    expect(firstImage?.storagePath).toMatch(
      /^assignment-questions\/u_head\/homework_with_image\//u,
    );
  });

  it('rejects prepareAssignmentImageUpload for students', async () => {
    const assignment = makeAssignment({
      allYearGroupBands: true,
      id: 'homework_upload_guard',
      title: 'Guard test',
    });
    const db = makeFakeDb({ assignments: [assignment] });

    await expect(
      makeCaller(primaryStudentUser, db).homework.prepareAssignmentImageUpload({
        assignmentId: assignment.id,
        files: [{ fileName: 'test.png', mimeType: 'image/png', sizeBytes: 100 }],
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('lets heads attach an assignment image and records an audit log', async () => {
    const assignment = makeAssignment({
      allYearGroupBands: true,
      id: 'homework_attach',
      title: 'Geography',
    });
    const db = makeFakeDb({ assignments: [assignment] });

    const result = await makeCaller(headUser, db).homework.attachAssignmentImage({
      assignmentId: assignment.id,
      image: {
        fileName: 'map.png',
        mimeType: 'image/png',
        sizeBytes: 1024,
        storageBucket: 'homework-submissions',
        storagePath: `assignment-questions/u_head/${assignment.id}/uuid-map.png`,
      },
    });

    expect(result).toMatchObject({ id: 'assignment_image_1' });
    expect(db.assignmentImages).toHaveLength(1);
    expect(db.assignmentImages[0]).toMatchObject({
      assignmentId: assignment.id,
      mimeType: 'image/png',
    });
    expect(db.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          action: 'Create',
          entity: 'HomeworkAssignmentImage',
          userId: headUser.id,
          entityId: 'assignment_image_1',
          meta: expect.anything() as unknown,
        },
      }),
    );
  });

  it('rejects attachAssignmentImage with wrong storage path', async () => {
    const assignment = makeAssignment({
      allYearGroupBands: true,
      id: 'homework_attach_bad',
      title: 'Art',
    });
    const db = makeFakeDb({ assignments: [assignment] });

    await expect(
      makeCaller(headUser, db).homework.attachAssignmentImage({
        assignmentId: assignment.id,
        image: {
          fileName: 'drawing.png',
          mimeType: 'image/png',
          sizeBytes: 500,
          storageBucket: 'homework-submissions',
          storagePath: `homework/u_head/${assignment.id}/uuid-drawing.png`,
        },
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('lets admins download any assignment image and denies other students', async () => {
    const allBandAssignment = makeAssignment({
      allYearGroupBands: true,
      id: 'homework_img_dl',
      title: 'Download test',
    });
    const lowerBandAssignment = makeAssignment({
      allYearGroupBands: false,
      bandIds: [lowerBandId],
      id: 'homework_img_lower',
      title: 'Lower band only',
    });
    const allBandImg: StoredHomeworkAssignmentImage = {
      id: 'assignment_image_all',
      assignmentId: allBandAssignment.id,
      uploadedById: headUser.id,
      originalFileNameEnc: encrypt('question.png'),
      mimeType: 'image/png',
      sizeBytes: 256,
      storageBucket: 'homework-submissions',
      storagePathEnc: encrypt(
        `assignment-questions/u_head/${allBandAssignment.id}/uuid-question.png`,
      ),
      createdAt: new Date('2026-06-12T10:00:00.000Z'),
    };
    const lowerBandImg: StoredHomeworkAssignmentImage = {
      id: 'assignment_image_lower',
      assignmentId: lowerBandAssignment.id,
      uploadedById: headUser.id,
      originalFileNameEnc: encrypt('lower-question.png'),
      mimeType: 'image/png',
      sizeBytes: 512,
      storageBucket: 'homework-submissions',
      storagePathEnc: encrypt(
        `assignment-questions/u_head/${lowerBandAssignment.id}/uuid-lower.png`,
      ),
      createdAt: new Date('2026-06-12T10:00:00.000Z'),
    };
    const db = makeFakeDb({
      assignments: [allBandAssignment, lowerBandAssignment],
      assignmentImages: [allBandImg, lowerBandImg],
    });

    await expect(
      makeCaller(headUser, db).homework.downloadAssignmentImage({ imageId: allBandImg.id }),
    ).resolves.toMatchObject({ fileName: 'question.png', storageBucket: 'homework-submissions' });

    await expect(
      makeCaller(primaryStudentUser, db).homework.downloadAssignmentImage({
        imageId: allBandImg.id,
      }),
    ).resolves.toMatchObject({ fileName: 'question.png' });

    await expect(
      makeCaller(secondaryStudentUser, db).homework.downloadAssignmentImage({
        imageId: lowerBandImg.id,
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });

    await expect(
      makeCaller(primaryStudentUser, db).homework.downloadAssignmentImage({
        imageId: lowerBandImg.id,
      }),
    ).resolves.toMatchObject({ fileName: 'lower-question.png' });
  });

  it('denies homework image download metadata to another student', async () => {
    const assignment = makeAssignment({
      allYearGroupBands: true,
      id: 'homework_upload',
      title: 'Science drawing',
    });
    const submission = makeSubmission({
      assignmentId: assignment.id,
      id: 'submission_primary',
      studentId: primaryStudentId,
    });
    const image: StoredHomeworkSubmissionImage = {
      id: 'image_primary',
      submissionId: submission.id,
      uploadedById: primaryStudentUser.id,
      originalFileNameEnc: encrypt('science.png'),
      mimeType: 'image/png',
      sizeBytes: 12,
      storageBucket: 'homework-submissions',
      storagePathEnc: encrypt(
        'homework/u_student_primary/ckhomeworkstudentprimary01/homework_upload/science.png',
      ),
      createdAt: new Date('2026-06-10T10:00:00.000Z'),
    };
    const db = makeFakeDb({
      assignments: [assignment],
      images: [image],
      submissions: [submission],
    });

    await expect(
      makeCaller(secondaryStudentUser, db).homework.downloadImage({ imageId: image.id }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });

    await expect(
      makeCaller(primaryStudentUser, db).homework.downloadImage({ imageId: image.id }),
    ).resolves.toMatchObject({
      fileName: 'science.png',
      storageBucket: 'homework-submissions',
    });
  });
});
