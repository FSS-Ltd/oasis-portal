import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function NotReadyPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  return (
    <main style={{ display: 'grid', minHeight: '100vh', placeItems: 'center', padding: 24 }}>
      <section style={{ maxWidth: 520 }}>
        <p style={{ color: '#425466', margin: '0 0 8px' }}>Oasis Learning Centre</p>
        <h1 style={{ fontSize: 32, lineHeight: 1.1, margin: '0 0 16px' }}>Portal not ready</h1>
        <p style={{ color: '#425466', lineHeight: 1.6, margin: '0 0 24px' }}>
          This role has a valid account, but its portal is not ready in this phase. Contact the
          centre team if you expected access today.
        </p>
        <form action="/sign-in">
          <button type="submit">Return to sign-in</button>
        </form>
      </section>
    </main>
  );
}
