import type { CSSProperties } from 'react';
import {
  BookOpen,
  Code2,
  Drama,
  Dumbbell,
  Gamepad2,
  Landmark,
  Music,
  Palette,
  Puzzle,
  Shapes,
  Sparkles,
  Trophy,
} from 'lucide-react';

export const CLUB_ACCENTS = [
  '#7D3C98',
  '#1B2B5E',
  '#B45309',
  '#0E7490',
  '#0E5C3A',
  '#BE185D',
  '#4338CA',
  '#7D1C2C',
  '#9A3412',
  '#0F766E',
  '#2563EB',
  '#64748B',
] as const;

export const CLUB_ICON_OPTIONS = [
  { key: 'drama', label: 'Drama', Icon: Drama, keywords: ['drama', 'theatre', 'acting'] },
  { key: 'music', label: 'Music', Icon: Music, keywords: ['music', 'choir', 'singing', 'band'] },
  { key: 'sports', label: 'Sports', Icon: Dumbbell, keywords: ['sport', 'football', 'fitness'] },
  { key: 'art', label: 'Art', Icon: Palette, keywords: ['art', 'craft', 'paint', 'drawing'] },
  { key: 'chess', label: 'Chess', Icon: Puzzle, keywords: ['chess', 'strategy', 'board'] },
  { key: 'coding', label: 'Coding', Icon: Code2, keywords: ['code', 'coding', 'computing'] },
  { key: 'book', label: 'Reading', Icon: BookOpen, keywords: ['book', 'read', 'reading'] },
  { key: 'scripture', label: 'Scripture', Icon: Landmark, keywords: ['scripture', 'bible'] },
  { key: 'stem', label: 'STEM', Icon: Shapes, keywords: ['stem', 'science', 'maths'] },
  { key: 'games', label: 'Games', Icon: Gamepad2, keywords: ['game', 'games'] },
  { key: 'achievement', label: 'Achievement', Icon: Trophy, keywords: ['award', 'merit'] },
  { key: 'general', label: 'General', Icon: Sparkles, keywords: [] },
] as const;

export type ClubIconKey = (typeof CLUB_ICON_OPTIONS)[number]['key'];
export type ClubAccentColor = (typeof CLUB_ACCENTS)[number];

function hashValue(value: string): number {
  let total = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    total ^= value.charCodeAt(index);
    total = Math.imul(total, 16777619);
  }
  return total >>> 0;
}

export function isClubIconKey(value: string | null | undefined): value is ClubIconKey {
  return CLUB_ICON_OPTIONS.some((option) => option.key === value);
}

export function isClubAccentColor(value: string | null | undefined): value is ClubAccentColor {
  return CLUB_ACCENTS.some((accent) => accent === value);
}

export function randomClubAccent(): ClubAccentColor {
  return CLUB_ACCENTS[Math.floor(Math.random() * CLUB_ACCENTS.length)] ?? CLUB_ACCENTS[0];
}

function inferIconKey(club: { id: string; name: string }): ClubIconKey {
  const name = club.name.trim().toLowerCase();
  const keywordMatch = CLUB_ICON_OPTIONS.find((option) =>
    option.keywords.some((keyword) => name.includes(keyword)),
  );
  if (keywordMatch) return keywordMatch.key;
  return (
    CLUB_ICON_OPTIONS[hashValue(`${club.id}:${name}`) % CLUB_ICON_OPTIONS.length]?.key ?? 'general'
  );
}

export function clubVisual(club: {
  accentColor?: string | null;
  iconKey?: string | null;
  id: string;
  name: string;
}) {
  const name = club.name.trim();
  const words = name.split(/\s+/u).filter(Boolean);
  const initials =
    words.length >= 2 ? `${words[0]?.[0] ?? ''}${words[1]?.[0] ?? ''}` : name.slice(0, 2);
  const iconKey = isClubIconKey(club.iconKey) ? club.iconKey : inferIconKey(club);
  const option =
    CLUB_ICON_OPTIONS.find((candidate) => candidate.key === iconKey) ?? CLUB_ICON_OPTIONS[0];

  return {
    accent: isClubAccentColor(club.accentColor)
      ? club.accentColor
      : CLUB_ACCENTS[hashValue(`${club.id}:${club.name}`) % CLUB_ACCENTS.length] ?? CLUB_ACCENTS[0],
    Icon: option.Icon,
    iconKey,
    iconLabel: initials.toUpperCase() || 'CL',
  };
}

export function clubAccentStyle(club: {
  accentColor?: string | null;
  iconKey?: string | null;
  id: string;
  name: string;
}): CSSProperties {
  return { '--club-accent': clubVisual(club).accent } as CSSProperties;
}
