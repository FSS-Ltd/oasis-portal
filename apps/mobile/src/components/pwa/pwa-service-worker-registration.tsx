import { useEffect } from 'react';
import { Platform } from 'react-native';

interface BrowserServiceWorkerContainer {
  register: (scriptURL: string) => Promise<unknown>;
}

interface BrowserGlobal {
  location?: {
    hostname?: string;
    protocol?: string;
  };
  navigator?: {
    serviceWorker?: BrowserServiceWorkerContainer;
  };
}

function canRegisterServiceWorker(browser: BrowserGlobal): boolean {
  const protocol = browser.location?.protocol;
  const hostname = browser.location?.hostname;

  return protocol === 'https:' || hostname === 'localhost' || hostname === '127.0.0.1';
}

export function PwaServiceWorkerRegistration() {
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const browser = globalThis as BrowserGlobal;
    const serviceWorker = browser.navigator?.serviceWorker;
    if (!serviceWorker || !canRegisterServiceWorker(browser)) return;

    void serviceWorker.register('/service-worker.js').catch(() => undefined);
  }, []);

  return null;
}
