import assert from 'node:assert/strict';
import test from 'node:test';
import {
  nextStaffRotaWorkspaceTab,
  staffRotaWorkspaceTabs,
  type StaffRotaWorkspaceTab,
} from '../src/components/rota/staff-rota-workspace-tabs.ts';

test('keeps staff rota navigation focused on schedule, availability, and swaps', () => {
  assert.deepEqual(
    staffRotaWorkspaceTabs.map((tab) => tab.id),
    ['schedule', 'availability', 'swap'],
  );

  const expectations: Array<[StaffRotaWorkspaceTab, string, StaffRotaWorkspaceTab | null]> = [
    ['schedule', 'ArrowRight', 'availability'],
    ['availability', 'ArrowRight', 'swap'],
    ['swap', 'ArrowRight', 'schedule'],
    ['schedule', 'ArrowLeft', 'swap'],
    ['swap', 'Home', 'schedule'],
    ['schedule', 'End', 'swap'],
    ['availability', 'Enter', null],
  ];

  for (const [activeTab, key, expectedTab] of expectations) {
    assert.equal(nextStaffRotaWorkspaceTab(activeTab, key), expectedTab);
  }
});
