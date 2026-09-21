import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { createCallerForRequest } from '../../../auth-context';
import { routeErrorResponse } from '../../../notices/route-errors';

const inputSchema = z.object({
  file: z.object({
    fileName: z.string().trim().min(1).max(255),
    mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
    sizeBytes: z
      .number()
      .int()
      .positive()
      .max(5 * 1024 * 1024),
  }),
});

export async function POST(request: Request): Promise<Response> {
  try {
    const input = inputSchema.parse(await request.json());
    const caller = await createCallerForRequest(request);
    const cover = await caller.library.prepareCoverUpload(input.file);
    const { data, error } = await createAdminClient()
      .storage.from(cover.storageBucket)
      .createSignedUploadUrl(cover.storagePath);
    if (error) throw error;
    return Response.json({ bucket: cover.storageBucket, cover: { ...cover, token: data.token } });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
