import assert from 'node:assert/strict';
import test from 'node:test';
import {
  directoryFilters,
  matchesDirectoryFilter,
  type DirectoryItem,
} from '../src/app/(admin)/admin/staff/_components/people-profile-model';

function account(active: boolean, role: 'Parent' | 'Supervisor'): DirectoryItem {
  return {
    key: `${role}:${String(active)}`,
    kind: role === 'Parent' ? 'parent' : 'supervisor',
    title: 'Test Person',
    subtitle: role,
    searchText: 'test person',
    user: {
      id: 'test-user',
      role,
      active,
      fullName: 'Test Person',
      email: 'test@example.test',
      tags: [],
      children: [],
      dob: null,
      phone: null,
      address: null,
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-01'),
    },
  };
}

test('the existing people selector includes an Inactive option', () => {
  assert.ok(
    directoryFilters.some((filter) => filter.id === 'inactive' && filter.label === 'Inactive'),
  );
});

test('Inactive shows inactive accounts across roles and excludes active accounts', () => {
  const items = [account(true, 'Parent'), account(false, 'Parent'), account(false, 'Supervisor')];
  assert.deepEqual(
    items.filter((item) => matchesDirectoryFilter(item, 'inactive')),
    items.slice(1),
  );
});

test('the default and role options keep inactive accounts out of the current directory', () => {
  const active = account(true, 'Parent');
  const inactive = account(false, 'Parent');
  assert.equal(matchesDirectoryFilter(active, 'all'), true);
  assert.equal(matchesDirectoryFilter(active, 'parent'), true);
  assert.equal(matchesDirectoryFilter(active, 'supervisor'), false);
  assert.equal(matchesDirectoryFilter(inactive, 'all'), false);
  assert.equal(matchesDirectoryFilter(inactive, 'parent'), false);
});
