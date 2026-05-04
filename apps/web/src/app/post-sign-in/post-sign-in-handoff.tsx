'use client';

import { useAuth } from '@clerk/nextjs';
import { useEffect } from 'react';

const RESOLVE_PATH = '/post-sign-in/resolve';
const SIGN_IN_PATH = '/sign-in/';

export function PostSignInHandoff() {
  const { isLoaded, isSignedIn } = useAuth();

  useEffect(() => {
    if (!isLoaded) return;

    window.location.replace(isSignedIn ? RESOLVE_PATH : SIGN_IN_PATH);
  }, [isLoaded, isSignedIn]);

  return (
    <main
      aria-live="polite"
      style={{ display: 'grid', minHeight: '100vh', placeItems: 'center', padding: 24 }}
    >
      <p>Preparing your Oasis portal...</p>
    </main>
  );
}
