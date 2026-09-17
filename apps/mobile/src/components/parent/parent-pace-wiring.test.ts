import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const mobileRoot = path.resolve(import.meta.dirname, '../../..');

function readMobile(relativePath: string): string {
  return readFileSync(path.join(mobileRoot, relativePath), 'utf8');
}

describe('parent PACE mobile wiring', () => {
  it('adds a dedicated PACE route to the parent portal', () => {
    const portal = readMobile('src/components/parent/parent-portal-screen.tsx');

    expect(existsSync(path.join(mobileRoot, 'src/components/parent/parent-pace-screen.tsx'))).toBe(
      true,
    );
    expect(portal).toContain("| 'pace'");
    expect(portal).toContain("label: 'PACE'");
    expect(portal).toContain("route === 'pace'");
    expect(portal).toContain('ParentPaceScreen');
  });

  it('uses parent-safe current and paginated history procedures', () => {
    const screen = readMobile('src/components/parent/parent-pace-screen.tsx');

    expect(screen).toContain('api.pace.parentCurrent.useQuery');
    expect(screen).toContain('api.pace.parentHistory.useQuery');
    expect(screen).toContain('const PAGE_SIZE = 20');
    expect(screen).toContain('pageSize: PAGE_SIZE');
    expect(screen).toContain('formatPaceIdentifier');
    expect(screen).toContain('resolveReportPeriod');
    expect(screen).toContain('Showing {String(start)}–{String(end)}');
    expect(screen).toContain('Previous PACE history page');
    expect(screen).toContain('Next PACE history page');
  });

  it('keeps the child-detail PACE view as a compact current-subject preview', () => {
    const detail = readMobile('src/components/parent/parent-child-detail-screen.tsx');
    const portal = readMobile('src/components/parent/parent-portal-screen.tsx');

    expect(detail).toContain('api.pace.parentCurrent.useQuery');
    expect(detail).toContain('subjects?.slice(0, 3)');
    expect(detail).toContain('View Full PACE');
    expect(portal).toContain('onOpenPace');
  });
});
