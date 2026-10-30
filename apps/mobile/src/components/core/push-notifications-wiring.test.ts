import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const mobileRoot = path.resolve(import.meta.dirname, '../../..');

function readMobile(relativePath: string): string {
  return readFileSync(path.join(mobileRoot, relativePath), 'utf8');
}

describe('push notifications mobile wiring', () => {
  it.each([
    'src/components/parent/parent-profile-registration-screen.tsx',
    'src/components/staff/staff-home-screen.tsx',
    'src/components/student/student-notifications-screen.tsx',
    'src/components/support/technical-support-portal-screen.tsx',
  ])('offers the push toggle on %s', (file) => {
    expect(readMobile(file)).toContain('<PushNotificationsCard');
  });

  it('forgets the device on sign-out from the root layout', () => {
    const layout = readMobile('app/_layout.tsx');
    expect(layout.match(/<PushNotificationsSignOutWatcher \/>/g)).toHaveLength(2);
  });

  it('registers, checks and forgets the device through the API', () => {
    const card = readMobile('src/components/core/push-notifications-card.tsx');
    expect(card).toContain('api.pushNotification.status.useQuery');
    expect(card).toContain('api.pushNotification.register.useMutation');
    expect(card).toContain('api.pushNotification.forget.useMutation');
    expect(card).toContain('Linking.openSettings');
  });

  it.each([
    ['src/components/parent/parent-portal-screen.tsx', "setRoute('messages')"],
    ['src/components/staff/staff-portal-screen.tsx', "setRoute('communications')"],
    ['src/components/support/technical-support-portal-screen.tsx', "setRoute('communications')"],
    ['src/components/student/student-portal-screen.tsx', "setActiveTab('updates')"],
  ])('opens the right screen from a tapped alert on %s', (file, navigation) => {
    const source = readMobile(file);
    const tap = source.slice(
      source.indexOf('usePushTap(('),
      source.indexOf('});', source.indexOf('usePushTap((')),
    );
    expect(tap).toContain(navigation);
  });

  it('declares the notifications plugin', () => {
    expect(readMobile('app.json')).toContain('"expo-notifications"');
  });
});
