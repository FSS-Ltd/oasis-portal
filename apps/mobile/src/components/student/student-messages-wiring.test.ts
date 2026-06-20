import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const mobileRoot = path.resolve(import.meta.dirname, '../../..');

function readMobile(relativePath: string): string {
  return readFileSync(path.join(mobileRoot, relativePath), 'utf8');
}

describe('student messages mobile wiring', () => {
  it('adds focused production files for student direct messages', () => {
    for (const file of ['student-messages-screen.tsx', 'student-messages-utils.ts']) {
      expect(existsSync(path.join(mobileRoot, 'src/components/student', file))).toBe(true);
    }
  });

  it('routes the student portal into a production Messages tab without community navigation', () => {
    const portal = readMobile('src/components/student/student-portal-screen.tsx');

    expect(portal).toMatch(/StudentMessagesScreen/);
    expect(portal).toMatch(
      /type StudentMobileTab = 'home' \| 'wallet' \| 'learning' \| 'activity' \| 'clubs' \| 'updates' \| 'messages'/,
    );
    expect(portal).toMatch(/label: 'Messages'/);
    expect(portal).toMatch(/icon: 'messages'/);
    expect(portal).toMatch(/activeTab === 'messages'/);
    expect(portal).toMatch(/studentDirectConversations/);
    expect(portal).toMatch(/badge: studentDirectUnreadCount/);
    expect(portal).not.toMatch(/label: 'Community'/);
    expect(portal).not.toMatch(/activeTab === 'community'/);
  });

  it('uses StudentDirect APIs and filters mobile recipients to Head or Pastor only', () => {
    const source = [
      'src/components/student/student-portal-screen.tsx',
      'src/components/student/student-messages-screen.tsx',
      'src/components/student/student-messages-utils.ts',
    ]
      .map(readMobile)
      .join('\n');

    expect(source).toMatch(/api\.message\.listConversations\.useQuery/);
    expect(source).toMatch(/api\.message\.listRecipients\.useQuery/);
    expect(source).toMatch(/conversationKind="StudentDirect"/);
    expect(source).toMatch(/kinds: \['StudentDirect'\]/);
    expect(source).toMatch(/studentDirectStaffRecipients/);
    expect(source).toMatch(/isPastoralStudentMessageRecipient/);
    expect(source).toMatch(/conversationHasPastoralParticipant/);
    expect(source).toMatch(/utils\.message\.listConversations\.invalidate/);

    for (const forbidden of [
      /api\.community/,
      /conversationKind="(StaffDirect|SupervisorHead|ParentStaff)"/,
      /activeTab === 'community'/,
      /friend/i,
      /public profile/i,
      /members\.map/,
      /moderation controls/i,
      /communityMessagingBlockedById/,
      /communityMessagingBlockedAt/,
    ]) {
      expect(source).not.toMatch(forbidden);
    }
  });

  it('keeps direct, blocked, read receipt, empty, pagination, pending, and error states visible', () => {
    const source = [
      'src/components/student/student-portal-screen.tsx',
      'src/components/student/student-messages-screen.tsx',
      'src/components/student/student-messages-utils.ts',
      'src/components/messages/mobile-messages-panel.tsx',
      'src/components/messages/mobile-message-inbox.tsx',
      'src/components/messages/mobile-message-conversation.tsx',
      'src/components/messages/mobile-message-new-thread.tsx',
    ]
      .map(readMobile)
      .join('\n');

    for (const text of [
      'Student communications',
      'Messages',
      'Loading student messages',
      'Messages unavailable',
      'Messaging blocked',
      'Messaging is disabled for your account right now.',
      'Choose the Head or Pastor to start a message.',
      'No messages yet',
      'New Message',
      'Load more',
      'Message unavailable',
      'Message reply',
      'Recipient and message are required.',
      'Choose a message and enter a reply.',
      'No message recipients are currently available.',
      'Sent',
      'Read',
      'Cancel',
      'Student portal locked',
      'Off-limit day',
      'Usage limit reached',
    ]) {
      expect(source).toContain(text);
    }
  });
});
