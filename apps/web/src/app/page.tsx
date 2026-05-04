import { auth } from '@clerk/nextjs/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const { userId } = await auth();
  if (userId) redirect('/post-sign-in');

  return (
    <main style={{ padding: 32, fontFamily: 'system-ui, sans-serif' }}>
      <h1>Oasis Learning Centre Portal</h1>
      <p>Sign in to access your Oasis dashboard.</p>
      <Link href="/sign-in/">Sign in</Link>
    </main>
  );
}
