import { applyRlsTx, syncTimetableTasks, type TimetableTaskDb } from '@oasis/api';
import { prisma } from '@oasis/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const heads = await prisma.user.findMany({
    where: { role: 'Head', active: true },
    select: { id: true, role: true, tags: true },
  });
  let updated = 0;
  let terms = 0;
  for (const head of heads) {
    const summary = await applyRlsTx(prisma, { ...head, requires2fa: false }, (db) =>
      syncTimetableTasks({
        db: db as unknown as TimetableTaskDb,
        headIds: [head.id],
      }),
    );
    updated += summary.updated;
    terms = Math.max(terms, summary.terms);
  }
  return Response.json({ ok: true, heads: heads.length, terms, updated });
}
