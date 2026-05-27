'use client';

import { useAuth } from '@clerk/nextjs';
import { useEffect } from 'react';
import { PortalLoadingScreen } from '@/components/auth/portal-loading-screen';

const RESOLVE_PATH = '/post-sign-in/resolve';
const SIGN_IN_PATH = '/sign-in/';

export function PostSignInHandoff() {
  const { isLoaded, isSignedIn } = useAuth();

  useEffect(() => {
    if (!isLoaded) return;

    window.location.replace(isSignedIn ? RESOLVE_PATH : SIGN_IN_PATH);
  }, [isLoaded, isSignedIn]);

  return <PortalLoadingScreen message="Preparing your Oasis portal" />;
}
