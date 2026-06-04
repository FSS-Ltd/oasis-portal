import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  ArrowRight,
  BookOpen,
  CalendarCheck,
  Check,
  CreditCard,
  FileText,
  Globe2,
  Home,
  LockKeyhole,
  MessageCircle,
  ShoppingCart,
  Star,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { LandingCalendarEvent, LandingPageData } from './landing-data';

const signInHref = '/sign-in/' as const;

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

type RoleTone = 'leads' | 'parent' | 'staff' | 'student';

interface RoleCardContent {
  description: string;
  foot: string;
  id?: string;
  items: string[];
  tag: string;
  title: string;
  tone: RoleTone;
}

interface FeatureContent {
  description: string;
  icon: LucideIcon;
  tag: string;
  title: string;
}

interface TrustContent {
  description: string;
  icon: LucideIcon;
  title: string;
}

const roleCards: RoleCardContent[] = [
  {
    tone: 'parent',
    tag: 'For families',
    title: 'Parent Portal',
    description:
      'A weekly snapshot of each of your children without trawling through email threads.',
    items: [
      'Attendance, PACE progress and behaviour for every child in one place',
      'E-sign permission slips and pay fees from your phone',
      "Message your child's supervisor directly, no app store needed",
      'Sign up for after-school clubs and pay club fees',
    ],
    foot: 'Used by 184 families',
  },
  {
    id: 'students',
    tone: 'student',
    tag: 'For students',
    title: 'Student Portal',
    description:
      'A focused space for students to see their work, rewards and next steps without the noise.',
    items: [
      'Check PACE progress, recent scores and attendance at a glance',
      'Track merit balances across spend, save, invest and tithe pots',
      'Open clubs, notices, faith corner and shop from one student-safe view',
      'Respect parent and centre locks, quiet days and daily usage limits',
    ],
    foot: 'Student-safe access',
  },
  {
    id: 'staff',
    tone: 'staff',
    tag: 'For supervisors',
    title: 'Staff Portal',
    description:
      'Everything a supervisor or head needs to run the day: register, log, message, approve.',
    items: [
      'Morning register with one-tap merit and demerit entry',
      'PACE scoring, paper records and the audit log in one feed',
      'Approve refunds, write praise postcards, run the merit shop',
      'Issue, chase and reconcile term invoices and bursaries',
    ],
    foot: '4 staff seats / admin tier',
  },
  {
    id: 'leads',
    tone: 'leads',
    tag: 'For volunteers and leads',
    title: 'Clubs Lead Portal',
    description:
      'A trimmed-down view for the parents and volunteers who run our after-school clubs.',
    items: [
      'See only the clubs you lead: Drama, Chess, Bell-ringing',
      'Take register, record DBS status, message parents',
      'Mark merit entries that feed into the main portal',
      'Print weekly attendance for the Head of Centre',
    ],
    foot: '12 leads / invite-only',
  },
];

const features: FeatureContent[] = [
  {
    icon: CalendarCheck,
    title: 'Attendance and register',
    description:
      'Take the morning register from any device: late, absent, prior-notice, and parents see it live.',
    tag: 'All roles',
  },
  {
    icon: Star,
    title: 'Merits and demerits',
    description:
      "Award character, scripture or academic merits in two taps. Spend, save, invest or tithe: child's choice.",
    tag: 'Staff / Clubs Leads',
  },
  {
    icon: BookOpen,
    title: 'PACE progress',
    description:
      'Self-tests, PACE tests and completion dates for every booklet across all five subjects.',
    tag: 'All roles',
  },
  {
    icon: CreditCard,
    title: 'Fees and invoices',
    description:
      'Term invoices, sibling discounts, bursaries and one-tap card payments without chasing PDFs.',
    tag: 'Parent / Staff',
  },
  {
    icon: FileText,
    title: 'Permission slips',
    description:
      'Send a trip notice and parents e-sign from their phone, with full audit trail and reminders.',
    tag: 'Staff / Parent',
  },
  {
    icon: ShoppingCart,
    title: 'Merit shop',
    description:
      'Treats, privileges, vouchers, recognition: stock, allergens and pickup, all managed in-portal.',
    tag: 'All roles',
  },
  {
    icon: MessageCircle,
    title: 'Messages',
    description:
      'Threaded conversations between supervisors and parents, kept on record for safeguarding.',
    tag: 'All roles',
  },
  {
    icon: Users,
    title: 'Clubs and activities',
    description:
      'Drama, chess, bell-ringing: clubs leads run their own register, parents see attendance.',
    tag: 'All roles',
  },
];

