import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const mobileRoot = path.resolve(import.meta.dirname, '../../..');

function readMobile(relativePath: string): string {
  return readFileSync(path.join(mobileRoot, relativePath), 'utf8');
}

describe('student Faith Corner mobile wiring', () => {
  it('adds a standalone production Faith Corner screen for the student portal', () => {
    expect(
      existsSync(path.join(mobileRoot, 'src/components/student/student-faith-corner-screen.tsx')),
    ).toBe(true);
  });

  it('routes the student portal into a dedicated Faith tab', () => {
    const portal = readMobile('src/components/student/student-portal-screen.tsx');
    const shell = readMobile('src/components/core/portal-mobile-shell.tsx');

    expect(portal).toMatch(/StudentFaithCornerScreen/);
    expect(portal).toMatch(
      /type StudentMobileTab =\s*\|?\s*'home'\s*\|\s*'community'\s*\|\s*'faith'\s*\|\s*'wallet'/,
    );
    expect(portal).toMatch(/id: 'faith', icon: 'faith', label: 'Faith'/);
    expect(portal).toMatch(/activeTab === 'faith'/);
    expect(shell).toMatch(/\|\s*'faith'/);
    expect(shell).toMatch(/case 'faith':/);
    expect(shell).toMatch(/return 'book-open'/);
  });

  it('uses student-safe Faith Corner APIs without admin publishing or moderation procedures', () => {
    const source = [
      'src/components/student/student-portal-screen.tsx',
      'src/components/student/student-faith-corner-screen.tsx',
      'src/components/student/student-faith-corner-panel.tsx',
      'src/components/student/student-faith-comments-panel.tsx',
      'src/components/student/student-clubs-faith-utils.ts',
    ]
      .map(readMobile)
      .join('\n');

    for (const required of [
      /api\.faithCorner\.currentForStudent\.useQuery/,
      /api\.faithCorner\.listComments\.useQuery/,
      /api\.faithCorner\.toggleCurrentLike\.useMutation/,
      /api\.faithCorner\.submitComment\.useMutation/,
      /api\.faithCorner\.toggleCommentLike\.useMutation/,
      /utils\.faithCorner\.currentForStudent\.invalidate/,
      /utils\.faithCorner\.listComments\.invalidate/,
    ]) {
      expect(source).toMatch(required);
    }

    for (const forbidden of [
      /api\.faithCorner\.(currentForAdmin|pendingCommentsForAdmin|reviewComment|publish)/,
      /api\.club\./,
      /management/i,
      /moderation/i,
      /reviewedAt/,
    ]) {
      expect(source).not.toMatch(forbidden);
    }
  });

  it('keeps web Faith Corner content and mobile states visible', () => {
    const source = [
      'src/components/student/student-faith-corner-screen.tsx',
      'src/components/student/student-faith-corner-panel.tsx',
      'src/components/student/student-faith-comments-panel.tsx',
    ]
      .map(readMobile)
      .join('\n');

    for (const text of [
      'Faith Corner',
      'Weekly Scripture memory and reflection for the Learning Centre.',
      'Published',
      'Memory verse',
      'Reflection',
      'Verse of the day',
      'Like',
      'Comments',
      'Your comment',
      'Send for approval',
      'Comment pending approval',
      'No approved comments yet.',
      'Loading Faith Corner',
      'Faith Corner unavailable',
      'Faith Corner is not ready',
      'Managed Faith Corner content will appear here when it is published.',
    ]) {
      expect(source).toContain(text);
    }
  });
});
