import type { TimetableColour, TimetableDay } from '@oasis/domain';

const termDateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

export function formatMinutes(minutes: number): string {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function minutesFromTime(value: string): number {
  const [hourText, minuteText] = value.split(':');
  return Number(hourText) * 60 + Number(minuteText);
}

export function formatTermDates(startsOn: Date | string, endsOn: Date | string): string {
  return `${termDateFormatter.format(new Date(startsOn))} – ${termDateFormatter.format(new Date(endsOn))}`;
}

export function timetableCellKey(day: TimetableDay, slotId: string): string {
  return `${day}:${slotId}`;
}

export function colourLabel(colour: TimetableColour): string {
  return colour.replace(/([a-z])([A-Z])/gu, '$1 $2');
}
