import { CLUBS_VISIBLE, ROTA_VISIBLE } from '@oasis/domain/portal-visibility';
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

import { NextResponse } from 'next/server';

const isRotaRoute = createRouteMatcher(['/admin/rota(.*)', '/supervisor/rota(.*)']);

const isClubsRoute = createRouteMatcher([
  '/admin/clubs(.*)',
  '/admin/my-clubs(.*)',
  '/parent/clubs(.*)',
  '/student/clubs(.*)',
  '/supervisor/clubs(.*)',
  '/clubs-lead(.*)',
]);

const isProtectedRoute = createRouteMatcher([
  '/admin(.*)',
  '/children-check(.*)',
  '/clubs-lead(.*)',
  '/dashboard(.*)',
  '/supervisor(.*)',
  '/parent(.*)',
  '/student(.*)',
  '/registration(.*)',
  '/not-ready(.*)',
]);

export default clerkMiddleware(async (auth, request) => {
  if (isProtectedRoute(request)) {
    await auth.protect();
  }
  if ((!CLUBS_VISIBLE && isClubsRoute(request)) || (!ROTA_VISIBLE && isRotaRoute(request))) {
    return NextResponse.redirect(new URL('/post-sign-in/resolve', request.url));
  }
});

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
