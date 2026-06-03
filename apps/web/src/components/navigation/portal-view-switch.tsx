'use client';

import Link from 'next/link';
import type { Route } from 'next';
import type { MouseEvent } from 'react';
import { useEffect, useState } from 'react';
import type { PortalViewId, PortalViewLink } from '@/lib/portal-view-routing';
import { parentPortalView } from '@/lib/portal-view-routing';
import { cn } from '@/lib/utils';

type PortalViewSwitchVariant = 'sidebar' | 'topbar' | 'mobile';

const defaultViews: readonly [PortalViewLink, PortalViewLink] = [
  parentPortalView,
  { href: '/post-sign-in/resolve?switchTo=staff', id: 'staff', label: 'Supervisor' },
];

interface PortalViewSwitchProps {
  activeView: PortalViewId;
  className?: string;
  variant: PortalViewSwitchVariant;
  views?: readonly [PortalViewLink, PortalViewLink];
}

function shouldUseCurrentTab(event: MouseEvent<HTMLAnchorElement>): boolean {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

export function PortalViewSwitch({
  activeView,
  className,
  variant,
  views = defaultViews,
}: PortalViewSwitchProps) {
  const [pendingView, setPendingView] = useState<PortalViewId | null>(null);
  const selectedView = pendingView ?? activeView;
  const secondViewSelected = selectedView === views[1].id;

  useEffect(() => {
    setPendingView(null);
  }, [activeView]);

  function handleSelect(event: MouseEvent<HTMLAnchorElement>, view: PortalViewId) {
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
        secondViewSelected ? 'is-second is-staff' : 'is-first is-parent',
        className,
      )}
      role="group"
    >
      <span aria-hidden="true" className="portal-view-switch__thumb" />
      {views.map((view) => (
        <Link
          aria-current={activeView === view.id ? 'page' : undefined}
          className={cn(
            'portal-view-switch__segment',
            selectedView === view.id ? 'is-selected' : undefined,
          )}
          href={view.href as Route}
          key={view.id}
          onClick={(event) => {
            handleSelect(event, view.id);
          }}
        >
          {view.label}
        </Link>
      ))}
    </div>
  );
}
