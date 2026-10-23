import assert from 'node:assert/strict';
import test from 'node:test';
import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { refreshRealtimeQueries, queryBelongsToAreas } from '../src/lib/realtime/query-cache';
import { routeDependsOnAreas, routeRealtimeAreas } from '../src/lib/realtime/route-dependencies';

test('area matching uses the tRPC procedure root only', () => {
  assert.equal(
    queryBelongsToAreas([['message', 'listThreads'], { type: 'query' }], ['message']),
    true,
  );
  assert.equal(
    queryBelongsToAreas([['profile', 'me'], { input: { message: true } }], ['message']),
    false,
  );
});

test('events refetch active queries, leave inactive ones stale, and preserve disabled exports', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let activeReads = 0;
  let disabledReads = 0;
  const activeKey = [['report', 'current']];
  const inactiveKey = [['report', 'history']];
  const unrelatedKey = [['profile', 'me']];
  const disabledKey = [['report', 'export']];
  client.setQueryData(inactiveKey, 'saved');
  client.setQueryData(unrelatedKey, 'profile');
  const active = new QueryObserver(client, {
    queryKey: activeKey,
    queryFn: async () => ++activeReads,
  });
  const disabled = new QueryObserver(client, {
    queryKey: disabledKey,
    enabled: false,
    queryFn: async () => ++disabledReads,
  });
  const unsubscribe = active.subscribe(() => {});
  const unsubscribeDisabled = disabled.subscribe(() => {});
  await active.refetch();
  const before = activeReads;
  await refreshRealtimeQueries(client, ['report']);
  assert.equal(activeReads, before + 1);
  assert.equal(disabledReads, 0);
  assert.equal(client.getQueryState(inactiveKey)?.isInvalidated, true);
  assert.equal(client.getQueryState(unrelatedKey)?.isInvalidated, false);
  unsubscribe();
  unsubscribeDisabled();
  client.clear();
});

test('server routes refresh only for their registered dependencies', () => {
  assert.equal(routeDependsOnAreas('/admin', ['attendance']), true);
  assert.equal(routeDependsOnAreas('/admin', ['investment']), false);
  assert.equal(routeDependsOnAreas('/parent/children/student_1', ['student']), true);
  assert.equal(routeDependsOnAreas('/admin/reports', ['report']), true);
  assert.equal(routeDependsOnAreas('/admin/reports', ['shop']), false);
  assert.equal(routeRealtimeAreas('/student/invest/portfolio').includes('investment'), true);
  assert.equal(routeRealtimeAreas('/sign-in').length, 0);
});

test('account confirmation observes cache updates without issuing requests', async () => {
  const { waitForCachedConfirmation } = await import('../src/lib/realtime/cache-confirmation');
  const client = new QueryClient();
  const controller = new AbortController();
  const key = [['studentSettings', 'listLinkedChildren']];
  const confirmation = waitForCachedConfirmation(
    client,
    key,
    (value: { linked: boolean } | undefined) => (value?.linked ? value : undefined),
    controller.signal,
  );
  client.setQueryData(key, { linked: false });
  client.setQueryData(key, { linked: true });
  assert.deepEqual(await confirmation, { linked: true });
  assert.equal(client.isFetching(), 0);
  client.clear();
});

test('account confirmation cleans up on abort and deadline without issuing requests', async () => {
  const { waitForCachedConfirmation } = await import('../src/lib/realtime/cache-confirmation');
  const client = new QueryClient();
  const controller = new AbortController();
  const aborted = waitForCachedConfirmation(client, ['abort'], () => undefined, controller.signal);
  controller.abort();
  await assert.rejects(aborted, /cancelled/);
  await assert.rejects(
    waitForCachedConfirmation(
      client,
      ['timeout'],
      () => undefined,
      new AbortController().signal,
      1,
    ),
    /pending/,
  );
  assert.equal(client.isFetching(), 0);
  client.clear();
});

