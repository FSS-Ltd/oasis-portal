import type {
  AvailabilityWindow,
  RotaDayAvailabilitySummary,
  StaffAvailability,
  StaffMonthlyAvailability,
} from './rota-utils';

type MinuteRange = Pick<AvailabilityWindow, 'endMinute' | 'startMinute'>;

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatMinute(minute: number): string {
  const hours = Math.floor(minute / 60);
  const minutes = minute % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function availabilityTimeLabel(window: MinuteRange): string {
  return `${formatMinute(window.startMinute)}-${formatMinute(window.endMinute)}`;
}

function monthlyUnavailabilityTimeLabel(window: MinuteRange): string {
  if (window.startMinute === 0 && window.endMinute === 1440) {
    return 'all day';
  }
  return `from ${formatMinute(window.startMinute)} to ${formatMinute(window.endMinute)}`;
}

function subtractUnavailableRanges(
  availability: AvailabilityWindow,
  unavailableRanges: readonly MinuteRange[],
): MinuteRange[] {
  return [...unavailableRanges]
    .sort((left, right) => left.startMinute - right.startMinute)
    .reduce<MinuteRange[]>(
      (availableRanges, unavailable) =>
        availableRanges.flatMap((available) => {
          if (
            unavailable.endMinute <= available.startMinute ||
            unavailable.startMinute >= available.endMinute
          ) {
            return [available];
          }

          const remaining: MinuteRange[] = [];
          if (unavailable.startMinute > available.startMinute) {
            remaining.push({
              startMinute: available.startMinute,
              endMinute: unavailable.startMinute,
            });
          }
          if (unavailable.endMinute < available.endMinute) {
            remaining.push({
              startMinute: unavailable.endMinute,
              endMinute: available.endMinute,
            });
          }
          return remaining;
        }),
      [{ startMinute: availability.startMinute, endMinute: availability.endMinute }],
    );
}

export function buildStaffAvailabilityByDay({
  staffAvailability,
  staffMonthlyAvailability,
  weekDays,
}: {
  staffAvailability: readonly StaffAvailability[];
  staffMonthlyAvailability: readonly StaffMonthlyAvailability[];
  weekDays: readonly Date[];
}): RotaDayAvailabilitySummary[] {
  return weekDays.map((day) => {
    const date = dateKey(day);
    const dayOfWeek = day.getUTCDay();
    const unavailable = staffMonthlyAvailability.flatMap((staff) =>
      staff.availability
        .filter((window) => window.date === date)
        .map((window) => ({
          id: `${staff.id}-${window.id}`,
          label: staff.fullName,
          detail: monthlyUnavailabilityTimeLabel(window),
        })),
    );

    return {
      date,
      available: staffAvailability.flatMap((staff) => {
        const unavailableRanges = (
          staffMonthlyAvailability.find((candidate) => candidate.id === staff.id)?.availability ??
          []
        )
          .filter((window) => window.date === date)
          .map(({ endMinute, startMinute }) => ({ endMinute, startMinute }));

        return staff.availability
          .filter((window) => window.dayOfWeek === dayOfWeek)
          .flatMap((window) =>
            subtractUnavailableRanges(window, unavailableRanges).map((range) => ({
              id: `${staff.id}-${String(window.dayOfWeek)}-${String(range.startMinute)}-${String(
                range.endMinute,
              )}`,
              label: staff.fullName,
              detail: availabilityTimeLabel({ ...window, ...range }),
            })),
          );
      }),
      unavailable,
    };
  });
}
