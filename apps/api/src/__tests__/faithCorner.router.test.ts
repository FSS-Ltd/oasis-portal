import { describe, expect, it, vi } from 'vitest';
import type { SessionUser } from '@oasis/domain';
import type { AppContext, RlsTx } from '../context.js';
import { faithCornerRouter } from '../routers/faithCorner.js';
import { router } from '../trpc.js';

const headUser: SessionUser = {
  id: 'faithhead0000000000001',
  role: 'Head',
  tags: [],
  requires2fa: false,
};

const parentUser: SessionUser = {
  id: 'faithparent00000000001',
  role: 'Parent',
  tags: [],
  requires2fa: false,
};

const studentUser: SessionUser = {
  id: 'faithstudentuser000001',
  role: 'Student',
  tags: [],
  requires2fa: false,
};

const otherStudentUser: SessionUser = {
  id: 'faithotherstudentuser1',
  role: 'Student',
  tags: [],
  requires2fa: false,
};

const studentId = 'faithstudent0000000001';
const otherStudentId = 'faithstudent0000000002';

type StoredFaithCornerCommentStatus = 'Pending' | 'Approved' | 'Rejected';

interface StoredFaithCornerContent {
  id: string;
  weeklyTheme: string;
  memoryVerseReference: string;
  memoryVerseTextEnc: string;
  reflectionPromptEnc: string;
  verseOfDayReference: string | null;
  verseOfDayTextEnc: string | null;
  active: boolean;
  publishedAt: Date;
  createdById: string;
  updatedById: string | null;
  createdAt: Date;
}

interface StoredFaithCornerContentLike {
  contentId: string;
  studentId: string;
  createdAt: Date;
}

