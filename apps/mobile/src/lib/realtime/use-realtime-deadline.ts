import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import {
  nextKnownDeadline,
  scheduleKnownDeadline,
  type KnownDeadline,
  type RealtimeArea,
} from '@oasis/domain';

/** Refresh a known expiry once; foreground subscription catch-up handles suspended timers. */
export function useRealtimeDeadline(
  deadlines: readonly KnownDeadline[],
  areas: readonly RealtimeArea[],
): void {
  const client = useQueryClient();
  const currentAreas = useRef(areas);
  currentAreas.current = areas;
  const deadline = nextKnownDeadline(deadlines);
  useEffect(
    () =>
      scheduleKnownDeadline(deadline, () => {
        if (AppState.currentState !== 'active') return;
        if (
          Platform.OS === 'web' &&
          typeof document !== 'undefined' &&
          document.visibilityState === 'hidden'
        )
          return;
        // Query errors remain in their existing observers; do not retry or poll here.
        void client.invalidateQueries({
          predicate(query) {
            const path: unknown = query.queryKey[0];
            return Array.isArray(path) && currentAreas.current.some((area) => path[0] === area);
          },
          refetchType: 'active',
        });
      }),
    [client, deadline],
  );
}