test('every authenticated portal page has an explicit route dependency classification', async () => {
  const { readdir } = await import('node:fs/promises');
  const { fileURLToPath } = await import('node:url');
  const appRoot = fileURLToPath(new URL('../src/app/', import.meta.url));
  const files = await readdir(appRoot, { recursive: true });
  const pages = files.filter(
    (file) =>
      file.endsWith('/page.tsx') &&
      /^\((admin|parent|supervisor|student|clubs-lead)\)\//.test(file),
  );
  assert.ok(pages.length > 80);
  for (const page of pages) {
    const route = '/' + page.replace(/^\([^/]+\)\//, '').replace(/\/page.tsx$/, '');
    assert.ok(
      routeRealtimeAreas(route).length > 0,
      `Missing route dependency classification: ${route}`,
    );
  }
});

test('an event during an existing read queues one fresh read after it settles', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let completeFirst: (value: string) => void = () => {};
  let reads = 0;
  const observer = new QueryObserver(client, {
    queryKey: [['message', 'listThreads']],
    queryFn: async () => {
      reads++;
      return reads === 1
        ? new Promise<string>((resolve) => {
            completeFirst = resolve;
          })
        : 'committed';
    },
  });
  const unsubscribe = observer.subscribe(() => {});
  const refresh = refreshRealtimeQueries(client, ['message']);
  completeFirst('before-commit');
  await refresh;
  assert.equal(reads, 2);
  assert.equal(observer.getCurrentResult().data, 'committed');
  unsubscribe();
  client.clear();
});

test('revocation and 2FA clear restricted caches before returning the existing access route', async () => {
  const { refreshAccountAuthority } = await import('../src/lib/realtime/account-authority');
  const client = new QueryClient();
  client.setQueryData([['student', 'list']], ['private']);
  const revoked = await refreshAccountAuthority(
    client,
    async () => ({
      accountAccessState: 'deactivated',
      user: null,
      linkedChildCount: 0,
      parentVolunteerAccess: null,
    }),
    undefined,
    () => true,
  );
  assert.equal(revoked?.redirect, '/access-revoked');
  assert.equal(client.getQueryCache().getAll().length, 0);
  client.setQueryData([['student', 'list']], ['private']);
  const twoFactor = await refreshAccountAuthority(
    client,
    async () => ({
      accountAccessState: 'active',
      user: { id: 'u1', role: 'Head', tags: [], requires2fa: true },
      linkedChildCount: 0,
      parentVolunteerAccess: null,
    }),
    undefined,
    () => true,
  );
  assert.equal(twoFactor?.redirect, '/post-sign-in/resolve');
  assert.equal(client.getQueryCache().getAll().length, 0);
  client.clear();
});

test('changed guardian/role authority evicts restricted cache; stale session cannot change the next session', async () => {
  const { refreshAccountAuthority } = await import('../src/lib/realtime/account-authority');
  const client = new QueryClient();
  const load = async () => ({
    accountAccessState: 'active' as const,
    user: { id: 'u1', role: 'Parent' as const, tags: [], requires2fa: false },
    linkedChildCount: 1,
    parentVolunteerAccess: null,
  });
  const initial = await refreshAccountAuthority(client, load, undefined, () => true);
  client.setQueryData([['student', 'list']], ['old-child']);
  const changed = await refreshAccountAuthority(client, load, 'previous-authority', () => true);
  assert.equal(changed?.changed, true);
  assert.equal(client.getQueryData([['student', 'list']]), undefined);
  client.setQueryData([['student', 'list']], ['next-session']);
  assert.equal(
    await refreshAccountAuthority(client, load, initial?.fingerprint, () => false),
    null,
  );
  assert.deepEqual(client.getQueryData([['student', 'list']]), ['next-session']);
  client.clear();
});

test('authority changes reset active observers instead of leaving removed private snapshots on screen', async () => {
  const { refreshAccountAuthority } = await import('../src/lib/realtime/account-authority');
  const client = new QueryClient();
  client.setQueryData([['student', 'list']], ['previous-scope']);
  const observer = new QueryObserver(client, {
    queryKey: [['student', 'list']],
    staleTime: Infinity,
    queryFn: async () => ['current-scope'],
  });
  const unsubscribe = observer.subscribe(() => {});
  await refreshAccountAuthority(
    client,
    async () => ({
      accountAccessState: 'active',
      user: { id: 'u1', role: 'Parent', tags: [], requires2fa: false },
      linkedChildCount: 1,
      parentVolunteerAccess: null,
    }),
    'previous-authority',
    () => true,
  );
  assert.deepEqual(observer.getCurrentResult().data, ['current-scope']);
  unsubscribe();
  client.clear();
});

