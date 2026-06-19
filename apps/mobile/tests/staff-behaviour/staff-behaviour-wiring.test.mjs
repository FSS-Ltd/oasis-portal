import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

const mobileRoot = path.resolve(import.meta.dirname, '../..');

function read(relativePath) {
  return readFileSync(path.join(mobileRoot, relativePath), 'utf8');
}

describe('staff behaviour mobile wiring', () => {
  it('adds a production staff behaviour screen under the staff component boundary', () => {
    assert.equal(
      existsSync(path.join(mobileRoot, 'src/components/staff/staff-behaviour-screen.tsx')),
      true,
      'StaffBehaviourScreen should exist outside the smoke component folder',
    );
    assert.equal(
      existsSync(path.join(mobileRoot, 'src/components/staff/staff-behaviour-form.tsx')),
      true,
      'Staff behaviour form should be split out of the screen container',
    );
    assert.equal(
      existsSync(path.join(mobileRoot, 'src/components/staff/staff-behaviour-student-picker.tsx')),
      true,
      'Staff behaviour student picker should be split out of the screen container',
    );
    assert.equal(
      existsSync(path.join(mobileRoot, 'src/components/staff/staff-behaviour-recent-panel.tsx')),
      true,
      'Staff behaviour recent entries should be split out of the screen container',
    );
    assert.equal(
      existsSync(path.join(mobileRoot, 'src/components/staff/staff-behaviour-utils.ts')),
      true,
      'Staff behaviour helpers should be colocated with staff components',
    );
  });

  it('routes Staff Home behaviour quick action to the production behaviour screen', () => {
    const portal = read('src/components/staff/staff-portal-screen.tsx');
    const home = read('src/components/staff/staff-home-screen.tsx');
    const model = read('src/components/staff/staff-home-model.ts');

    assert.match(portal, /StaffBehaviourScreen/);
    assert.match(portal, /'behaviour'/);
    assert.match(home, /onOpenBehaviour/);
    assert.match(home, /behaviour: onOpenBehaviour/);
    assert.match(model, /id: 'behaviour'/);
  });

  it('uses scoped staff behaviour APIs without exposing report or admin operations', () => {
    const screen = read('src/components/staff/staff-behaviour-screen.tsx');

    assert.match(screen, /api\.attendance\.forDate\.useQuery/);
    assert.match(screen, /api\.behaviour\.recentEntries\.useQuery/);
    assert.match(screen, /api\.behaviour\.log\.useMutation/);
    assert.match(screen, /utils\.behaviour\.recentEntries\.invalidate/);
    assert.match(screen, /utils\.staffHome\.summary\.invalidate/);
    assert.doesNotMatch(screen, /api\.behaviour\.dailyMerits/);
    assert.doesNotMatch(screen, /api\.behaviour\.trends/);
    assert.doesNotMatch(screen, /api\.behaviour\.updateEntry/);
    assert.doesNotMatch(screen, /api\.behaviour\.deleteEntry/);
    assert.doesNotMatch(screen, /api\.behaviour\.escalateDemeritStage/);
  });

  it('keeps validation, Sensitive policy messaging, pending state, and success or error feedback visible', () => {
    const screen = read('src/components/staff/staff-behaviour-screen.tsx');
    const form = read('src/components/staff/staff-behaviour-form.tsx');
    const recent = read('src/components/staff/staff-behaviour-recent-panel.tsx');
    const utils = read('src/components/staff/staff-behaviour-utils.ts');

    assert.match(form, /Sensitive entries are restricted/);
    assert.match(form, /Saving behaviour/);
    assert.match(screen, /Behaviour saved/);
    assert.match(screen, /statusMessage/);
    assert.match(screen, /logBehaviour\.error/);
    assert.match(utils, /validateBehaviourForm/);
    assert.match(utils, /Enter a positive merit amount/);
    assert.match(utils, /Choose a student/);
    assert.match(recent, /No behaviour entries have been logged today/);
  });
});
