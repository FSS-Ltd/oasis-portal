import { TRPCError } from '@trpc/server';
import { friendlyErrorMessage } from '@/lib/user-facing-errors';

export function routeErrorResponse(error: unknown, fallback = 'Notice request failed.'): Response {
  if (error instanceof TRPCError) {
    const status =
      error.code === 'UNAUTHORIZED'
        ? 401
        : error.code === 'FORBIDDEN'
          ? 403
          : error.code === 'NOT_FOUND'
            ? 404
            : 400;

    return Response.json(
      { error: friendlyErrorMessage(error) },
      { status },
    );
  }

  return Response.json(
    { error: friendlyErrorMessage(error, fallback) },
    { status: 500 },
  );
}
