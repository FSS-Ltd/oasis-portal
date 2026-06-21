import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const mobileRoot = path.resolve(import.meta.dirname, '../../..');

function readMobile(relativePath: string): string {
  return readFileSync(path.join(mobileRoot, relativePath), 'utf8');
}

describe('student notifications mobile wiring', () => {
  it('adds focused production files for student updates', () => {
    for (const file of [
      'student-notifications-screen.tsx',
      'student-notifications-list.tsx',
      'student-notification-detail.tsx',
      'student-notifications-utils.ts',
    ]) {
      expect(existsSync(path.join(mobileRoot, 'src/components/student', file))).toBe(true);
    }
  });

  it('routes the student portal into an Updates tab with unread badge support', () => {
    const portal = readMobile('src/components/student/student-portal-screen.tsx');

    expect(portal).toMatch(/StudentNotificationsScreen/);
    for (const tab of ["'home'", "'wallet'", "'learning'", "'activity'", "'clubs'", "'updates'"]) {
      expect(portal).toContain(tab);
    }
    expect(portal).toMatch(/label: 'Updates'/);
    expect(portal).toMatch(/activeTab === 'updates'/);
    expect(portal).toMatch(/studentNotificationUnread/);
    expect(portal).toMatch(/badge: studentNotificationUnread\.data\?\.count/);
  });

  it('uses student-safe notification queries and mark-read mutation only', () => {
    const source = [
      'src/components/student/student-portal-screen.tsx',
      'src/components/student/student-notifications-screen.tsx',
      'src/components/student/student-notifications-list.tsx',
      'src/components/student/student-notification-detail.tsx',
      'src/components/student/student-notifications-utils.ts',
    ]
      .map(readMobile)
      .join('\n');

    expect(source).toMatch(/api\.studentNotification\.list\.useQuery/);
    expect(source).toMatch(/api\.studentNotification\.unreadCount\.useQuery/);
    expect(source).toMatch(/api\.studentNotification\.markRead\.useMutation/);
    expect(source).toMatch(/utils\.studentNotification\.list\.invalidate/);
    expect(source).toMatch(/utils\.studentNotification\.unreadCount\.invalidate/);
    expect(source).toMatch(/utils\.student\.dashboard\.invalidate/);

    for (const forbidden of [
      /api\.studentNotification\.announce/,
      /api\.audit/,
      /auditLog/,
      /sourceEntity/,
      /sourceId/,
      /createdById/,
      /bodyEnc/,
      /recipient/i,
      /api\.student\.(list|byId|create|update)/,
    ]) {
      expect(source).not.toMatch(forbidden);
    }
  });

  it('keeps loading, empty, failed-refresh, read, unread, detail, and mark-read states visible', () => {
    const source = [
      'src/components/student/student-portal-screen.tsx',
      'src/components/student/student-notifications-screen.tsx',
      'src/components/student/student-notifications-list.tsx',
      'src/components/student/student-notification-detail.tsx',
      'src/components/student/student-notifications-utils.ts',
    ]
      .map(readMobile)
      .join('\n');

    for (const text of [
      'Latest updates',
      'Notification centre',
      'Loading updates',
      'Updates unavailable',
      'No student updates yet',
      'Updates will appear here when they are sent.',
      'Update detail',
      'Select an update to inspect the full message.',
      'Mark read',
      'Marking...',
      'Read',
      'Unread',
      'Merits',
      'Shop',
      'Club',
      'Announcement',
      'Refresh failed',
      'Student portal locked',
      'Off-limit day',
      'Usage limit reached',
    ]) {
      expect(source).toContain(text);
    }
  });
});
