import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

const mobileRoot = path.resolve(import.meta.dirname, '../..');

function read(relativePath) {
  return readFileSync(path.join(mobileRoot, relativePath), 'utf8');
}

describe('staff incident mobile wiring', () => {
  it('adds a production staff incident screen under the staff component boundary', () => {
    assert.equal(
      existsSync(path.join(mobileRoot, 'src/components/staff/staff-incident-screen.tsx')),
      true,
      'StaffIncidentScreen should exist outside the smoke component folder',
    );
    assert.equal(
      existsSync(path.join(mobileRoot, 'src/components/staff/staff-incident-form.tsx')),
      true,
      'Staff incident form should be split out of the screen container',
    );
    assert.equal(
      existsSync(path.join(mobileRoot, 'src/components/staff/staff-incident-form-controls.tsx')),
      true,
      'Staff incident form controls should be split out of the form container',
    );
    assert.equal(
      existsSync(path.join(mobileRoot, 'src/components/staff/staff-incident-student-picker.tsx')),
      true,
      'Staff incident student picker should be split out of the screen container',
    );
    assert.equal(
      existsSync(path.join(mobileRoot, 'src/components/staff/staff-incident-review-panel.tsx')),
      true,
      'Staff incident review panel should be split out of the screen container',
    );
    assert.equal(
      existsSync(path.join(mobileRoot, 'src/components/staff/staff-incident-utils.ts')),
      true,
      'Staff incident helpers should be colocated with staff components',
    );
  });

  it('routes Staff Home incident quick action to the production incident screen', () => {
    const portal = read('src/components/staff/staff-portal-screen.tsx');
    const home = read('src/components/staff/staff-home-screen.tsx');
    const model = read('src/components/staff/staff-home-model.ts');

    assert.match(portal, /StaffIncidentScreen/);
    assert.match(portal, /'incidents'/);
    assert.match(home, /onOpenIncidents/);
    assert.match(home, /incidents: onOpenIncidents/);
    assert.match(model, /id: 'incidents'/);
  });

  it('uses scoped staff incident APIs without exposing review or parent-release operations', () => {
    const screen = read('src/components/staff/staff-incident-screen.tsx');

    assert.match(screen, /api\.incident\.listStaff\.useQuery/);
    assert.match(screen, /api\.incident\.listStaffOptions\.useQuery/);
    assert.match(screen, /api\.incident\.createDraft\.useMutation/);
    assert.match(screen, /api\.incident\.submitForHeadReview\.useMutation/);
    assert.match(screen, /utils\.incident\.listStaff\.invalidate/);
    assert.match(screen, /utils\.staffHome\.summary\.invalidate/);
    assert.doesNotMatch(screen, /api\.incident\.signOff/);
    assert.doesNotMatch(screen, /api\.incident\.escalate/);
    assert.doesNotMatch(screen, /api\.incident\.generateParentCopy/);
    assert.doesNotMatch(screen, /api\.incident\.shareParentCopy/);
    assert.doesNotMatch(screen, /api\.incident\.downloadParentPdf/);
  });

  it('keeps validation, attachment affordance, pending, submitted, and failed-submit states visible', () => {
    const screen = read('src/components/staff/staff-incident-screen.tsx');
    const form = read('src/components/staff/staff-incident-form.tsx');
    const review = read('src/components/staff/staff-incident-review-panel.tsx');
    const utils = read('src/components/staff/staff-incident-utils.ts');

    assert.match(form, /Evidence attachments/);
    assert.match(form, /Parent visibility stays off/);
    assert.match(form, /Saving draft/);
    assert.match(review, /Ready for Head review/);
    assert.match(review, /Submit for Head review/);
    assert.match(screen, /Incident submitted for Head review/);
    assert.match(screen, /statusMessage/);
    assert.match(screen, /createDraft\.error|submitForHeadReview\.error/);
    assert.match(utils, /validateIncidentForm/);
    assert.match(utils, /Describe the factual account/);
    assert.match(utils, /Choose at least one student/);
  });
});
