import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const mobileRoot = path.resolve(import.meta.dirname, '../../..');
const repoRoot = path.resolve(mobileRoot, '../..');

function readMobile(relativePath: string): string {
  return readFileSync(path.join(mobileRoot, relativePath), 'utf8');
}

function readRepo(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

describe('staff club manager mobile wiring', () => {
  it('adds focused production staff club manager components', () => {
    const staffFiles = [
      'staff-club-manager-screen.tsx',
      'staff-club-manager-club-list.tsx',
      'staff-club-manager-overview.tsx',
      'staff-club-manager-roster.tsx',
      'staff-club-manager-attendance.tsx',
      'staff-club-manager-notices.tsx',
      'staff-club-manager-rota.tsx',
      'staff-club-manager-form-modal.tsx',
      'staff-club-manager-utils.ts',
    ];

    for (const file of staffFiles) {
      expect(existsSync(path.join(mobileRoot, 'src/components/staff', file))).toBe(true);
    }
  });

  it('routes Staff Home club manager action separately from club lead access', () => {
    const portal = readMobile('src/components/staff/staff-portal-screen.tsx');
    const home = readMobile('src/components/staff/staff-home-screen.tsx');
    const model = readMobile('src/components/staff/staff-home-model.ts');
    const apiSummary = readRepo('apps/api/src/routers/staffHome.ts');

    expect(portal).toMatch(/StaffClubManagerScreen/);
    expect(portal).toMatch(/'club-manager'/);
    expect(portal).toMatch(/'clubs'/);
    expect(portal).toMatch(/StaffClubLeadScreen/);
    expect(home).toMatch(/onOpenClubManager/);
    expect(home).toMatch(/'club-manager': onOpenClubManager/);
    expect(model).toMatch(/id: 'club-manager'/);
    expect(model).toMatch(/label: 'Club manager'/);
    expect(model).toMatch(/canManageClubs/);
    expect(apiSummary).toMatch(/canManageClubs/);
  });

  it('uses scoped manager APIs, including club creation and editing', () => {
    const screen = readMobile('src/components/staff/staff-club-manager-screen.tsx');
    const attendance = readMobile('src/components/staff/staff-club-manager-attendance.tsx');
    const notices = readMobile('src/components/staff/staff-club-manager-notices.tsx');
    const rota = readMobile('src/components/staff/staff-club-manager-rota.tsx');
    const leadScreen = readMobile('src/components/staff/staff-club-lead-screen.tsx');

    expect(screen).toMatch(/api\.club\.managementList\.useQuery/);
    expect(screen).toMatch(/api\.club\.roster\.useQuery/);
    expect(screen).toMatch(/api\.club\.attendanceForSession\.useQuery/);
    expect(screen).toMatch(/api\.club\.markAttendance\.useMutation/);
    expect(screen).toMatch(/api\.club\.resetAttendanceForSession\.useMutation/);
    expect(screen).toMatch(/api\.club\.notifications\.useQuery/);
    expect(screen).toMatch(/api\.club\.notify\.useMutation/);
    expect(screen).toMatch(/api\.club\.clubRotaSchedule\.useQuery/);
    expect(screen).toMatch(/api\.club\.yearGroupBands\.useQuery/);
    expect(screen).toMatch(/api\.club\.create\.useMutation/);
    expect(screen).toMatch(/api\.club\.update\.useMutation/);
    expect(screen).toMatch(/utils\.club\.managementList\.invalidate/);
    expect(screen).toMatch(/utils\.club\.attendanceForSession\.invalidate/);
    expect(screen).toMatch(/utils\.club\.notifications\.invalidate/);

    for (const source of [attendance, notices, rota]) {
      expect(source).not.toMatch(/api\.club\.studentCandidates/);
      expect(source).not.toMatch(/api\.club\.signUp/);
      expect(source).not.toMatch(/api\.club\.withdraw/);
      expect(source).not.toMatch(/api\.club\.leadCandidates/);
      expect(source).not.toMatch(/api\.club\.setLeadAssignments/);
      expect(source).not.toMatch(/api\.club\.rotaCandidates/);
      expect(source).not.toMatch(/api\.club\.setRotaParticipants/);
      expect(source).not.toMatch(/api\.club\.createClubRotaShift/);
      expect(source).not.toMatch(/api\.club\.updateClubRotaShift/);
      expect(source).not.toMatch(/api\.club\.deleteClubRotaShift/);
    }

    expect(leadScreen).not.toMatch(/api\.club\.managementList/);
    expect(leadScreen).not.toMatch(/api\.club\.clubRotaSchedule/);
    expect(leadScreen).not.toMatch(/api\.club\.resetAttendanceForSession/);
  });

  it('collects a required year-group selection in the manager editor', () => {
    const editor = readMobile('src/components/staff/staff-club-manager-form-modal.tsx');

    expect(editor).toMatch(/Select at least one year group/);
    expect(editor).toMatch(/yearGroupBandIds/);
    expect(editor).toMatch(/Only these groups can join newly/);
  });

  it('keeps club manager states and copy distinct from club lead', () => {
    const screen = readMobile('src/components/staff/staff-club-manager-screen.tsx');
    const list = readMobile('src/components/staff/staff-club-manager-club-list.tsx');
    const attendance = readMobile('src/components/staff/staff-club-manager-attendance.tsx');
    const notices = readMobile('src/components/staff/staff-club-manager-notices.tsx');
    const rota = readMobile('src/components/staff/staff-club-manager-rota.tsx');

    expect(screen).toMatch(/Club manager/);
    expect(list).toMatch(/All clubs/);
    expect(screen).toMatch(/Loading club manager data/);
    expect(screen).toMatch(/No active clubs/);
    expect(screen).toMatch(/Attendance saved/);
    expect(screen).toMatch(/Attendance reset/);
    expect(screen).toMatch(/Notice posted/);
    expect(screen).toMatch(/Club notice could not be sent/);
    expect(attendance).toMatch(/Reset session/);
    expect(attendance).toMatch(/Saving attendance/);
    expect(notices).toMatch(/Posting notice/);
    expect(rota).toMatch(/Rota inspection/);
    expect(rota).toMatch(/No rota shifts/);

    expect(screen).not.toMatch(/Club lead operations/);
    expect(screen).not.toMatch(/Assigned clubs/);
  });
});
