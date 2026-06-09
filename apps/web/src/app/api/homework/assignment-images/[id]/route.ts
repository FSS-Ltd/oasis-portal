import { createAdminClient } from '@/lib/supabase/admin';
import { createCallerForRequest } from '../../../auth-context';
import { routeErrorResponse } from '../../../notices/route-errors';

interface AssignmentImageRouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(req: Request, context: AssignmentImageRouteContext): Promise<Response> {
  try {
    const params = await context.params;
    const url = new URL(req.url);
    const shouldDownload = url.searchParams.get('download') === '1';
    const caller = await createCallerForRequest(req);
    const image = await caller.homework.downloadAssignmentImage({ imageId: params.id });
    const supabase = createAdminClient();
    const { data, error } = await supabase.storage
      .from(image.storageBucket)
      .createSignedUrl(image.storagePath, 60, {
        download: shouldDownload ? image.fileName : false,
      });

    if (error) throw error;

    return Response.redirect(data.signedUrl, 307);
  } catch (error) {
    return routeErrorResponse(error);
  }
}
