import { logOperationalEvent, reconcileStudentSchoolYears } from '@oasis/api';
import { prisma } from '@oasis/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const summary = await reconcileStudentSchoolYears(prisma);
    return Response.json({ ok: true, ...summary });
  } catch (error) {
    logOperationalEvent({
      event: 'student.school_year_reconciliation_failed',
      level: 'error',
      message: 'School-year reconciliation failed',
      meta: { errorType: error instanceof Error ? error.name : 'UnknownError' },
    });
    return Response.json({ ok: false, error: 'School-year update unavailable' }, { status: 503 });
  }
}
