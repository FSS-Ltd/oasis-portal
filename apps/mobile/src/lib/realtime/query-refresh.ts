import type { Query, QueryClient } from '@tanstack/react-query';
import { REALTIME_AUTHORITY_AREAS, type RealtimeArea } from '@oasis/domain';

function path(query: Query): readonly unknown[] {
  return Array.isArray(query.queryKey[0]) ? query.queryKey[0] : [];
}

function isDownload(query: Query): boolean {
  return path(query).some((part) => typeof part === 'string' && /download|export|pdf/i.test(part));
}

/** Recheck authority before any event-driven protected read. Disabled downloads stay on demand. */
export async function refreshMobileQueries(
  client: QueryClient,
  areas: readonly RealtimeArea[],
  fetchAuthority?: () => Promise<unknown>,
  isActive: () => boolean = () => true,
): Promise<void> {
  if (!isActive()) return;
  const protectedQuery = (query: Query) => path(query)[0] !== 'health';
  let authorityChanged = false;
  function clearProtectedData(remove: boolean): void {
    for (const query of client.getQueryCache().findAll({ predicate: protectedQuery })) {
      query.reset();
      // Reset can restore initialData; authority changes must also clear hydrated snapshots.
      query.setState({
        data: undefined,
        dataUpdatedAt: 0,
        error: null,
        errorUpdatedAt: 0,
        status: 'pending',
      });
    }
    if (remove) client.removeQueries({ predicate: protectedQuery });
  }
  if (
    areas.some((area) => REALTIME_AUTHORITY_AREAS.some((authorityArea) => authorityArea === area))
  ) {
    const authorityQuery = () =>
      client.getQueryCache().findAll({ queryKey: [['health', 'me']] })[0];
    const previousAuthority = authorityQuery()?.state.data;
    await authorityQuery()?.promise?.catch(() => undefined);
    if (!isActive()) return;
    let authority: unknown;
    try {
      await client.invalidateQueries({ queryKey: [['health']], refetchType: 'none' });
      authority = fetchAuthority ? await fetchAuthority() : await authorityQuery()?.fetch();
    } catch (error) {
      if (!isActive()) return;
      await client.cancelQueries({ predicate: protectedQuery });
      if (!isActive()) return;
      clearProtectedData(true);
      throw error;
    }
    if (!isActive()) return;
    if (
      typeof authority !== 'object' ||
      authority === null ||
      !('accountAccessState' in authority) ||
      authority.accountAccessState !== 'active' ||
      !('user' in authority) ||
      typeof authority.user !== 'object' ||
      authority.user === null ||
      ('requires2fa' in authority.user && authority.user.requires2fa === true)
    ) {
      await client.cancelQueries({ predicate: protectedQuery });
      if (!isActive()) return;
      clearProtectedData(true);
      if (
        typeof authority === 'object' &&
        authority !== null &&
        'accountAccessState' in authority &&
        authority.accountAccessState === 'deactivated'
      )
        return;
      throw new Error('Account access could not be refreshed.');
    }
    authorityChanged = JSON.stringify(previousAuthority) !== JSON.stringify(authority);
    if (authorityChanged) {
      await client.cancelQueries({ predicate: protectedQuery });
      if (!isActive()) return;
      clearProtectedData(false);
    }
  }
  const affected = (query: Query) =>
    path(query)[0] !== 'health' &&
    (authorityChanged || areas.some((area) => path(query)[0] === area)) &&
    !isDownload(query);
  // Mount reads may have started before this change committed. Do not reuse their snapshots.
  await Promise.allSettled(
    client
      .getQueryCache()
      .findAll({ predicate: affected })
      .flatMap((query) => (query.promise ? [query.promise] : [])),
  );
  if (!isActive()) return;
  await client.invalidateQueries(
    { predicate: affected, refetchType: 'active' },
    { throwOnError: true },
  );
}
