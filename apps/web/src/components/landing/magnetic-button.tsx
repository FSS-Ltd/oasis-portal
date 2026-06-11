'use client';

import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import { motion, useMotionValue, useSpring } from 'framer-motion';
import { useFinePointer, useMotionOK } from './motion-utils';

/**
 * Spring-magnet wrapper for CTA buttons: the button leans up to ~10px toward
 * the cursor and springs back on leave. Inert on touch and reduced motion.
 */
export function MagneticButton({ children }: { children: ReactNode }) {
  const motionOK = useMotionOK();
  const finePointer = useFinePointer();
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const x = useSpring(rawX, { damping: 14, stiffness: 160 });
  const y = useSpring(rawY, { damping: 14, stiffness: 160 });
  const enabled = motionOK && finePointer;

  const onPointerMove = (event: ReactPointerEvent<HTMLSpanElement>) => {
    if (!enabled) return;
    const rect = event.currentTarget.getBoundingClientRect();
    rawX.set(((event.clientX - rect.left) / rect.width - 0.5) * 20);
    rawY.set(((event.clientY - rect.top) / rect.height - 0.5) * 16);
  };

  const reset = () => {
    rawX.set(0);
    rawY.set(0);
  };

  return (
    <motion.span
      className="landing-magnet"
      onPointerLeave={reset}
      onPointerMove={onPointerMove}
      style={{ x, y }}
    >
      {children}
    </motion.span>
  );
}
