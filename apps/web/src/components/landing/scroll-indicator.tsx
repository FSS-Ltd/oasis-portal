'use client';

import { motion, useScroll, useTransform } from 'framer-motion';

export function ScrollIndicator() {
  const { scrollY } = useScroll();
  const opacity = useTransform(scrollY, [0, 140], [1, 0]);

  return (
    <motion.div aria-hidden="true" className="landing-scroll-cue" style={{ opacity }}>
      <span className="landing-scroll-cue__label">Scroll</span>
      <span className="landing-scroll-cue__line" />
    </motion.div>
  );
}
