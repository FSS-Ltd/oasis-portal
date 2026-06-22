import { describe, expect, it } from 'vitest';
import {
  detectPwaNotificationSurface,
  getPwaNotificationCopy,
} from './pwa-notification-state';

describe('PWA notification state', () => {
  it('offers browser notifications only when web notifications and service workers are available', () => {
    expect(
      detectPwaNotificationSurface({
        notificationPermission: 'default',
        notificationsAvailable: true,
        platformOS: 'web',
        serviceWorkerAvailable: true,
      }),
    ).toBe('request');
  });

  it('hides notification prompts for native builds and unsupported browsers', () => {
    expect(
      detectPwaNotificationSurface({
        notificationPermission: 'default',
        notificationsAvailable: true,
        platformOS: 'ios',
        serviceWorkerAvailable: true,
      }),
    ).toBe('hidden');

    expect(
      detectPwaNotificationSurface({
        notificationPermission: 'default',
        notificationsAvailable: false,
        platformOS: 'web',
        serviceWorkerAvailable: true,
      }),
    ).toBe('hidden');
  });

  it('uses explicit copy for granted and denied browser notification states', () => {
    expect(
      getPwaNotificationCopy(
        detectPwaNotificationSurface({
          notificationPermission: 'granted',
          notificationsAvailable: true,
          platformOS: 'web',
          serviceWorkerAvailable: true,
        }),
      ),
    ).toEqual({
      detail: 'This device can receive Oasis browser notifications when they are sent.',
      label: 'Enabled',
      title: 'Browser notifications on',
    });

    expect(
      getPwaNotificationCopy(
        detectPwaNotificationSurface({
          notificationPermission: 'denied',
          notificationsAvailable: true,
          platformOS: 'web',
          serviceWorkerAvailable: true,
        }),
      ),
    ).toEqual({
      detail: 'Notifications are blocked in this browser. Change the site permission to enable them.',
      label: 'Blocked',
      title: 'Browser notifications blocked',
    });
  });
});
