import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

const mobileRoot = path.resolve(import.meta.dirname, '../..');

function read(relativePath) {
  return readFileSync(path.join(mobileRoot, relativePath), 'utf8');
}

describe('staff PACE mobile wiring', () => {
  it('adds a production staff PACE screen under the staff component boundary', () => {
    assert.equal(
      existsSync(path.join(mobileRoot, 'src/components/staff/staff-pace-screen.tsx')),
      true,
      'StaffPaceScreen should exist outside the smoke component folder',
    );
    assert.equal(
      existsSync(path.join(mobileRoot, 'src/components/staff/staff-pace-form.tsx')),
      true,
      'Staff PACE form should be split out of the screen container',
    );
    assert.equal(
      existsSync(path.join(mobileRoot, 'src/components/staff/staff-pace-student-picker.tsx')),
      true,
      'Staff PACE student picker should be split out of the screen container',
    );
    assert.equal(
      existsSync(path.join(mobileRoot, 'src/components/staff/staff-pace-subject-panel.tsx')),
      true,
      'Staff PACE subject panel should be split out of the screen container',
    );
    assert.equal(
      existsSync(path.join(mobileRoot, 'src/components/staff/staff-pace-utils.ts')),
      true,
      'Staff PACE helpers should be colocated with staff components',
    );
  });

  it('routes Staff Home PACE quick action to the production PACE screen', () => {
    const portal = read('src/components/staff/staff-portal-screen.tsx');
    const home = read('src/components/staff/staff-home-screen.tsx');
    const model = read('src/components/staff/staff-home-model.ts');

    assert.match(portal, /StaffPaceScreen/);
    assert.match(portal, /'pace'/);
    assert.match(home, /onOpenPace/);
    assert.match(home, /pace: onOpenPace/);
    assert.match(model, /id: 'pace'/);
  });

  it('uses scoped staff PACE APIs without exposing correction or admin operations', () => {
    const screen = read('src/components/staff/staff-pace-screen.tsx');

    assert.match(screen, /api\.pace\.roster\.useQuery/);
    assert.match(screen, /api\.pace\.forStudent\.useQuery/);
    assert.match(screen, /api\.pace\.record\.useMutation/);
    assert.match(screen, /utils\.pace\.forStudent\.invalidate/);
    assert.match(screen, /utils\.pace\.roster\.invalidate/);
    assert.match(screen, /utils\.staffHome\.summary\.invalidate/);
    assert.doesNotMatch(screen, /api\.pace\.updateRecord/);
    assert.doesNotMatch(screen, /api\.pace\.deleteRecord/);
    assert.doesNotMatch(screen, /approveFailedFinalTestAdvance/);
    assert.doesNotMatch(screen, /api\.admin/);
    assert.doesNotMatch(screen, /updatePacePolicy/);
  });

  it('keeps validation, policy warnings, pending state, and success or error feedback visible', () => {
    const screen = read('src/components/staff/staff-pace-screen.tsx');
    const form = read('src/components/staff/staff-pace-form.tsx');
    const panel = read('src/components/staff/staff-pace-subject-panel.tsx');
    const utils = read('src/components/staff/staff-pace-utils.ts');

    assert.match(form, /Daily PACE limit/);
    assert.match(form, /Submission blocked/);
    assert.match(form, /Saving score/);
    assert.match(screen, /PACE score entry/);
    assert.match(screen, /statusMessage/);
    assert.match(screen, /recordPace\.error/);
    assert.match(utils, /validatePaceForm/);
    assert.match(utils, /Enter a score between 0 and 100/);
    assert.match(utils, /Enter a positive PACE number/);
    assert.match(panel, /No active PACE subjects/);
  });
});