const trustItems: TrustContent[] = [
  {
    icon: LockKeyhole,
    title: '2FA on every sign-in',
    description: 'TOTP or SMS, mandatory for staff. Optional for parents, but on by default.',
  },
  {
    icon: Globe2,
    title: 'UK/EU hosted',
    description:
      'All pupil data lives in eu-west-2 (London). GDPR-compliant with no transatlantic sync.',
  },
  {
    icon: MessageCircle,
    title: 'Full audit trail',
    description:
      'Every merit, refund, message and permission e-signature is logged with a name and time.',
  },
  {
    icon: Home,
    title: 'Built for one centre',
    description:
      'Not a generic schools SaaS. Every workflow is shaped around how Oasis actually runs.',
  },
];

function formatYearFromTermId(id: string): string {
  return id.slice(0, 4);
}

function formatEventDay(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', timeZone: 'UTC' }).format(date);
}

function formatEventMonth(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', { month: 'short', timeZone: 'UTC' }).format(date);
}

function formatAttendanceValue(rate: number | null): string {
  return rate === null ? '-' : `${rate.toFixed(1)}%`;
}

function formatAttendanceSub(data: LandingPageData): string {
  if (data.attendance.attendanceRate === null) {
    return `No centre-wide attendance has been recorded for ${data.term.label.toLowerCase()} yet.`;
  }

  return `Centre-wide attendance for ${data.term.label.toLowerCase()} to date: ${String(
    data.attendance.present,
  )}/${String(data.attendance.total)} marked present.`;
}

function eventDescription(event: LandingCalendarEvent): string {
  if (event.description) return event.description;
  if (event.date.getTime() !== event.endDate.getTime()) {
    return `Runs until ${formatEventDay(event.endDate)} ${formatEventMonth(event.endDate)}`;
  }
  return 'Published in the Oasis calendar.';
}

function attendanceBarHeight(rate: number | null): string {
  if (rate === null) return '18%';
  return `${String(Math.max(18, Math.min(100, rate)))}%`;
}

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <span className="landing-eyebrow">
      <span className="landing-eyebrow__dot" />
      {children}
    </span>
  );
}

function ButtonLink({
  children,
  href,
  variant = 'primary',
}: {
  children: ReactNode;
  href: string;
  variant?: 'ghost' | 'primary';
}) {
  const className = `landing-btn landing-btn--${variant}`;
  if (href.startsWith('#')) {
    return (
      <a className={className} href={href}>
        {children}
      </a>
    );
  }

  return (
    <Link className={className} href={signInHref}>
      {children}
    </Link>
  );
}

function SectionHead({
  children,
  eyebrow,
  title,
}: {
  children?: ReactNode;
  eyebrow: string;
  title: string;
}) {
  return (
    <div className="landing-section-head">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="landing-serif">{title}</h2>
      {children ? <p>{children}</p> : null}
    </div>
  );
}

