'use client';

import { useEffect, type ReactNode } from 'react';
import { MotionConfig } from 'framer-motion';
import Lenis from 'lenis';

const NAV_OFFSET = -88;

/**
 * Inertial smooth scrolling for the landing page only. Lenis drives native window
 * scroll, so `position: sticky` and Framer's `useScroll` keep working untouched.
 * Touch scrolling stays native and reduced-motion users never get an instance.
 */
export function LenisProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const lenis = new Lenis({ lerp: 0.1 });
    let frame = requestAnimationFrame(function raf(time) {
      lenis.raf(time);
      frame = requestAnimationFrame(raf);
    });

    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest('a[href^="#"]');
      if (!(anchor instanceof HTMLAnchorElement)) return;
      const id = decodeURIComponent(anchor.hash.slice(1));
      if (!id) return;
      const section = document.getElementById(id);
      if (!section) return;
      event.preventDefault();
      lenis.scrollTo(section, { offset: NAV_OFFSET });
    };

    document.addEventListener('click', onClick);

    return () => {
      document.removeEventListener('click', onClick);
      cancelAnimationFrame(frame);
      lenis.destroy();
    };
  }, []);

  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
