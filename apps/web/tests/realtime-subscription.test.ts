import assert from 'node:assert/strict';
import test from 'node:test';
import { REALTIME_DATA_EVENT } from '@oasis/domain';
import {
  startRealtimeSubscription,
  tokenRefreshDelay,
  type RealtimeChannelAdapter,
} from '../src/lib/realtime/subscription';

function harness() {
  const callbacks = new Map<string, (payload: unknown) => void>();
  let status: ((status: string) => void) | undefined;
  const calls: string[] = [];
  const channel: RealtimeChannelAdapter = {
    onBroadcast(event, callback) {
      callbacks.set(event, callback);
      calls.push('listen');
    },
    subscribe(callback) {
      status = callback;
      calls.push('subscribe');
    },
    async remove() {
      calls.push('remove');
    },
  };
  return { channel, callbacks, calls, status: (value: string) => status?.(value) };
}
const settle = () =>
  new Promise<void>((resolve) => {
    setImmediate(resolve);
  });

test('authenticate and attach handlers before subscribing; catch up only after SUBSCRIBED', async () => {
  const transport = harness();
  const stop = startRealtimeSubscription({
    channel: transport.channel,
    getToken: async () => {
      transport.calls.push('token');
      return 'test-token';
    },
    setAuth: async () => {
      transport.calls.push('auth');
    },
    receive: () => {
      transport.calls.push('event');
    },
    receiveLegacy: () => {
      transport.calls.push('legacy');
    },
    subscribed: () => {
      transport.calls.push('catchup');
    },
    disconnected: () => {
      transport.calls.push('disconnect');
    },
    failed: () => {
      transport.calls.push('error');
    },
  });
  await settle();
  assert.equal(transport.calls.includes('catchup'), false);
  assert.ok(transport.calls.indexOf('auth') < transport.calls.indexOf('subscribe'));
  transport.status('SUBSCRIBED');
  assert.equal(transport.calls.at(-1), 'catchup');
  transport.callbacks.get(REALTIME_DATA_EVENT)?.({ eventId: 'changed' });
  assert.equal(transport.calls.at(-1), 'event');
  transport.status('CHANNEL_ERROR');
  assert.equal(transport.calls.at(-1), 'disconnect');
  transport.status('SUBSCRIBED');
  assert.equal(transport.calls.at(-1), 'catchup');
  stop();
  const after = transport.calls.length;
  transport.status('SUBSCRIBED');
  transport.callbacks.get(REALTIME_DATA_EVENT)?.({});
  assert.equal(transport.calls.length, after);
});

test('teardown before token resolution cannot subscribe or start a catchup read', async () => {
  const transport = harness();
  let resolveToken: (token: string) => void = () => {};
  const token = new Promise<string>((resolve) => {
    resolveToken = resolve;
  });
  const stop = startRealtimeSubscription({
    channel: transport.channel,
    getToken: () => token,
    setAuth: async () => {
      transport.calls.push('auth');
    },
    receive() {},
    receiveLegacy() {},
    subscribed() {
      transport.calls.push('catchup');
    },
    disconnected() {},
    failed() {
      transport.calls.push('error');
    },
  });
  stop();
  resolveToken('test-token');
  await settle();
  assert.equal(transport.calls.includes('subscribe'), false);
  assert.equal(transport.calls.includes('auth'), false);
  assert.equal(transport.calls.includes('catchup'), false);
});

test('token refresh schedules from JWT expiry with no database timer', () => {
  const token = `header.${btoa(JSON.stringify({ exp: 100 }))}.signature`;
  assert.equal(tokenRefreshDelay(token, 60_000), 30_000);
  assert.equal(tokenRefreshDelay(token, 99_000), 1_000);
  assert.equal(tokenRefreshDelay('invalid'), null);
});
