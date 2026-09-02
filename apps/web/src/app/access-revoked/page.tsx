import Image from 'next/image';
import { hasClerkPublishableKey } from '../(auth)/clerk-config';
import { AccessRevokedScreen } from './access-revoked-screen';
import styles from './access-revoked.module.css';

export const dynamic = 'force-dynamic';

export default function AccessRevokedPage() {
  if (!hasClerkPublishableKey()) {
    return (
      <main className={styles.page}>
        <section className={styles.card}>
          <Image
            alt="Oasis Learning Centre"
            className={styles.logo}
            height={62}
            priority
            src="/oasis-logo.svg"
            width={160}
          />
          <p className={styles.eyebrow}>Oasis Learning Centre</p>
          <h1>You no longer have access to the portal.</h1>
          <p>Your account is no longer active. Please contact Oasis Learning Centre for help.</p>
        </section>
      </main>
    );
  }

  return <AccessRevokedScreen />;
}
