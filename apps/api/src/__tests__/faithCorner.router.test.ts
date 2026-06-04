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

const studentId = 'faithstudent0000000001';

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
  student: { findUnique: ReturnType<typeof vi.fn> };
  studentPortalSettings: { findUnique: ReturnType<typeof vi.fn> };
  studentPortalUsageMinute: { count: ReturnType<typeof vi.fn> };
  content: StoredFaithCornerContent[];
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

function makeFakeDb(content: StoredFaithCornerContent[] = []): FakeDb {
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
    student: {
      findUnique: vi.fn(({ where }: FakeStudentFindUniqueArgs) =>
        Promise.resolve(
          where.userId === studentUser.id ? { id: studentId, active: true } : null,
        ),
      ),
    },
    studentPortalSettings: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
    studentPortalUsageMinute: {
      count: vi.fn().mockResolvedValue(0),
    },
    content,
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
      ready: false,
    });
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
});
