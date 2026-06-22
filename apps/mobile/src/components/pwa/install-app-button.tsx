import { useEffect, useMemo, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { MutedText, MobileButton } from '../core/mobile-ui';
import { C } from '../core/mobile-theme';
import {
  detectPwaInstallSurface,
  getInstallAppCopy,
  isRunningStandalone,
  type PwaInstallSurface,
} from './install-app-state';

interface BeforeInstallPromptEventLike {
  preventDefault?: () => void;
  prompt: () => Promise<void> | void;
  userChoice?: Promise<{ outcome: 'accepted' | 'dismissed'; platform?: string }>;
}

interface BrowserGlobal {
  addEventListener?: (type: string, listener: (event: unknown) => void) => void;
  matchMedia?: (query: string) => { matches: boolean };
  navigator?: {
    maxTouchPoints?: number;
    standalone?: boolean;
    userAgent?: string;
  };
  removeEventListener?: (type: string, listener: (event: unknown) => void) => void;
}

function isBeforeInstallPromptEvent(event: unknown): event is BeforeInstallPromptEventLike {
  return (
    typeof event === 'object' &&
    event !== null &&
    'prompt' in event &&
    typeof (event as { prompt?: unknown }).prompt === 'function'
  );
}

function readInstallSurface(hasBeforeInstallPrompt: boolean): PwaInstallSurface {
  const browser = globalThis as BrowserGlobal;
  const displayModeStandalone = browser.matchMedia?.('(display-mode: standalone)').matches ?? false;
  const navigatorStandalone = browser.navigator?.standalone;

  return detectPwaInstallSurface({
    hasBeforeInstallPrompt,
    isStandalone: isRunningStandalone({
      displayModeStandalone,
      navigatorStandalone,
    }),
    maxTouchPoints: browser.navigator?.maxTouchPoints ?? 0,
    userAgent: browser.navigator?.userAgent ?? '',
  });
}

export function InstallAppButton() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEventLike | null>(null);
  const [surface, setSurface] = useState<PwaInstallSurface>('hidden');
  const [showIosSteps, setShowIosSteps] = useState(false);
  const copy = useMemo(() => getInstallAppCopy(surface), [surface]);

  useEffect(() => {
    if (Platform.OS !== 'web') return undefined;

    const browser = globalThis as BrowserGlobal;
    setSurface(readInstallSurface(false));

    function handleBeforeInstallPrompt(event: unknown) {
      if (!isBeforeInstallPromptEvent(event)) return;

      event.preventDefault?.();
      setInstallPrompt(event);
      setSurface(readInstallSurface(true));
    }

    browser.addEventListener?.('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      browser.removeEventListener?.('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  if (Platform.OS !== 'web' || surface === 'hidden') return null;

  async function handlePress() {
    if (surface === 'androidInstructions' || surface === 'iosInstructions') {
      setShowIosSteps((current) => !current);
      return;
    }

    if (!installPrompt) return;

    try {
      await installPrompt.prompt();
      await installPrompt.userChoice?.catch(() => undefined);
    } finally {
      setInstallPrompt(null);
      setSurface(readInstallSurface(false));
    }
  }

  return (
    <View style={styles.panel}>
      <View style={styles.copy}>
        <Text style={styles.title}>{copy.title}</Text>
        <MutedText>{copy.detail}</MutedText>
        {showIosSteps ? (
          <MutedText>
            {surface === 'androidInstructions'
              ? 'Open the browser menu, select Install app or Add to Home screen, then open Oasis from Home.'
              : 'Use Safari Share, select Add to Home Screen, then open Oasis from Home.'}
          </MutedText>
        ) : null}
      </View>
      <MobileButton
        compact
        label={copy.label}
        onPress={() => {
          void handlePress();
        }}
        variant="blue"
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
    borderColor: C.blueMid,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    marginTop: 14,
    padding: 14,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  title: {
    color: C.navy,
    fontSize: 13,
    fontWeight: '800',
  },
});
