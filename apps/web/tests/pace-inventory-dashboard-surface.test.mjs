import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const webRoot = path.resolve(import.meta.dirname, '..');

function readWeb(relativePath) {
  return readFileSync(path.join(webRoot, relativePath), 'utf8');
}

test('the Head dashboard exposes PACE Inventory next to the PACE workflow', () => {
  const adminNavSource = readWeb('src/components/admin/admin-nav.tsx');
  const dashboardSource = readWeb('src/app/(admin)/admin/page.tsx');

  assert.match(
    adminNavSource,
    /href: '\/admin\/pace'[^\n]*label: 'PACE'[\s\S]*href: '\/admin\/pace\/inventory'[^\n]*label: 'PACE Inventory'/,
  );
  assert.match(adminNavSource, /if \(item\.label === 'PACE Inventory'\) return access\.isHead;/);
  assert.match(
    dashboardSource,
    /\{user\.role === 'Head' \? \([\s\S]*<QuickAction href="\/admin\/pace\/inventory" label="PACE Inventory" \/>[\s\S]*\) : null\}/,
  );
});

test('the dashboard provides a Head-only PACE Inventory route backed by the inventory client', () => {
  const routePath = path.join(webRoot, 'src/app/(admin)/admin/pace/inventory/page.tsx');

  assert.equal(existsSync(routePath), true);
  const routeSource = readFileSync(routePath, 'utf8');
  assert.match(routeSource, /getAcademicInventoryHeadUser/);
  assert.match(routeSource, /PaceInventoryClient/);
});

test('the PACE Inventory client supports bulk supply, tracked orders, status changes, and diagnostic corrections', () => {
  const clientPath = path.join(webRoot, 'src/components/pace/pace-inventory-client.tsx');
  const pickerPath = path.join(webRoot, 'src/components/pace/pace-catalogue-picker.tsx');

  assert.equal(existsSync(clientPath), true);
  const clientSource = readFileSync(clientPath, 'utf8');
  assert.equal(existsSync(pickerPath), true);
  const pickerSource = readFileSync(pickerPath, 'utf8');

  assert.match(clientSource, /PaceCataloguePicker/);
  assert.match(clientSource, /api\.academicInventory\.addCurrentSupply\.useMutation/);
  assert.match(clientSource, /api\.academicInventory\.createOrders\.useMutation/);
  assert.match(clientSource, /api\.academicInventory\.updateOrderStatus\.useMutation/);
  assert.match(clientSource, /api\.academicInventory\.deleteDiagnostic\.useMutation/);
  assert.match(clientSource, /Delete diagnostic/);
  assert.match(clientSource, /ConfirmationDialog/);
  assert.match(
    clientSource,
    /const isBulkMutationPending = addCurrentSupply\.isPending \|\| createOrders\.isPending/,
  );
  assert.match(clientSource, /availablePacesAhead\(/);
  assert.match(clientSource, /availableFutureSupply\.map\(/);
  assert.match(clientSource, /disabled=\{!assignment \|\| isBulkMutationPending\}/);
  assert.match(
    clientSource,
    /disabled=\{!assignment \|\| !hasSelection \|\| isBulkMutationPending\}/,
  );
  assert.match(clientSource, /PACE orders created\./);
  assert.match(clientSource, /function nextOrderStatus/);
  assert.match(clientSource, /Mark \{nextStatus\}/);
  assert.match(pickerSource, /type="checkbox"/);
  assert.match(pickerSource, /Level \{level\}/);
  assert.match(pickerSource, /!isAvailable && !isSelected/);
  assert.match(pickerSource, /Selected/);
  assert.match(pickerSource, /Unavailable/);
});

test('PACE Progress is exact while PACE Inventory owns its nested routes', () => {
  const adminNavSource = readWeb('src/components/admin/admin-nav.tsx');

  assert.match(adminNavSource, /href === '\/admin\/pace'[^\n]*pathname === href/);
  assert.match(
    adminNavSource,
    /return pathname === href \|\| pathname\.startsWith\(`\$\{href\}\/`\);/,
  );
});
