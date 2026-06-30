import { SignIn } from '@clerk/nextjs';
import { hasClerkPublishableKey } from '../../clerk-config';

const passwordResetHref = '/sign-in/forgot-password';

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
      <div style={{ display: 'grid', gap: 12, justifyItems: 'center' }}>
        <SignIn
          fallbackRedirectUrl="/post-sign-in"
          forceRedirectUrl="/post-sign-in"
          path="/sign-in"
          signUpUrl="/sign-up"
        />
        <a
          href={passwordResetHref}
          style={{ color: '#5B90C5', fontSize: 14, fontWeight: 700, textDecoration: 'none' }}
        >
          Forgot password?
        </a>
      </div>
    </main>
  );
}
