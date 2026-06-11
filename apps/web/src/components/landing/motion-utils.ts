'use client';

import { useEffect, useState } from 'react';
import { useReducedMotion } from 'framer-motion';

export const landingEase = [0.16, 1, 0.3, 1] as const;

export function useMediaQuery(query: string, defaultValue: boolean): boolean {
  const [matches, setMatches] = useState(defaultValue);

  useEffect(() => {
    const list = window.matchMedia(query);
    setMatches(list.matches);
    const onChange = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };
    list.addEventListener('change', onChange);
    return () => {
      list.removeEventListener('change', onChange);
    };
  }, [query]);

  return matches;
}

/** Mouse-driven effects (tilt, magnetic buttons) only make sense with a hovering pointer. */
export function useFinePointer(): boolean {
  return useMediaQuery('(hover: hover) and (pointer: fine)', false);
}

/** Mirrors the 900px breakpoint where the landing layout switches to its mobile mode. */
export function useIsMobile(): boolean {
  return useMediaQuery('(max-width: 900px)', true);
}

/**
 * True once hydrated. Scroll-reveal components render fully visible on the server
 * and only adopt hidden states after mount, so SSR HTML never hides content.
 */
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  return mounted;
}

export function useMotionOK(): boolean {
  const reduceMotion = useReducedMotion();
  return reduceMotion !== true;
}
