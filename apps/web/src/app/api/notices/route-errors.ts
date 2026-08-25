import { TRPCError } from '@trpc/server';
import { logOperationalEvent, operationalErrorMessage } from '@oasis/api';
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

  logOperationalEvent({
    event: 'route.unexpected_failure',
    level: 'error',
    message: 'A protected route request failed unexpectedly',
    meta: { error: operationalErrorMessage(error) },
  });

  return Response.json(
    { error: friendlyErrorMessage(error, fallback) },
    { status: 500 },
  );
}
