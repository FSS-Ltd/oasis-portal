import assert from 'node:assert/strict';
import test from 'node:test';
import {
  adminRotaWorkspaceTabs,
  nextAdminRotaWorkspaceTab,
  type AdminRotaWorkspaceTab,
} from '../src/app/(admin)/admin/rota/_components/admin-rota-workspace-tabs.ts';

test('keeps admin rota navigation focused on planning actions', () => {
  assert.deepEqual(
    adminRotaWorkspaceTabs.map((tab) => tab.id),
    ['week', 'shifts', 'availability', 'swaps'],
  );

  const expectations: Array<[AdminRotaWorkspaceTab, string, AdminRotaWorkspaceTab | null]> = [
    ['week', 'ArrowRight', 'shifts'],
    ['shifts', 'ArrowRight', 'availability'],
    ['availability', 'ArrowRight', 'swaps'],
    ['swaps', 'ArrowRight', 'week'],
    ['week', 'ArrowLeft', 'swaps'],
    ['swaps', 'Home', 'week'],
    ['week', 'End', 'swaps'],
    ['availability', 'Enter', null],
  ];

  for (const [activeTab, key, expectedTab] of expectations) {
    assert.equal(nextAdminRotaWorkspaceTab(activeTab, key), expectedTab);
  }
});
