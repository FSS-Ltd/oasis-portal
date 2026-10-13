'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { FileText, HeartPulse, ShieldAlert, ShieldCheck } from 'lucide-react';
import { SidebarNavGroup } from '@/components/navigation/sidebar-nav-group';

const items = [
  { href: '/compliance/incidents', label: 'Safeguarding', icon: ShieldAlert },
  { href: '/compliance/dbs-training', label: 'DBS & Training', icon: ShieldCheck },
  { href: '/compliance/medtab', label: 'MedTab', icon: HeartPulse },
  { href: '/compliance/user-agreements', label: 'User Agreements', icon: FileText },
] as const;

export function ComplianceNav() {
  const pathname = usePathname() ?? '';
  const [open, setOpen] = useState(true);
  return (
    <nav aria-label="Compliance pages" className="admin-shell__nav compliance-nav">
      <SidebarNavGroup icon={ShieldAlert} label="Compliance" onOpenChange={setOpen} open={open}>
        {items.map(({ href, label, icon: Icon }) => (
          <Link
            aria-current={pathname === href ? 'page' : undefined}
            className={`admin-shell__nav-item${pathname === href ? ' is-active' : ''}`}
            href={{ pathname: href }}
            key={href}
          >
            <Icon aria-hidden="true" size={15} />
            <span>{label}</span>
          </Link>
        ))}
      </SidebarNavGroup>
    </nav>
  );
}
