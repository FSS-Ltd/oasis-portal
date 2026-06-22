import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const mobileRoot = path.resolve(import.meta.dirname, '../../..');

function readMobile(relativePath: string): string {
  return readFileSync(path.join(mobileRoot, relativePath), 'utf8');
}

describe('student homework activity mobile wiring', () => {
  it('adds focused production files for assigned work', () => {
    for (const file of [
      'student-homework-activity-screen.tsx',
      'student-homework-activity-list.tsx',
      'student-homework-activity-detail.tsx',
      'student-homework-activity-submit-panel.tsx',
      'student-homework-activity-utils.ts',
    ]) {
      expect(existsSync(path.join(mobileRoot, 'src/components/student', file))).toBe(true);
    }
  });

  it('routes the student portal into a production Activity tab', () => {
    const portal = readMobile('src/components/student/student-portal-screen.tsx');

    expect(portal).toMatch(/StudentHomeworkActivityScreen/);
    expect(portal).toMatch(
      /type StudentMobileTab =\s*\|?\s*'home'\s*\|\s*'community'\s*\|\s*'faith'\s*\|\s*'wallet'\s*\|\s*'learning'\s*\|\s*'activity'/,
    );
    expect(portal).toMatch(/label: 'Activity'/);
    expect(portal).toMatch(/icon: 'activity'/);
    expect(portal).toMatch(/activeTab === 'activity'/);
  });

  it('uses student-safe homework queries and upload submission mutation only', () => {
    const source = [
      'src/components/student/student-portal-screen.tsx',
      'src/components/student/student-homework-activity-screen.tsx',
      'src/components/student/student-homework-activity-list.tsx',
      'src/components/student/student-homework-activity-detail.tsx',
      'src/components/student/student-homework-activity-submit-panel.tsx',
      'src/components/student/student-homework-activity-utils.ts',
    ]
      .map(readMobile)
      .join('\n');

    expect(source).toMatch(/api\.homework\.studentDue\.useQuery/);
    expect(source).toMatch(/api\.homework\.studentGraded\.useQuery/);
    expect(source).toMatch(/api\.homework\.submitUpload\.useMutation/);
    expect(source).toMatch(/utils\.homework\.studentDue\.invalidate/);
    expect(source).toMatch(/utils\.homework\.studentGraded\.invalidate/);

    for (const forbidden of [
      /api\.homework\.(createAssignment|updateAssignment|reviewSubmission|reviewQueue|adminAssignments)/,
      /api\.homework\.(prepareAssignmentImageUpload|attachAssignmentImage|downloadAssignmentImage)/,
      /api\.student\.(list|byId|create|update)/,
      /parent-only/i,
      /staff-only/i,
      /internal review/i,
      /reviewedBy/,
    ]) {
      expect(source).not.toMatch(forbidden);
    }
  });

  it('keeps assigned, detail, submitted, pending, blocked, empty, and error states visible', () => {
    const source = [
      'src/components/student/student-portal-screen.tsx',
      'src/components/student/student-homework-activity-screen.tsx',
      'src/components/student/student-homework-activity-list.tsx',
      'src/components/student/student-homework-activity-detail.tsx',
      'src/components/student/student-homework-activity-submit-panel.tsx',
      'src/components/student/student-homework-activity-utils.ts',
    ]
      .map(readMobile)
      .join('\n');

    for (const text of [
      'Assigned work',
      'Current assignments',
      'Activity detail',
      'Homework',
      'Upload image',
      'Upload another image',
      'Hand in person',
      'Submitting work',
      'Submitted',
      'Submission pending',
      'Your submission is waiting for review.',
      'Loading assigned work',
      'Assigned work unavailable',
      'This account cannot open assigned work right now.',
      'No assigned work',
      'Homework and activities assigned to you will appear here.',
      'Work could not be submitted.',
      'Student portal locked',
      'Off-limit day',
      'Usage limit reached',
      'Graded homework',
      'No graded homework',
    ]) {
      expect(source).toContain(text);
    }
  });
});
