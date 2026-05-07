import { auth } from '@clerk/nextjs/server';
import { SignOutButton } from '@clerk/nextjs';
import { redirect } from 'next/navigation';
import { ensureDevHeadUser } from '@/lib/dev-head-user';

export const dynamic = 'force-dynamic';

export default async function NotReadyPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in/');
  if (await ensureDevHeadUser(userId)) redirect('/post-sign-in/resolve');

  return (
    <main style={{ display: 'grid', minHeight: '100vh', placeItems: 'center', padding: 24 }}>
      <section style={{ maxWidth: 520 }}>
        <p style={{ color: '#425466', margin: '0 0 8px' }}>Oasis Learning Centre</p>
        <h1 style={{ fontSize: 32, lineHeight: 1.1, margin: '0 0 16px' }}>Portal not ready</h1>
        <p style={{ color: '#425466', lineHeight: 1.6, margin: '0 0 24px' }}>
          You are signed in, but your portal profile is not ready yet. If you just signed up, wait a
          moment and refresh this page. If you need to use a different account, sign out first.
        </p>
        <SignOutButton redirectUrl="/sign-in/">
          <button type="button">Sign out</button>
        </SignOutButton>
      </section>
    </main>
  );
}
