import { TRPCError } from '@trpc/server';

export function routeErrorResponse(error: unknown): Response {
  if (error instanceof TRPCError) {
    return Response.json(
      { error: error.message },
      { status: error.code === 'UNAUTHORIZED' ? 401 : error.code === 'FORBIDDEN' ? 403 : 400 },
    );
  }

  return Response.json(
    { error: error instanceof Error ? error.message : 'invoice request failed' },
    { status: 500 },
  );
}
