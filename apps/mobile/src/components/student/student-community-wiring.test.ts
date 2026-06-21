import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const mobileRoot = path.resolve(import.meta.dirname, '../../..');

function readMobile(relativePath: string): string {
  return readFileSync(path.join(mobileRoot, relativePath), 'utf8');
}

describe('student community mobile wiring', () => {
  it('adds focused student Community files', () => {
    for (const file of [
      'student-community-contacts.tsx',
      'student-community-screen.tsx',
      'student-community-utils.ts',
      'student-community-wiring.test.ts',
    ]) {
      expect(existsSync(path.join(mobileRoot, 'src/components/student', file))).toBe(true);
    }
  });

  it('exposes Community through the student mobile More navigation', () => {
    const portal = readMobile('src/components/student/student-portal-screen.tsx');

    expect(portal).toMatch(/\|\s*'community'/);
    expect(portal).toMatch(/id: 'community'/);
    expect(portal).toMatch(/label: 'Community'/);
    expect(portal).toMatch(/icon: 'messages'/);
    expect(portal).toMatch(/activeTab === 'community'/);
    expect(portal).toMatch(/<StudentCommunityScreen/);
  });

  it('uses self-scoped community APIs for groups, membership, and messages', () => {
    const source = [
      'src/components/student/student-community-contacts.tsx',
      'src/components/student/student-community-screen.tsx',
      'src/components/student/student-community-utils.ts',
    ]
      .map(readMobile)
      .join('\n');

    for (const required of [
      /api\.community\.listStudentGroups\.useQuery/,
      /api\.community\.listGroupMessages\.useQuery/,
      /api\.community\.joinGroup\.useMutation/,
      /api\.community\.sendMessage\.useMutation/,
      /utils\.community\.listStudentGroups\.invalidate/,
      /utils\.community\.listGroupMessages\.invalidate/,
      /handleJoinGroup/,
      /handleSendMessage/,
      /group\.members\.map/,
    ]) {
      expect(source).toMatch(required);
    }

    for (const forbidden of [
      /listAdminGroups/,
      /listAdminGroupMessages/,
      /createGroup/,
      /updateGroup/,
      /setMembership/,
      /setStudentMessagingBlocked/,
      /listStudentModeration/,
    ]) {
      expect(source).not.toMatch(forbidden);
    }
  });

  it('keeps group, join, blocked, message, refresh, pending, and error states visible', () => {
    const source = [
      'src/components/student/student-community-contacts.tsx',
      'src/components/student/student-community-screen.tsx',
      'src/components/student/student-community-utils.ts',
    ]
      .map(readMobile)
      .join('\n');

    for (const text of [
      'Student Community',
      'Community',
      'Loading community',
      'Community unavailable',
      'Groups',
      'Choose group',
      'Student contacts',
      'No contacts yet.',
      'Year',
      'Join Group',
      'Join this group to read and send messages.',
      'Loading messages',
      'No community messages yet.',
      'Messaging blocked',
      'Messaging is disabled for your account right now.',
      'Community message',
      'Choose a group and enter a message.',
      'Community messages must be 2000 characters or fewer.',
      'Sent',
      'Refresh',
      'Delivered',
      'Read',
    ]) {
      expect(source).toContain(text);
    }
  });
});
