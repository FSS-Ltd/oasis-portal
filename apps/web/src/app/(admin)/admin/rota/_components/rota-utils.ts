export const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

export type ShiftForm = {
  id: string | null;
  staffUserId: string;
  kind: 'Cover' | 'Meeting';
  yearGroupBandId: string;
  date: string;
  startsAt: string;
  endsAt: string;
  notes: string;
};

export type AvailabilityWindow = {
  dayOfWeek: number;
  startMinute: number;
  endMinute: number;
};

export type StaffAvailability = {
  id: string;
  fullName: string;
  role: string;
  availability: AvailabilityWindow[];
};

export type MonthlyAvailabilityWindow = {
  id: string;
  date: string;
  startMinute: number;
  endMinute: number;
};

export type StaffMonthlyAvailability = {
  id: string;
  fullName: string;
  role: string;
  availability: MonthlyAvailabilityWindow[];
};

export type RotaAvailabilityBadge = {
  id: string;
  label: string;
  detail: string;
};

export type RotaDayAvailabilitySummary = {
  date: string;
  available: RotaAvailabilityBadge[];
  unavailable: RotaAvailabilityBadge[];
};

export type RotaShift = {
  id: string;
  staffUserId: string;
  kind: 'Cover' | 'Meeting';
  yearGroupBandId: string | null;
  date: string;
  startsAt: Date;
  endsAt: Date;
  notes: string | null;
  bandName: string | null;
  bandColour: string | null;
  staff: { fullName: string; email: string; role: string } | null;
};

export type ParentVolunteerDay = {
  id: string;
  date: string;
  placement: 'Centre' | 'LunchAndClubsPrimary' | 'LunchAndClubsSecondary';
  parent: { id: string; fullName: string };
};

export type StaffLunchAndClubsVolunteerDay = {
  id: string;
  date: string;
  staff: { id: string; fullName: string };
};

export function parentVolunteerPlacementLabel(placement: ParentVolunteerDay['placement']): string {
  switch (placement) {
    case 'LunchAndClubsPrimary':
      return 'Lunch + Clubs · Primary';
    case 'LunchAndClubsSecondary':
      return 'Lunch + Clubs · Secondary';
    default:
      return 'Centre Volunteer';
  }
}

export const emptyShiftForm: ShiftForm = {
  id: null,
  staffUserId: '',
  kind: 'Cover',
  yearGroupBandId: '',
  date: '',
  startsAt: '09:00',
  endsAt: '12:00',
  notes: '',
};

export function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function today(): Date {
  return new Date(`${dateKey(new Date())}T00:00:00.000Z`);
}

export function mondayFor(date: Date): Date {
  const base = new Date(`${dateKey(date)}T00:00:00.000Z`);
  const day = base.getUTCDay();
  const offset = day === 0 ? -6 : 1 - day;
  base.setUTCDate(base.getUTCDate() + offset);
  return base;
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function formatDateLabel(date: Date): string {
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

export function formatDateTime(value: Date): string {
  return value.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  });
}

export function formatMinute(minute: number): string {
  const hours = Math.floor(minute / 60);
  const minutes = minute % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function asDateTime(date: string, time: string): Date {
  return new Date(`${date}T${time}:00.000Z`);
}

export function shiftToForm(shift: RotaShift): ShiftForm {
  return {
    id: shift.id,
    staffUserId: shift.staffUserId,
    kind: shift.kind,
    yearGroupBandId: shift.yearGroupBandId ?? '',
    date: shift.date,
    startsAt: formatDateTime(shift.startsAt),
    endsAt: formatDateTime(shift.endsAt),
    notes: shift.notes ?? '',
  };
}

export function availabilityLabel(window: AvailabilityWindow): string {
  const dayLabel = dayLabels[window.dayOfWeek] ?? 'Unknown';
  return `${dayLabel} ${availabilityTimeLabel(window)}`;
}

export function availabilityTimeLabel(window: AvailabilityWindow): string {
  return `${formatMinute(window.startMinute)}-${formatMinute(window.endMinute)}`;
}

export function monthlyUnavailabilityTimeLabel(window: MonthlyAvailabilityWindow): string {
  if (window.startMinute === 0 && window.endMinute === 1440) {
    return 'all day';
  }
  return `from ${formatMinute(window.startMinute)} to ${formatMinute(window.endMinute)}`;
}

export function monthlyUnavailabilityLabel(window: MonthlyAvailabilityWindow): string {
  return `${formatDateLabel(new Date(`${window.date}T00:00:00.000Z`))} ${monthlyUnavailabilityTimeLabel(
    window,
  )}`;
}
