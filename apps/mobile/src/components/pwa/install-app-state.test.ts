import { describe, expect, it } from 'vitest';
import {
  detectPwaInstallSurface,
  getInstallAppCopy,
  isRunningStandalone,
} from './install-app-state';

describe('PWA install state', () => {
  it('detects standalone display mode from either browser signal', () => {
    expect(
      isRunningStandalone({
        displayModeStandalone: true,
        navigatorStandalone: false,
      }),
    ).toBe(true);
    expect(
      isRunningStandalone({
        displayModeStandalone: false,
        navigatorStandalone: true,
      }),
    ).toBe(true);
  });

  it('uses browser prompt copy when Chromium exposes an install prompt', () => {
    const surface = detectPwaInstallSurface({
      hasBeforeInstallPrompt: true,
      isStandalone: false,
      maxTouchPoints: 5,
      userAgent:
        'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/126.0.0.0 Mobile Safari/537.36',
    });

    expect(surface).toBe('browserPrompt');
    expect(getInstallAppCopy(surface)).toEqual({
      detail: 'Install Oasis on this device for a full-screen app experience.',
      label: 'Download app',
      title: 'Install Oasis',
    });
  });

  it('uses iOS Add to Home Screen instructions when programmatic install is unavailable', () => {
    const surface = detectPwaInstallSurface({
      hasBeforeInstallPrompt: false,
      isStandalone: false,
      maxTouchPoints: 5,
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Version/17.5 Mobile/15E148 Safari/604.1',
    });

    expect(surface).toBe('iosInstructions');
    expect(getInstallAppCopy(surface)).toEqual({
      detail: 'Open Share in Safari, then choose Add to Home Screen.',
      label: 'Download app',
      title: 'Add Oasis to Home Screen',
    });
  });

  it('uses Android Add to Home Screen instructions before Chromium exposes an install prompt', () => {
    const surface = detectPwaInstallSurface({
      hasBeforeInstallPrompt: false,
      isStandalone: false,
      maxTouchPoints: 5,
      userAgent:
        'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/126.0.0.0 Mobile Safari/537.36',
    });

    expect(surface).toBe('androidInstructions');
    expect(getInstallAppCopy(surface)).toEqual({
      detail: 'Open the browser menu, then choose Install app or Add to Home screen.',
      label: 'Download app',
      title: 'Add Oasis to Home Screen',
    });
  });

  it('hides install UI when the app is already standalone or unsupported', () => {
    expect(
      detectPwaInstallSurface({
        hasBeforeInstallPrompt: true,
        isStandalone: true,
        maxTouchPoints: 5,
        userAgent: 'Mozilla/5.0 (Linux; Android 14) Chrome/126.0.0.0 Mobile Safari/537.36',
      }),
    ).toBe('hidden');

    expect(
      detectPwaInstallSurface({
        hasBeforeInstallPrompt: false,
        isStandalone: false,
        maxTouchPoints: 0,
        userAgent: 'Mozilla/5.0 (X11; Linux x86_64) Firefox/127.0',
      }),
    ).toBe('hidden');
  });
});
