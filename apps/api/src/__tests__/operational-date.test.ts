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

function dbWithTrip(trip: { active: boolean; category: 'Meetings' | 'Trips' } | null) {
  return {
    calendarEvent: {
      findFirst: vi
        .fn()
        .mockResolvedValue(trip?.active && trip.category === 'Trips' ? { id: 'trip' } : null),
    },
  } as never;
}

describe('operational date access', () => {
  it('allows normal attendance on an operating day and rejects a closure', async () => {
    const db = dbWithTrip(null);

    await expect(assertOperatingDate(db, date('2027-01-05'))).resolves.toBeUndefined();
    await expect(assertOperatingDate(db, date('2027-02-16'))).rejects.toThrow('Half term');
  });

  it('permits only rota and field-trip attendance for an active trip on a closure', async () => {
    const db = dbWithTrip({ active: true, category: 'Trips' });

    await expect(operationalDateStatus(db, date('2027-02-16'))).resolves.toMatchObject({
      kind: 'fieldTrip',
    });
    await expect(assertRotaDate(db, date('2027-02-16'))).resolves.toBeUndefined();
    await expect(assertFieldTripAttendanceDate(db, date('2027-02-16'))).resolves.toBeUndefined();
    await expect(assertOperatingDate(db, date('2027-02-16'))).rejects.toThrow('operating day');
  });

  it('does not treat archived or non-trip events as field trips', async () => {
    await expect(
      assertRotaDate(dbWithTrip({ active: false, category: 'Trips' }), date('2027-02-16')),
    ).rejects.toThrow('planned field trips');
    await expect(
      assertFieldTripAttendanceDate(
        dbWithTrip({ active: true, category: 'Meetings' }),
        date('2027-02-16'),
      ),
    ).rejects.toThrow('planned field trip');
  });
});
