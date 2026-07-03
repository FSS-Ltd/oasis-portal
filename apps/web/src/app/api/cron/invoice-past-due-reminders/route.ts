import {
  createResendEmailClient,
  sendPastDueInvoiceReminders,
  type InvoicePastDueReminderDb,
} from '@oasis/api';
import { prisma } from '@oasis/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');

  if (!secret || authHeader !== `Bearer ${secret}`) {
    return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  // Prisma's generated delegates are wider than the service's narrow testable DB interface.
  const db = prisma as unknown as InvoicePastDueReminderDb;
  const summary = await sendPastDueInvoiceReminders({
    db,
    emailClient: createResendEmailClient(),
  });

  return Response.json({ ok: true, ...summary });
}
