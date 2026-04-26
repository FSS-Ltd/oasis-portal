import { SignIn } from '@clerk/nextjs';
import { hasClerkPublishableKey } from '../../clerk-config';

export default function SignInPage() {
  if (!hasClerkPublishableKey()) {
    return (
      <main style={{ display: 'grid', minHeight: '100vh', placeItems: 'center', padding: 24 }}>
        <p>Clerk publishable key is required for sign-in.</p>
      </main>
    );
  }

  return (
    <main style={{ display: 'grid', minHeight: '100vh', placeItems: 'center', padding: 24 }}>
      <SignIn path="/sign-in" signUpUrl="/sign-up" />
    </main>
  );
}
