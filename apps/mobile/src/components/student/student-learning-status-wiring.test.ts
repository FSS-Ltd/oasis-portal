import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const mobileRoot = path.resolve(import.meta.dirname, '../../..');

function readMobile(relativePath: string): string {
  return readFileSync(path.join(mobileRoot, relativePath), 'utf8');
}

describe('student learning status mobile wiring', () => {
  it('adds focused production student learning files', () => {
    for (const file of [
      'student-learning-attendance-panel.tsx',
      'student-learning-pace-panel.tsx',
      'student-learning-ranks-panel.tsx',
      'student-learning-screen.tsx',
      'student-learning-utils.ts',
    ]) {
      expect(existsSync(path.join(mobileRoot, 'src/components/student', file))).toBe(true);
    }
  });

  it('routes the student portal into a production Learning tab', () => {
    const portal = readMobile('src/components/student/student-portal-screen.tsx');

    expect(portal).toMatch(/StudentLearningScreen/);
    expect(portal).toMatch(
      /type StudentMobileTab =\s*\|?\s*'home'\s*\|\s*'community'\s*\|\s*'faith'\s*\|\s*'wallet'\s*\|\s*'learning'/,
    );
    expect(portal).toMatch(/label: 'Learning'/);
    expect(portal).toMatch(/icon: 'pace'/);
    expect(portal).toMatch(/activeTab === 'learning'/);
  });

  it('uses student-safe learning queries without staff, parent, or admin-only procedures', () => {
    const source = [
      'src/components/student/student-portal-screen.tsx',
      'src/components/student/student-learning-attendance-panel.tsx',
      'src/components/student/student-learning-pace-panel.tsx',
      'src/components/student/student-learning-ranks-panel.tsx',
      'src/components/student/student-learning-screen.tsx',
      'src/components/student/student-learning-utils.ts',
    ]
      .map(readMobile)
      .join('\n');

    expect(source).toMatch(/api\.pace\.forStudent\.useQuery/);
    expect(source).toMatch(/api\.attendance\.studentSummary\.useQuery/);
    expect(source).toMatch(/api\.leaderboard\.get\.useQuery/);
    expect(source).toMatch(/studentWallet\.data\?\.studentId/);
    expect(source).toMatch(/academicScreensEnabled/);
    expect(source).toMatch(/includeViewerRows:\s*true/);
    expect(source).toMatch(/scope:\s*'public'/);

    for (const forbidden of [
      /HighestDemerits/,
      /api\.attendance\.(forDate|mark|studentHistory|exportStudents)/,
      /api\.pace\.(record|updateRecord|deleteRecord|approveAdvancement|roster)/,
      /api\.student\.(list|byId|create|update|assignSubject|setCurrentPace)/,
      /api\.leaderboard\.charityPot\.updateGoal/,
      /scope:\s*'full'/,
      /includeAdminDemerits/,
      /Sensitive/,
    ]) {
      expect(source).not.toMatch(forbidden);
    }
  });

  it('keeps PACE, attendance, rank, disabled, loading, empty, and error states visible', () => {
    const source = [
      'src/components/student/student-portal-screen.tsx',
      'src/components/student/student-learning-attendance-panel.tsx',
      'src/components/student/student-learning-pace-panel.tsx',
      'src/components/student/student-learning-ranks-panel.tsx',
      'src/components/student/student-learning-screen.tsx',
      'src/components/student/student-learning-utils.ts',
    ]
      .map(readMobile)
      .join('\n');

    for (const text of [
      'Learning',
      'PACE progress',
      'Oasis attendance',
      'Positive ranks',
      'Loading learning status',
      'Learning unavailable',
      'Academic screens will open when this year group is ready.',
      'No PACE subjects',
      'No attendance recorded',
      'No rankings are available for this category yet.',
      'Top Tithers',
      'Top Savers',
      'Top Investors',
      'Your rank',
    ]) {
      expect(source).toContain(text);
    }
  });
});
