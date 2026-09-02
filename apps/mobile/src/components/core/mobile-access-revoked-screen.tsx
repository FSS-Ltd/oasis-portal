import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useClerk } from '@clerk/clerk-expo';
import { C } from './mobile-theme';
import { Card, MutedText } from './mobile-ui';

const ACCESS_REVOCATION_DELAY_MS = 60_000;

function secondsUntil(deadline: number): number {
  return Math.max(0, Math.ceil((deadline - Date.now()) / 1_000));
}

export function MobileAccessRevokedScreen() {
  const { signOut } = useClerk();
  const deadline = useRef(Date.now() + ACCESS_REVOCATION_DELAY_MS).current;
  const [secondsRemaining, setSecondsRemaining] = useState(() => secondsUntil(deadline));

  useEffect(() => {
    function updateRemainingTime() {
      setSecondsRemaining(secondsUntil(deadline));
    }

    async function signOutAtDeadline() {
      await signOut();
    }

    const intervalId = setInterval(updateRemainingTime, 1_000);
    const timeoutId = setTimeout(
      () => {
        updateRemainingTime();
        void signOutAtDeadline();
      },
      Math.max(0, deadline - Date.now()),
    );

    return () => {
      clearInterval(intervalId);
      clearTimeout(timeoutId);
    };
  }, [deadline, signOut]);

  const progress = secondsRemaining / (ACCESS_REVOCATION_DELAY_MS / 1_000);
  const progressWidth = `${String(progress * 100)}%` as `${number}%`;

  return (
    <View style={styles.shell}>
      <Card style={styles.card}>
        <Text accessibilityRole="header" style={styles.heading}>
          You no longer have access to the portal.
        </Text>
        <MutedText>
          Your account has been deactivated. You will be signed out securely and returned to the
          sign-in screen.
        </MutedText>
        <Text accessibilityLiveRegion="polite" style={styles.countdown}>
          Seconds remaining: {secondsRemaining}
        </Text>
        <View
          accessibilityLabel={`Sign-out progress: ${String(secondsRemaining)} seconds remaining`}
          accessibilityRole="progressbar"
          accessibilityValue={{ max: 60, min: 0, now: secondsRemaining }}
          style={styles.progressTrack}
        >
          <View style={[styles.progressValue, { width: progressWidth }]} />
        </View>
        <Text style={styles.progressNote}>
          Sign-out progress. Your session ends when the timer reaches zero.
        </Text>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 18, maxWidth: 480, padding: 24, width: '100%' },
  countdown: { color: C.navy, fontSize: 18, fontWeight: '800' },
  heading: { color: C.navy, fontSize: 28, fontWeight: '900', lineHeight: 35 },
  progressNote: { color: C.textSecondary, fontSize: 12, lineHeight: 17 },
  progressTrack: {
    backgroundColor: C.border,
    borderColor: C.navy,
    borderRadius: 999,
    borderWidth: 1,
    height: 12,
    overflow: 'hidden',
  },
  progressValue: { backgroundColor: C.navy, height: '100%' },
  shell: {
    alignItems: 'center',
    backgroundColor: C.bg,
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
});
