import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import type { RealtimeArea } from '@oasis/domain';
import { refreshMobileQueries } from './query-refresh';

describe('mobile event query refresh', () => {
  it('fetches affected active queries, stales inactive queries, and leaves downloads untouched', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const active = vi.fn(() => Promise.resolve('updated'));
    const unrelated = vi.fn(() => Promise.resolve('unrelated'));
    const observer = new QueryObserver(client, {
      queryKey: [['report', 'scoreKeys', 'current']],
      queryFn: active,
      initialData: 'old',
      staleTime: Infinity,
    });
    const unsubscribe = observer.subscribe(() => undefined);
    client.setQueryData([['report', 'history']], 'cached');
    client.setQueryData([['report', 'scoreKeys', 'downloadPdf']], 'pdf');
    await client.fetchQuery({
      queryKey: [['message', 'list']],
      queryFn: unrelated,
      staleTime: Infinity,
    });
    await refreshMobileQueries(client, ['report']);
    expect(active).toHaveBeenCalledTimes(1);
    expect(unrelated).toHaveBeenCalledTimes(1);
    expect(client.getQueryState([['report', 'history']])?.isInvalidated).toBe(true);
    expect(client.getQueryState([['report', 'scoreKeys', 'downloadPdf']])?.isInvalidated).toBe(
      false,
    );
    unsubscribe();
    client.clear();
  });

  it.each([
    'health',
    'profile',
    'admin',
    'registration',
    'studentSettings',
  ] satisfies RealtimeArea[])(
    'clears active observer snapshots before protected reads on a %s revocation event',
    async (area) => {
      const client = new QueryClient();
      const order: string[] = [];
      const authority = new QueryObserver(client, {
        queryKey: [['health', 'me']],
        initialData: { accountAccessState: 'active' },
        staleTime: Infinity,
        queryFn: () => {
          order.push('authority');
          return Promise.resolve({ accountAccessState: 'deactivated' });
        },
      });
      const protectedQuery = new QueryObserver(client, {
        queryKey: [['report', 'list']],
        initialData: 'sensitive',
        staleTime: Infinity,
        queryFn: () => {
          order.push('report');
          return Promise.resolve('new');
        },
      });
      client.setQueryData([['report', 'scoreKeys', 'downloadPdf']], 'private-pdf');
      const stopAuthority = authority.subscribe(() => undefined);
      const stopProtected = protectedQuery.subscribe(() => undefined);
      await refreshMobileQueries(client, [area]);
      expect(order).toEqual(['authority']);
      expect(client.getQueryData([['report', 'list']])).toBeUndefined();
      expect(protectedQuery.getCurrentResult().data).toBeUndefined();
      expect(client.getQueryData([['report', 'scoreKeys', 'downloadPdf']])).toBeUndefined();
      stopAuthority();
      stopProtected();
      client.clear();
    },
  );
  it.each([
    { accountAccessState: 'active', user: null },
    { accountAccessState: 'active', user: { id: 'one', requires2fa: true } },
    { accountAccessState: 'unavailable', user: { id: 'one' } },
  ])(
    'clears protected caches without fetching when authority is invalid: %j',
    async (authority) => {
      const client = new QueryClient();
      client.setQueryData([['report', 'list']], 'sensitive');
      const fetchAuthority = vi.fn(() => Promise.resolve(authority));
      await expect(
        refreshMobileQueries(client, ['health', 'report'], fetchAuthority),
      ).rejects.toThrow('Account access could not be refreshed.');
      expect(fetchAuthority).toHaveBeenCalledTimes(1);
      expect(client.getQueryData([['report', 'list']])).toBeUndefined();
      client.clear();
    },
  );

  it('fetches inactive authority before protected snapshots', async () => {
    const client = new QueryClient();
    const authority = vi.fn(() =>
      Promise.resolve({ accountAccessState: 'active', user: { id: 'one' } }),
    );
    await client.fetchQuery({
      queryKey: [['health', 'me'], { type: 'query' }],
      queryFn: authority,
    });
    await refreshMobileQueries(client, ['health']);
    expect(authority).toHaveBeenCalledTimes(2);
    client.clear();
  });

  it('keeps unrelated mount reads running when refreshed authority has not changed', async () => {
    const client = new QueryClient();
    const account = { accountAccessState: 'active', user: { id: 'one' } };
    client.setQueryData([['health', 'me']], account);
    let finish: ((data: string) => void) | undefined;
    const observer = new QueryObserver(client, {
      queryKey: [['report', 'list']],
      queryFn: () =>
        new Promise<string>((resolve) => {
          finish = resolve;
        }),
    });
    const stop = observer.subscribe(() => undefined);
    await refreshMobileQueries(client, ['profile'], () => Promise.resolve(account));
    expect(observer.getCurrentResult().isFetching).toBe(true);
    finish?.('authorized result');
    await observer.getCurrentQuery().promise;
    expect(observer.getCurrentResult().data).toBe('authorized result');
    stop();
    client.clear();
  });

  it('clears restricted data when authority fetch fails', async () => {
    const client = new QueryClient();
    client.setQueryData([['report', 'list']], 'sensitive');
    await expect(
      refreshMobileQueries(client, ['health'], () =>
        Promise.reject(new Error('Access unavailable')),
      ),
    ).rejects.toThrow('Access unavailable');
    expect(client.getQueryData([['report', 'list']])).toBeUndefined();
    client.clear();
  });
  it('refetches after a pre-event mount read finishes instead of reusing its stale snapshot', async () => {
    const client = new QueryClient();
    let finishMount: ((value: string) => void) | undefined;
    const read = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<string>((resolve) => {
            finishMount = resolve;
          }),
      )
      .mockResolvedValue('committed');
    const observer = new QueryObserver(client, { queryKey: [['report', 'list']], queryFn: read });
    const stop = observer.subscribe(() => undefined);
    const refresh = refreshMobileQueries(client, ['report']);
    expect(read).toHaveBeenCalledTimes(1);
    finishMount?.('old');
    await refresh;
    expect(read).toHaveBeenCalledTimes(2);
    expect(client.getQueryData([['report', 'list']])).toBe('committed');
    stop();
    client.clear();
  });
  it('refreshes all active protected scopes after an authority change even for a health-only event', async () => {
    const client = new QueryClient();
    client.setQueryData([['health', 'me']], {
      accountAccessState: 'active',
      user: { id: 'one', role: 'Head' },
    });
    const read = vi.fn(() => Promise.resolve('new scope'));
    const observer = new QueryObserver(client, {
      queryKey: [['report', 'list']],
      queryFn: read,
      initialData: 'old scope',
      staleTime: Infinity,
    });
    const stop = observer.subscribe(() => undefined);
    await refreshMobileQueries(client, ['health'], () =>
      Promise.resolve({
        accountAccessState: 'active',
        user: { id: 'one', role: 'Parent' },
      }),
    );
    expect(read).toHaveBeenCalledTimes(1);
    expect(client.getQueryData([['report', 'list']])).toBe('new scope');
    stop();
    client.clear();
  });
});
