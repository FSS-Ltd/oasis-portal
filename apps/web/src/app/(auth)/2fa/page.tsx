import { UserProfile } from '@clerk/nextjs';
import { hasClerkPublishableKey } from '../clerk-config';

export default function TwoFactorScaffoldPage() {
  if (!hasClerkPublishableKey()) {
    return (
      <main style={{ display: 'grid', minHeight: '100vh', placeItems: 'center', padding: 24 }}>
        <p>Clerk publishable key is required for 2FA setup.</p>
      </main>
    );
  }

  return (
    <main style={{ display: 'grid', minHeight: '100vh', placeItems: 'center', padding: 24 }}>
      <UserProfile path="/2fa" routing="path" />
    </main>
  );
}
