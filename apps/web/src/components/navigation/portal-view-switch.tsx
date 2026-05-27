'use client';

import Link from 'next/link';
import type { MouseEvent } from 'react';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

type PortalView = 'parent' | 'staff';
type PortalViewSwitchVariant = 'sidebar' | 'topbar' | 'mobile';

const parentPortalTransitionHref = '/post-sign-in/resolve?switchTo=parent';
const staffPortalTransitionHref = '/post-sign-in/resolve?switchTo=staff';

interface PortalViewSwitchProps {
  activeView: PortalView;
  className?: string;
  variant: PortalViewSwitchVariant;
}

function shouldUseCurrentTab(event: MouseEvent<HTMLAnchorElement>): boolean {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

export function PortalViewSwitch({ activeView, className, variant }: PortalViewSwitchProps) {
  const [pendingView, setPendingView] = useState<PortalView | null>(null);
  const selectedView = pendingView ?? activeView;

  useEffect(() => {
    setPendingView(null);
  }, [activeView]);

  function handleSelect(event: MouseEvent<HTMLAnchorElement>, view: PortalView) {
    if (!shouldUseCurrentTab(event)) {
      return;
    }

    if (view === activeView) {
      event.preventDefault();
      return;
    }

    setPendingView(view);
  }

  return (
    <div
      aria-label="Switch portal view"
      className={cn(
        'portal-view-switch',
        `portal-view-switch--${variant}`,
        selectedView === 'staff' ? 'is-staff' : 'is-parent',
        className,
      )}
      role="group"
    >
      <span aria-hidden="true" className="portal-view-switch__thumb" />
      <Link
        aria-current={activeView === 'parent' ? 'page' : undefined}
        className={cn(
          'portal-view-switch__segment',
          selectedView === 'parent' ? 'is-selected' : undefined,
        )}
        href={parentPortalTransitionHref}
        onClick={(event) => {
          handleSelect(event, 'parent');
        }}
      >
        Parent
      </Link>
      <Link
        aria-current={activeView === 'staff' ? 'page' : undefined}
        className={cn(
          'portal-view-switch__segment',
          selectedView === 'staff' ? 'is-selected' : undefined,
        )}
        href={staffPortalTransitionHref}
        onClick={(event) => {
          handleSelect(event, 'staff');
        }}
      >
        Supervisor
      </Link>
    </div>
  );
}