test('a newly forbidden old-scope query does not block changed-authority route reconciliation', async () => {
  const { refreshAccountAuthority } = await import('../src/lib/realtime/account-authority');
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const observer = new QueryObserver(client, {
    queryKey: [['admin', 'listUsers']],
    initialData: ['old private roster'],
    staleTime: Infinity,
    queryFn: () => Promise.reject(new Error('FORBIDDEN')),
  });
  const stop = observer.subscribe(() => {});
  try {
    const result = await refreshAccountAuthority(
      client,
      () =>
        Promise.resolve({
          accountAccessState: 'active',
          user: { id: 'u1', role: 'Parent', tags: [], requires2fa: false },
          linkedChildCount: 1,
          parentVolunteerAccess: null,
        }),
      'previous-head-authority',
      () => true,
    );
    assert.equal(result?.changed, true);
    assert.equal(observer.getCurrentResult().data, undefined);
    assert.equal(observer.getCurrentResult().error?.message, 'FORBIDDEN');
  } finally {
    stop();
    client.clear();
  }
});

test('denied authority removes hydrated active and disabled PDF observer data before redirect without reads', async () => {
  const { refreshAccountAuthority } = await import('../src/lib/realtime/account-authority');
  for (const denied of ['deactivated', '2fa'] as const) {
    const client = new QueryClient();
    let reads = 0;
    const activeObserver = new QueryObserver(client, {
      queryKey: [['student', 'list']],
      initialData: ['private-hydrated-student'],
      staleTime: Infinity,
      queryFn: async () => {
        reads++;
        return ['forbidden'];
      },
    });
    const pdfObserver = new QueryObserver(client, {
      queryKey: [['report', 'exportPdf']],
      initialData: 'private-pdf-bytes',
      enabled: false,
      queryFn: async () => {
        reads++;
        return 'forbidden-pdf';
      },
    });
    const stopActive = activeObserver.subscribe(() => {});
    const stopPdf = pdfObserver.subscribe(() => {});
    const result = await refreshAccountAuthority(
      client,
      async () => ({
        accountAccessState: denied === 'deactivated' ? 'deactivated' : 'active',
        user:
          denied === 'deactivated' ? null : { id: 'u1', role: 'Head', tags: [], requires2fa: true },
        linkedChildCount: 0,
        parentVolunteerAccess: null,
      }),
      'previous-authority',
      () => true,
    );
    assert.ok(result?.redirect);
    assert.equal(activeObserver.getCurrentResult().data, undefined);
    assert.equal(pdfObserver.getCurrentResult().data, undefined);
    assert.equal(reads, 0);
    stopActive();
    stopPdf();
    client.clear();
  }
});

test('changed valid authority erases hydrated snapshots, refetches active scope, and leaves PDF disabled', async () => {
  const { refreshAccountAuthority } = await import('../src/lib/realtime/account-authority');
  const client = new QueryClient();
  let activeReads = 0;
  let pdfReads = 0;
  const activeObserver = new QueryObserver(client, {
    queryKey: [['student', 'list']],
    initialData: ['previous-hydrated-scope'],
    staleTime: Infinity,
    queryFn: async () => {
      activeReads++;
      return ['new-authorized-scope'];
    },
  });
  const pdfObserver = new QueryObserver(client, {
    queryKey: [['report', 'exportPdf']],
    initialData: 'previous-private-pdf',
    enabled: false,
    queryFn: async () => {
      pdfReads++;
      return 'new-pdf';
    },
  });
  const stopActive = activeObserver.subscribe(() => {});
  const stopPdf = pdfObserver.subscribe(() => {});
  await refreshAccountAuthority(
    client,
    async () => ({
      accountAccessState: 'active',
      user: { id: 'u1', role: 'Parent', tags: [], requires2fa: false },
      linkedChildCount: 1,
      parentVolunteerAccess: null,
    }),
    'previous-authority',
    () => true,
  );
  assert.deepEqual(activeObserver.getCurrentResult().data, ['new-authorized-scope']);
  assert.equal(pdfObserver.getCurrentResult().data, undefined);
  assert.equal(activeReads, 1);
  assert.equal(pdfReads, 0);
  stopActive();
  stopPdf();
  client.clear();
});

test('failed authority refresh clears protected observers without refetching denied data', async () => {
  const { refreshAccountAuthority } = await import('../src/lib/realtime/account-authority');
  const client = new QueryClient();
  let reads = 0;
  const observer = new QueryObserver(client, {
    queryKey: [['student', 'list']],
    initialData: ['private'],
    staleTime: Infinity,
    queryFn: async () => {
      reads++;
      return ['forbidden'];
    },
  });
  const unsubscribe = observer.subscribe(() => {});
  await assert.rejects(
    refreshAccountAuthority(
      client,
      async () => {
        throw new Error('authority unavailable');
      },
      'previous-authority',
      () => true,
    ),
    /authority unavailable/,
  );
  assert.equal(observer.getCurrentResult().data, undefined);
  assert.equal(reads, 0);
  unsubscribe();
  client.clear();
});
