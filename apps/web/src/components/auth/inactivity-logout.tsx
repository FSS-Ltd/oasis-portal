'use client';

import { useAuth, useClerk } from '@clerk/nextjs';
import { useEffect, useRef } from 'react';

const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000;
const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'touchstart', 'wheel', 'scroll'] as const;

export function InactivityLogout() {
  const { isLoaded, isSignedIn } = useAuth();
  const { signOut } = useClerk();
  const lastActivityAtRef = useRef(0);
  const signingOutRef = useRef(false);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;

    let timeoutId: ReturnType<typeof setTimeout>;

    const signOutForInactivity = () => {
      if (signingOutRef.current) return;

      signingOutRef.current = true;
      void signOut({ redirectUrl: '/sign-in' });
    };

    const scheduleSignOut = () => {
      clearTimeout(timeoutId);
      const remainingMs = INACTIVITY_TIMEOUT_MS - (Date.now() - lastActivityAtRef.current);
      timeoutId = setTimeout(signOutForInactivity, Math.max(remainingMs, 0));
    };

    const recordActivity = () => {
      lastActivityAtRef.current = Date.now();
      scheduleSignOut();
    };

    const checkInactivityOnVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;

      if (Date.now() - lastActivityAtRef.current >= INACTIVITY_TIMEOUT_MS) {
        signOutForInactivity();
        return;
      }

      scheduleSignOut();
    };

    signingOutRef.current = false;
    recordActivity();
    ACTIVITY_EVENTS.forEach((eventName) => window.addEventListener(eventName, recordActivity));
    document.addEventListener('visibilitychange', checkInactivityOnVisibilityChange);

    return () => {
      clearTimeout(timeoutId);
      ACTIVITY_EVENTS.forEach((eventName) => window.removeEventListener(eventName, recordActivity));
      document.removeEventListener('visibilitychange', checkInactivityOnVisibilityChange);
    };
  }, [isLoaded, isSignedIn, signOut]);

  return null;
}
