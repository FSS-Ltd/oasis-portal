import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import './legal.css';

export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="legal">
      <a className="legal__skip" href="#legal-content">
        Skip to content
      </a>
      <header className="legal__bar">
        <div className="legal__bar-inner">
          <Link className="legal__brand" href="/">
            <Image alt="" height={28} src="/oasis-logo.svg" width={28} />
            Oasis Learning Centre
          </Link>
          <nav aria-label="Legal and help" className="legal__nav">
            <Link href="/privacy">Privacy</Link>
            <Link href="/support">Support</Link>
          </nav>
        </div>
      </header>
      <main className="legal__main" id="legal-content">
        {children}
      </main>
      <footer className="legal__foot">
        <div className="legal__foot-inner">Oasis Learning Centre. Portal provided by FSS Ltd.</div>
      </footer>
    </div>
  );
}
