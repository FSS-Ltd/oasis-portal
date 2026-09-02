'use client';

import { useClerk } from '@clerk/nextjs';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import styles from './access-revoked.module.css';

export const ACCESS_REVOKED_DURATION_MS = 60_000;
const COUNTDOWN_INTERVAL_MS = 250;

function remainingSeconds(deadline: number, now: number): number {
  return Math.max(0, Math.ceil((deadline - now) / 1_000));
}

function formatCountdown(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes)}:${String(seconds % 60).padStart(2, '0')}`;
}

export function AccessRevokedScreen() {
  const { signOut } = useClerk();
  const [secondsRemaining, setSecondsRemaining] = useState(60);

  useEffect(() => {
    const deadline = Date.now() + ACCESS_REVOKED_DURATION_MS;
    const updateCountdown = () => {
      setSecondsRemaining(remainingSeconds(deadline, Date.now()));
    };
    const signOutAndReturnHome = async () => {
      try {
        await signOut();
      } catch {
        // A Clerk failure must not leave a deactivated account in the portal.
      } finally {
        window.location.replace('/');
      }
    };

    updateCountdown();
    const interval = window.setInterval(updateCountdown, COUNTDOWN_INTERVAL_MS);
    const timeout = window.setTimeout(() => {
      void signOutAndReturnHome();
    }, ACCESS_REVOKED_DURATION_MS);

    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
  }, [signOut]);

  const progressValue = ACCESS_REVOKED_DURATION_MS / 1_000 - secondsRemaining;

  return (
    <main className={styles.page}>
      <section aria-labelledby="access-revoked-heading" className={styles.card}>
        <Image
          alt="Oasis Learning Centre"
          className={styles.logo}
          height={62}
          priority
          src="/oasis-logo.svg"
          width={160}
        />
        <p className={styles.eyebrow}>Account access</p>
        <h1 id="access-revoked-heading">You no longer have access to the portal.</h1>
        <p className={styles.message}>
          This Oasis account has been deactivated. You will be signed out securely and returned to
          the public home page shortly.
        </p>
        <div aria-describedby="access-revoked-countdown" className={styles.countdown}>
          <div className={styles.countdownHeader}>
            <span>Signing out in</span>
            <strong>{formatCountdown(secondsRemaining)}</strong>
          </div>
          <label className={styles.progressLabel} htmlFor="access-revoked-progress">
            Sign-out progress
          </label>
          <progress id="access-revoked-progress" max={60} value={progressValue}>
            {formatCountdown(secondsRemaining)} remaining
          </progress>
          <p aria-live="polite" id="access-revoked-countdown">
            {secondsRemaining} seconds remaining before secure sign out.
          </p>
        </div>
        <p className={styles.support}>
          If you believe this is unexpected, please contact Oasis Learning Centre.
        </p>
      </section>
    </main>
  );
}
