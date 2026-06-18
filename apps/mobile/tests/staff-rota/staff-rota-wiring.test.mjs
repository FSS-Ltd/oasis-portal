import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

const mobileRoot = path.resolve(import.meta.dirname, '../..');

function read(relativePath) {
  return readFileSync(path.join(mobileRoot, relativePath), 'utf8');
}

describe('staff rota mobile wiring', () => {
  it('adds a production staff rota screen under the staff component boundary', () => {
    assert.equal(
      existsSync(path.join(mobileRoot, 'src/components/staff/staff-rota-screen.tsx')),
      true,
      'StaffRotaScreen should exist outside the smoke component folder',
    );
    assert.equal(
      existsSync(path.join(mobileRoot, 'src/components/staff/staff-rota-utils.ts')),
      true,
      'Staff rota helpers should be colocated with staff components',
    );
    assert.equal(
      existsSync(path.join(mobileRoot, 'src/components/staff/staff-rota-availability-panel.tsx')),
      true,
      'Staff availability editing should be split out of the screen container',
    );
    assert.equal(
      existsSync(path.join(mobileRoot, 'src/components/staff/staff-rota-swap-panel.tsx')),
      true,
      'Staff swap requests should be split out of the screen container',
    );
  });

  it('routes Staff Home rota quick action to the production rota screen', () => {
    const portal = read('src/components/staff/staff-portal-screen.tsx');
    const home = read('src/components/staff/staff-home-screen.tsx');
    const model = read('src/components/staff/staff-home-model.ts');

    assert.match(portal, /StaffRotaScreen/);
    assert.match(portal, /'rota'/);
    assert.match(home, /onOpenRota/);
    assert.match(home, /action\.id === 'rota'/);
    assert.match(model, /id: 'rota'/);
  });

  it('uses staff self-service rota APIs without exposing admin-only scheduling controls', () => {
    const screen = read('src/components/staff/staff-rota-screen.tsx');

    assert.match(screen, /api\.rota\.myRota\.useQuery/);
    assert.match(screen, /api\.rota\.myAvailability\.useQuery/);
    assert.match(screen, /api\.rota\.setMyAvailability\.useMutation/);
    assert.match(screen, /api\.rota\.myMonthlyAvailability\.useQuery/);
    assert.match(screen, /api\.rota\.setMyMonthlyAvailability\.useMutation/);
    assert.match(screen, /api\.rota\.swapCandidates\.useQuery/);
    assert.match(screen, /api\.rota\.mySwapRequests\.useQuery/);
    assert.match(screen, /api\.rota\.requestSwap\.useMutation/);
    assert.doesNotMatch(screen, /api\.rota\.weekSchedule/);
    assert.doesNotMatch(screen, /api\.rota\.listStaff/);
    assert.doesNotMatch(screen, /api\.rota\.createShift/);
    assert.doesNotMatch(screen, /api\.rota\.updateShift/);
    assert.doesNotMatch(screen, /api\.rota\.deleteShift/);
    assert.doesNotMatch(screen, /api\.rota\.pendingSwapRequests/);
    assert.doesNotMatch(screen, /api\.rota\.approveSwap/);
    assert.doesNotMatch(screen, /api\.rota\.rejectSwap/);
  });

  it('surfaces rota, availability, monthly unavailability, and swap request states', () => {
    const screen = read('src/components/staff/staff-rota-screen.tsx');
    const availabilityPanel = read('src/components/staff/staff-rota-availability-panel.tsx');
    const swapPanel = read('src/components/staff/staff-rota-swap-panel.tsx');
    const utils = read('src/components/staff/staff-rota-utils.ts');

    assert.match(screen, /RotaPanel/);
    assert.match(screen, /AvailabilityPanel/);
    assert.match(screen, /SwapPanel/);
    assert.match(availabilityPanel, /Weekly availability/);
    assert.match(availabilityPanel, /Monthly unavailability/);
    assert.match(swapPanel, /Request shift swap/);
    assert.match(screen, /Shift swap request sent for Head review/);
    assert.match(swapPanel, /swap\.direction/);
    assert.match(utils, /monthlyAvailabilityLabel/);
    assert.match(utils, /all day/);
  });
});
