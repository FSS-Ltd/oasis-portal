import { prisma } from '@oasis/db';
import { runWeeklyTithe } from '@oasis/api';
import { TITHE_TIME_ZONE, startOfTitheWeek } from '@oasis/domain';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function localCronParts(date: Date): { hour: number; minute: number; weekday: string } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    hourCycle: 'h23',
    minute: '2-digit',
    timeZone: TITHE_TIME_ZONE,
    weekday: 'short',
  }).formatToParts(date);

  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';

  return {
    hour: Number(value('hour')),
    minute: Number(value('minute')),
    weekday: value('weekday'),
  };
}

function isFridayOnePmLondon(date: Date): boolean {
  const parts = localCronParts(date);
  return parts.weekday === 'Fri' && parts.hour === 13 && parts.minute === 0;
}

export async function GET(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');

  if (!secret || authHeader !== `Bearer ${secret}`) {
    return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  if (!isFridayOnePmLondon(now)) {
    return Response.json({
      ok: true,
      skipped: true,
      reason: 'outside Friday 13:00 Europe/London settlement window',
      checkedAt: now.toISOString(),
    });
  }

  const periodStart = startOfTitheWeek(now);
  const summary = await runWeeklyTithe({
    auditSource: 'cron.tithe-weekly',
    auditUserId: null,
    db: prisma,
    weekStart: new Date(periodStart.getTime() - 1),
  });

  return Response.json({ ok: true, ...summary });
}
