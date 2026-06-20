import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const mobileRoot = path.resolve(import.meta.dirname, '../../..');

function readMobile(relativePath: string): string {
  return readFileSync(path.join(mobileRoot, relativePath), 'utf8');
}

describe('parent incident reports mobile wiring', () => {
  it('adds a focused parent incident reports screen', () => {
    expect(
      existsSync(path.join(mobileRoot, 'src/components/parent/parent-incident-reports-screen.tsx')),
    ).toBe(true);
  });

  it('wires the parent portal to the incidents route', () => {
    const portal = readMobile('src/components/parent/parent-portal-screen.tsx');

    expect(portal).toMatch(/ParentIncidentReportsScreen/);
    expect(portal).toMatch(/'incidents'/);
    expect(portal).toMatch(/label: 'Incidents'/);
    expect(portal).toMatch(/route === 'incidents'/);
  });

  it('uses parent-safe incident APIs without staff-only workflows', () => {
    const screen = readMobile('src/components/parent/parent-incident-reports-screen.tsx');

    expect(screen).toMatch(/api\.incident\.listParent\.useQuery/);
    expect(screen).toMatch(/api\.incident\.acknowledgeParentCopy\.useMutation/);
    expect(screen).toMatch(/api\.incident\.downloadParentPdf\.useQuery/);
    expect(screen).toMatch(/ParentChildSwitcher/);
    expect(screen).toMatch(/ParentChildHero/);
    for (const forbidden of [
      'listStaff',
      'getStaff',
      'listStaffOptions',
      'createDraft',
      'updateDraft',
      'deleteDraft',
      'submitForHeadReview',
      'signOff',
      'escalate',
      'generateParentCopy',
      'shareParentCopy',
      'Sharing reason',
      'Data sharing reason',
      'redactions',
      'factualAccount',
      'directDisclosure',
      'internal review',
      'Head sign-off',
      'Sensitive',
    ]) {
      expect(screen).not.toContain(forbidden);
    }
  });

  it('keeps expected parent-safe incident states visible', () => {
    const screen = readMobile('src/components/parent/parent-incident-reports-screen.tsx');

    for (const text of [
      'Incident reports',
      'Shared incident reports',
      'Incident Report',
      'Parent copy',
      'Summary shared with parent',
      'First aid given',
      'Follow-up requested',
      'View PDF',
      'Download PDF',
      'Acknowledge receipt',
      'Message supervisor',
      'No linked children',
      'No signed-off incident reports',
      'No report selected',
      'Acknowledgement due',
      'Acknowledged',
      'Downloaded',
      'PDF unavailable',
      'Incident receipt acknowledged.',
      'Incident receipt could not be acknowledged.',
      'Read-only',
    ]) {
      expect(screen).toContain(text);
    }
  });
});
