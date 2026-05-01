const DEFAULT_AVATAR_COLOURS = [
  '#7C3F98',
  '#8B1E2D',
  '#0E7892',
  '#5B90C5',
  '#006B4A',
  '#B45309',
] as const;

export const SNAPSHOT_AVATAR_COLOURS = [
  '#5B90C5',
  '#7C3F98',
  '#16784F',
  '#B45309',
  '#8B1E2D',
  '#0E7892',
  '#4F46E5',
  '#C2185B',
  '#006B4A',
] as const;

export function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

export function firstName(name: string): string {
  return name.split(' ').filter(Boolean)[0] ?? name;
}

export function avatarColour(
  index: number,
  palette: readonly string[] = DEFAULT_AVATAR_COLOURS,
): string {
  return palette[index % palette.length] ?? DEFAULT_AVATAR_COLOURS[3];
}

export function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function formatGbDateTime(value: string | Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function formatGbTime(value: string | Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}
