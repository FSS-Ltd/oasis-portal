import assert from 'node:assert/strict';
import test from 'node:test';
import { detectPolling } from '../event-architecture.mjs';

test('rejects interval queries, interval timers, and repeated confirmation reads', () => {
  for (const code of [
    'useQuery(input, { refetchInterval: 30000 });',
    'window.setInterval(() => fetch("/api/data"), 1000);',
    'for (let attempt = 0; attempt < 8; attempt++) { await settings.refetch(); }',
    'while (pending) { await client.fetchQuery({ queryKey: ["status"] }); }',
  ]) {
    assert.ok(detectPolling(code, 'apps/web/src/feature.tsx').length > 0, code);
  }
});

test('permits one-shot deadlines and event-triggered refetches', () => {
  assert.deepEqual(
    detectPolling(
      `
    channel.on('changed', () => query.refetch());
    setTimeout(() => query.refetch(), expiresAt - Date.now());
  `,
      'apps/web/src/feature.tsx',
    ),
    [],
  );
});

test('usage heartbeat exception cannot permit additional reads or other files', () => {
  const file = 'apps/mobile/src/components/smoke/student-portal-smoke-screen.tsx';
  assert.deepEqual(
    detectPolling('setInterval(() => { heartbeat.mutate({ sessionKey }); }, 55000)', file),
    [],
  );
  assert.ok(
    detectPolling(
      'setInterval(() => { heartbeat.mutate({ sessionKey }); data.refetch(); }, 55000)',
      file,
    ).length > 0,
  );
  assert.ok(
    detectPolling(
      'setInterval(() => { heartbeat.mutate({ sessionKey }); }, 55000)',
      'apps/api/src/poller.ts',
    ).length > 0,
  );
});

test('countdown exception only permits the documented clock callback', () => {
  const file = 'apps/web/src/app/access-revoked/access-revoked-screen.tsx';
  assert.deepEqual(
    detectPolling('window.setInterval(updateCountdown, COUNTDOWN_INTERVAL_MS)', file),
    [],
  );
  assert.ok(detectPolling('window.setInterval(refreshData, 1000)', file).length > 0);
});

test('rejects self-scheduling data reads while allowing deadline-based scheduling', () => {
  for (const code of [
    'async function poll() { await query.refetch(); setTimeout(poll, 1000); }',
    'const poll = () => { setTimeout(async () => { await query.refetch(); poll(); }, 1000); };',
    'function refresh() { client.invalidateQueries(); setTimeout(refresh, 1000); }',
  ]) {
    assert.ok(detectPolling(code, 'apps/web/src/feature.tsx').length > 0);
  }
  assert.deepEqual(
    detectPolling(
      `
    function midnight() {
      setTimeout(() => { query.refetch(); midnight(); }, nextLondonMidnight().getTime() - Date.now());
    }
  `,
      'apps/web/src/feature.tsx',
    ),
    [],
  );
});
