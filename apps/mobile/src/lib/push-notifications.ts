import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';
import { Platform } from 'react-native';

/** Native push only. The PWA keeps its in-app Updates. */
export const PUSH_SUPPORTED = Platform.OS === 'ios' || Platform.OS === 'android';

export const PUSH_PLATFORM = Platform.OS === 'ios' ? 'Ios' : 'Android';

if (PUSH_SUPPORTED) {
  // Show alerts that arrive while the app is open, quietly.
  Notifications.setNotificationHandler({
    handleNotification: () =>
      Promise.resolve({
        shouldPlaySound: false,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
  });
}

function easProjectId(): string | undefined {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return extra?.eas?.projectId;
}

async function expoPushToken(): Promise<string> {
  const projectId = easProjectId();
  const { data } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : {});
  return data;
}

export async function pushPermissionGranted(): Promise<boolean> {
  if (!PUSH_SUPPORTED) return false;
  const { granted } = await Notifications.getPermissionsAsync();
  return granted;
}

/** True when the user said no and only phone Settings can turn notifications back on. */
export async function pushPermissionBlocked(): Promise<boolean> {
  if (!PUSH_SUPPORTED) return false;
  const { granted, canAskAgain } = await Notifications.getPermissionsAsync();
  return !granted && !canAskAgain;
}

/** This device's token if the user has already allowed notifications, without prompting. */
export async function readPushToken(): Promise<string | null> {
  return (await pushPermissionGranted()) ? expoPushToken() : null;
}

/**
 * Asks for permission if the OS still allows asking, then returns the token.
 * Returns null when the user has said no; only phone Settings can undo that.
 */
export async function requestPushToken(): Promise<string | null> {
  if (!PUSH_SUPPORTED) return null;
  if (Platform.OS === 'android') {
    // Android 13+ only shows the permission prompt once a channel exists.
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Oasis updates',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  const current = await Notifications.getPermissionsAsync();
  const { granted } =
    current.granted || !current.canAskAgain
      ? current
      : await Notifications.requestPermissionsAsync();
  return granted ? expoPushToken() : null;
}

export type PushArea = 'messages' | 'updates';

// Taps already acted on, so remounting a portal does not jump back to the same screen.
const handledTaps = new Set<string>();

/** Calls `onTap` with the area of a tapped notification, including the one that opened the app. */
export function usePushTap(onTap: (area: PushArea) => void) {
  const response = Notifications.useLastNotificationResponse();
  useEffect(() => {
    if (!PUSH_SUPPORTED || !response) return;
    if (response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    const { identifier, content } = response.notification.request;
    if (handledTaps.has(identifier)) return;
    handledTaps.add(identifier);
    const area: unknown = content.data.area;
    if (area === 'messages' || area === 'updates') onTap(area);
  }, [onTap, response]);
}
