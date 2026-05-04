import { hasClerkPublishableKey } from '../(auth)/clerk-config';
import { PostSignInHandoff } from './post-sign-in-handoff';

export const dynamic = 'force-dynamic';

export default function PostSignInPage() {
  if (!hasClerkPublishableKey()) {
    return (
      <main style={{ display: 'grid', minHeight: '100vh', placeItems: 'center', padding: 24 }}>
        <p>Clerk publishable key is required for post sign-in routing.</p>
      </main>
    );
  }

  return <PostSignInHandoff />;
}
