'use client';

import type { PointerEvent as ReactPointerEvent } from 'react';
import {
  motion,
  useMotionValue,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from 'framer-motion';
import { FileText } from 'lucide-react';
import { useFinePointer, useIsMobile, useMotionOK, useMounted } from './motion-utils';

const behaviourPreviewRows = [
  {
    initials: 'GW',
    colour: '#7D3C98',
    title: 'Scripture memory / Grace W.',
    sub: 'Psalm 23, word-perfect',
    delta: '+10',
    positive: true,
  },
  {
    initials: 'DP',
    colour: '#7D1C2C',
    title: 'Late to assembly / Daniel P.',
    sub: 'No prior notification',
    delta: '-5',
    positive: false,
  },
  {
    initials: 'EB',
    colour: '#0E7490',
    title: 'PACE 1097 / 95% / Esther B.',
    sub: 'Mathematics test',
    delta: '+15',
    positive: true,
  },
] as const;

interface CardStyle {
  rotateX: MotionValue<number>;
  rotateY: MotionValue<number>;
  x: MotionValue<number>;
  y: MotionValue<number>;
}

/**
 * Combines per-card scroll parallax with pointer tilt on a single transform.
 * `depth` scales the tilt, `drift` is the scroll travel in px at full speed.
 */
function usePreviewCard(
  scrollY: MotionValue<number>,
  tiltX: MotionValue<number>,
  tiltY: MotionValue<number>,
  depth: number,
  drift: number,
  scrollFactor: number,
): CardStyle {
  const scrollOffset = useTransform(scrollY, [0, 760], [0, drift * scrollFactor]);
  const x = useTransform(() => tiltX.get() * 16 * depth);
  const y = useTransform(() => scrollOffset.get() + tiltY.get() * 12 * depth);
  const rotateX = useTransform(() => tiltY.get() * -2.2 * depth);
  const rotateY = useTransform(() => tiltX.get() * 2.2 * depth);
  return { rotateX, rotateY, x, y };
}

export function HeroPreview() {
  const mounted = useMounted();
  const motionOK = useMotionOK();
  const finePointer = useFinePointer();
  const isMobile = useIsMobile();
  const { scrollY } = useScroll();

  const rawTiltX = useMotionValue(0);
  const rawTiltY = useMotionValue(0);
  const tiltX = useSpring(rawTiltX, { damping: 20, stiffness: 120 });
  const tiltY = useSpring(rawTiltY, { damping: 20, stiffness: 120 });

  const scrollFactor = isMobile ? 0.3 : 1;
  const merits = usePreviewCard(scrollY, tiltX, tiltY, 1, -50, scrollFactor);
  const behaviour = usePreviewCard(scrollY, tiltX, tiltY, 0.55, -110, scrollFactor);
  const slip = usePreviewCard(scrollY, tiltX, tiltY, 1.35, -26, scrollFactor);
  const containerOpacity = useTransform(scrollY, [300, 760], [1, 0.35]);

  const active = mounted && motionOK;
  const tiltActive = active && finePointer;

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!tiltActive) return;
    const rect = event.currentTarget.getBoundingClientRect();
    rawTiltX.set(((event.clientX - rect.left) / rect.width) * 2 - 1);
    rawTiltY.set(((event.clientY - rect.top) / rect.height) * 2 - 1);
  };

  const onPointerLeave = () => {
    rawTiltX.set(0);
    rawTiltY.set(0);
  };

  return (
    <motion.div
      aria-hidden="true"
      className="landing-preview"
      onPointerLeave={onPointerLeave}
      onPointerMove={onPointerMove}
      style={active ? { opacity: containerOpacity } : {}}
    >
      <div className="landing-preview-item landing-preview-item--merits">
        <motion.article
          className="landing-preview-card landing-preview-card--merits"
          style={active ? merits : {}}
        >
          <p className="landing-preview-card__eyebrow">Grace Williams / L8</p>
          <p className="landing-preview-card__meta">Merit balance</p>
          <div className="landing-preview-card__amount">
            238 <span>spend</span>
          </div>
          <div className="landing-preview-card__accounts">
            <span>
              <strong>150</strong>
              Saving
            </span>
            <span>
              <strong>200</strong>
              Invest
            </span>
            <span>
              <strong>15%</strong>
              Tithe
            </span>
          </div>
          <div className="landing-preview-card__bar">
            <span />
          </div>
          <small>68% to next reward tier</small>
        </motion.article>
      </div>

      <div className="landing-preview-item landing-preview-item--behaviour">
        <motion.article
          className="landing-preview-card landing-preview-card--behaviour"
          style={active ? behaviour : {}}
        >
          <div className="landing-preview-card__head">
            <h3>Today / Behaviour log</h3>
            <span>Tue 27 May</span>
          </div>
          {behaviourPreviewRows.map((row) => (
            <div className="landing-preview-row" key={row.title}>
              <span className="landing-preview-row__avatar" style={{ backgroundColor: row.colour }}>
                {row.initials}
              </span>
              <span>
                <strong>{row.title}</strong>
                <small>{row.sub}</small>
              </span>
              <em className={row.positive ? 'is-positive' : 'is-negative'}>{row.delta}</em>
            </div>
          ))}
        </motion.article>
      </div>

      <div className="landing-preview-item landing-preview-item--slip">
        <motion.article
          className="landing-preview-card landing-preview-card--slip"
          style={active ? slip : {}}
        >
          <div className="landing-preview-slip__head">
            <span>
              <FileText aria-hidden="true" size={16} />
            </span>
            <div>
              <h3>Permission slip due</h3>
              <p>Cathedral trip / Fri 6 Jun</p>
            </div>
          </div>
          <p>2 of 3 children signed. Tap to e-sign Joseph&apos;s slip.</p>
          <span className="landing-preview-slip__button">E-sign now</span>
        </motion.article>
      </div>
    </motion.div>
  );
}
