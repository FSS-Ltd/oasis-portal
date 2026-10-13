'use client';

import { useState } from 'react';
import type { Route } from 'next';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Bell,
  ClipboardList,
  Home,
  ShieldAlert,
  Smartphone,
  Star,
  type LucideIcon,
} from 'lucide-react';
import { SidebarNavGroup } from '@/components/navigation/sidebar-nav-group';

const mainItems = [
  { href: '/clubs-lead', label: 'Overview', icon: Home },
  { href: '/clubs-lead?tab=behaviour', label: 'Behaviour', icon: Star },
  { href: '/clubs-lead?tab=attendance', label: 'Attendance', icon: ClipboardList },
  { href: '/clubs-lead?tab=noticeboard', label: 'Noticeboard', icon: Bell },
] as const;

const complianceItems = [
  { href: '/clubs-lead/compliance/dbs-training', label: 'DBS & Training', icon: ShieldAlert },
  { href: '/clubs-lead/compliance/medtab', label: 'MedTab', icon: ClipboardList },
] as const;

function NavLink({ href, label, icon: Icon }: { href: Route; label: string; icon: LucideIcon }) {
  return (
    <Link className="admin-shell__nav-item" href={href}>
      <Icon aria-hidden="true" size={15} />
      <span>{label}</span>
    </Link>
  );
}

export function ClubsLeadNav() {
  const pathname = usePathname() ?? '';
  const [complianceOpen, setComplianceOpen] = useState(
    pathname.startsWith('/clubs-lead/compliance/'),
  );

  return (
    <nav className="admin-shell__nav clubs-lead-shell__nav">
      {mainItems.map((item) => (
        <NavLink {...item} key={item.label} />
      ))}
      <SidebarNavGroup
        icon={ShieldAlert}
        label="Compliance"
        onOpenChange={setComplianceOpen}
        open={complianceOpen}
      >
        {complianceItems.map((item) => (
          <NavLink {...item} key={item.label} />
        ))}
      </SidebarNavGroup>
      <NavLink href="/mobile-app" icon={Smartphone} label="Mobile App" />
    </nav>
  );
}
