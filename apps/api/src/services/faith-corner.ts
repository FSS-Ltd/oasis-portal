import { TRPCError } from '@trpc/server';
import type { Prisma } from '@oasis/db';
import type { AppContext } from '../context.js';

export interface FaithCornerDto {
  id: string | null;
  weeklyTheme: string;
  memoryVerse: {
    reference: string;
    text: string;
    translation: 'NKJV';
  } | null;
  reflectionPrompt: string | null;
  verseOfDay: {
    reference: string;
    text: string;
    translation: 'NKJV';
  } | null;
  publishedAt: Date | null;
  likeCount: number;
  commentCount: number;
  likedByCurrentStudent: boolean;
  ready: boolean;
}

const faithCornerSelect = {
  id: true,
  weeklyTheme: true,
  memoryVerseReference: true,
  memoryVerseTextEnc: true,
  reflectionPromptEnc: true,
  verseOfDayReference: true,
  verseOfDayTextEnc: true,
  publishedAt: true,
} satisfies Prisma.FaithCornerContentSelect;

type FaithCornerRow = Prisma.FaithCornerContentGetPayload<{ select: typeof faithCornerSelect }>;

export const emptyFaithCorner: FaithCornerDto = {
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
};

function decryptRequired(
  decrypt: (value: string | null | undefined) => string | null,
  value: string,
): string {
  const decrypted = decrypt(value);
  if (!decrypted) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'faith corner content decrypt failed',
    });
  }
  return decrypted;
}

export function mapFaithCornerContent(
  decrypt: (value: string | null | undefined) => string | null,
  row: FaithCornerRow | null,
  interactions?: {
    commentCount: number;
    likedByCurrentStudent: boolean;
    likeCount: number;
  },
): FaithCornerDto {
  if (!row) return emptyFaithCorner;

  const verseOfDayText =
    row.verseOfDayReference && row.verseOfDayTextEnc
      ? decryptRequired(decrypt, row.verseOfDayTextEnc)
      : null;

  return {
    id: row.id,
    weeklyTheme: row.weeklyTheme,
    memoryVerse: {
      reference: row.memoryVerseReference,
      text: decryptRequired(decrypt, row.memoryVerseTextEnc),
      translation: 'NKJV',
    },
    reflectionPrompt: decryptRequired(decrypt, row.reflectionPromptEnc),
    verseOfDay:
      row.verseOfDayReference && verseOfDayText
        ? {
            reference: row.verseOfDayReference,
            text: verseOfDayText,
            translation: 'NKJV',
          }
        : null,
    publishedAt: row.publishedAt,
    likeCount: interactions?.likeCount ?? 0,
    commentCount: interactions?.commentCount ?? 0,
    likedByCurrentStudent: interactions?.likedByCurrentStudent ?? false,
    ready: true,
  };
}

export async function loadCurrentFaithCornerContent(
  ctx: AppContext,
  currentStudentId?: string,
): Promise<FaithCornerDto> {
  const row = await ctx.db.faithCornerContent.findFirst({
    where: { active: true },
    select: faithCornerSelect,
    orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
  });

  if (row) {
    await ctx.db.auditLog.create({
      data: {
        userId: ctx.user?.id ?? null,
        action: 'DecryptPii',
        entity: 'FaithCornerContent',
        entityId: row.id,
        meta: { source: 'faithCorner.current', count: row.verseOfDayTextEnc ? 3 : 2 },
      },
    });
  }

  if (!row) return emptyFaithCorner;

  const [likeCount, commentCount, ownLike] = await Promise.all([
    ctx.db.faithCornerContentLike.count({ where: { contentId: row.id } }),
    ctx.db.faithCornerComment.count({ where: { contentId: row.id, status: 'Approved' } }),
    currentStudentId
      ? ctx.db.faithCornerContentLike.findUnique({
          where: { contentId_studentId: { contentId: row.id, studentId: currentStudentId } },
          select: { contentId: true },
        })
      : Promise.resolve(null),
  ]);

  return mapFaithCornerContent(ctx.db.$enc.decrypt, row, {
    likeCount,
    commentCount,
    likedByCurrentStudent: ownLike !== null,
  });
}
