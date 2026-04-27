import { auth } from '@clerk/nextjs/server';
import { notFound } from 'next/navigation';
import { createContext } from '@oasis/api';
import { requireFullAdmin } from '@oasis/domain';

export async function assertFullAdmin() {
  try {
    const { userId } = await auth();
    const ctx = await createContext({ headers: new Headers(), clerkUserId: userId });
    if (!ctx.user) notFound();
    requireFullAdmin(ctx.user);
  } catch {
    notFound();
  }
}
