import type { QueryClient, QueryKey } from '@tanstack/react-query';

/** Wait for a committed event to update the cache. This never starts a read. */
export function waitForCachedConfirmation<T>(
  client: QueryClient,
  key: QueryKey,
  confirmed: (value: T | undefined) => T | undefined,
  signal: AbortSignal,
  timeoutMs = 15_000,
): Promise<T> {
  return new Promise((resolve, reject) => {
    function cleanup(): void {
      unsubscribe();
      clearTimeout(timeout);
      signal.removeEventListener('abort', abort);
    }
    function abort(): void {
      cleanup();
      reject(new Error('Account confirmation cancelled.'));
    }
    function check(): void {
      const result = confirmed(client.getQueryData<T>(key));
      if (result !== undefined) {
        cleanup();
        resolve(result);
      }
    }
    if (signal.aborted) {
      reject(new Error('Account confirmation cancelled.'));
      return;
    }
    const unsubscribe = client.getQueryCache().subscribe(check);
    const timeout = setTimeout(() => {
      cleanup();
      reject(
        new Error(
          'Account link is still pending. Check the account link before changing credentials.',
        ),
      );
    }, timeoutMs);
    signal.addEventListener('abort', abort, { once: true });
    check();
  });
}
