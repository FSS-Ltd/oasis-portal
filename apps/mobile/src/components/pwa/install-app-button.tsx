import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { C } from '../smoke/mobile-theme';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

interface BrowserWindow {
  addEventListener: (type: string, listener: (event: Event) => void) => void;
  matchMedia?: (query: string) => { matches: boolean };
  removeEventListener: (type: string, listener: (event: Event) => void) => void;
}

interface BrowserNavigator {
  userAgent: string;
}

interface BrowserGlobal {
  navigator?: BrowserNavigator;
  window?: BrowserWindow;
}

function browserGlobal(): BrowserGlobal {
  return globalThis;
}

function isStandaloneDisplay(): boolean {
  const browserWindow = browserGlobal().window;
  return browserWindow?.matchMedia?.('(display-mode: standalone)').matches ?? false;
}

function isiOSBrowser(): boolean {
  const browserNavigator = browserGlobal().navigator;
  return browserNavigator ? /iPad|iPhone|iPod/.test(browserNavigator.userAgent) : false;
}

export function InstallAppButton() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const browserWindow = browserGlobal().window;
    if (!browserWindow) return;

    if (isStandaloneDisplay()) {
      setInstalled(true);
      return;
    }

    setShowIosHint(isiOSBrowser());

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
    };

    browserWindow.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    browserWindow.addEventListener('appinstalled', onInstalled);
    return () => {
      browserWindow.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      browserWindow.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (Platform.OS !== 'web' || installed) return null;
  if (!installPrompt && !showIosHint) return null;

  async function promptInstall() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  }

  return (
    <View style={styles.panel}>
      <View style={styles.copy}>
        <Text style={styles.title}>Install Oasis</Text>
        <Text style={styles.text}>
          {installPrompt
            ? 'Add the portal to this device for quicker access.'
            : 'Use Safari Share, then Add to Home Screen.'}
        </Text>
      </View>
      {installPrompt ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            void promptInstall();
          }}
          style={({ pressed }) => [styles.button, pressed ? styles.buttonPressed : null]}
        >
          <Text style={styles.buttonText}>Install</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    backgroundColor: C.blue,
    borderRadius: 10,
    minWidth: 86,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  buttonPressed: {
    opacity: 0.82,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  copy: {
    flex: 1,
    gap: 3,
  },
  panel: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: C.surface,
    borderColor: C.border,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    marginTop: 14,
    padding: 14,
  },
  text: {
    color: C.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  title: {
    color: C.navy,
    fontSize: 14,
    fontWeight: '800',
  },
});
