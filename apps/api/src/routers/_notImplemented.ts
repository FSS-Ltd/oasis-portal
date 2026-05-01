import { TRPCError } from '@trpc/server';

/**
 * Throws a clearly named error for routes that are present in the API surface
 * but not currently available to users.
 */
export function notImplemented(feature: string): never {
  throw new TRPCError({
    code: 'NOT_IMPLEMENTED',
    message: `${feature} is not available in this portal yet.`,
  });
}
