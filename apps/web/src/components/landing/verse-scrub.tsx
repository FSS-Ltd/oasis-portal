'use client';

import { useRef } from 'react';
import { motion, useScroll, useTransform, type MotionValue } from 'framer-motion';
import { useMotionOK, useMounted } from './motion-utils';

interface ScrubWordProps {
  index: number;
  progress: MotionValue<number>;
  total: number;
  word: string;
}

function ScrubWord({ index, progress, total, word }: ScrubWordProps) {
  const opacity = useTransform(progress, [index / total, (index + 1) / total], [0.16, 1]);
  return (
    <motion.span className="landing-verse__word" style={{ opacity }}>
      {word}{' '}
    </motion.span>
  );
}

/**
 * The term verse brightens word by word as it scrolls through the viewport,
 * scrubbing in both directions. Plain full-opacity text on the server and
 * under reduced motion.
 */
export function VerseScrub({ reference, text }: { reference: string; text: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const mounted = useMounted();
  const motionOK = useMotionOK();
  const { scrollYProgress } = useScroll({ offset: ['start 0.92', 'start 0.45'], target: ref });
  const referenceOpacity = useTransform(scrollYProgress, [0.82, 1], [0, 1]);
  const words = text.split(' ');
  const active = mounted && motionOK;

  return (
    <div ref={ref}>
      <strong className="landing-term-card__big landing-term-card__big--verse">
        {active
          ? words.map((word, index) => (
              <ScrubWord
                index={index}
                key={`${word}-${String(index)}`}
                progress={scrollYProgress}
                total={words.length}
                word={word}
              />
            ))
          : text}
      </strong>
      <motion.p
        className="landing-term-card__sub"
        style={active ? { opacity: referenceOpacity } : {}}
      >
        {reference}
      </motion.p>
    </div>
  );
}
