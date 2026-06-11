'use client';

import { useEffect, useRef } from 'react';
import { animate, motion, useInView, useMotionValue, useTransform } from 'framer-motion';
import { landingEase, useMotionOK } from './motion-utils';

/**
 * Animated percentage counter. SSR (and reduced motion) render the real final
 * value; the 0 -> value sweep only starts once the element scrolls into view.
 */
export function Counter({ value }: { value: number | null }) {
  const ref = useRef<HTMLSpanElement>(null);
  const motionOK = useMotionOK();
  const inView = useInView(ref, { margin: '-15% 0px -15% 0px', once: true });
  const count = useMotionValue(value ?? 0);
  const display = useTransform(count, (current) => `${current.toFixed(1)}%`);

  useEffect(() => {
    if (!inView || !motionOK || value === null) return;
    count.set(0);
    const controls = animate(count, value, { duration: 1.6, ease: landingEase });
    return () => {
      controls.stop();
    };
  }, [count, inView, motionOK, value]);

  if (value === null) {
    return <span ref={ref}>-</span>;
  }

  return <motion.span ref={ref}>{display}</motion.span>;
}
