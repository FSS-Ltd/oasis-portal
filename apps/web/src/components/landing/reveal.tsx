'use client';

import { useRef, type ReactNode } from 'react';
import { motion, useInView } from 'framer-motion';
import { landingEase, useMotionOK, useMounted } from './motion-utils';

interface RevealProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  x?: number;
  y?: number;
}

/**
 * Scroll-triggered entrance. Server HTML renders fully visible; the hidden state
 * is applied (instantly) after hydration, so content is never invisible without JS.
 */
export function Reveal({ children, className, delay = 0, x = 0, y = 28 }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const mounted = useMounted();
  const motionOK = useMotionOK();
  const inView = useInView(ref, { margin: '-10% 0px -10% 0px', once: true });
  const shown = !mounted || !motionOK || inView;

  return (
    <motion.div
      animate={shown ? 'show' : 'hidden'}
      className={className ? `landing-reveal ${className}` : 'landing-reveal'}
      initial={false}
      ref={ref}
      variants={{
        hidden: { filter: 'blur(5px)', opacity: 0, transition: { duration: 0 }, x, y },
        show: {
          filter: 'blur(0px)',
          opacity: 1,
          transition: { delay, duration: 0.65, ease: landingEase },
          x: 0,
          y: 0,
        },
      }}
    >
      {children}
    </motion.div>
  );
}
