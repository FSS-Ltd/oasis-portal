import { Fragment, type CSSProperties } from 'react';

/**
 * Server-rendered masked words for the hero headline. The entrance runs as a pure
 * CSS keyframe (see landing-motion.css), so it starts at first paint, needs no JS,
 * and is disabled wholesale under prefers-reduced-motion.
 */
export function SplitWords({ from = 0, text }: { from?: number; text: string }) {
  return (
    <>
      {text.split(' ').map((word, index) => (
        <Fragment key={`${word}-${String(index)}`}>
          <span className="landing-mask">
            <span
              className="landing-mask__inner"
              style={{ '--i': from + index } as CSSProperties}
            >
              {word}
            </span>
          </span>{' '}
        </Fragment>
      ))}
    </>
  );
}
