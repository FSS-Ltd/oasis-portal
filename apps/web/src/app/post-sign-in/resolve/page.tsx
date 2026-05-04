import { auth } from '@clerk/nextjs/server';
import { createContext } from '@oasis/api';
import { redirect } from 'next/navigation';
import { resolvePostSignInDestination } from '@/lib/post-sign-in-routing';

export const dynamic = 'force-dynamic';

export default async function PostSignInResolvePage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in/');

  const ctx = await createContext({ headers: new Headers(), clerkUserId: userId });
  redirect(resolvePostSignInDestination(ctx.user));
}
