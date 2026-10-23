import type { RealtimeArea } from '@oasis/domain';

const listeners = new Set<(areas: readonly RealtimeArea[]) => void>();

export function notifyRealtimeAreas(areas: readonly RealtimeArea[]): void {
  for (const listener of listeners) listener(areas);
}

export function subscribeRealtimeAreas(
  listener: (areas: readonly RealtimeArea[]) => void,
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
