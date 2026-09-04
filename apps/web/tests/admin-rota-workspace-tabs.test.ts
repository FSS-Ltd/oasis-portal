import assert from 'node:assert/strict';
import test from 'node:test';
import {
  adminRotaWorkspaceTabs,
  nextAdminRotaWorkspaceTab,
  type AdminRotaWorkspaceTab,
} from '../src/app/(admin)/admin/rota/_components/admin-rota-workspace-tabs.ts';

test('shows volunteer access only to managers and includes it in keyboard navigation', () => {
  assert.deepEqual(
    adminRotaWorkspaceTabs(true).map((tab) => tab.id),
    ['week', 'shifts', 'availability', 'swaps', 'volunteerAccess'],
  );
  assert.deepEqual(
    adminRotaWorkspaceTabs(false).map((tab) => tab.id),
    ['week', 'shifts', 'availability', 'swaps'],
  );

  assert.equal(
    nextAdminRotaWorkspaceTab('swaps', 'ArrowRight', adminRotaWorkspaceTabs(true)),
    'volunteerAccess',
  );
});

test('keeps non-manager admin rota navigation focused on planning actions', () => {
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
    assert.equal(
      nextAdminRotaWorkspaceTab(activeTab, key, adminRotaWorkspaceTabs(false)),
      expectedTab,
    );
  }
});
