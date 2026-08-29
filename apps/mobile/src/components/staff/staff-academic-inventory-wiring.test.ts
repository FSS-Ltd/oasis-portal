import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { canOpenAcademicInventory } from './staff-academic-inventory-utils';
import { buildStaffHomeViewModel, type StaffHomeSummary } from './staff-home-model';

const staffComponentsRoot = path.resolve(import.meta.dirname);

function readStaffComponent(fileName: string): string {
  const filePath = path.join(staffComponentsRoot, fileName);
  return existsSync(filePath) ? readFileSync(filePath, 'utf8') : '';
}

describe('staff academic inventory mobile wiring', () => {
  it('adds the inventory quick action for Heads only', () => {
    const summary: StaffHomeSummary = {
      attendance: { absent: 0, late: 0, marked: 1, present: 1, total: 1, unmarked: 0 },
      behaviour: { entriesRecordedToday: 0 },
      clubs: { assignedClubCount: 0 },
      date: '2026-08-29',
      notices: { unread: 0 },
      pace: { testsRecordedToday: 0 },
      permissions: {
        canManageClubs: false,
        canUseClubLeadAccess: false,
        canUseClubs: false,
        canUseShopCounter: false,
      },
      rota: {
        nextShift: null,
        pendingSwapCount: 0,
        shiftsToday: 0,
        shiftsThisWeek: 0,
      },
      shop: { readyReservationCount: 0 },
    };

    const headActions = buildStaffHomeViewModel(
      summary,
      canOpenAcademicInventory({ role: 'Head' }),
    ).quickActions;
    const supervisorActions = buildStaffHomeViewModel(
      summary,
      canOpenAcademicInventory({ role: 'Supervisor' }),
    ).quickActions;

    expect(headActions.some((action) => action.id === 'academic-inventory')).toBe(true);
    expect(supervisorActions.some((action) => action.id === 'academic-inventory')).toBe(false);
  });

  it('wires the Head inventory workflow to its API procedures', () => {
    const screen = readStaffComponent('staff-academic-inventory-screen.tsx');

    expect(screen).toMatch(/api\.academicInventory\.summary\.useQuery/);
    expect(screen).toMatch(/api\.academicInventory\.createOrder\.useMutation/);
    expect(screen).toMatch(/api\.academicInventory\.updateOrderStatus\.useMutation/);
    expect(screen).toMatch(/api\.academicInventory\.recordDiagnostic\.useMutation/);
  });

  it('routes a Head-only quick action from Staff Home', () => {
    const portal = readStaffComponent('staff-portal-screen.tsx');
    const home = readStaffComponent('staff-home-screen.tsx');
    const model = readStaffComponent('staff-home-model.ts');
    const source = `${portal}\n${home}\n${model}`;

    expect(source).toMatch(/academic-inventory/);
    expect(source).toMatch(/onOpenAcademicInventory/);
    expect(source).toMatch(/canOpenAcademicInventory/);
  });
});
