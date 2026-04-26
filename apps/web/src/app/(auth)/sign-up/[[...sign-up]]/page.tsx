import { SignUp } from '@clerk/nextjs';
import { hasClerkPublishableKey } from '../../clerk-config';

export default function SignUpPage() {
  if (!hasClerkPublishableKey()) {
    return (
      <main style={{ display: 'grid', minHeight: '100vh', placeItems: 'center', padding: 24 }}>
        <p>Clerk publishable key is required for sign-up.</p>
      </main>
    );
  }

  return (
    <main style={{ display: 'grid', minHeight: '100vh', placeItems: 'center', padding: 24 }}>
      <SignUp path="/sign-up" signInUrl="/sign-in" />
    </main>
  );
}
