import assert from 'node:assert/strict';
import test from 'node:test';
import { canUseParentVolunteerNavigation, resolveParentVolunteerAccess } from '@oasis/domain';
import { assertParentVolunteerRouteAccess } from '../src/components/parent/parent-volunteer-route-access.ts';
import {
  parentBottomNavigationItems,
  parentNavigationItems,
} from '../src/components/parent/parent-nav.tsx';
import { lunchAndClubsVolunteerSaveInput } from '../src/components/parent/parent-volunteer-client.tsx';

const grantedStaffAccess = resolveParentVolunteerAccess({
  active: true,
  activeGuardianCount: 1,
  role: 'ClubsLead',
  staffParentVolunteerAccess: true,
});

test('entitled staff and parents see Volunteer in side navigation without changing mobile bottom navigation', () => {
  const parentAccess = resolveParentVolunteerAccess({
    active: true,
    activeGuardianCount: 1,
    role: 'Parent',
    staffParentVolunteerAccess: false,
  });
  const deniedStaffAccess = resolveParentVolunteerAccess({
    active: true,
    activeGuardianCount: 1,
    role: 'Supervisor',
    staffParentVolunteerAccess: false,
  });

  for (const access of [parentAccess, grantedStaffAccess]) {
    assert.ok(
      parentNavigationItems(canUseParentVolunteerNavigation(access)).some(
        (item) => item.href === '/parent/volunteer',
      ),
    );
  }
  assert.ok(
    !parentNavigationItems(canUseParentVolunteerNavigation(deniedStaffAccess)).some(
      (item) => item.href === '/parent/volunteer',
    ),
  );
  assert.deepEqual(
    parentBottomNavigationItems(canUseParentVolunteerNavigation(grantedStaffAccess)).map(
      (item) => item.href,
    ),
    ['/parent', '/parent/calendar', '/parent/permission-slips', '/parent/fees', '/parent/messages'],
  );
});

test('the volunteer route denies unentitled staff and accepts Parent or entitled staff access', () => {
  assert.doesNotThrow(() => {
    assertParentVolunteerRouteAccess('parent');
  });
  assert.doesNotThrow(() => {
    assertParentVolunteerRouteAccess(grantedStaffAccess);
  });
  assert.throws(() => {
    assertParentVolunteerRouteAccess(null);
  }, /NEXT_HTTP_ERROR_FALLBACK;404/u);
});

test('the Lunch + Clubs client mutation seam never sends Centre dates', () => {
  const input = lunchAndClubsVolunteerSaveInput({
    primaryLunchAndClubsDates: ['2026-09-03'],
    secondaryLunchAndClubsDates: ['2026-09-04'],
    termId: '2026-Autumn',
  });

  assert.deepEqual(input, {
    primaryLunchAndClubsDates: ['2026-09-03'],
    secondaryLunchAndClubsDates: ['2026-09-04'],
    termId: '2026-Autumn',
  });
  assert.equal('centreDates' in input, false);
});
