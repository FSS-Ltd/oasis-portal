import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

const mobileRoot = path.resolve(import.meta.dirname, '../..');

function read(relativePath) {
  return readFileSync(path.join(mobileRoot, relativePath), 'utf8');
}

describe('staff club lead mobile wiring', () => {
  it('adds a production staff club lead screen under the staff component boundary', () => {
    const staffFiles = [
      'staff-club-lead-screen.tsx',
      'staff-club-lead-switcher.tsx',
      'staff-club-lead-overview.tsx',
      'staff-club-lead-behaviour.tsx',
      'staff-club-lead-attendance.tsx',
      'staff-club-lead-attendance-components.tsx',
      'staff-club-lead-noticeboard.tsx',
      'staff-club-lead-utils.ts',
    ];

    for (const file of staffFiles) {
      assert.equal(
        existsSync(path.join(mobileRoot, 'src/components/staff', file)),
        true,
        `${file} should exist as a focused staff club lead component`,
      );
    }
  });

  it('routes Staff Home club quick action to the production club lead screen', () => {
    const portal = read('src/components/staff/staff-portal-screen.tsx');
    const home = read('src/components/staff/staff-home-screen.tsx');
    const model = read('src/components/staff/staff-home-model.ts');

    assert.match(portal, /StaffClubLeadScreen/);
    assert.match(portal, /'clubs'/);
    assert.match(home, /onOpenClubs/);
    assert.match(home, /clubs: onOpenClubs/);
    assert.match(model, /id: 'clubs'/);
  });

  it('uses assigned club lead APIs without exposing manager-only club administration', () => {
    const screen = read('src/components/staff/staff-club-lead-screen.tsx');

    assert.match(screen, /api\.club\.leadClubs\.useQuery/);
    assert.match(screen, /api\.club\.roster\.useQuery/);
    assert.match(screen, /api\.club\.attendanceForSession\.useQuery/);
    assert.match(screen, /api\.club\.markAttendance\.useMutation/);
    assert.match(screen, /api\.club\.notifications\.useQuery/);
    assert.match(screen, /api\.club\.notify\.useMutation/);
    assert.match(screen, /api\.behaviour\.recentEntries\.useQuery/);
    assert.match(screen, /api\.behaviour\.log\.useMutation/);
    assert.match(screen, /utils\.club\.roster\.invalidate/);
    assert.match(screen, /utils\.club\.attendanceForSession\.invalidate/);
    assert.match(screen, /utils\.club\.notifications\.invalidate/);
    assert.match(screen, /utils\.behaviour\.recentEntries\.invalidate/);
    assert.match(screen, /utils\.staffHome\.summary\.invalidate/);

    assert.doesNotMatch(screen, /api\.club\.managementList/);
    assert.doesNotMatch(screen, /api\.club\.create/);
    assert.doesNotMatch(screen, /api\.club\.update/);
    assert.doesNotMatch(screen, /api\.club\.leadCandidates/);
    assert.doesNotMatch(screen, /api\.club\.setLeadAssignments/);
    assert.doesNotMatch(screen, /api\.club\.setRotaParticipants/);
    assert.doesNotMatch(screen, /api\.club\.createClubRotaShift/);
    assert.doesNotMatch(screen, /api\.club\.updateClubRotaShift/);
    assert.doesNotMatch(screen, /api\.club\.deleteClubRotaShift/);
  });

  it('keeps loading, empty, pending, success, and error states visible', () => {
    const screen = read('src/components/staff/staff-club-lead-screen.tsx');
    const attendance =
      read('src/components/staff/staff-club-lead-attendance.tsx') +
      read('src/components/staff/staff-club-lead-attendance-components.tsx');
    const behaviour = read('src/components/staff/staff-club-lead-behaviour.tsx');
    const noticeboard = read('src/components/staff/staff-club-lead-noticeboard.tsx');

    assert.match(screen, /Loading assigned clubs/);
    assert.match(screen, /No assigned clubs/);
    assert.match(attendance, /No roster available/);
    assert.match(screen, /Attendance saved/);
    assert.match(screen, /Attendance could not be saved|markAttendance\.error/);
    assert.match(screen, /Behaviour saved/);
    assert.match(screen, /Behaviour could not be saved|logBehaviour\.error/);
    assert.match(screen, /Notice posted/);
    assert.match(screen, /Club notice could not be sent|sendNotice\.error/);
    assert.match(attendance, /Saving attendance/);
    assert.match(behaviour, /Saving behaviour/);
    assert.match(noticeboard, /Posting notice/);
  });

  it('keeps behaviour logging today-only while attendance can move between session dates', () => {
    const screen = read('src/components/staff/staff-club-lead-screen.tsx');
    const attendance =
      read('src/components/staff/staff-club-lead-attendance.tsx') +
      read('src/components/staff/staff-club-lead-attendance-components.tsx');

    assert.match(screen, /todayDate/);
    assert.match(screen, /attendanceDate/);
    assert.match(
      screen,
      /api\.behaviour\.recentEntries\.useQuery\(\s*\{\s*date: todayDate, clubId/s,
    );
    assert.match(
      screen,
      /utils\.behaviour\.recentEntries\.invalidate\(\s*\{\s*date: todayDate, clubId/s,
    );
    assert.doesNotMatch(
      screen,
      /api\.behaviour\.recentEntries\.useQuery\(\s*\{\s*date: attendanceDate/s,
    );
    assert.doesNotMatch(
      screen,
      /utils\.behaviour\.recentEntries\.invalidate\(\s*\{\s*date: attendanceDate/s,
    );
    assert.match(screen, /function changeAttendanceDate/);
    assert.match(attendance, /Session date/);
  });
});
