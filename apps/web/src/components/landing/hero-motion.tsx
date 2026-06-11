'use client';

import { motion, useScroll, useTransform } from 'framer-motion';
import { useIsMobile, useMotionOK, useMounted } from './motion-utils';

/**
 * Layered hero backdrop: the existing line texture plus two slow aurora blobs,
 * each parallaxed at its own speed. The hero is always at the top of the page,
 * so raw scrollY ranges stand in for section progress.
 */
export function HeroBackdrop() {
  const mounted = useMounted();
  const motionOK = useMotionOK();
  const isMobile = useIsMobile();
  const { scrollY } = useScroll();
  const depth = isMobile ? 0.4 : 1;
  const textureY = useTransform(scrollY, [0, 900], [0, 60 * depth]);
  const auroraAY = useTransform(scrollY, [0, 900], [0, 140 * depth]);
  const auroraBY = useTransform(scrollY, [0, 900], [0, -90 * depth]);
  const active = mounted && motionOK;

  return (
    <div aria-hidden="true" className="landing-hero__backdrop">
      <motion.div className="landing-hero__bg" style={active ? { y: textureY } : {}} />
      <motion.div
        className="landing-aurora landing-aurora--a"
        style={active ? { y: auroraAY } : {}}
      >
        <div className="landing-aurora__blob landing-aurora__blob--a" />
      </motion.div>
      <motion.div
        className="landing-aurora landing-aurora--b"
        style={active ? { y: auroraBY } : {}}
      >
        <div className="landing-aurora__blob landing-aurora__blob--b" />
      </motion.div>
    </div>
  );
}