function RoleCard({ role }: { role: RoleCardContent }) {
  return (
    <article className={`landing-role-card landing-role-card--${role.tone}`} id={role.id}>
      <span className={`landing-role-tag landing-role-tag--${role.tone}`}>{role.tag}</span>
      <h3>{role.title}</h3>
      <p className="landing-role-card__description">{role.description}</p>
      <ul className="landing-role-list">
        {role.items.map((item) => (
          <li key={item}>
            <span className="landing-role-list__tick">
              <Check aria-hidden="true" size={11} strokeWidth={3} />
            </span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
      <div className="landing-role-foot">
        <span>{role.foot}</span>
        <Link href={signInHref}>Open</Link>
      </div>
    </article>
  );
}

function FeatureCard({ feature }: { feature: FeatureContent }) {
  const Icon = feature.icon;
  return (
    <article className="landing-feature">
      <div className="landing-feature__glyph">
        <Icon aria-hidden="true" size={20} />
      </div>
      <h4>{feature.title}</h4>
      <p>{feature.description}</p>
      <span>{feature.tag}</span>
    </article>
  );
}

function TrustItem({ item }: { item: TrustContent }) {
  const Icon = item.icon;
  return (
    <article className="landing-trust-item">
      <div className="landing-trust-item__icon">
        <Icon aria-hidden="true" size={16} />
      </div>
      <h3>{item.title}</h3>
      <p>{item.description}</p>
    </article>
  );
}

function PortalPreview() {
  return (
    <div aria-hidden="true" className="landing-preview">
      <article className="landing-preview-card landing-preview-card--merits">
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
      </article>

      <article className="landing-preview-card landing-preview-card--behaviour">
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
      </article>

      <article className="landing-preview-card landing-preview-card--slip">
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
      </article>
    </div>
  );
}

function EventRows({ events }: { events: LandingCalendarEvent[] }) {
  if (events.length === 0) {
    return (
      <div className="landing-event-empty">
        <strong>No upcoming dates published.</strong>
        <span>Term dates will appear here when they are added to the Oasis calendar.</span>
      </div>
    );
  }

  return (
    <>
      {events.map((event) => (
        <div className="landing-event-row" key={event.id}>
          <div className="landing-event-row__date">
            <strong>{formatEventDay(event.date)}</strong>
            <span>{formatEventMonth(event.date)}</span>
          </div>
          <div className="landing-event-row__body">
            <strong>{event.title}</strong>
            <span>{eventDescription(event)}</span>
          </div>
        </div>
      ))}
    </>
  );
}

function TermGlance({ data }: { data: LandingPageData }) {
  return (
    <section className="landing-term-band" id="term">
      <div className="landing-wrap">
        <SectionHead eyebrow="This term" title={`${data.term.season} term, at a glance.`}>
          The dates supervisors plan to and parents need to remember, pulled from the same calendar
          that drives the portal.
        </SectionHead>

        <div className="landing-term-grid">
          <article className="landing-term-card">
            <p className="landing-term-card__label">Upcoming dates</p>
            <EventRows events={data.events} />
          </article>

          <article className="landing-term-card">
            <p className="landing-term-card__label">Term running total</p>
            <strong className="landing-term-card__big">
              {formatAttendanceValue(data.attendance.attendanceRate)}
            </strong>
            <p className="landing-term-card__sub">{formatAttendanceSub(data)}</p>
            <div className="landing-attendance-bars" aria-hidden="true">
              {data.attendance.weeks.map((week) => (
                <span
                  key={week.startDate.toISOString()}
                  style={{ height: attendanceBarHeight(week.attendanceRate) }}
                />
              ))}
            </div>
          </article>

          <article className="landing-term-card">
            <p className="landing-term-card__label">Verse for the term</p>
            <strong className="landing-term-card__big landing-term-card__big--verse">
              {data.versePlaceholder.text}
            </strong>
            <p className="landing-term-card__sub">{data.versePlaceholder.reference}</p>
          </article>
        </div>
      </div>
    </section>
  );
}

export function LandingPage({ data }: { data: LandingPageData }) {
  const termYear = formatYearFromTermId(data.term.id);

  return (
    <main className="landing-page landing-page--dark landing-page--centered">
      <header className="landing-nav">
        <div className="landing-wrap landing-nav__inner">
          <Link className="landing-brand" href="/">
            <span className="landing-brand__logo">
              <Image alt="Oasis crest" height={36} priority src="/oasis-logo.svg" width={36} />
            </span>
            <span>
              <strong>Oasis Learning Centre</strong>
              <small>Staff and Family Portal</small>
            </span>
          </Link>
          <nav className="landing-nav__links" aria-label="Landing page">
            <a href="#parents">For Parents</a>
            <a href="#students">For Students</a>
            <a href="#staff">For Staff</a>
            <a href="#leads">Clubs Leads</a>
            <a href="#inside">Inside the portal</a>
            <a href="#term">This term</a>
          </nav>
          <div className="landing-nav__actions">
            <a className="landing-btn landing-btn--ghost landing-btn--sm" href="#help">
              Help
            </a>
            <Link className="landing-btn landing-btn--primary landing-btn--sm" href={signInHref}>
              Sign in
              <ArrowRight aria-hidden="true" size={14} />
            </Link>
          </div>
        </div>
      </header>

      <section className="landing-hero">
        <div className="landing-hero__bg" />
        <div className="landing-wrap landing-hero__inner">
          <div className="landing-hero__text">
            <Eyebrow>
              {data.term.season} Term {termYear} / Now open
            </Eyebrow>
            <h1 className="landing-serif">
              One quiet place for everything that happens at <em>Oasis</em>.
            </h1>
            <p>
              Attendance, PACE progress, merits, fees, permission slips, club sign-ups and Friday
              messages, all in a single calm portal for parents, students, staff and clubs leads.
            </p>
            <div className="landing-hero__actions">
              <ButtonLink href={signInHref}>
                Sign in to the portal
                <ArrowRight aria-hidden="true" size={16} />
              </ButtonLink>
              <ButtonLink href="#inside" variant="ghost">
                Take a tour
              </ButtonLink>
            </div>
            <div className="landing-hero__meta">
              <span>
                <strong>4 roles</strong>
                Parent / Student / Staff / Clubs Lead
              </span>
              <span>
                <strong>1 sign-in</strong>
                Secured with 2FA
              </span>
              <span>
                <strong>eu-west-2</strong>
                UK/EU GDPR hosted
              </span>
            </div>
          </div>
          <PortalPreview />
        </div>
      </section>

      <section className="landing-roles-band" id="parents">
        <div className="landing-wrap">
          <SectionHead
            eyebrow="Four portals / One centre"
            title="A view of Oasis built for the way you use it."
          >
            The same data, the same crest, shaped around what parents, students, supervisors and
            clubs leads each actually need to do this week.
          </SectionHead>
          <div className="landing-roles">
            {roleCards.map((role) => (
              <RoleCard key={role.title} role={role} />
            ))}
          </div>
        </div>
      </section>

      <section className="landing-inside" id="inside">
        <div className="landing-wrap">
          <SectionHead eyebrow="Inside the portal" title="Built around how a centre actually runs.">
            Not a generic schools product. Every screen reflects how Oasis works day to day, from
            PACE booklets to Friday assembly mentions.
          </SectionHead>
          <div className="landing-features">
            {features.map((feature) => (
              <FeatureCard feature={feature} key={feature.title} />
            ))}
          </div>
        </div>
      </section>

      <TermGlance data={data} />

      <section className="landing-trust">
        <div className="landing-wrap">
          <SectionHead eyebrow="Quietly safe" title="A portal a centre can actually trust." />
          <div className="landing-trust-row">
            {trustItems.map((item) => (
              <TrustItem item={item} key={item.title} />
            ))}
          </div>
        </div>
      </section>

      <section className="landing-cta-band">
        <div className="landing-wrap">
          <div className="landing-cta-card">
            <div>
              <h2>Ready when you are.</h2>
              <p>
                Sign in with your Oasis email. New family? Speak to the office on Monday and
                we&apos;ll send your invite the same day.
              </p>
            </div>
            <div className="landing-cta-card__actions">
              <ButtonLink href={signInHref}>
                Sign in
                <ArrowRight aria-hidden="true" size={16} />
              </ButtonLink>
              <ButtonLink href="#help" variant="ghost">
                I need help
              </ButtonLink>
            </div>
          </div>
        </div>
      </section>

      <footer className="landing-footer" id="help">
        <div className="landing-wrap landing-footer__inner">
          <div className="landing-footer__brand">
            <span className="landing-brand__logo">
              <Image alt="Oasis crest" height={28} src="/oasis-logo.svg" width={28} />
            </span>
            <span>
              <strong>Oasis Learning Centre</strong>
            </span>
          </div>
          <div className="landing-footer__powered-by">
            <span>Powered by FSS Ltd</span>
            <Image alt="Faithful Software Solutions" height={84} src="/fss-logo.png" width={300} />
          </div>
          <p>
            UK/EU GDPR / eu-west-2 / v4.2.0
            <br />
            Trouble signing in? Contact support at support@faithfulsoftware.dev
          </p>
        </div>
      </footer>
    </main>
  );
}
