import { handleClerkWebhookRequest } from '@oasis/api/clerk-webhook';

export const runtime = 'nodejs';

export function POST(request: Request): Promise<Response> {
  return handleClerkWebhookRequest(request);
}
