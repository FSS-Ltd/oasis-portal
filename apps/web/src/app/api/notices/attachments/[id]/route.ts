import { createAdminClient } from '@/lib/supabase/admin';
import { createCallerForRequest } from '../../../auth-context';
import { routeErrorResponse } from '../../route-errors';

interface NoticeAttachmentRouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(req: Request, context: NoticeAttachmentRouteContext): Promise<Response> {
  try {
    const params = await context.params;
    const url = new URL(req.url);
    const shouldDownload = url.searchParams.get('download') === '1';
    const caller = await createCallerForRequest(req);
    const result = await caller.notice.downloadAttachment({
      attachmentId: params.id,
      markRead: !shouldDownload,
    });
    const supabase = createAdminClient();
    const { data, error } = await supabase.storage
      .from(result.storageBucket)
      .createSignedUrl(result.storagePath, 60, {
        download: shouldDownload ? result.fileName : false,
      });

    if (error) throw error;

    return Response.redirect(data.signedUrl, 307);
  } catch (error) {
    return routeErrorResponse(error);
  }
}
