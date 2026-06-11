'use client';

import { Children, useRef, type CSSProperties, type ReactNode } from 'react';
import { motion, useScroll, useTransform, type MotionValue } from 'framer-motion';
import { useIsMobile, useMotionOK, useMounted } from './motion-utils';

const DECK_TOP = 108;
const DECK_STEP = 16;

interface DeckCardProps {
  children: ReactNode;
  index: number;
  progress: MotionValue<number>;
  total: number;
}

function DeckCard({ children, index, progress, total }: DeckCardProps) {
  const mounted = useMounted();
  const motionOK = useMotionOK();
  const isMobile = useIsMobile();
  const isLast = index === total - 1;
  const from = index / total;
  const to = (index + 1) / total;
  const scale = useTransform(progress, [from, to], [1, 0.94]);
  const filter = useTransform(progress, [from, to], ['brightness(1)', 'brightness(0.82)']);
  const active = mounted && motionOK && !isMobile && !isLast;
  const deckTop = { '--deck-top': `${String(DECK_TOP + index * DECK_STEP)}px` } as CSSProperties;

  return (
    <div className="landing-role-deck__card" style={deckTop}>
      <motion.div
        className="landing-role-deck__inner"
        style={active ? { filter, scale } : {}}
      >
        {children}
      </motion.div>
    </div>
  );
}

/**
 * Sticky-stacking deck for the four role panels. The deck container (never
 * transformed) drives one scroll progress; each card recedes as the next
 * arrives. Below 900px the cards are plain flow with no transforms.
 */
export function RoleDeck({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const items = Children.toArray(children);
  const { scrollYProgress } = useScroll({ offset: ['start 0.25', 'end end'], target: ref });

  return (
    <div className="landing-role-deck" ref={ref}>
      {items.map((child, index) => (
        <DeckCard index={index} key={index} progress={scrollYProgress} total={items.length}>
          {child}
        </DeckCard>
      ))}
    </div>
  );
}
