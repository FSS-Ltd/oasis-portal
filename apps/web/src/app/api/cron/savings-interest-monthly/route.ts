import { runMonthlySavingsInterest } from '@oasis/api';
import { prisma } from '@oasis/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');

  if (!secret || authHeader !== `Bearer ${secret}`) {
    return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const summary = await runMonthlySavingsInterest({
    auditUserId: null,
    db: prisma,
  });

  return Response.json({ ok: true, ...summary });
}
