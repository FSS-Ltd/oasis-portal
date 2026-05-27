'use client';

import { useEffect } from 'react';
import { PortalLoadingScreen } from '@/components/auth/portal-loading-screen';
import type { PostSignInDestination } from '@/lib/post-sign-in-routing';

const PORTAL_COPY_BY_DESTINATION = {
  '/admin': 'Preparing your staff portal',
  '/admin/access': 'Preparing your access portal',
  '/admin/clubs': 'Preparing your clubs portal',
  '/clubs-lead': 'Preparing your clubs portal',
  '/children-check': 'Preparing your Oasis portal',
  '/supervisor': 'Preparing your supervisor portal',
  '/parent': 'Preparing your parent portal',
  '/registration': 'Preparing registration',
  '/not-ready': 'Preparing your Oasis portal',
} satisfies Record<PostSignInDestination, string>;

interface PostSignInTransitionProps {
  destination: PostSignInDestination;
}

export function PostSignInTransition({ destination }: PostSignInTransitionProps) {
  useEffect(() => {
    const timeout = window.setTimeout(() => {
      window.location.replace(destination);
    }, 650);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [destination]);

  return <PortalLoadingScreen message={PORTAL_COPY_BY_DESTINATION[destination]} />;
}
