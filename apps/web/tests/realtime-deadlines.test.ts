import assert from 'node:assert/strict';
import test from 'node:test';
import { nextKnownDeadline, scheduleKnownDeadline } from '../src/lib/realtime/deadline-clock';

test('selects the earliest future boundary, excluding expired, absent and invalid dates', () => {
  assert.equal(
    nextKnownDeadline(
      [null, undefined, 'invalid', new Date(50), new Date(200), new Date(150)],
      100,
    ),
    150,
  );
  assert.equal(nextKnownDeadline([new Date(50), null], 100), null);
});

test('known deadline wakes once, and teardown prevents its callback', (context) => {
  context.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 100 });
  let wakes = 0;
  const stop = scheduleKnownDeadline(500, () => {
    wakes++;
  });
  context.mock.timers.tick(399);
  assert.equal(wakes, 0);
  context.mock.timers.tick(2);
  assert.equal(wakes, 1);
  context.mock.timers.tick(60_000);
  assert.equal(wakes, 1);
  stop();
  const cancel = scheduleKnownDeadline(100_000, () => {
    wakes++;
  });
  cancel();
  context.mock.timers.tick(100_000);
  assert.equal(wakes, 1);
});

test('long deadlines do not perform an early data refresh when JS timer range ends', (context) => {
  context.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 0 });
  let wakes = 0;
  const due = 2_147_483_647 + 5_000;
  const stop = scheduleKnownDeadline(due, () => {
    wakes++;
  });
  context.mock.timers.tick(2_147_483_647);
  assert.equal(wakes, 0);
  context.mock.timers.tick(5_001);
  assert.equal(wakes, 1);
  stop();
});
