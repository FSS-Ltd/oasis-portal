'use client';

import type { ReactNode } from 'react';
import { useId } from 'react';
import { ChevronDown, type LucideIcon } from 'lucide-react';

type SidebarNavGroupProps = {
  badge?: string | null;
  children: ReactNode;
  icon: LucideIcon;
  label: string;
  navIconSize?: number;
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

export function SidebarNavGroup({
  badge,
  children,
  icon: GroupIcon,
  label,
  navIconSize = 15,
  onOpenChange,
  open,
}: SidebarNavGroupProps) {
  const contentId = useId();

  return (
    <div className="admin-shell__nav-group" data-open={open ? 'true' : undefined}>
      <button
        aria-controls={contentId}
        aria-expanded={open}
        className="admin-shell__nav-group-summary"
        onClick={() => {
          onOpenChange(!open);
        }}
        type="button"
      >
        <GroupIcon aria-hidden="true" size={navIconSize} />
        <span className="admin-shell__nav-group-label">{label}</span>
        {badge ? <b className="admin-shell__nav-group-badge">{badge}</b> : null}
        <ChevronDown aria-hidden="true" className="admin-shell__nav-group-chevron" size={13} />
      </button>
      {open ? (
        <div className="admin-shell__nav-group-items" id={contentId}>
          {children}
        </div>
      ) : null}
    </div>
  );
}
