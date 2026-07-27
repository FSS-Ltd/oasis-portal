import type { RouterOutputs } from '@/lib/trpc';

type LeadClub = RouterOutputs['club']['leadClubs'][number];
type BehaviourEntry = RouterOutputs['behaviour']['recentEntries']['entries'][number];

export type ClubsLeadTab = 'overview' | 'behaviour' | 'attendance' | 'noticeboard';

export const CLUBS_LEAD_TABS = ['overview', 'behaviour', 'attendance', 'noticeboard'] as const;

export const CLUBS_LEAD_TAB_LABELS: ReadonlyArray<readonly [ClubsLeadTab, string]> = [
  ['overview', 'Overview'],
  ['behaviour', 'Behaviour'],
  ['attendance', 'Attendance'],
  ['noticeboard', 'Noticeboard'],
];

const CLUB_ACCENTS = ['#7D3C98', '#1B2B5E', '#B45309', '#0E7490', '#0E5C3A', '#8B1E2D'] as const;
const CLUB_ICONS = ['🎭', '♟', '🎨', '✝', '🎵', '📚'] as const;

export function todayDate(): Date {
  return new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);
}

export function formatDateTime(value: Date | string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
  }).format(new Date(value));
}

export function clubVisual(club: Pick<LeadClub, 'name'>, index: number) {
  const lower = club.name.toLowerCase();
  const icon = lower.includes('chess')
    ? '♟'
    : lower.includes('drama')
      ? '🎭'
      : lower.includes('art')
        ? '🎨'
        : lower.includes('scripture')
          ? '✝'
          : CLUB_ICONS[index % CLUB_ICONS.length];
  return {
    accent: CLUB_ACCENTS[index % CLUB_ACCENTS.length] ?? '#0E5C3A',
    icon,
  };
}

export function parseTab(value: string | null): ClubsLeadTab {
  return CLUBS_LEAD_TABS.some((tab) => tab === value) ? (value as ClubsLeadTab) : 'overview';
}

export function entryTone(entry: Pick<BehaviourEntry, 'type'>): 'blue' | 'green' | 'red' {
  if (entry.type === 'Merit') return 'green';
  if (entry.type === 'Demerit') return 'red';
  return 'blue';
}

export function entryLabel(entry: Pick<BehaviourEntry, 'meritDelta' | 'type'>): string {
  if (entry.type === 'General') return 'General';
  return `${entry.meritDelta > 0 ? '+' : ''}${String(entry.meritDelta)} merits`;
}
