'use client';

import { useRef, type ReactNode } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { useMotionOK, useMounted } from './motion-utils';

interface ParallaxProps {
  children?: ReactNode;
  className?: string;
  from?: number;
  to?: number;
}

/**
 * Moves its inner layer between `from` and `to` (px) as the outer, untransformed
 * element transits the viewport. Used for decorative background layers.
 */
export function Parallax({ children, className, from = -40, to = 40 }: ParallaxProps) {
  const ref = useRef<HTMLDivElement>(null);
  const mounted = useMounted();
  const motionOK = useMotionOK();
  const { scrollYProgress } = useScroll({ offset: ['start end', 'end start'], target: ref });
  const y = useTransform(scrollYProgress, [0, 1], [from, to]);

  return (
    <div className={className} ref={ref}>
      <motion.div
        className="landing-parallax__inner"
        style={mounted && motionOK ? { y } : {}}
      >
        {children}
      </motion.div>
    </div>
  );
}
