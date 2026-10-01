import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const webRoot = path.resolve(import.meta.dirname, '..');

function readWeb(relativePath) {
  return readFileSync(path.join(webRoot, relativePath), 'utf8');
}

function evaluateIsActiveRoute(adminNavSource) {
  const match = adminNavSource.match(
    /function isActiveRoute\(pathname: string, href: string, label: string\): boolean \{[\s\S]*?\n\}/,
  );

  assert.ok(match, 'isActiveRoute helper must exist');
  const helperSource = match[0].replaceAll(': string', '').replace(': boolean', '');

  return Function(`return (${helperSource});`)();
}

function evaluateSelectionHelper(clientSource, helperName) {
  const match = clientSource.match(new RegExp(`function ${helperName}\\([\\s\\S]*?\\n\\}`, 'u'));

  assert.ok(match, `${helperName} helper must exist`);
  const helperSource = match[0]
    .replaceAll(': InventoryStudent[]', '')
    .replaceAll(': InventoryStudent | null', '')
    .replaceAll(': InventoryAssignment | null', '')
    .replaceAll(': string', '');

  return Function(`${helperSource}; return ${helperName};`)();
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
  const diagnosticFormPath = path.join(webRoot, 'src/components/pace/pace-diagnostic-form.tsx');
  const pickerPath = path.join(webRoot, 'src/components/pace/pace-catalogue-picker.tsx');

  assert.equal(existsSync(clientPath), true);
  const clientSource = readFileSync(clientPath, 'utf8');
  assert.equal(existsSync(diagnosticFormPath), true);
  const diagnosticFormSource = readFileSync(diagnosticFormPath, 'utf8');
  assert.equal(existsSync(pickerPath), true);
  const pickerSource = readFileSync(pickerPath, 'utf8');

  assert.match(clientSource, /PaceCataloguePicker/);
  assert.match(clientSource, /api\.academicInventory\.addCurrentSupply\.useMutation/);
  assert.match(clientSource, /api\.academicInventory\.createOrders\.useMutation/);
  assert.match(clientSource, /api\.academicInventory\.updateOrderStatus\.useMutation/);
  assert.match(clientSource, /api\.academicInventory\.recordDiagnostic\.useMutation/);
  assert.match(clientSource, /api\.academicInventory\.deleteDiagnostic\.useMutation/);
  assert.match(clientSource, /PaceDiagnosticForm/);
  assert.match(clientSource, /Delete diagnostic/);
  assert.match(clientSource, /ConfirmationDialog/);
  assert.match(
    clientSource,
    /const isBulkMutationPending = addCurrentSupply\.isPending \|\| createOrders\.isPending/,
  );
  assert.match(clientSource, /availablePacesAhead\(/);
  assert.match(clientSource, /availableFutureSupply\.map\(/);
  assert.match(clientSource, /\{assignment \? \(/);
  assert.match(clientSource, /disabled=\{isBulkMutationPending\}/);
  assert.match(
    clientSource,
    /disabled=\{!assignment \|\| !hasSelection \|\| isBulkMutationPending\}/,
  );
  assert.match(clientSource, /PACE orders created\./);
  assert.match(clientSource, /function nextOrderStatus/);
  assert.match(clientSource, /Mark \{nextStatus\}/);
  assert.match(clientSource, /PACE order is outside the supported range and cannot be delivered\./);
  assert.match(pickerSource, /type="checkbox"/);
  assert.match(pickerSource, /availablePacesAhead\(currentPaceNumber, PACE_CATALOGUE\)/);
  assert.match(pickerSource, /slice\(0, visibleCount\)/);
  assert.match(pickerSource, /Show next \{String\(PACE_PICKER_WINDOW_SIZE\)\} PACEs/);
  assert.doesNotMatch(pickerSource, /paceLevelForNumber|Level \{level\}/);
  assert.match(pickerSource, /!isAvailable && !isSelected/);
  assert.match(pickerSource, /Selected/);
  assert.match(pickerSource, /Unavailable/);
  assert.match(pickerSource, /Starting after PACE #\$\{String\(currentPaceNumber\)\}/);
  assert.match(diagnosticFormSource, /<form/);
  assert.match(diagnosticFormSource, /label="Level"/);
  assert.match(diagnosticFormSource, /label="Outcome"/);
  assert.match(diagnosticFormSource, /Record diagnostic/);
  assert.match(diagnosticFormSource, /It does not change the student&apos;s current PACE\./);
});

test('PACE Inventory does not resolve stale student or subject ids to fallback assignments', () => {
  const clientSource = readWeb('src/components/pace/pace-inventory-client.tsx');
  const resolveStudent = evaluateSelectionHelper(clientSource, 'selectedStudent');
  const resolveAssignment = evaluateSelectionHelper(clientSource, 'selectedAssignment');
  const students = [
    {
      id: 'student-1',
      subjects: [{ subjectId: 'english' }, { subjectId: 'maths' }],
    },
    {
      id: 'student-2',
      subjects: [{ subjectId: 'science' }],
    },
  ];

  assert.equal(resolveStudent(students, ''), students[0]);
  assert.equal(resolveStudent(students, 'student-2'), students[1]);
  assert.equal(resolveStudent(students, 'deactivated-student'), null);
  assert.equal(resolveAssignment(students[0], ''), students[0].subjects[0]);
  assert.equal(resolveAssignment(students[0], 'maths'), students[0].subjects[1]);
  assert.equal(resolveAssignment(students[0], 'deactivated-subject'), null);
  assert.equal(resolveAssignment(null, ''), null);
});

test('PACE Inventory clears and guards PACE numbers when the effective assignment changes', () => {
  const clientSource = readWeb('src/components/pace/pace-inventory-client.tsx');

  assert.match(
    clientSource,
    /const selectionContextKey = `\$\{selectedStudentId\}:\$\{selectedSubjectId\}:\$\{String\([\s\S]*assignment\?\.currentPaceNumber \?\? ''[\s\S]*\)\}`;/,
  );
  assert.match(
    clientSource,
    /paceSelection\.assignmentKey === selectionContextKey \? paceSelection\.paceNumbers : \[\]/,
  );
  assert.match(
    clientSource,
    /useEffect\(\(\) => \{[\s\S]*setPaceSelection\([\s\S]*paceNumbers: \[\][\s\S]*\}, \[selectionContextKey\]\);/,
  );
});

test('Needs attention groups by child and lets the order modal select a subject', () => {
  const clientSource = readWeb('src/components/pace/pace-inventory-client.tsx');
  const modalSource = readWeb('src/components/pace/pace-inventory-order-modal.tsx');
  const pickerSource = readWeb('src/components/pace/pace-catalogue-picker.tsx');

  assert.match(clientSource, /function groupAlertsByStudent\([\s\S]*groupedAlerts\.map\(/);
  assert.match(clientSource, /setQuickOrderTarget\(\{[\s\S]*studentId: group\.studentId/);
  assert.match(modalSource, /onSubmit: \(subjectId: string, paceNumbers: number\[\]\)/);
  assert.match(modalSource, /<Field label="Subject">[\s\S]*<SelectInput/);
  assert.match(modalSource, /onSubmit\(subject\.subjectId, paceNumbers\)/);
  assert.match(clientSource, /<PaceInventoryOrderModal/);
  assert.match(clientSource, /aria-label={`Create order for/);
  assert.match(modalSource, /<dialog[\s\S]*aria-labelledby=/);
  assert.match(modalSource, /dialog\.showModal\(\)/);
  assert.match(modalSource, /onCancel=/);
  assert.match(modalSource, /label|Cancel/);
  assert.match(modalSource, /role="alert"/);
  assert.match(modalSource, /disabled={pending}/);
  assert.match(pickerSource, /useId\(\)/);
});

test('PACE Progress is exact while PACE Inventory owns its nested routes', () => {
  const adminNavSource = readWeb('src/components/admin/admin-nav.tsx');
  const isActiveRoute = evaluateIsActiveRoute(adminNavSource);

  assert.equal(isActiveRoute('/admin/pace', '/admin/pace', 'PACE'), true);
  for (const pathname of ['/admin/pace/inventory', '/admin/pace/inventory/diagnostics']) {
    assert.equal(isActiveRoute(pathname, '/admin/pace', 'PACE'), false);
    assert.equal(isActiveRoute(pathname, '/admin/pace/inventory', 'PACE Inventory'), true);
  }
});
