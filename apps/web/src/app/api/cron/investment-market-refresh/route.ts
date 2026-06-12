import { refreshInvestmentMarketData, type InvestmentMarketRefreshDb } from '@oasis/api';
import { prisma } from '@oasis/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');

  if (!secret || authHeader !== `Bearer ${secret}`) {
    return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const summary = await refreshInvestmentMarketData({
    auditUserId: null,
    db: prisma as unknown as InvestmentMarketRefreshDb,
    mode: 'scheduled',
  });

  return Response.json({ ok: true, ...summary });
}
