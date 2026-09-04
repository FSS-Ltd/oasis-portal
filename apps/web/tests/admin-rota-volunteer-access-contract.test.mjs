import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const adminCss = readFileSync('apps/web/src/app/(admin)/admin/admin.css', 'utf8');
const volunteerAccessSource = readFileSync(
  'apps/web/src/app/(admin)/admin/rota/_components/rota-volunteer-access.tsx',
  'utf8',
);
const schedulerSource = readFileSync(
  'apps/web/src/app/(admin)/admin/rota/rota-scheduler-client.tsx',
  'utf8',
);

test('admin rota tabs resolve to two columns before narrow desktop tabs can crowd', () => {
  const baseRule = '.admin-rota-tabs {';
  const responsiveRule = /@media \(max-width: 1100px\) \{\s*\.admin-rota-tabs \{\s*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/gu;
  const responsiveRules = [...adminCss.matchAll(responsiveRule)];
  const lastResponsiveRule = responsiveRules.at(-1);

  assert.ok(lastResponsiveRule?.index !== undefined);
  assert.ok(lastResponsiveRule.index > adminCss.indexOf(baseRule));
});

test('non-manager rota tabs use all four desktop columns', () => {
  assert.match(
    adminCss,
    /\.admin-rota-tabs--four \{\s*grid-template-columns: repeat\(4, minmax\(0, 1fr\)\);/u,
  );
  assert.match(
    schedulerSource,
    /className=\{`admin-rota-tabs\$\{hasVolunteerAccessTab \? '' : ' admin-rota-tabs--four'\}`\}/u,
  );
});

test('volunteer access query errors are announced to assistive technology', () => {
  assert.match(
    volunteerAccessSource,
    /<p className="status--error" role="alert">[\s\S]*\{friendlyErrorMessage\(accessQuery\.error\)\}[\s\S]*<\/p>/,
  );
});

test('volunteer access pending state disables only the affected row', () => {
  assert.match(
    volunteerAccessSource,
    /disabled=\{isPendingVolunteerRow\(pendingRows, member\.id\)\}/u,
  );
  assert.doesNotMatch(volunteerAccessSource, /disabled=\{updateAccess\.isPending/u);
  assert.match(volunteerAccessSource, /variables\.userId/u);
  assert.match(volunteerAccessSource, /onSettled\(_data, _error, variables\)/u);
  assert.match(
    volunteerAccessSource,
    /invalidate\(\)\.catch\(\(\) => undefined\)/u,
  );
});
