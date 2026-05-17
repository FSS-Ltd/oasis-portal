'use client';

import type { KeyboardEvent as ReactKeyboardEvent, MouseEvent, ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { Menu, X } from 'lucide-react';

interface MobileSideMenuProps {
  children: ReactNode;
  closeLabel?: string;
  menuLabel: string;
  subtitle: string;
  title: string;
}

const focusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function focusableElements(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLElement>(focusableSelector)).filter(
    (element) =>
      !element.hasAttribute('disabled') && element.getAttribute('aria-hidden') !== 'true',
  );
}

export function MobileSideMenu({
  children,
  closeLabel = 'Close navigation menu',
  menuLabel,
  subtitle,
  title,
}: MobileSideMenuProps) {
  const [open, setOpen] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (!open) {
      if (wasOpenRef.current) {
        triggerRef.current?.focus();
      }
      wasOpenRef.current = false;
      return;
    }

    wasOpenRef.current = true;
    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  function closeMenu() {
    setOpen(false);
  }

  function handleBackdropClick() {
    closeMenu();
  }

  function handleNavigationClick(event: MouseEvent<HTMLDivElement>) {
    const target = event.target;

    if (!(target instanceof Element)) return;
    if (target.closest('a[href]')) closeMenu();
  }

  function handlePanelKeyDown(event: ReactKeyboardEvent<HTMLElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeMenu();
      return;
    }

    if (event.key !== 'Tab') return;

    const panel = panelRef.current;
    if (!panel) return;

    const elements = focusableElements(panel);
    const firstElement = elements[0];
    const lastElement = elements[elements.length - 1];

    if (!firstElement || !lastElement) return;

    if (event.shiftKey && document.activeElement === firstElement) {
      event.preventDefault();
      lastElement.focus();
      return;
    }

    if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  }

  return (
    <>
      <button
        aria-controls="mobile-side-menu"
        aria-expanded={open}
        aria-label={menuLabel}
        className="mobile-side-menu__trigger"
        onClick={() => {
          setOpen(true);
        }}
        ref={triggerRef}
        type="button"
      >
        <Menu aria-hidden="true" size={17} />
      </button>

      {open ? (
        <div className="mobile-side-menu" data-open="true">
          <button
            aria-label={closeLabel}
            className="mobile-side-menu__backdrop"
            onClick={handleBackdropClick}
            tabIndex={-1}
            type="button"
          />
          <aside
            aria-labelledby="mobile-side-menu-title"
            aria-modal="true"
            className="mobile-side-menu__panel"
            id="mobile-side-menu"
            onKeyDown={handlePanelKeyDown}
            ref={panelRef}
            role="dialog"
          >
            <header className="mobile-side-menu__header">
              <span>
                <small>{subtitle}</small>
                <strong id="mobile-side-menu-title">{title}</strong>
              </span>
              <button
                aria-label={closeLabel}
                className="mobile-side-menu__close"
                onClick={closeMenu}
                ref={closeButtonRef}
                type="button"
              >
                <X aria-hidden="true" size={15} />
              </button>
            </header>
            <div className="mobile-side-menu__body" onClickCapture={handleNavigationClick}>
              {children}
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
