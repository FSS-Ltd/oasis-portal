import { createElement } from 'react';
import { QueryClient, QueryClientProvider, QueryObserver } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import { mobileTestRenderer } from '../../test-utils/mobile-test-renderer';
import { useRealtimeDeadline } from './use-realtime-deadline';

vi.mock('react-native', () => ({ AppState: { currentState: 'active' }, Platform: { OS: 'ios' } }));
afterEach(() => vi.useRealTimers());

it('refreshes expiring notices once at their deadline without idle polling', async () => {
  vi.useFakeTimers();
  const client = new QueryClient();
  const read = vi.fn(() => Promise.resolve([]));
  const observer = new QueryObserver(client, {
    queryKey: [['notice', 'listForParents']],
    queryFn: read,
    initialData: [],
    staleTime: Infinity,
  });
  const stop = observer.subscribe(() => undefined);
  const expiresAt = new Date(Date.now() + 1_000);
  function Notices() {
    useRealtimeDeadline([expiresAt], ['notice']);
    return null;
  }
  let renderer: ReturnType<typeof mobileTestRenderer.create> | undefined;
  mobileTestRenderer.act(() => {
    renderer = mobileTestRenderer.create(
      createElement(QueryClientProvider, { client }, createElement(Notices)),
    );
  });
  await vi.advanceTimersByTimeAsync(999);
  expect(read).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(2);
  expect(read).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(60_000);
  expect(read).toHaveBeenCalledTimes(1);
  mobileTestRenderer.act(() => {
    renderer?.unmount();
  });
  stop();
  client.clear();
});
