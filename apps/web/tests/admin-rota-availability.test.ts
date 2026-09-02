import assert from 'node:assert/strict';
import test from 'node:test';
import { buildStaffAvailabilityByDay } from '../src/app/(admin)/admin/rota/_components/rota-availability-utils.ts';
import type {
  StaffAvailability,
  StaffMonthlyAvailability,
} from '../src/app/(admin)/admin/rota/_components/rota-utils.ts';

test('removes partial monthly absences from weekly availability before planning cover', () => {
  const staffAvailability: StaffAvailability[] = [
    {
      id: 'supervisor-1',
      fullName: 'Supervisor One',
      role: 'Supervisor',
      availability: [{ dayOfWeek: 3, startMinute: 9 * 60, endMinute: 17 * 60 }],
    },
  ];
  const staffMonthlyAvailability: StaffMonthlyAvailability[] = [
    {
      id: 'supervisor-1',
      fullName: 'Supervisor One',
      role: 'Supervisor',
      availability: [
        { id: 'absence-1', date: '2026-09-02', startMinute: 9 * 60, endMinute: 12 * 60 },
      ],
    },
  ];

  const [wednesday] = buildStaffAvailabilityByDay({
    staffAvailability,
    staffMonthlyAvailability,
    weekDays: [new Date('2026-09-02T00:00:00.000Z')],
  });

  assert.deepEqual(wednesday?.available, [
    {
      detail: '12:00-17:00',
      id: 'supervisor-1-3-720-1020',
      label: 'Supervisor One',
    },
  ]);
  assert.deepEqual(wednesday?.unavailable, [
    {
      detail: 'from 09:00 to 12:00',
      id: 'supervisor-1-absence-1',
      label: 'Supervisor One',
    },
  ]);
});
