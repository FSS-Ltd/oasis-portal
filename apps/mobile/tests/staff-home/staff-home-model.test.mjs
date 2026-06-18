import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

const model = await import('../../src/components/staff/staff-home-model.ts');

describe('staff home model', () => {
  it('derives the attendance progress and next task from staff summary counts', () => {
    const view = model.buildStaffHomeViewModel({
      attendance: {
        absent: 1,
        late: 1,
        marked: 8,
        present: 6,
        total: 10,
        unmarked: 2,
      },
      behaviour: { entriesRecordedToday: 2 },
      date: '2026-04-25',
      notices: { unread: 3 },
      pace: { testsRecordedToday: 4 },
      permissions: {
        canUseClubs: true,
        canUseShopCounter: true,
      },
      rota: {
        nextShift: null,
        pendingSwapCount: 1,
        shiftsToday: 2,
        shiftsThisWeek: 5,
      },
      shop: { readyReservationCount: 6 },
      clubs: { assignedClubCount: 2 },
    });

    assert.equal(view.attendanceProgressLabel, '8/10 marked');
    assert.equal(view.attendanceCompletionPercent, 80);
    assert.equal(view.nextTask.title, 'Finish attendance');
    assert.equal(view.nextTask.metric, '2 unmarked');
    assert.deepEqual(
      view.quickActions.map((action) => action.id),
      ['attendance', 'behaviour', 'pace', 'rota', 'shop', 'clubs'],
    );
  });

  it('prefers operational exceptions over routine actions', () => {
    const view = model.buildStaffHomeViewModel({
      attendance: {
        absent: 0,
        late: 0,
        marked: 12,
        present: 12,
        total: 12,
        unmarked: 0,
      },
      behaviour: { entriesRecordedToday: 0 },
      date: '2026-04-25',
      notices: { unread: 0 },
      pace: { testsRecordedToday: 0 },
      permissions: {
        canUseClubs: false,
        canUseShopCounter: true,
      },
      rota: {
        nextShift: {
          bandColour: '#5B90C5',
          bandName: 'Upper Primary',
          endsAt: '2026-04-25T12:00:00.000Z',
          kind: 'Cover',
          startsAt: '2026-04-25T09:00:00.000Z',
        },
        pendingSwapCount: 0,
        shiftsToday: 1,
        shiftsThisWeek: 3,
      },
      shop: { readyReservationCount: 4 },
      clubs: { assignedClubCount: 0 },
    });

    assert.equal(view.nextTask.title, 'Collect shop reservations');
    assert.equal(view.nextTask.metric, '4 ready');
    assert.equal(
      view.quickActions.some((action) => action.id === 'clubs'),
      false,
    );
  });
});
