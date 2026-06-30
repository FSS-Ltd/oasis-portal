'use client';

import type {
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
} from 'react';
import { useId, useRef } from 'react';
import { ChevronDown, type LucideIcon } from 'lucide-react';

type SidebarNavGroupProps = {
  badge?: string | null;
  children: ReactNode;
  icon: LucideIcon;
  label: string;
  navIconSize?: number;
  onHoverEnd: () => void;
  onHoverStart: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

function isHoverPointer(pointerType: string): boolean {
  return pointerType === 'mouse' || pointerType === 'pen';
}

export function SidebarNavGroup({
  badge,
  children,
  icon: GroupIcon,
  label,
  navIconSize = 15,
  onHoverEnd,
  onHoverStart,
  onOpenChange,
  open,
}: SidebarNavGroupProps) {
  const contentId = useId();
  const lastPointerTypeRef = useRef<string | null>(null);

  function handlePointerEnter(event: ReactPointerEvent<HTMLDivElement>): void {
    if (isHoverPointer(event.pointerType)) {
      onHoverStart();
    }
  }

  function handlePointerLeave(event: ReactPointerEvent<HTMLDivElement>): void {
    if (isHoverPointer(event.pointerType)) {
      onHoverEnd();
    }
  }

  function handleSummaryPointerDown(event: ReactPointerEvent<HTMLButtonElement>): void {
    lastPointerTypeRef.current = event.pointerType;

    if (!isHoverPointer(event.pointerType)) return;

    event.preventDefault();
    onOpenChange(true);

    const pointerType = event.pointerType;
    window.setTimeout(() => {
      if (lastPointerTypeRef.current === pointerType) {
        lastPointerTypeRef.current = null;
      }
    }, 0);
  }

  function handleSummaryClick(event: ReactMouseEvent<HTMLButtonElement>): void {
    const pointerType = lastPointerTypeRef.current;
    lastPointerTypeRef.current = null;

    if (pointerType && isHoverPointer(pointerType)) {
      event.preventDefault();
      return;
    }

    onOpenChange(!open);
  }

  return (
    <div
      className="admin-shell__nav-group"
      data-open={open ? 'true' : undefined}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
    >
      <button
        aria-controls={contentId}
        aria-expanded={open}
        className="admin-shell__nav-group-summary"
        onClick={handleSummaryClick}
        onPointerDown={handleSummaryPointerDown}
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
