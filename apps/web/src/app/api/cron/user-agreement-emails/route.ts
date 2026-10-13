import { createResendEmailClient, deliverUserAgreementRequests } from '@oasis/api';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const summary = await deliverUserAgreementRequests(
    undefined,
    undefined,
    createResendEmailClient(),
  );
  return Response.json({ ok: true, ...summary });
}
