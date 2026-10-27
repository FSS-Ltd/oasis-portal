import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { canOpenAcademicInventory, paceNumberValue } from './staff-academic-inventory-utils';
import { buildStaffHomeViewModel, type StaffHomeSummary } from './staff-home-model';

const staffComponentsRoot = path.resolve(import.meta.dirname);

function readStaffComponent(fileName: string): string {
  const filePath = path.join(staffComponentsRoot, fileName);
  return existsSync(filePath) ? readFileSync(filePath, 'utf8') : '';
}

describe('staff academic inventory mobile wiring', () => {
  it('accepts only PACE numbers in the supported catalogue', () => {
    expect(paceNumberValue('1001')).toBe(1001);
    expect(paceNumberValue('1144')).toBe(1144);
    expect(paceNumberValue('1000')).toBeNull();
    expect(paceNumberValue('1145')).toBeNull();
    expect(paceNumberValue('1001.5')).toBeNull();
  });

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
    expect(screen).toMatch(/api\.academicInventory\.markOrdersInTransit\.useMutation/);
    expect(screen).toMatch(/api\.academicInventory\.markOrdersDelivered\.useMutation/);
    expect(screen).toMatch(/api\.academicInventory\.recordDiagnostic\.useMutation/);
    expect(screen).toMatch(/includeHistory: false/);
    expect(screen).toMatch(/Needs attention/);
    expect(screen).toMatch(/Planner/);
    expect(screen).toMatch(/Orders/);
    expect(screen).toMatch(/Diagnostics/);
  });

  it('opens a child and subject-specific quick order from each reorder alert', () => {
    const screen = readStaffComponent('staff-academic-inventory-screen.tsx');
    const components = readStaffComponent('staff-academic-inventory-components.tsx');

    expect(screen).toMatch(/<InventoryAlerts onCreateOrder={openQuickOrder}/);
    expect(screen).toMatch(
      /setQuickOrderTarget\(\{ studentId: alert\.studentId, subjectId: alert\.subjectId \}\)/,
    );
    expect(screen).toMatch(
      /quickOrderStudent\?\.subjects\.find\([\s\S]*quickOrderTarget\.subjectId/,
    );
    expect(screen).toMatch(
      /studentId: quickOrderTarget\.studentId,[\s\S]*subjectId: quickOrderTarget\.subjectId/,
    );
    expect(screen).toMatch(/<InventoryQuickOrderModal/);
    expect(components).toMatch(/label="Create order"/);
    expect(components).toMatch(/accessibilityLabel={`Create order for/);
    expect(components).toMatch(/presentationStyle="overFullScreen"/);
    expect(components).toMatch(/keyboardShouldPersistTaps="handled"/);
    expect(components).toMatch(/keyboardAvoidingView/);
    expect(components).toMatch(/label="Cancel"/);
    expect(components).toMatch(/disabled={pending}/);
  });

  it('announces mutation feedback to assistive technology', () => {
    const components = readStaffComponent('staff-academic-inventory-components.tsx');

    expect(components).toMatch(/accessibilityLiveRegion=/);
    expect(components).toMatch(/accessibilityRole="alert"/);
  });

  it('uses compact searchable selection sheets and a footer outside the scroll area', () => {
    const screen = readStaffComponent('staff-academic-inventory-screen.tsx');
    const pickers = readStaffComponent('staff-academic-inventory-pickers.tsx');
    expect(pickers).toMatch(/label="Find child"/);
    expect(pickers).toMatch(/<Modal/);
    expect(screen).toMatch(/<InventoryStudentPicker/);
    expect(screen).toMatch(/<InventorySubjectPicker/);
    expect(screen).toMatch(/<\/ScrollView>[\s\S]*<View style={styles\.bulkFooter}>/);
  });

  it('clears stale feedback when diagnostic controls change', () => {
    const screen = readStaffComponent('staff-academic-inventory-screen.tsx');

    expect(screen).toMatch(
      /function changeDiagnosticLevel[\s\S]*?setDiagnosticLevel[\s\S]*?setDiagnosticSubmitted\(false\)[\s\S]*?setStatusMessage\(null\)/,
    );
    expect(screen).toMatch(
      /function changeDiagnosticOutcome[\s\S]*?setDiagnosticOutcome[\s\S]*?setDiagnosticSubmitted\(false\)[\s\S]*?setStatusMessage\(null\)/,
    );
    expect(screen).toMatch(/onChangeLevel={changeDiagnosticLevel}/);
    expect(screen).toMatch(/onChangeOutcome={changeDiagnosticOutcome}/);
  });

  it('records chart tests for Math and English and level tests for Word Building and Reading', () => {
    const components = readStaffComponent('staff-academic-inventory-components.tsx');
    const screen = readStaffComponent('staff-academic-inventory-screen.tsx');
    const history = readStaffComponent('staff-academic-inventory-history.tsx');
    const gapPlan = readStaffComponent('staff-academic-gap-plan.tsx');

    for (const label of ['Math', 'English', 'Word Building', 'Reading']) {
      expect(components).toContain(`label: '${label}'`);
    }
    expect(components).toMatch(/DIAGNOSTIC_LEVEL_MAX/);
    expect(components).toMatch(/derivePacePlacement\(/);
    expect(components).toMatch(/label="First PACE"/);
    expect(components).toMatch(/label="Last PACE attempted"/);
    expect(components).toMatch(/Reading is not a subject/);
    expect(screen).toMatch(
      /recordDiagnostic\.mutate\(\{ studentId: selectedStudent\.id, \.\.\.submission \}\)/,
    );
    expect(history).toMatch(/Set up Gap PACEs/);
    expect(screen).toMatch(/initialGaps={gapPrefillMatch\?\.gaps}/);
    expect(gapPlan).toMatch(/initialGaps\?: readonly number\[\] \| undefined/);
  });

  it('locks diagnostic choices while a result is pending', () => {
    const components = readStaffComponent('staff-academic-inventory-components.tsx');
    const diagnosticCard = components.slice(
      components.indexOf('export function InventoryDiagnosticCard'),
      components.indexOf('function OptionButton'),
    );
    const segmentButton = components.slice(
      components.indexOf('function SegmentButton'),
      components.indexOf('const styles'),
    );

    // Test, first and last PACE, chart, level, outcome and the submit button.
    expect(diagnosticCard.match(/disabled={pending}/g)).toHaveLength(7);
    expect(segmentButton).toMatch(/disabled: boolean/);
    expect(segmentButton).toMatch(/accessibilityState={{ disabled, selected: active }}/);
    expect(segmentButton).toMatch(/disabled={disabled}/);
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
