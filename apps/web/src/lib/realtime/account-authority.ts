import type { Query, QueryClient } from '@tanstack/react-query';
import type { RouterOutputs } from '../trpc';
import { queryBelongsToAreas } from './query-cache';

interface AuthorityResult {
  fingerprint: string;
  changed: boolean;
  redirect: '/access-revoked' | '/post-sign-in/resolve' | null;
}

function isProtectedQuery(query: Query): boolean {
  return !queryBelongsToAreas(query.queryKey, ['health']);
}

/** Clear observer snapshots too, including disabled downloads and hydrated data. */
export function clearProtectedRealtimeData(client: QueryClient, remove: boolean): void {
  for (const query of client.getQueryCache().findAll({ predicate: isProtectedQuery })) {
    query.reset();
    // reset() can restore initialData; removing a query alone retains observer data.
    query.setState({
      data: undefined,
      dataUpdatedAt: 0,
      error: null,
      errorUpdatedAt: 0,
      status: 'pending',
    });
  }
  if (remove) client.removeQueries({ predicate: isProtectedQuery });
}

/** Resolve current permissions before allowing any event-triggered restricted read. */
export async function refreshAccountAuthority(
  client: QueryClient,
  load: () => Promise<RouterOutputs['health']['me']>,
  previous: string | undefined,
  active: () => boolean,
): Promise<AuthorityResult | null> {
  if (!active()) return null;
  let account: RouterOutputs['health']['me'];
  try {
    account = await load();
  } catch (error) {
    if (active()) {
      await client.cancelQueries({ predicate: isProtectedQuery });
      if (active()) clearProtectedRealtimeData(client, true);
    }
    throw error;
  }
  if (!active()) return null;
  const fingerprint = JSON.stringify(account);
  if (account.accountAccessState !== 'active' || !account.user || account.user.requires2fa) {
    await client.cancelQueries();
    if (!active()) return null;
    clearProtectedRealtimeData(client, true);
    client.clear();
    return {
      fingerprint,
      changed: true,
      redirect:
        account.accountAccessState === 'deactivated' ? '/access-revoked' : '/post-sign-in/resolve',
    };
  }
  const changed = previous !== undefined && previous !== fingerprint;
  if (changed) {
    await client.cancelQueries({ predicate: isProtectedQuery });
    if (!active()) return null;
    clearProtectedRealtimeData(client, false);
    // Formerly authorized resources may now return 403. Their observers own those
    // errors; they must not prevent the route guard from handling the new role.
    await client.invalidateQueries(
      { predicate: isProtectedQuery, refetchType: 'active' },
      { cancelRefetch: false },
    );
    if (!active()) return null;
  }
  return { fingerprint, changed, redirect: null };
}
