'use client';

import { useEffect, useRef, useState } from 'react';
import {
  nextKnownDeadline,
  scheduleKnownDeadline,
  type KnownDeadline,
} from '../realtime/deadline-clock';

/** Render at the next known due time. No periodic state-discovery request. */
export function useDeadlineClock(
  deadlines: readonly KnownDeadline[],
  onDeadline?: () => void,
): Date {
  const [, render] = useState(0);
  const callback = useRef(onDeadline);
  callback.current = onDeadline;
  const next = nextKnownDeadline(deadlines);
  useEffect(
    () =>
      scheduleKnownDeadline(next, () => {
        render((count) => count + 1);
        if (document.visibilityState === 'visible') callback.current?.();
      }),
    [next],
  );
  return new Date();
}
