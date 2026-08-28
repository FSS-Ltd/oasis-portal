import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const mobileRoot = path.resolve(import.meta.dirname, '../../..');

function readMobile(relativePath: string): string {
  return readFileSync(path.join(mobileRoot, relativePath), 'utf8');
}

describe('parent notifications mobile wiring', () => {
  it('adds the parent notifications screen', () => {
    expect(
      existsSync(path.join(mobileRoot, 'src/components/parent/parent-notifications-screen.tsx')),
    ).toBe(true);
  });

  it('wires parent notifications into the parent portal', () => {
    const portal = readMobile('src/components/parent/parent-portal-screen.tsx');

    expect(portal).toMatch(/ParentNotificationsScreen/);
    expect(portal).toMatch(/'notifications'/);
    expect(portal).toMatch(/api\.parentNotification\.list\.useQuery/);
    expect(portal).toMatch(/api\.parentNotification\.unreadCount\.useQuery/);
    expect(portal).toMatch(/api\.parentNotification\.markRead\.useMutation/);
    expect(portal).toMatch(/setRoute\('fees'\)/);
    expect(portal).toMatch(/initialInvoiceId=\{selectedInvoiceId\}/);
  });

  it('keeps invoice open and mark-read states visible', () => {
    const source = readMobile('src/components/parent/parent-notifications-screen.tsx');

    for (const text of [
      'Notifications',
      'Latest updates',
      'Invoices and parent portal updates.',
      'No notifications yet',
      'Open invoice',
      'Mark read',
      'Read',
      'Notifications unavailable',
    ]) {
      expect(source).toContain(text);
    }
    expect(source).toMatch(/invoiceIdFromHref/);
    expect(source).toMatch(/onOpenInvoice/);
    expect(source).toMatch(/onMarkRead/);
  });
});
