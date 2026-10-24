import type { QueryClient, QueryKey } from '@tanstack/react-query';
import type { RealtimeArea } from '@oasis/domain';

export function queryBelongsToAreas(key: QueryKey, areas: readonly RealtimeArea[]): boolean {
  const path: unknown = key[0];
  return Array.isArray(path) && areas.some((area) => path[0] === area);
}

export async function refreshRealtimeQueries(
  client: QueryClient,
  areas: readonly RealtimeArea[],
  shouldRefresh: () => boolean = () => true,
): Promise<void> {
  const predicate = (query: { queryKey: QueryKey }) => queryBelongsToAreas(query.queryKey, areas);
  const inFlight = client
    .getQueryCache()
    .findAll({ predicate })
    .filter((query) => query.isActive() && query.state.fetchStatus === 'fetching')
    .flatMap((query) => {
      const pending = query.promise;
      return pending ? [pending] : [];
    });
  await client.invalidateQueries({ predicate, refetchType: 'none' });
  // A read started before the event may return a pre-commit snapshot. Wait for it,
  // then perform one new read; never cancel/restart a request for every event.
  await Promise.allSettled(inFlight);
  if (!shouldRefresh()) return;
  await client.invalidateQueries(
    { predicate, refetchType: 'active' },
    { cancelRefetch: false, throwOnError: true },
  );
}