interface StoredFaithCornerComment {
  id: string;
  contentId: string;
  studentId: string;
  bodyEnc: string;
  status: StoredFaithCornerCommentStatus;
  reviewedById: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface StoredFaithCornerCommentLike {
  commentId: string;
  studentId: string;
  createdAt: Date;
}

interface FakeDb {
  $enc: {
    encrypt: ReturnType<typeof vi.fn>;
    decrypt: ReturnType<typeof vi.fn>;
  };
  $transaction: ReturnType<typeof vi.fn>;
  auditLog: { create: ReturnType<typeof vi.fn> };
  faithCornerContent: {
    create: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
  };
  faithCornerContentLike: {
    count: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
  };
  faithCornerComment: {
    count: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  faithCornerCommentLike: {
    count: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
  };
  student: { findUnique: ReturnType<typeof vi.fn> };
  studentPortalSettings: { findUnique: ReturnType<typeof vi.fn> };
  studentPortalUsageMinute: { count: ReturnType<typeof vi.fn> };
  content: StoredFaithCornerContent[];
  contentLikes: StoredFaithCornerContentLike[];
  comments: StoredFaithCornerComment[];
  commentLikes: StoredFaithCornerCommentLike[];
}

interface FakeFaithCornerCreateArgs {
  data: {
    weeklyTheme: string;
    memoryVerseReference: string;
    memoryVerseTextEnc: string;
    reflectionPromptEnc: string;
    verseOfDayReference: string | null;
    verseOfDayTextEnc: string | null;
    active: boolean;
    publishedAt: Date;
    createdById: string;
    updatedById: string | null;
  };
}

interface FakeFaithCornerUpdateManyArgs {
  data: {
    active: boolean;
    updatedById: string;
  };
}

interface FakeStudentFindUniqueArgs {
  where: { userId?: string };
}

interface FakeContentLikeWhere {
  contentId_studentId: { contentId: string; studentId: string };
}

interface FakeCommentLikeWhere {
  commentId_studentId: { commentId: string; studentId: string };
}

interface FakeAuditCreateArgs {
  data: {
    userId: string | null;
    action: string;
    entity: string;
    entityId?: string | null;
    meta?: Record<string, unknown>;
  };
}

function encrypt(value: string): string {
  return `enc:${value}`;
}

function decrypt(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.replace(/^enc:/u, '');
}

function makeContent(
  input: Partial<StoredFaithCornerContent> &
    Pick<StoredFaithCornerContent, 'id' | 'weeklyTheme'>,
): StoredFaithCornerContent {
  return {
    memoryVerseReference: 'John 3:16',
    memoryVerseTextEnc: encrypt('For God so loved the world.'),
    reflectionPromptEnc: encrypt('Where can you show love today?'),
    verseOfDayReference: null,
    verseOfDayTextEnc: null,
    active: true,
    publishedAt: new Date('2026-06-04T09:00:00.000Z'),
    createdById: headUser.id,
    updatedById: headUser.id,
    createdAt: new Date('2026-06-04T09:00:00.000Z'),
    ...input,
  };
}

function selectedContent(row: StoredFaithCornerContent) {
  return {
    id: row.id,
    weeklyTheme: row.weeklyTheme,
    memoryVerseReference: row.memoryVerseReference,
    memoryVerseTextEnc: row.memoryVerseTextEnc,
    reflectionPromptEnc: row.reflectionPromptEnc,
    verseOfDayReference: row.verseOfDayReference,
    verseOfDayTextEnc: row.verseOfDayTextEnc,
    publishedAt: row.publishedAt,
  };
}

function studentName(student: string): string {
  return student === otherStudentId ? 'Grace Learner' : 'Faith Student';
}

function makeComment(
  input: Partial<StoredFaithCornerComment> &
    Pick<StoredFaithCornerComment, 'contentId' | 'id' | 'studentId'>,
): StoredFaithCornerComment {
  return {
    bodyEnc: encrypt('This helped me trust God today.'),
    status: 'Pending',
    reviewedById: null,
    reviewedAt: null,
    createdAt: new Date('2026-06-04T10:00:00.000Z'),
    updatedAt: new Date('2026-06-04T10:00:00.000Z'),
    ...input,
  };
}

function selectedComment(
  row: StoredFaithCornerComment,
  content: StoredFaithCornerContent[],
  commentLikes: StoredFaithCornerCommentLike[],
) {
  return {
    id: row.id,
    bodyEnc: row.bodyEnc,
    status: row.status,
    studentId: row.studentId,
    createdAt: row.createdAt,
    reviewedAt: row.reviewedAt,
    student: { fullNameEnc: encrypt(studentName(row.studentId)) },
    content: {
      weeklyTheme:
        content.find((candidate) => candidate.id === row.contentId)?.weeklyTheme ?? 'Faith Corner',
    },
    _count: {
      likes: commentLikes.filter((like) => like.commentId === row.id).length,
    },
  };
}

function makeFakeDb(
  content: StoredFaithCornerContent[] = [],
  comments: StoredFaithCornerComment[] = [],
): FakeDb {
  const contentLikes: StoredFaithCornerContentLike[] = [];
  const commentLikes: StoredFaithCornerCommentLike[] = [];
  const db = {
    $enc: {
      encrypt: vi.fn(encrypt),
      decrypt: vi.fn(decrypt),
    },
    $transaction: vi.fn(),
    auditLog: {
      create: vi.fn().mockResolvedValue(undefined),
    },
    faithCornerContent: {
      create: vi.fn(({ data }: FakeFaithCornerCreateArgs) => {
        const row = makeContent({
          id: `faithcontent${String(content.length + 1).padStart(6, '0')}`,
          weeklyTheme: data.weeklyTheme,
          memoryVerseReference: data.memoryVerseReference,
          memoryVerseTextEnc: data.memoryVerseTextEnc,
          reflectionPromptEnc: data.reflectionPromptEnc,
          verseOfDayReference: data.verseOfDayReference,
          verseOfDayTextEnc: data.verseOfDayTextEnc,
          active: data.active,
          publishedAt: data.publishedAt,
          createdById: data.createdById,
          updatedById: data.updatedById,
        });
        content.push(row);
        return Promise.resolve(selectedContent(row));
      }),
      findFirst: vi.fn(() => {
        const row =
          [...content]
            .filter((candidate) => candidate.active)
            .sort(
              (left, right) =>
                right.publishedAt.getTime() - left.publishedAt.getTime() ||
                right.createdAt.getTime() - left.createdAt.getTime(),
            )[0] ?? null;
        return Promise.resolve(row ? selectedContent(row) : null);
      }),
      updateMany: vi.fn(({ data }: FakeFaithCornerUpdateManyArgs) => {
        let count = 0;
        for (const row of content) {
          if (!row.active) continue;
          row.active = data.active;
          row.updatedById = data.updatedById;
          count += 1;
        }
        return Promise.resolve({ count });
      }),
    },
    faithCornerContentLike: {
      count: vi.fn(({ where }: { where: { contentId: string } }) =>
        Promise.resolve(contentLikes.filter((like) => like.contentId === where.contentId).length),
      ),
      create: vi.fn(({ data }: { data: { contentId: string; studentId: string } }) => {
        contentLikes.push({ ...data, createdAt: new Date('2026-06-04T10:30:00.000Z') });
        return Promise.resolve(data);
      }),
      delete: vi.fn(({ where }: { where: FakeContentLikeWhere }) => {
        const index = contentLikes.findIndex(
          (like) =>
            like.contentId === where.contentId_studentId.contentId &&
            like.studentId === where.contentId_studentId.studentId,
        );
        const [deleted] = index >= 0 ? contentLikes.splice(index, 1) : [];
        return Promise.resolve(deleted);
      }),
      findUnique: vi.fn(({ where }: { where: FakeContentLikeWhere }) =>
        Promise.resolve(
          contentLikes.find(
            (like) =>
              like.contentId === where.contentId_studentId.contentId &&
              like.studentId === where.contentId_studentId.studentId,
          ) ?? null,
        ),
      ),
    },
    faithCornerComment: {
      count: vi.fn(({ where }: { where: { contentId: string; status?: StoredFaithCornerCommentStatus } }) =>
        Promise.resolve(
          comments.filter(
            (comment) =>
              comment.contentId === where.contentId &&
              (where.status === undefined || comment.status === where.status),
          ).length,
        ),
      ),
      create: vi.fn(
        ({
          data,
        }: {
          data: {
            bodyEnc: string;
            contentId: string;
            status: StoredFaithCornerCommentStatus;
            studentId: string;
          };
        }) => {
          const row = makeComment({
            id: `faithcomment${String(comments.length + 1).padStart(6, '0')}`,
            ...data,
          });
          comments.push(row);
          return Promise.resolve(selectedComment(row, content, commentLikes));
        },
      ),
      findMany: vi.fn(({ where }: { where: Record<string, unknown> }) => {
        const rows = comments
          .filter((comment) => {
            if (where['status'] && comment.status !== where['status']) return false;
            if (where['contentId'] && comment.contentId !== where['contentId']) return false;
            const or = where['OR'] as Array<{ status?: string; studentId?: string }> | undefined;
            if (!or) return true;
            return or.some(
              (condition) =>
                (condition.status === undefined || comment.status === condition.status) &&
                (condition.studentId === undefined || comment.studentId === condition.studentId),
            );
          })
          .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime());
        return Promise.resolve(rows.map((row) => selectedComment(row, content, commentLikes)));
      }),
      findUnique: vi.fn(({ where }: { where: { id: string } }) => {
        const row = comments.find((comment) => comment.id === where.id);
        if (!row) return Promise.resolve(null);
        return Promise.resolve({
          ...selectedComment(row, content, commentLikes),
          content: {
            active: content.find((candidate) => candidate.id === row.contentId)?.active ?? false,
            weeklyTheme:
              content.find((candidate) => candidate.id === row.contentId)?.weeklyTheme ??
              'Faith Corner',
          },
        });
      }),
      update: vi.fn(
        ({
          data,
          where,
        }: {
          data: {
            reviewedAt: Date;
            reviewedById: string;
            status: StoredFaithCornerCommentStatus;
          };
          where: { id: string };
        }) => {
          const row = comments.find((comment) => comment.id === where.id);
          if (!row) throw new Error('comment not found');
          row.status = data.status;
          row.reviewedAt = data.reviewedAt;
          row.reviewedById = data.reviewedById;
          row.updatedAt = data.reviewedAt;
          return Promise.resolve(selectedComment(row, content, commentLikes));
        },
      ),
    },
    faithCornerCommentLike: {
      count: vi.fn(({ where }: { where: { commentId: string } }) =>
        Promise.resolve(commentLikes.filter((like) => like.commentId === where.commentId).length),
      ),
      create: vi.fn(({ data }: { data: { commentId: string; studentId: string } }) => {
        commentLikes.push({ ...data, createdAt: new Date('2026-06-04T11:00:00.000Z') });
        return Promise.resolve(data);
      }),
      delete: vi.fn(({ where }: { where: FakeCommentLikeWhere }) => {
        const index = commentLikes.findIndex(
          (like) =>
            like.commentId === where.commentId_studentId.commentId &&
            like.studentId === where.commentId_studentId.studentId,
        );
        const [deleted] = index >= 0 ? commentLikes.splice(index, 1) : [];
        return Promise.resolve(deleted);
      }),
      findMany: vi.fn(
        ({ where }: { where: { commentId: { in: string[] }; studentId: string } }) =>
          Promise.resolve(
            commentLikes
              .filter(
                (like) =>
                  where.commentId.in.includes(like.commentId) &&
                  like.studentId === where.studentId,
              )
              .map((like) => ({ commentId: like.commentId })),
          ),
      ),
      findUnique: vi.fn(({ where }: { where: FakeCommentLikeWhere }) =>
        Promise.resolve(
          commentLikes.find(
            (like) =>
              like.commentId === where.commentId_studentId.commentId &&
              like.studentId === where.commentId_studentId.studentId,
          ) ?? null,
        ),
      ),
    },
    student: {
      findUnique: vi.fn(({ where }: FakeStudentFindUniqueArgs) =>
        Promise.resolve({
          [studentUser.id]: { id: studentId, active: true },
          [otherStudentUser.id]: { id: otherStudentId, active: true },
        }[where.userId ?? ''] ?? null),
      ),
    },
    studentPortalSettings: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
    studentPortalUsageMinute: {
      count: vi.fn().mockResolvedValue(0),
    },
    content,
    contentLikes,
    comments,
    commentLikes,
  } satisfies FakeDb;

