import { auth } from '@clerk/nextjs/server';
import { createContext } from '@oasis/api';
import { canManageUserAccounts, isFullAdmin } from '@oasis/domain';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function PostSignInPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in/');

  const ctx = await createContext({ headers: new Headers(), clerkUserId: userId });
  if (!ctx.user) redirect('/not-ready');

  if (isFullAdmin(ctx.user)) redirect('/admin');
  if (canManageUserAccounts(ctx.user)) redirect('/admin/access');
  if (ctx.user.role === 'Supervisor') redirect('/supervisor');
  if (ctx.user.role === 'Parent') redirect('/parent');

  redirect('/not-ready');
}
