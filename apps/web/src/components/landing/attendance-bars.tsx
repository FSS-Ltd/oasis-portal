'use client';

import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { landingEase, useMotionOK, useMounted } from './motion-utils';

/** Weekly attendance bars that grow from the baseline once scrolled into view. */
export function AttendanceBars({ heights }: { heights: string[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const mounted = useMounted();
  const motionOK = useMotionOK();
  const inView = useInView(ref, { margin: '-15% 0px -15% 0px', once: true });
  const shown = !mounted || !motionOK || inView;

  return (
    <div aria-hidden="true" className="landing-attendance-bars" ref={ref}>
      {heights.map((height, index) => (
        <motion.span
          animate={shown ? 'show' : 'hidden'}
          initial={false}
          key={`${String(index)}-${height}`}
          style={{ height, originY: 1 }}
          variants={{
            hidden: { scaleY: 0, transition: { duration: 0 } },
            show: {
              scaleY: 1,
              transition: { delay: index * 0.07, duration: 0.7, ease: landingEase },
            },
          }}
        />
      ))}
    </div>
  );
}
