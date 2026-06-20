import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const mobileRoot = path.resolve(import.meta.dirname, '../../..');

function readMobile(relativePath: string): string {
  return readFileSync(path.join(mobileRoot, relativePath), 'utf8');
}

describe('student clubs and faith mobile wiring', () => {
  it('adds focused production files for clubs and Faith Corner', () => {
    for (const file of [
      'student-club-detail-panel.tsx',
      'student-clubs-faith-screen.tsx',
      'student-clubs-faith-utils.ts',
      'student-clubs-panel.tsx',
      'student-faith-comments-panel.tsx',
      'student-faith-corner-panel.tsx',
    ]) {
      expect(existsSync(path.join(mobileRoot, 'src/components/student', file))).toBe(true);
    }
  });

  it('routes the student portal into a production Clubs tab', () => {
    const portal = readMobile('src/components/student/student-portal-screen.tsx');

    expect(portal).toMatch(/StudentClubsFaithScreen/);
    expect(portal).toMatch(
      /type StudentMobileTab = 'home' \| 'wallet' \| 'learning' \| 'activity' \| 'clubs'/,
    );
    expect(portal).toMatch(/label: 'Clubs'/);
    expect(portal).toMatch(/icon: 'clubs'/);
    expect(portal).toMatch(/activeTab === 'clubs'/);
  });

  it('uses student-safe club and Faith Corner APIs without management or moderation procedures', () => {
    const source = [
      'src/components/student/student-portal-screen.tsx',
      'src/components/student/student-club-detail-panel.tsx',
      'src/components/student/student-clubs-faith-screen.tsx',
      'src/components/student/student-clubs-faith-utils.ts',
      'src/components/student/student-clubs-panel.tsx',
      'src/components/student/student-faith-comments-panel.tsx',
      'src/components/student/student-faith-corner-panel.tsx',
    ]
      .map(readMobile)
      .join('\n');

    for (const required of [
      /api\.club\.studentClubs\.useQuery/,
      /api\.club\.studentClubDetail\.useQuery/,
      /api\.club\.studentExpressInterest\.useMutation/,
      /api\.faithCorner\.currentForStudent\.useQuery/,
      /api\.faithCorner\.listComments\.useQuery/,
      /api\.faithCorner\.toggleCurrentLike\.useMutation/,
      /api\.faithCorner\.submitComment\.useMutation/,
      /api\.faithCorner\.toggleCommentLike\.useMutation/,
      /utils\.club\.studentClubs\.invalidate/,
      /utils\.faithCorner\.currentForStudent\.invalidate/,
    ]) {
      expect(source).toMatch(required);
    }

    for (const forbidden of [
      /api\.club\.(managementList|roster|studentCandidates|leadCandidates|signUp|withdraw)/,
      /api\.club\.(attendanceForSession|markAttendance|notify|create|update|delete)/,
      /api\.club\.(linkedChildSignupContext|linkedChildClubDetail|myClubNotices)/,
      /api\.faithCorner\.(currentForAdmin|pendingCommentsForAdmin|reviewComment|publish)/,
      /api\.behaviour\./,
      /api\.childLog\./,
      /api\.childNotes\./,
      /moderation/i,
      /reviewedAt/,
      /weeklyTheme: row\.content/,
    ]) {
      expect(source).not.toMatch(forbidden);
    }
  });

  it('keeps club, Faith Corner, interaction, blocked, empty, loading, and error states visible', () => {
    const source = [
      'src/components/student/student-portal-screen.tsx',
      'src/components/student/student-club-detail-panel.tsx',
      'src/components/student/student-clubs-faith-screen.tsx',
      'src/components/student/student-clubs-faith-utils.ts',
      'src/components/student/student-clubs-panel.tsx',
      'src/components/student/student-faith-comments-panel.tsx',
      'src/components/student/student-faith-corner-panel.tsx',
    ]
      .map(readMobile)
      .join('\n');

    for (const text of [
      'Clubs and Faith Corner',
      'Club Noticeboard',
      'Active clubs',
      'Club detail',
      'Send interest',
      'Interest sent',
      'Member notices locked',
      'No active clubs',
      'No club notices',
      'Loading clubs',
      'Clubs unavailable',
      'Faith Corner',
      'Memory verse',
      'Reflection',
      'Verse of the day',
      'Loading Faith Corner',
      'Faith Corner unavailable',
      'Faith Corner is not ready',
      'Comments',
      'Send for approval',
      'Comment pending approval',
      'No approved comments yet.',
      'Student portal locked',
      'Off-limit day',
      'Usage limit reached',
    ]) {
      expect(source).toContain(text);
    }
  });
});
