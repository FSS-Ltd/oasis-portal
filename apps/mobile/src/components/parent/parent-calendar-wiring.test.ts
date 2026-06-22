import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const mobileRoot = path.resolve(import.meta.dirname, '../../..');

function readMobile(relativePath: string): string {
  return readFileSync(path.join(mobileRoot, relativePath), 'utf8');
}

describe('parent calendar mobile wiring', () => {
  it('adds focused production parent calendar files', () => {
    for (const file of [
      'parent-calendar-screen.tsx',
      'parent-calendar-detail.tsx',
      'parent-calendar-list.tsx',
      'parent-calendar-utils.ts',
    ]) {
      expect(existsSync(path.join(mobileRoot, 'src/components/parent', file))).toBe(true);
    }
  });

  it('wires the parent portal calendar route to the production screen', () => {
    const portal = readMobile('src/components/parent/parent-portal-screen.tsx');

    expect(portal).toMatch(/ParentCalendarScreen/);
    expect(portal).toMatch(/'calendar'/);
    expect(portal).toMatch(/route === 'calendar'/);
    expect(portal).toMatch(/api\.calendar\.listForParents\.useQuery/);
    expect(portal).toMatch(/enabled:\s*route === 'calendar'/);
    expect(portal).toMatch(/parentCalendar\.refetch/);
    expect(portal).toMatch(/Calendar/);
  });

  it('uses the parent calendar API and excludes calendar management controls', () => {
    const screen = readMobile('src/components/parent/parent-calendar-screen.tsx');
    const detail = readMobile('src/components/parent/parent-calendar-detail.tsx');
    const list = readMobile('src/components/parent/parent-calendar-list.tsx');
    const portal = readMobile('src/components/parent/parent-portal-screen.tsx');

    expect(portal).toMatch(/api\.calendar\.listForParents\.useQuery/);

    for (const source of [screen, detail, list, portal]) {
      expect(source).not.toMatch(/calendar\.listForAdmin/);
      expect(source).not.toMatch(/calendar\.listForStaff/);
      expect(source).not.toMatch(/calendar\.listVisible/);
      expect(source).not.toMatch(/calendar\.listRequiredPersonCandidates/);
      expect(source).not.toMatch(/calendar\.create/);
      expect(source).not.toMatch(/calendar\.update/);
      expect(source).not.toMatch(/calendar\.archive/);
      expect(source).not.toMatch(/onArchive/);
      expect(source).not.toMatch(/onEdit/);
    }
  });

  it('keeps parent calendar list, detail, empty, loading, and error states visible', () => {
    const source = [
      'src/components/parent/parent-calendar-screen.tsx',
      'src/components/parent/parent-calendar-detail.tsx',
      'src/components/parent/parent-calendar-list.tsx',
      'src/components/parent/parent-calendar-utils.ts',
    ]
      .map(readMobile)
      .join('\n');

    for (const text of [
      'Parent Calendar',
      'Key Dates',
      'Upcoming events',
      'This month',
      'All portals',
      'Parents',
      'Half term',
      'Trips',
      'Oasis days',
      'The Cedars',
      'Meetings',
      'Trainings',
      'Event details',
      'Schedule',
      'Audience',
      'Category',
      'Description',
      'Loading parent dates',
      'Calendar unavailable',
      'No parent dates are published.',
      'No upcoming events',
    ]) {
      expect(source).toContain(text);
    }
  });
});
