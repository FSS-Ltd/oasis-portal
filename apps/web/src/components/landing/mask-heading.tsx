'use client';

import { Fragment, useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { landingEase, useMotionOK, useMounted } from './motion-utils';

/**
 * Section heading with the masked word-by-word rise used across the page.
 * Words are visible in server HTML and only hide after hydration, off-screen.
 */
export function MaskHeading({ className, text }: { className?: string; text: string }) {
  const ref = useRef<HTMLHeadingElement>(null);
  const mounted = useMounted();
  const motionOK = useMotionOK();
  const inView = useInView(ref, { margin: '-12% 0px -12% 0px', once: true });
  const shown = !mounted || !motionOK || inView;
  const words = text.split(' ');

  return (
    <h2 className={className} ref={ref}>
      {words.map((word, index) => (
        <Fragment key={`${word}-${String(index)}`}>
          <span className="landing-mask">
            <motion.span
              animate={shown ? 'show' : 'hidden'}
              className="landing-mask__word"
              initial={false}
              variants={{
                hidden: { rotate: 3, transition: { duration: 0 }, y: '115%' },
                show: {
                  rotate: 0,
                  transition: { delay: index * 0.045, duration: 0.7, ease: landingEase },
                  y: '0%',
                },
              }}
            >
              {word}
            </motion.span>
          </span>{' '}
        </Fragment>
      ))}
    </h2>
  );
}
