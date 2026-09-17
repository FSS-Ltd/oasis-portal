import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const webRoot = path.resolve(import.meta.dirname, '..');

function readWeb(relativePath) {
  return readFileSync(path.join(webRoot, relativePath), 'utf8');
}

test('parent PACE is a dedicated navigable, paginated surface', () => {
  const routePath = path.join(webRoot, 'src/app/(parent)/parent/pace/page.tsx');
  const navigation = readWeb('src/components/parent/parent-nav.tsx');
  const client = readWeb('src/components/parent/parent-pace-client.tsx');
  const history = readWeb('src/components/parent/parent-pace-history-table.tsx');

  assert.equal(existsSync(routePath), true);
  assert.match(navigation, /href: '\/parent\/pace', label: 'PACE'/);
  assert.match(client, /api\.pace\.parentCurrent\.useQuery/);
  assert.match(client, /api\.pace\.parentHistory\.useQuery/);
  assert.match(client, /const PAGE_SIZE = 20/);
  assert.match(client, /pageSize: PAGE_SIZE/);
  assert.match(client, /Current/);
  assert.match(client, /History/);
  assert.match(client, /Academic Year/);
  assert.match(client, /Term/);
  assert.match(client, /resolveReportPeriod/);
  assert.match(history, /Subject/);
  assert.match(history, /Assessment/);
  assert.match(history, /Previous PACE history page/);
  assert.match(history, /Next PACE history page/);
  assert.match(history, /Showing \{String\(start\)\}–\{String\(end\)\}/);
  assert.match(history, /formatPaceIdentifier/);
});

test('parent Child detail uses only a compact current PACE preview', () => {
  const childRoute = readWeb('src/app/(parent)/parent/children/[id]/page.tsx');
  const detail = readWeb('src/components/student-drillthrough/student-drillthrough-content.tsx');

  assert.match(childRoute, /parentPaceHref/);
  assert.match(detail, /ParentCurrentPacePreview/);
  assert.match(detail, /View Full PACE/);
  assert.match(detail, /drillThroughTabs\(canViewFinance, !parentPaceHref\)/);
  assert.match(detail, /activeTab === 'pace' && !parentPaceHref/);
  assert.match(detail, /formatPaceIdentifier/);
});
