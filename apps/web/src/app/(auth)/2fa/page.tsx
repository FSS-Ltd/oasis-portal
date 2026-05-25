import { auth } from '@clerk/nextjs/server';
import { UserProfile } from '@clerk/nextjs';
import { redirect } from 'next/navigation';
import { hasClerkPublishableKey } from '../clerk-config';

export default async function TwoFactorScaffoldPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in/');

  if (!hasClerkPublishableKey()) {
    return (
      <main style={{ display: 'grid', minHeight: '100vh', placeItems: 'center', padding: 24 }}>
        <p>Clerk publishable key is required for 2FA setup.</p>
      </main>
    );
  }

  return (
    <main
      style={{
        display: 'grid',
        gap: 16,
        minHeight: '100vh',
        placeItems: 'center',
        padding: 24,
      }}
    >
      <section style={{ maxWidth: 560, textAlign: 'center' }}>
        <h1>Secure your Oasis account</h1>
        <p>
          Two-factor authentication is required before portal access. Add an authenticator app or
          recovery method, then sign out and sign back in to complete the second-factor check.
        </p>
        <p>
          If you are locked out, contact Technical Support so they can verify your identity and
          reset your Clerk security factors.
        </p>
      </section>
      <UserProfile path="/2fa" routing="path" />
    </main>
  );
}
