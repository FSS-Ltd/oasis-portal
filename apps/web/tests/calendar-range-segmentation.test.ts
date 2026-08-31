import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildCalendarMonthWeeks,
  type CalendarEvent,
} from '../src/components/calendar/calendar-model.ts';

function makeRangeEvent(id: string, startDate: string, endDate: string): CalendarEvent {
  return {
    id,
    title: id,
    description: null,
    audience: 'All',
    category: 'HalfTerm',
    startDate,
    endDate,
    startTime: null,
    endTime: null,
    active: true,
    createdById: 'head',
    createdAt: new Date('2026-08-31T00:00:00.000Z'),
    updatedAt: new Date('2026-08-31T00:00:00.000Z'),
    requiredPeople: [],
    source: 'Manual',
  };
}

test('splits a multi-day holiday into continuous weekly bars without daily repetitions', () => {
  const holiday = makeRangeEvent('Autumn half-term break', '2026-10-17', '2026-11-02');
  const weeks = buildCalendarMonthWeeks('2026-10', [holiday]);
  const segments = weeks.flatMap((week) => week.rangeSegments);

  assert.deepEqual(
    segments.map((segment) => [
      segment.event.id,
      segment.startColumn,
      segment.endColumn,
      segment.showsLabel,
    ]),
    [
      ['Autumn half-term break', 5, 6, true],
      ['Autumn half-term break', 0, 6, false],
      ['Autumn half-term break', 0, 6, false],
      ['Autumn half-term break', 0, 0, false],
    ],
  );
  assert.equal(segments.length, 4);
  assert.equal(
    weeks
      .flatMap((week) => week.days.flatMap((day) => day.events))
      .filter((event) => event.id === holiday.id).length,
    0,
  );
});

test('uses separate lanes for overlapping multi-day ranges', () => {
  const weeks = buildCalendarMonthWeeks('2026-10', [
    makeRangeEvent('First break', '2026-10-17', '2026-10-31'),
    makeRangeEvent('Second break', '2026-10-20', '2026-10-27'),
  ]);
  const overlappingWeek = weeks.find((week) => week.days[0]?.key === '2026-10-19');

  assert.ok(overlappingWeek);
  assert.equal(overlappingWeek.rangeLaneCount, 2);
  assert.deepEqual(
    overlappingWeek.rangeSegments.map((segment) => [segment.event.id, segment.lane]),
    [
      ['First break', 0],
      ['Second break', 1],
    ],
  );
});
