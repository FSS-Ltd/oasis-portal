import { CLUBS_VISIBLE, HOMEWORK_VISIBLE, ROTA_VISIBLE } from '@oasis/domain/portal-visibility';
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

import { NextResponse } from 'next/server';

const isRotaRoute = createRouteMatcher([
  '/admin/rota(.*)',
  '/supervisor/rota(.*)',
  '/parent/volunteer(.*)',
]);

const isClubsRoute = createRouteMatcher([
  '/admin/clubs(.*)',
  '/admin/my-clubs(.*)',
  '/parent/clubs(.*)',
  '/student/clubs(.*)',
  '/supervisor/clubs(.*)',
  '/clubs-lead(.*)',
]);

const isHomeworkRoute = createRouteMatcher(['/admin/homework(.*)', '/student/homework(.*)']);
const isHomeworkApiRoute = createRouteMatcher(['/api/homework(.*)']);

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
  '/user-agreements(.*)',
]);

export default clerkMiddleware(async (auth, request) => {
  if (isProtectedRoute(request)) {
    await auth.protect();
  }
  // The upload and image routes sit outside the page matchers above. API callers get a 404, not a redirect.
  if (!HOMEWORK_VISIBLE && isHomeworkApiRoute(request)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (
    (!CLUBS_VISIBLE && isClubsRoute(request)) ||
    (!ROTA_VISIBLE && isRotaRoute(request)) ||
    (!HOMEWORK_VISIBLE && isHomeworkRoute(request))
  ) {
    return NextResponse.redirect(new URL('/post-sign-in/resolve', request.url));
  }
});

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
