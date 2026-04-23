import { TRPCError } from '@trpc/server';

/**
 * Phase-0 stub: throws a clearly-named error at call time so a client wiring
 * mistake is never silently hidden, but the router shape is typed and stable.
 */
export function notImplemented(feature: string): never {
  throw new TRPCError({
    code: 'NOT_IMPLEMENTED',
    message: `${feature} is a Phase-0 stub. Implemented in later phases per oasis-platform-plan.md.`,
  });
}
