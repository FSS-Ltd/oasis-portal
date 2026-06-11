'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { landingEase } from './motion-utils';

const signInHref = '/sign-in/' as const;

const navLinks = [
  { href: '#parents', id: 'parents', label: 'For Parents' },
  { href: '#students', id: 'students', label: 'For Students' },
  { href: '#staff', id: 'staff', label: 'For Staff' },
  { href: '#leads', id: 'leads', label: 'Clubs Leads' },
  { href: '#inside', id: 'inside', label: 'Inside the portal' },
  { href: '#term', id: 'term', label: 'This term' },
] as const;

const menuLinkVariants = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, transition: { duration: 0.45, ease: landingEase }, y: 0 },
};

export function LandingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const { scrollY } = useScroll();

  useMotionValueEvent(scrollY, 'change', (value) => {
    setScrolled(value > 24);
  });

  useEffect(() => {
    const sections = navLinks
      .map((link) => document.getElementById(link.id))
      .filter((element): element is HTMLElement => element !== null);
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(entry.target.id);
        }
      },
      { rootMargin: '-40% 0px -55% 0px' },
    );
    sections.forEach((section) => {
      observer.observe(section);
    });
    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    const previousOverflow = root.style.overflow;
    root.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      root.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
      toggleRef.current?.focus();
    };
  }, [open]);

  const closeMenu = () => {
    setOpen(false);
  };

  return (
    <header className={scrolled ? 'landing-nav landing-nav--scrolled' : 'landing-nav'}>
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
        <nav aria-label="Landing page" className="landing-nav__links">
          {navLinks.map((link) => (
            <a
              className={active === link.id ? 'is-active' : undefined}
              href={link.href}
              key={link.id}
            >
              {link.label}
              {active === link.id ? (
                <motion.span
                  className="landing-nav__marker"
                  layoutId="landing-nav-marker"
                  transition={{ duration: 0.35, ease: landingEase }}
                />
              ) : null}
            </a>
          ))}
        </nav>
        <div className="landing-nav__actions">
          <a className="landing-btn landing-btn--ghost landing-btn--sm" href="#help">
            Help
          </a>
          <Link className="landing-btn landing-btn--primary landing-btn--sm" href={signInHref}>
            Sign in
            <ArrowRight aria-hidden="true" size={14} />
          </Link>
          <button
            aria-controls="landing-mobile-menu"
            aria-expanded={open}
            aria-label={open ? 'Close menu' : 'Open menu'}
            className={open ? 'landing-nav__toggle is-open' : 'landing-nav__toggle'}
            onClick={() => {
              setOpen((value) => !value);
            }}
            ref={toggleRef}
            type="button"
          >
            <span />
            <span />
            <span />
          </button>
        </div>
      </div>
      <AnimatePresence>
        {open ? (
          <motion.div
            animate={{ opacity: 1 }}
            className="landing-menu"
            exit={{ opacity: 0, transition: { duration: 0.2 } }}
            id="landing-mobile-menu"
            initial={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <motion.nav
              animate="show"
              aria-label="Landing page menu"
              className="landing-menu__links"
              initial="hidden"
              variants={{
                hidden: {},
                show: { transition: { delayChildren: 0.08, staggerChildren: 0.05 } },
              }}
            >
              {navLinks.map((link) => (
                <motion.a
                  href={link.href}
                  key={link.id}
                  onClick={closeMenu}
                  variants={menuLinkVariants}
                >
                  {link.label}
                </motion.a>
              ))}
            </motion.nav>
            <motion.div
              animate={{ opacity: 1, transition: { delay: 0.4, duration: 0.45, ease: landingEase }, y: 0 }}
              className="landing-menu__actions"
              initial={{ opacity: 0, y: 18 }}
            >
              <Link className="landing-btn landing-btn--primary" href={signInHref} onClick={closeMenu}>
                Sign in
                <ArrowRight aria-hidden="true" size={16} />
              </Link>
              <a className="landing-btn landing-btn--ghost" href="#help" onClick={closeMenu}>
                I need help
              </a>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </header>
  );
}
