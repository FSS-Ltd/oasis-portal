import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

const mobileRoot = path.resolve(import.meta.dirname, '../..');

function read(relativePath) {
  return readFileSync(path.join(mobileRoot, relativePath), 'utf8');
}

describe('staff communications mobile wiring', () => {
  it('routes staff users through the production staff portal shell', () => {
    assert.equal(
      existsSync(path.join(mobileRoot, 'src/components/staff/staff-portal-screen.tsx')),
      true,
      'StaffPortalScreen should coordinate production staff screens',
    );

    const router = read('src/components/core/signed-in-router.tsx');
    assert.match(router, /StaffPortalScreen/);
    assert.doesNotMatch(router, /<StaffHomeScreen user=\{user\}/);
  });

  it('adds a production staff communications screen backed by staff-safe APIs', () => {
    assert.equal(
      existsSync(path.join(mobileRoot, 'src/components/staff/staff-communications-screen.tsx')),
      true,
      'StaffCommunicationsScreen should exist outside the smoke component folder',
    );

    const screen = read('src/components/staff/staff-communications-screen.tsx');
    const noticesPanel = read('src/components/staff/staff-notices-panel.tsx');
    assert.match(screen, /api\.notice\.listForStaff\.useQuery/);
    assert.match(noticesPanel, /api\.notice\.markRead\.useMutation/);
    assert.match(noticesPanel, /utils\.notice\.listForStaff\.invalidate/);
    assert.match(screen, /api\.message\.listConversations\.useQuery/);
    assert.match(screen, /kinds: \[...staffInboxConversationKinds\]/);
    assert.match(screen, /kinds: \[...supervisorHeadConversationKinds\]/);
    assert.match(screen, /api\.message\.listRecipients\.useQuery\(\s*\{\s*kind: 'StaffDirect'/);
    assert.match(screen, /api\.message\.listRecipients\.useQuery\(\s*\{\s*kind: 'SupervisorHead'/);
    assert.match(screen, /enabled: canUseSupervisorHead/);
    assert.match(screen, /api\.message\.openStaffroom\.useMutation/);
    assert.match(screen, /staffInboxConversationKinds/);
    assert.match(screen, /supervisorHeadConversationKinds/);
    assert.doesNotMatch(screen, /kind: 'ParentStaff'/);
  });

  it('lets Staff Home open communications without introducing dead navigation', () => {
    const home = read('src/components/staff/staff-home-screen.tsx');
    const model = read('src/components/staff/staff-home-model.ts');

    assert.match(home, /onOpenCommunications/);
    assert.match(home, /communications: onOpenCommunications/);
    assert.match(model, /id: 'communications'/);
  });

  it('reuses the shared mobile message panel with staff-direct copy', () => {
    const panel = read('src/components/messages/mobile-messages-panel.tsx');

    assert.match(
      panel,
      /type ConversationKind = 'ParentStaff' \| 'StudentDirect' \| 'StaffDirect' \| 'SupervisorHead'/,
    );
    assert.match(panel, /emptyDetail/);
    assert.match(panel, /conversationKind === 'StaffDirect'/);
    assert.match(panel, /conversationKind === 'SupervisorHead'/);
  });
});
