import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const webRoot = path.resolve(import.meta.dirname, '..');
const read = (relativePath) => {
  const absolutePath = path.join(webRoot, relativePath);
  return existsSync(absolutePath) ? readFileSync(absolutePath, 'utf8') : '';
};

const form = read('src/components/pace/pace-diagnostic-form.tsx');
const chart = read('src/components/pace/pace-diagnostic-chart.tsx');
const client = read('src/components/pace/pace-inventory-client.tsx');
const gapPanel = read('src/components/pace/pace-gap-plan-panel.tsx');

test('the diagnostic form offers four tests and splits chart entry from level entry', () => {
  for (const label of ['Math', 'English', 'Word Building', 'Reading']) {
    assert.match(form, new RegExp(`label: '${label}'`));
  }
  assert.match(form, /label="Test"/);
  assert.match(form, /<fieldset className="pace-levels">/);
  assert.match(form, /aria-pressed=/);
  assert.match(form, /\['Pass', 'Fail'\] as const/);
  assert.match(form, /levelResults/);
  assert.match(form, /diagnosticLevelsFor\(/);
  assert.match(form, /isDiagnosticChartTest/);
  assert.match(form, /derivePacePlacement\(/);
  // The chart is the input: shown straight away and extended with buttons, no PACE typing.
  assert.doesNotMatch(form, /label="First PACE"/);
  assert.doesNotMatch(form, /label="Last PACE attempted"/);
  assert.match(form, /Add next 12 PACEs/);
  assert.match(form, /Add next PACE/);
  assert.match(form, /Remove last PACE/);
  assert.match(form, /Learning Gaps/);
  assert.match(form, /Performance Level/);
  assert.match(form, /is not a subject/);
  assert.match(form, /It does not change the student&apos;s current PACE\./);
});

test('the chart circles PACEs like the printed diagnostic and is keyboard operable', () => {
  assert.match(chart, /export function PaceDiagnosticChart/);
  assert.match(chart, /aria-pressed=/);
  assert.match(chart, /circled/);
});

test('results show chart rows and offer a one-click Gap PACEs setup', () => {
  assert.match(client, /PaceDiagnosticChart/);
  assert.match(client, /Set up Gap PACEs/);
  assert.match(client, /setDiagnosticTab\('gaps'\)/);
  assert.match(client, /initialGaps=/);
  assert.match(client, /initialJumpTo=/);
  assert.match(client, /diagnostic\.placement/);
  assert.match(gapPanel, /initialGaps\?: readonly number\[\]/);
});

test('Reading and Word Building show the provisional start PACE from the placement map', () => {
  assert.match(form, /placementFromLevels\(/);
  assert.match(form, /First level failed/);
  assert.match(form, /Recommended start/);
  assert.match(form, /Etymology/);
  assert.match(form, /review the full\s+diagnostic\s+report/);
  assert.match(form, /Bible Reading and\s+Literature and Creative Writing/);
  assert.match(form, /readiness\s+assessment/);
  assert.match(client, /recommendedStartPace\(/);
  assert.match(client, /Recommended start/);
  assert.match(client, /Older result/);
  assert.match(client, /levelPlacement/);
  assert.match(client, /pace-level-chip/);
});

test('the Math and English chart is always visible in results, not hidden behind a toggle', () => {
  assert.doesNotMatch(client, /<details>/);
  assert.doesNotMatch(client, /View chart/);
  assert.match(client, /<PaceDiagnosticChart/);
});
