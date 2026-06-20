import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const mobileRoot = path.resolve(import.meta.dirname, '../../..');

function readMobile(relativePath: string): string {
  return readFileSync(path.join(mobileRoot, relativePath), 'utf8');
}

describe('parent messages mobile wiring', () => {
  it('adds a focused production parent messages screen', () => {
    expect(
      existsSync(path.join(mobileRoot, 'src/components/parent/parent-messages-screen.tsx')),
    ).toBe(true);
  });

  it('moves reusable mobile message components out of the smoke boundary', () => {
    for (const relativePath of [
      'src/components/messages/mobile-messages-panel.tsx',
      'src/components/messages/mobile-message-inbox.tsx',
      'src/components/messages/mobile-message-conversation.tsx',
      'src/components/messages/mobile-message-new-thread.tsx',
      'src/components/messages/mobile-message-types.ts',
      'src/components/messages/mobile-message-utils.ts',
    ]) {
      expect(existsSync(path.join(mobileRoot, relativePath))).toBe(true);
    }
  });

  it('wires the parent portal to the production messages screen', () => {
    const portal = readMobile('src/components/parent/parent-portal-screen.tsx');

    expect(portal).toMatch(/ParentMessagesScreen/);
    expect(portal).toMatch(/route === 'messages'/);
    expect(portal).toMatch(/kinds: \['ParentStaff'\]/);
    expect(portal).toMatch(/kind: 'ParentStaff'/);
    expect(portal).not.toMatch(/parent-smoke-messages/);
  });

  it('uses message APIs for inbox, detail, new message, reply, pagination, and refresh', () => {
    const screen = readMobile('src/components/parent/parent-messages-screen.tsx');
    const panel = readMobile('src/components/messages/mobile-messages-panel.tsx');

    expect(screen).toMatch(/MobileMessagesPanel/);
    expect(panel).toMatch(/api\.message\.listConversationMessages\.useQuery/);
    expect(panel).toMatch(/api\.message\.openConversation\.useMutation/);
    expect(panel).toMatch(/api\.message\.sendInConversation\.useMutation/);
    expect(panel).toMatch(/utils\.message\.listConversations\.invalidate/);
    expect(panel).toMatch(/utils\.message\.listConversationMessages\.invalidate/);
    expect(panel).toMatch(/conversationKind = 'ParentStaff'/);
    expect(screen).toMatch(/conversationKind="ParentStaff"/);
    expect(screen).not.toMatch(/Staffroom/);
    expect(screen).not.toMatch(/StaffDirect/);
    expect(screen).not.toMatch(/SupervisorHead/);
    expect(screen).not.toMatch(/StudentDirect/);
  });

  it('keeps expected parent message states visible', () => {
    const inbox = readMobile('src/components/messages/mobile-message-inbox.tsx');
    const conversation = readMobile('src/components/messages/mobile-message-conversation.tsx');
    const composer = readMobile('src/components/messages/mobile-message-new-thread.tsx');
    const panel = readMobile('src/components/messages/mobile-messages-panel.tsx');

    for (const text of [
      'Centre communications',
      'Messages',
      'No messages yet',
      'New Message',
      'Load more',
      'Loading messages',
      'Message unavailable',
      'Message reply',
      'Sent',
      'Read',
      'Cancel',
      'Recipient and message are required.',
      'Choose a message and enter a reply.',
      'No message recipients are currently available.',
      'Start a message with the centre team.',
    ]) {
      expect(`${inbox}\n${conversation}\n${composer}\n${panel}`).toContain(text);
    }
  });
});
