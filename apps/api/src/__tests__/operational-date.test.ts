import { describe, expect, it, vi } from 'vitest';
import {
  assertFieldTripAttendanceDate,
  assertOperatingDate,
  assertRotaDate,
  operationalDateStatus,
} from '../lib/operational-date.js';

function date(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function dbWithEvent(
  event: { active: boolean; category: 'HalfTerm' | 'Meetings' | 'Trips' } | null,
) {
  return {
    calendarEvent: {
      findFirst: vi
        .fn()
        .mockImplementation(({ where }: { where: { category: 'HalfTerm' | 'Trips' } }) =>
          Promise.resolve(event?.active && event.category === where.category ? { id: 'event' } : null),
        ),
    },
  } as never;
}

describe('operational date access', () => {
  it('allows normal attendance on an operating day and rejects a closure', async () => {
    const db = dbWithEvent(null);

    await expect(assertOperatingDate(db, date('2027-01-05'))).resolves.toBeUndefined();
    await expect(assertOperatingDate(db, date('2027-02-16'))).rejects.toThrow('Half term');
  });

  it('permits only rota and field-trip attendance for an active trip on a closure', async () => {
    const db = dbWithEvent({ active: true, category: 'Trips' });

    await expect(operationalDateStatus(db, date('2027-02-16'))).resolves.toMatchObject({
      kind: 'fieldTrip',
    });
    await expect(assertRotaDate(db, date('2027-02-16'))).resolves.toBeUndefined();
    await expect(assertFieldTripAttendanceDate(db, date('2027-02-16'))).resolves.toBeUndefined();
    await expect(assertOperatingDate(db, date('2027-02-16'))).rejects.toThrow('operating day');
  });

  it('does not treat archived or non-trip events as field trips', async () => {
    await expect(
      assertRotaDate(dbWithEvent({ active: false, category: 'Trips' }), date('2027-02-16')),
    ).rejects.toThrow('planned field trips');
    await expect(
      assertFieldTripAttendanceDate(
        dbWithEvent({ active: true, category: 'Meetings' }),
        date('2027-02-16'),
      ),
    ).rejects.toThrow('planned field trip');
  });

  it('treats an active calendar half-term as closed even when the published calendar says operating', async () => {
    const db = dbWithEvent({ active: true, category: 'HalfTerm' });

    await expect(operationalDateStatus(db, date('2027-01-05'))).resolves.toMatchObject({
      kind: 'closed',
      label: 'Half term',
    });
    await expect(assertRotaDate(db, date('2027-01-05'))).rejects.toThrow('Half term');
  });
});
