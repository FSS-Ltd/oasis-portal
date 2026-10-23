import { REALTIME_AREAS, parseDataChangedEvent, type RealtimeArea } from './events.js';

interface RealtimeRefreshOptions {
  refresh: (areas: readonly RealtimeArea[], reconcile: boolean) => Promise<void>;
  onError: (error: unknown) => void;
}

export interface RealtimeRefreshCoordinator {
  receive: (payload: unknown) => boolean;
  enqueue: (areas: readonly RealtimeArea[]) => void;
  reconcile: () => void;
  dispose: () => void;
}

const BATCH_WINDOW_MS = 100;
const REMEMBERED_EVENT_LIMIT = 2_048;

/** Coalesces notifications; it never schedules an idle discovery read or retry. */
export function createRealtimeRefreshCoordinator(
  options: RealtimeRefreshOptions,
): RealtimeRefreshCoordinator {
  const pending = new Set<RealtimeArea>();
  const seen = new Set<string>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let running = false;
  let disposed = false;
  let reconciliationPending = false;

  function isDisposed(): boolean {
    return disposed;
  }

  function schedule(): void {
    if (disposed || running || timer !== undefined || pending.size === 0) return;
    timer = setTimeout(() => {
      timer = undefined;
      void flush();
    }, BATCH_WINDOW_MS);
  }

  async function flush(): Promise<void> {
    if (disposed || running || pending.size === 0) return;
    const areas = [...pending];
    const reconcile = reconciliationPending;
    pending.clear();
    reconciliationPending = false;
    running = true;
    try {
      await options.refresh(areas, reconcile);
    } catch (error) {
      if (!isDisposed()) options.onError(error);
    } finally {
      running = false;
      schedule();
    }
  }

  function enqueue(areas: readonly RealtimeArea[]): void {
    if (disposed) return;
    for (const area of areas) pending.add(area);
    schedule();
  }

  return {
    receive(payload) {
      if (disposed) return false;
      const event = parseDataChangedEvent(payload);
      if (!event || seen.has(event.eventId)) return false;
      seen.add(event.eventId);
      if (seen.size > REMEMBERED_EVENT_LIMIT) {
        const oldest = seen.values().next().value;
        if (oldest !== undefined) seen.delete(oldest);
      }
      enqueue(event.areas);
      return true;
    },
    enqueue,
    reconcile() {
      if (disposed) return;
      for (const area of REALTIME_AREAS) pending.add(area);
      reconciliationPending = true;
      if (timer !== undefined) clearTimeout(timer);
      timer = undefined;
      void flush();
    },
    dispose() {
      disposed = true;
      if (timer !== undefined) clearTimeout(timer);
      timer = undefined;
      pending.clear();
      seen.clear();
    },
  };
}
