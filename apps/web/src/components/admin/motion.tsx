'use client';

import type { ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

const ease = [0.16, 1, 0.3, 1] as const;

export function MotionPage({ children }: { children: ReactNode }) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className="motion-page"
      initial={reduceMotion ? false : { opacity: 0, y: 10 }}
      transition={{ duration: 0.28, ease }}
    >
      {children}
    </motion.div>
  );
}

export function MotionList({ children }: { children: ReactNode }) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      animate="show"
      className="motion-list"
      initial={reduceMotion ? false : 'hidden'}
      variants={{
        hidden: {},
        show: {
          transition: {
            staggerChildren: reduceMotion ? 0 : 0.035,
          },
        },
      }}
    >
      {children}
    </motion.div>
  );
}

export function MotionItem({ children }: { children: ReactNode }) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      variants={{
        hidden: reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 },
        show: { opacity: 1, y: 0, transition: { duration: 0.22, ease } },
      }}
    >
      {children}
    </motion.div>
  );
}

export function MotionTableRow({ children }: { children: ReactNode }) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.tr
      variants={{
        hidden: reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 },
        show: { opacity: 1, y: 0, transition: { duration: 0.2, ease } },
      }}
    >
      {children}
    </motion.tr>
  );
}
