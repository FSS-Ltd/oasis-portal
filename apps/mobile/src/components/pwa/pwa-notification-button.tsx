import { useEffect, useMemo, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { C } from '../core/mobile-theme';
import { MobileButton, MutedText } from '../core/mobile-ui';
import {
  detectPwaNotificationSurface,
  getPwaNotificationCopy,
  type PwaNotificationPermission,
  type PwaNotificationSurface,
} from './pwa-notification-state';

interface BrowserGlobal {
  Notification?: {
    permission: PwaNotificationPermission;
    requestPermission: () => Promise<PwaNotificationPermission>;
  };
  navigator?: {
    serviceWorker?: unknown;
  };
}

function readNotificationSurface(): PwaNotificationSurface {
  const browser = globalThis as BrowserGlobal;

  return detectPwaNotificationSurface({
    notificationPermission: browser.Notification?.permission ?? 'default',
    notificationsAvailable: Boolean(browser.Notification),
    platformOS: Platform.OS,
    serviceWorkerAvailable: Boolean(browser.navigator?.serviceWorker),
  });
}

export function PwaNotificationButton() {
  const [surface, setSurface] = useState<PwaNotificationSurface>('hidden');
  const copy = useMemo(() => getPwaNotificationCopy(surface), [surface]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    setSurface(readNotificationSurface());
  }, []);

  if (Platform.OS !== 'web' || surface === 'hidden') return null;

  async function handlePress() {
    if (surface !== 'request') return;

    const browser = globalThis as BrowserGlobal;
    await browser.Notification?.requestPermission().catch(() => undefined);
    setSurface(readNotificationSurface());
  }

  return (
    <View style={styles.panel}>
      <View style={styles.copy}>
        <Text style={styles.title}>{copy.title}</Text>
        <MutedText>{copy.detail}</MutedText>
      </View>
      <MobileButton
        compact
        disabled={surface !== 'request'}
        label={copy.label}
        onPress={() => {
          void handlePress();
        }}
        variant={surface === 'blocked' ? 'danger' : 'blue'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  copy: {
    flex: 1,
    gap: 4,
  },
  panel: {
    alignItems: 'center',
    backgroundColor: C.surface,
    borderColor: C.border,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 14,
  },
  title: {
    color: C.navy,
    fontSize: 13,
    fontWeight: '800',
  },
});