  db.$transaction.mockImplementation(async <T>(fn: (tx: FakeDb) => Promise<T>) => fn(db));
  return db;
}

function makeCtx(user: SessionUser | null, db: FakeDb): AppContext {
  return {
    db: db as unknown as AppContext['db'],
    user,
    requestId: 'req_faith_test',
    withRls: async <T>(fn: (tx: RlsTx) => Promise<T>) => fn({} as RlsTx),
  } satisfies AppContext;
}

function makeCaller(user: SessionUser | null, db = makeFakeDb()) {
  const appRouter = router({ faithCorner: faithCornerRouter });
  return { caller: appRouter.createCaller(makeCtx(user, db)), db };
}

describe('faithCorner router', () => {
  it('allows Centre Manager users to publish current Faith Corner content', async () => {
    const existing = makeContent({ id: 'faithold00000000001', weeklyTheme: 'Old theme' });
    const { caller, db } = makeCaller(headUser, makeFakeDb([existing]));

    const result = await caller.faithCorner.publish({
      weeklyTheme: 'Courage and kindness',
      memoryVerseReference: 'Joshua 1:9',
      memoryVerseText: 'Be strong and of good courage.',
      reflectionPrompt: 'Where do you need courage this week?',
      verseOfDayReference: 'Psalm 27:1',
      verseOfDayText: 'The Lord is my light.',
    });

    expect(existing.active).toBe(false);
    expect(result).toMatchObject({
      weeklyTheme: 'Courage and kindness',
      memoryVerse: {
        reference: 'Joshua 1:9',
        text: 'Be strong and of good courage.',
        translation: 'NKJV',
      },
      reflectionPrompt: 'Where do you need courage this week?',
      verseOfDay: {
        reference: 'Psalm 27:1',
        text: 'The Lord is my light.',
        translation: 'NKJV',
      },
      ready: true,
    });
    expect(db.content).toHaveLength(2);
    const audit = db.auditLog.create.mock.calls.at(-1)?.[0] as FakeAuditCreateArgs | undefined;
    expect(audit?.data).toMatchObject({
      action: 'Create',
      entity: 'FaithCornerContent',
      userId: headUser.id,
    });
    expect(audit?.data.entityId).toEqual(expect.any(String));
  });

  it('returns current Faith Corner content to students as read-only data', async () => {
    const { caller } = makeCaller(
      studentUser,
      makeFakeDb([
        makeContent({
          id: 'faithcurrent0000001',
          weeklyTheme: 'Walk in wisdom',
          memoryVerseReference: 'Proverbs 3:5',
          memoryVerseTextEnc: encrypt('Trust in the Lord.'),
          reflectionPromptEnc: encrypt('What does trust look like today?'),
        }),
      ]),
    );

    await expect(caller.faithCorner.currentForStudent()).resolves.toMatchObject({
      id: 'faithcurrent0000001',
      weeklyTheme: 'Walk in wisdom',
      memoryVerse: {
        reference: 'Proverbs 3:5',
        text: 'Trust in the Lord.',
        translation: 'NKJV',
      },
      reflectionPrompt: 'What does trust look like today?',
      verseOfDay: null,
      likeCount: 0,
      commentCount: 0,
      likedByCurrentStudent: false,
      ready: true,
    });
  });

  it('returns an empty current state when no content is published', async () => {
    const { caller } = makeCaller(studentUser);

    await expect(caller.faithCorner.currentForStudent()).resolves.toEqual({
      id: null,
      weeklyTheme: 'Faith Corner',
      memoryVerse: null,
      reflectionPrompt: null,
      verseOfDay: null,
      publishedAt: null,
      likeCount: 0,
      commentCount: 0,
      likedByCurrentStudent: false,
      ready: false,
    });
  });

  it('lets students toggle a like on the current devotion', async () => {
    const { caller, db } = makeCaller(
      studentUser,
      makeFakeDb([makeContent({ id: 'faithcurrent0000001', weeklyTheme: 'Walk in wisdom' })]),
    );

    await expect(caller.faithCorner.toggleCurrentLike()).resolves.toMatchObject({
      id: 'faithcurrent0000001',
      likeCount: 1,
      likedByCurrentStudent: true,
    });
    expect(db.contentLikes).toEqual([
      expect.objectContaining({ contentId: 'faithcurrent0000001', studentId }),
    ]);

    await expect(caller.faithCorner.toggleCurrentLike()).resolves.toMatchObject({
      likeCount: 0,
      likedByCurrentStudent: false,
    });
    expect(db.contentLikes).toHaveLength(0);
  });

  it('keeps submitted comments private until admin approval', async () => {
    const content = makeContent({ id: 'faithcurrent0000001', weeklyTheme: 'Walk in wisdom' });
    const db = makeFakeDb([content]);
    const studentCaller = makeCaller(studentUser, db).caller;
    const otherStudentCaller = makeCaller(otherStudentUser, db).caller;
    const adminCaller = makeCaller(headUser, db).caller;

    const submitted = await studentCaller.faithCorner.submitComment({
      body: 'This reminded me to pray before I worry.',
    });

    expect(submitted).toMatchObject({
      authorFirstName: 'Faith',
      body: 'This reminded me to pray before I worry.',
      isOwnComment: true,
      status: 'Pending',
    });
    await expect(studentCaller.faithCorner.listComments()).resolves.toMatchObject([
      { id: submitted.id, status: 'Pending', isOwnComment: true },
    ]);
    await expect(otherStudentCaller.faithCorner.listComments()).resolves.toEqual([]);

    await expect(adminCaller.faithCorner.pendingCommentsForAdmin()).resolves.toMatchObject([
      {
        id: submitted.id,
        authorFirstName: 'Faith',
        weeklyTheme: 'Walk in wisdom',
        status: 'Pending',
      },
    ]);

    await expect(
      adminCaller.faithCorner.reviewComment({ commentId: submitted.id, status: 'Approved' }),
    ).resolves.toMatchObject({ id: submitted.id, status: 'Approved' });
    await expect(otherStudentCaller.faithCorner.listComments()).resolves.toMatchObject([
      {
        id: submitted.id,
        authorFirstName: 'Faith',
        isOwnComment: false,
        status: 'Approved',
      },
    ]);
  });

  it('lets students like approved comments only', async () => {
    const content = makeContent({ id: 'faithcurrent0000001', weeklyTheme: 'Walk in wisdom' });
    const pending = makeComment({
      id: 'faithcommentpending1',
      contentId: content.id,
      studentId,
      status: 'Pending',
    });
    const approved = makeComment({
      id: 'faithcommentapproved',
      contentId: content.id,
      studentId,
      status: 'Approved',
    });
    const { caller, db } = makeCaller(otherStudentUser, makeFakeDb([content], [pending, approved]));

    await expect(
      caller.faithCorner.toggleCommentLike({ commentId: pending.id }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });

    await expect(caller.faithCorner.toggleCommentLike({ commentId: approved.id })).resolves.toEqual({
      likedByCurrentStudent: true,
      likeCount: 1,
    });
    expect(db.commentLikes).toEqual([
      expect.objectContaining({ commentId: approved.id, studentId: otherStudentId }),
    ]);

    await expect(caller.faithCorner.toggleCommentLike({ commentId: approved.id })).resolves.toEqual({
      likedByCurrentStudent: false,
      likeCount: 0,
    });
    expect(db.commentLikes).toHaveLength(0);
  });

  it('blocks students and parents from publishing Faith Corner content', async () => {
    await expect(
      makeCaller(studentUser).caller.faithCorner.publish({
        weeklyTheme: 'Theme',
        memoryVerseReference: 'John 3:16',
        memoryVerseText: 'Memory verse',
        reflectionPrompt: 'Reflection prompt',
        verseOfDayReference: null,
        verseOfDayText: null,
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });

    await expect(
      makeCaller(parentUser).caller.faithCorner.publish({
        weeklyTheme: 'Theme',
        memoryVerseReference: 'John 3:16',
        memoryVerseText: 'Memory verse',
        reflectionPrompt: 'Reflection prompt',
        verseOfDayReference: null,
        verseOfDayText: null,
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('blocks parents and anonymous users from student comment interactions', async () => {
    const db = makeFakeDb([
      makeContent({ id: 'faithcurrent0000001', weeklyTheme: 'Walk in wisdom' }),
    ]);

    await expect(
      makeCaller(parentUser, db).caller.faithCorner.submitComment({ body: 'Parent comment' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });

    await expect(makeCaller(null, db).caller.faithCorner.listComments()).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });
});
