import { createResendEmailClient, sendLibraryReminders } from '@oasis/api';
import { prisma } from '@oasis/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }
  const summary = await sendLibraryReminders({
    db: prisma,
    emailClient: createResendEmailClient(),
  });
  return Response.json({ ok: true, ...summary });
}
