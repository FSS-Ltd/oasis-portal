import { useAuth } from '@clerk/clerk-expo';
import { useEffect, useRef, useState } from 'react';
import { AppState, Linking, StyleSheet, Switch, Text, View } from 'react-native';
import {
  PUSH_PLATFORM,
  PUSH_SUPPORTED,
  pushPermissionBlocked,
  readPushToken,
  requestPushToken,
} from '../../lib/push-notifications';
import { api } from '../../lib/trpc';
import { Card, ErrorText, MobileButton, MutedText, SectionTitle } from './mobile-ui';
import { C, typeRamp } from './mobile-theme';

interface PushNotificationsCardProps {
  /** What this person gets alerts about, e.g. "new messages". */
  about: string;
}

/** Per-device opt-in for push. Renders nothing on the web. */
export function PushNotificationsCard({ about }: PushNotificationsCardProps) {
  const utils = api.useUtils();
  const [token, setToken] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const status = api.pushNotification.status.useQuery(
    { token: token ?? '' },
    { enabled: token !== null, retry: false },
  );
  const register = api.pushNotification.register.useMutation();
  const forget = api.pushNotification.forget.useMutation();

  useEffect(() => {
    function refresh() {
      readPushToken()
        .then(setToken)
        .catch(() => {
          setToken(null);
        });
      pushPermissionBlocked()
        .then(setBlocked)
        .catch(() => undefined);
    }
    refresh();
    // Coming back from phone Settings may have changed the permission.
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => {
      subscription.remove();
    };
  }, []);

  if (!PUSH_SUPPORTED) return null;

  const enabled = status.data?.enabled ?? false;

  async function toggle(next: boolean) {
    setError(null);
    setBusy(true);
    try {
      if (next) {
        const granted = token ?? (await requestPushToken());
        if (!granted) {
          setBlocked(true);
          return;
        }
        setBlocked(false);
        setToken(granted);
        await register.mutateAsync({ token: granted, platform: PUSH_PLATFORM });
      } else if (token) {
        await forget.mutateAsync({ token });
      }
      await utils.pushNotification.status.invalidate();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <SectionTitle>Push notifications</SectionTitle>
      <View style={styles.row}>
        <Text style={styles.rowTitle}>Notify me on this phone</Text>
        <Switch
          accessibilityHint={`Sends an alert to this phone for ${about}`}
          accessibilityLabel="Notify me on this phone"
          disabled={busy || status.isFetching}
          onValueChange={(next) => {
            void toggle(next);
          }}
          trackColor={{ true: C.navy }}
          value={enabled}
        />
      </View>
      <MutedText>
        {`Get an alert for ${about}. Alerts never show names or details on your lock screen.`}
      </MutedText>
      {blocked ? (
        <>
          <MutedText>Notifications are turned off for Oasis in your phone settings.</MutedText>
          <MobileButton
            label="Open phone settings"
            onPress={() => {
              void Linking.openSettings();
            }}
            variant="secondary"
          />
        </>
      ) : null}
      {error ? <ErrorText>{error}</ErrorText> : null}
    </Card>
  );
}

/**
 * Stops pushes to this phone when someone signs out, so a shared phone never shows the
 * last user's alerts. Watches Clerk once here instead of wrapping every sign-out button.
 */
export function PushNotificationsSignOutWatcher() {
  const { isSignedIn } = useAuth();
  const wasSignedIn = useRef(isSignedIn);
  const forget = api.pushNotification.forget.useMutation();

  useEffect(() => {
    const signedOut = wasSignedIn.current === true && isSignedIn === false;
    wasSignedIn.current = isSignedIn;
    if (!signedOut || !PUSH_SUPPORTED) return;
    readPushToken()
      .then((token) => (token ? forget.mutateAsync({ token }) : null))
      .catch(() => undefined);
  }, [forget, isSignedIn]);

  return null;
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    minHeight: 44,
  },
  rowTitle: {
    flex: 1,
    ...typeRamp.subhead,
    color: C.navy,
    fontWeight: '600',
  },
});
