import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const mobileRoot = path.resolve(import.meta.dirname, '../../..');

function readMobile(relativePath: string): string {
  return readFileSync(path.join(mobileRoot, relativePath), 'utf8');
}

describe('student direct messages removal wiring', () => {
  it('removes the production student direct Messages files', () => {
    for (const file of ['student-messages-screen.tsx', 'student-messages-utils.ts']) {
      expect(existsSync(path.join(mobileRoot, 'src/components/student', file))).toBe(false);
    }
  });

  it('keeps student mobile navigation on Community without a Messages tab', () => {
    const portal = readMobile('src/components/student/student-portal-screen.tsx');

    expect(portal).toMatch(/id: 'community'/);
    expect(portal).toMatch(/label: 'Community'/);
    expect(portal).toMatch(/activeTab === 'community'/);
    expect(portal).toMatch(/<StudentCommunityScreen/);
    expect(portal).not.toMatch(/StudentMessagesScreen/);
    expect(portal).not.toMatch(/id: 'messages'/);
    expect(portal).not.toMatch(/label: 'Messages'/);
    expect(portal).not.toMatch(/activeTab === 'messages'/);
  });

  it('does not query StudentDirect conversations from the production student portal', () => {
    const source = [
      'src/components/student/student-portal-screen.tsx',
      'src/components/student/student-community-screen.tsx',
      'src/components/student/student-community-utils.ts',
    ]
      .map(readMobile)
      .join('\n');

    for (const forbidden of [
      /api\.message\.listConversations\.useQuery/,
      /api\.message\.listRecipients\.useQuery/,
      /conversationKind="StudentDirect"/,
      /kinds: \['StudentDirect'\]/,
      /studentDirect/,
    ]) {
      expect(source).not.toMatch(forbidden);
    }
  });
});
