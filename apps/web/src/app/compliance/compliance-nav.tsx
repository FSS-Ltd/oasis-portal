'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { HeartPulse, ShieldCheck } from 'lucide-react';

const items = [
  { href: '/compliance/dbs-training', label: 'DBS & Training', icon: ShieldCheck },
  { href: '/compliance/medtab', label: 'MedTab', icon: HeartPulse },
] as const;

export function ComplianceNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Compliance pages" className="compliance-nav">
      {items.map(({ href, label, icon: Icon }) => (
        <Link aria-current={pathname === href ? 'page' : undefined} href={href} key={href}>
          <Icon aria-hidden="true" size={18} />
          {label}
        </Link>
      ))}
    </nav>
  );
}
