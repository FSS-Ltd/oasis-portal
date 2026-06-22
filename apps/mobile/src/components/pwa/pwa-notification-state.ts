export type PwaNotificationPermission = 'default' | 'denied' | 'granted';
export type PwaNotificationSurface = 'blocked' | 'enabled' | 'hidden' | 'request';
export type PwaPlatformOS = 'android' | 'ios' | 'macos' | 'web' | 'windows';

interface NotificationSurfaceInput {
  notificationPermission: PwaNotificationPermission;
  notificationsAvailable: boolean;
  platformOS: PwaPlatformOS;
  serviceWorkerAvailable: boolean;
}

interface PwaNotificationCopy {
  detail: string;
  label: string;
  title: string;
}

export function detectPwaNotificationSurface({
  notificationPermission,
  notificationsAvailable,
  platformOS,
  serviceWorkerAvailable,
}: NotificationSurfaceInput): PwaNotificationSurface {
  if (platformOS !== 'web' || !notificationsAvailable || !serviceWorkerAvailable) return 'hidden';
  if (notificationPermission === 'granted') return 'enabled';
  if (notificationPermission === 'denied') return 'blocked';
  return 'request';
}

export function getPwaNotificationCopy(surface: PwaNotificationSurface): PwaNotificationCopy {
  if (surface === 'request') {
    return {
      detail: 'Allow this browser to receive Oasis notifications for new updates.',
      label: 'Enable',
      title: 'Browser notifications',
    };
  }

  if (surface === 'enabled') {
    return {
      detail: 'This device can receive Oasis browser notifications when they are sent.',
      label: 'Enabled',
      title: 'Browser notifications on',
    };
  }

  if (surface === 'blocked') {
    return {
      detail: 'Notifications are blocked in this browser. Change the site permission to enable them.',
      label: 'Blocked',
      title: 'Browser notifications blocked',
    };
  }

  return {
    detail: '',
    label: '',
    title: '',
  };
}
