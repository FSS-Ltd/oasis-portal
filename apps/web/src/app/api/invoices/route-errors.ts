import { TRPCError } from '@trpc/server';
import { friendlyErrorMessage } from '@/lib/user-facing-errors';

export function routeErrorResponse(error: unknown): Response {
  if (error instanceof TRPCError) {
    return Response.json(
      { error: friendlyErrorMessage(error) },
      { status: error.code === 'UNAUTHORIZED' ? 401 : error.code === 'FORBIDDEN' ? 403 : 400 },
    );
  }

  return Response.json(
    { error: friendlyErrorMessage(error, 'Invoice request failed.') },
    { status: 500 },
  );
}
