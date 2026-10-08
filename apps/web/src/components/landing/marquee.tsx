const marqueeItems = [
  'Attendance',
  'Merits',
  'PACE progress',
  'Fees',
  'Permission slips',
  'Merit shop',
  'Messages',
] as const;

/**
 * CSS-only infinite keyword marquee between the hero and the role decks.
 * Content is duplicated once so the -50% translate loops seamlessly.
 */
export function LandingMarquee() {
  return (
    <div aria-hidden="true" className="landing-marquee">
      <div className="landing-marquee__track">
        {[0, 1].map((copy) => (
          <div className="landing-marquee__group" key={copy}>
            {marqueeItems.map((item) => (
              <span className="landing-marquee__item" key={item}>
                {item}
                <span className="landing-marquee__dot" />
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
