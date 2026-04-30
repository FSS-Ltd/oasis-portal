import { auth } from '@clerk/nextjs/server';
import { createContext } from '@oasis/api';
import { isFullAdmin } from '@oasis/domain';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function PostSignInPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const ctx = await createContext({ headers: new Headers(), clerkUserId: userId });
  if (!ctx.user) redirect('/sign-in');

  if (isFullAdmin(ctx.user)) redirect('/admin');
  if (ctx.user.role === 'Supervisor') redirect('/supervisor');

  redirect('/not-ready');
}
