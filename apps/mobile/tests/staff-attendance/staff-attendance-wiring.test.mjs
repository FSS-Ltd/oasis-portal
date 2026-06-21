import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

const mobileRoot = path.resolve(import.meta.dirname, '../..');

function read(relativePath) {
  return readFileSync(path.join(mobileRoot, relativePath), 'utf8');
}

describe('staff attendance mobile wiring', () => {
  it('adds a production staff attendance screen under the staff component boundary', () => {
    assert.equal(
      existsSync(path.join(mobileRoot, 'src/components/staff/staff-attendance-screen.tsx')),
      true,
      'StaffAttendanceScreen should exist outside the smoke component folder',
    );
    assert.equal(
      existsSync(path.join(mobileRoot, 'src/components/staff/staff-attendance-roster.tsx')),
      true,
      'Staff attendance roster should be split out of the screen container',
    );
    assert.equal(
      existsSync(path.join(mobileRoot, 'src/components/staff/staff-attendance-summary.tsx')),
      true,
      'Staff attendance summary should be split out of the screen container',
    );
    assert.equal(
      existsSync(path.join(mobileRoot, 'src/components/staff/staff-special-attendance-roster.tsx')),
      true,
      'Special attendance roster should be split out of the screen container',
    );
    assert.equal(
      existsSync(path.join(mobileRoot, 'src/components/staff/staff-attendance-utils.ts')),
      true,
      'Staff attendance helpers should be colocated with staff components',
    );
  });

  it('routes Staff Home attendance quick action to the production attendance screen', () => {
    const portal = read('src/components/staff/staff-portal-screen.tsx');
    const home = read('src/components/staff/staff-home-screen.tsx');
    const model = read('src/components/staff/staff-home-model.ts');

    assert.match(portal, /StaffAttendanceScreen/);
    assert.match(portal, /'attendance'/);
    assert.match(home, /onOpenAttendance/);
    assert.match(home, /attendance: onOpenAttendance/);
    assert.match(model, /id: 'attendance'/);
  });

  it('uses scoped student attendance APIs without exposing reset or staff-attendance admin controls', () => {
    const screen = read('src/components/staff/staff-attendance-screen.tsx');

    assert.match(screen, /api\.attendance\.forDate\.useQuery/);
    assert.match(screen, /api\.attendance\.mark\.useMutation/);
    assert.match(screen, /utils\.attendance\.forDate\.invalidate/);
    assert.match(screen, /utils\.staffHome\.summary\.invalidate/);
    assert.doesNotMatch(screen, /api\.attendance\.resetForDate/);
    assert.doesNotMatch(screen, /api\.attendance\.staffForDate/);
    assert.doesNotMatch(screen, /api\.attendance\.markStaff/);
    assert.doesNotMatch(screen, /api\.attendance\.resetStaffForDate/);
  });

  it('requires absence reasons and keeps save, loading, empty, success, and error states visible', () => {
    const screen = read('src/components/staff/staff-attendance-screen.tsx');
    const roster = read('src/components/staff/staff-attendance-roster.tsx');
    const summary = read('src/components/staff/staff-attendance-summary.tsx');
    const utils = read('src/components/staff/staff-attendance-utils.ts');

    assert.match(roster, /Absence reason/);
    assert.match(roster, /Choose a reason before saving absent/);
    assert.match(utils, /absenceReasons/);
    assert.match(utils, /isDraftSaveable/);
    assert.match(screen, /Loading attendance roster/);
    assert.match(roster, /No roster available/);
    assert.match(screen, /Attendance saved/);
    assert.match(screen, /statusMessage/);
    assert.match(screen, /markAttendance\.error/);
    assert.match(summary, /Register progress/);
  });

  it('matches the web special attendance workflow for trip and location registers', () => {
    const screen = read('src/components/staff/staff-attendance-screen.tsx');
    const specialRoster = read('src/components/staff/staff-special-attendance-roster.tsx');
    const utils = read('src/components/staff/staff-attendance-utils.ts');

    assert.match(screen, /api\.attendance\.specialForDate\.useQuery/);
    assert.match(screen, /api\.attendance\.saveSpecialSession\.useMutation/);
    assert.match(screen, /api\.attendance\.markSpecial\.useMutation/);
    assert.match(screen, /utils\.attendance\.specialForDate\.invalidate/);
    assert.match(screen, /setSpecialRegister/);
    assert.match(screen, /setSpecialDestination/);

    for (const register of ['FieldTrip', 'MinibusInbound', 'MinibusOutbound', 'TheCedars']) {
      assert.match(utils, new RegExp(register));
    }

    assert.match(specialRoster, /Special attendance/);
    assert.match(specialRoster, /Minibus destination/);
    assert.match(specialRoster, /Save destination/);
    assert.match(specialRoster, /Choose a register/);
    assert.match(specialRoster, /save the minibus destination/i);
    assert.match(specialRoster, /attendanceStatuses/);
  });
});
