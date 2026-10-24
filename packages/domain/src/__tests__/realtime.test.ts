import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  REALTIME_AREAS,
  createRealtimeRefreshCoordinator,
  nextLondonMidnight,
  parseDataChangedEvent,
  type RealtimeArea,
} from '../realtime/index.js';

const event = {
  eventId: 'd988598b-8254-4d05-a3c5-1fbcd9ce1781',
  areas: ['pace', 'report'],
  occurredAt: '2026-10-23T12:00:00.000Z',
};

afterEach(() => vi.useRealTimers());

describe('private invalidation events', () => {
  it('accepts the managed broadcast UUID without exposing transport metadata', () => {
    const transportId = 'd988598b-8254-4d05-a3c5-1fbcd9ce1782';
    expect(parseDataChangedEvent({ ...event, id: transportId })).toEqual(event);
    expect(parseDataChangedEvent({ ...event, id: 'record-identifier' })).toBeNull();
    expect(parseDataChangedEvent({ ...event, id: 123 })).toBeNull();
    expect(parseDataChangedEvent({ ...event, id: transportId, record: {} })).toBeNull();
  });

  it('accepts metadata and rejects unknown areas, identifiers, timestamps, and record contents', () => {
    expect(parseDataChangedEvent(event)).toEqual(event);
    for (const invalid of [
      null,
      { ...event, eventId: '' },
      { ...event, occurredAt: 'tomorrow' },
      { ...event, areas: [] },
      { ...event, areas: ['unknown'] },
      { ...event, areas: ['pace', 'pace'] },
      { ...event, record: { studentName: 'private' } },
    ]) {
      expect(parseDataChangedEvent(invalid)).toBeNull();
    }
  });
});

describe('event-driven refresh coordination', () => {
  it('makes no idle reads, batches affected areas, and ignores duplicate deliveries', async () => {
    vi.useFakeTimers();
    const calls: RealtimeArea[][] = [];
    const coordinator = createRealtimeRefreshCoordinator({
      refresh: (areas) => {
        calls.push([...areas]);
        return Promise.resolve();
      },
      onError: () => {
        throw new Error('Unexpected refresh error');
      },
    });
    await vi.advanceTimersByTimeAsync(60 * 60 * 1000);
    expect(calls).toEqual([]);
    expect(coordinator.receive(event)).toBe(true);
    expect(coordinator.receive(event)).toBe(false);
    coordinator.enqueue(['student', 'pace']);
    await vi.advanceTimersByTimeAsync(99);
    expect(calls).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    expect(calls).toEqual([['pace', 'report', 'student']]);
    await vi.advanceTimersByTimeAsync(60 * 60 * 1000);
    expect(calls).toHaveLength(1);
    coordinator.dispose();
  });

  it('subsequently refreshes changes received during catch-up without overlapping reads', async () => {
    vi.useFakeTimers();
    let finish: (() => void) | undefined;
    const calls: { areas: readonly RealtimeArea[]; reconcile: boolean }[] = [];
    const coordinator = createRealtimeRefreshCoordinator({
      refresh: (areas, reconcile) => {
        calls.push({ areas, reconcile });
        return new Promise<void>((resolve) => {
          finish = resolve;
        });
      },
      onError: () => undefined,
    });
    coordinator.reconcile();
    expect(calls).toEqual([{ areas: [...REALTIME_AREAS], reconcile: true }]);
    coordinator.receive(event);
    coordinator.enqueue(['pace']);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(calls).toHaveLength(1);
    finish?.();
    await vi.advanceTimersByTimeAsync(100);
    expect(calls).toHaveLength(2);
    expect(calls[1]).toEqual({ areas: ['pace', 'report'], reconcile: false });
    coordinator.dispose();
    finish?.();
  });

  it('reports failed reads once and retries only after an event or explicit reconciliation', async () => {
    vi.useFakeTimers();
    let count = 0;
    const errors: unknown[] = [];
    const coordinator = createRealtimeRefreshCoordinator({
      refresh: () => {
        count += 1;
        return Promise.reject(new Error('offline'));
      },
      onError: (error) => errors.push(error),
    });
    coordinator.reconcile();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(count).toBe(1);
    expect(errors).toHaveLength(1);
    coordinator.reconcile();
    await vi.advanceTimersByTimeAsync(1);
    expect(count).toBe(2);
    coordinator.dispose();
  });

  it('drops scheduled work and suppresses late failure callbacks after disposal', async () => {
    vi.useFakeTimers();
    let rejectRead: ((error: Error) => void) | undefined;
    const refresh = vi.fn(
      () =>
        new Promise<void>((_resolve, reject) => {
          rejectRead = reject;
        }),
    );
    const onError = vi.fn();
    const coordinator = createRealtimeRefreshCoordinator({ refresh, onError });
    coordinator.enqueue(['pace']);
    coordinator.dispose();
    coordinator.reconcile();
    expect(coordinator.receive(event)).toBe(false);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(refresh).not.toHaveBeenCalled();

    const running = createRealtimeRefreshCoordinator({ refresh, onError });
    running.reconcile();
    running.dispose();
    rejectRead?.(new Error('late network error'));
    await vi.advanceTimersByTimeAsync(1);
    expect(onError).not.toHaveBeenCalled();
  });
});

describe('one-shot London calendar boundary', () => {
  it.each([
    ['2026-10-23T12:00:00Z', '2026-10-23T23:00:00.000Z'],
    ['2026-10-24T23:30:00Z', '2026-10-26T00:00:00.000Z'],
    ['2026-03-28T23:30:00Z', '2026-03-29T00:00:00.000Z'],
    ['2026-03-29T00:30:00Z', '2026-03-29T23:00:00.000Z'],
    ['2026-12-31T23:59:59Z', '2027-01-01T00:00:00.000Z'],
  ])('schedules the next local midnight from %s', (now, expected) => {
    expect(nextLondonMidnight(new Date(now)).toISOString()).toBe(expected);
  });
});
