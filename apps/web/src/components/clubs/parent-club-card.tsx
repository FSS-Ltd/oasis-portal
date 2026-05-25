'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { CheckCircle2, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { RouterOutputs } from '@/lib/trpc';
import { clubAccentStyle, clubVisual } from './club-visuals';

export type ParentClub = RouterOutputs['club']['linkedChildSignupContext']['clubs'][number];

function capacityText(club: ParentClub): string {
  if (club.capacity === null) return `${String(club.activeSignupCount)} members`;
  return `${String(club.activeSignupCount)} / ${String(club.capacity)} members`;
}

function capacityPercent(club: ParentClub): number {
  if (club.capacity === null || club.capacity <= 0) return 0;
  return Math.min(100, Math.round((club.activeSignupCount / club.capacity) * 100));
}

function isClubFull(club: ParentClub): boolean {
  return club.capacity !== null && club.activeSignupCount >= club.capacity;
}

function familySignupText(club: ParentClub): string {
  const count = club.signedUpStudentIds.length;
  if (count === 0) return 'No linked children signed up';
  if (count === 1) return '1 linked child signed up';
  return `${String(count)} linked children signed up`;
}

function statusLabel(club: ParentClub, selectedChildId?: string | null): string {
  if (selectedChildId && club.signedUpStudentIds.includes(selectedChildId)) return 'Signed up';
  if (club.signedUpStudentIds.length > 0) return 'In your family';
  if (isClubFull(club)) return 'Full';
  return 'Open';
}

function statusTone(
  club: ParentClub,
  selectedChildId?: string | null,
): 'amber' | 'green' | 'grey' {
  if (selectedChildId && club.signedUpStudentIds.includes(selectedChildId)) return 'green';
  if (club.signedUpStudentIds.length > 0) return 'green';
  if (isClubFull(club)) return 'grey';
  return 'amber';
}

interface ParentClubCardProps {
  actionMode?: boolean;
  club: ParentClub;
  disabled?: boolean;
  href?: Route;
  onSignUp?: (club: ParentClub) => void;
  onWithdraw?: (club: ParentClub) => void;
  pending?: boolean;
  selectedChildId?: string | null;
}

export function ParentClubCard({
  actionMode = false,
  club,
  disabled = false,
  href,
  onSignUp,
  onWithdraw,
  pending = false,
  selectedChildId = null,
}: ParentClubCardProps) {
  const visual = clubVisual(club);
  const ClubIcon = visual.Icon;
  const signedUp = selectedChildId ? club.signedUpStudentIds.includes(selectedChildId) : false;
  const full = isClubFull(club);
  const cannotSignUp = disabled || full;
  const content = (
    <>
      <div className="parent-club-card__band">
        <span className="parent-club-card__title">
          <strong>{club.name}</strong>
          <small>{club.scheduleLabel ?? 'No schedule set'}</small>
        </span>
        <Badge tone={statusTone(club, selectedChildId)}>
          {statusLabel(club, selectedChildId)}
        </Badge>
        <span className="parent-club-card__icon" aria-hidden="true">
          <ClubIcon size={28} />
        </span>
      </div>

      <div className="parent-club-card__body">
        <div className="parent-club-card__copy">
          <strong>{familySignupText(club)}</strong>
          {club.description ? <p>{club.description}</p> : <p>Club details will appear here.</p>}
        </div>

        <div className="parent-club-card__capacity">
          <span>
            <strong>{capacityText(club)}</strong>
            <small>{club.capacity === null ? 'No capacity cap' : 'Capacity'}</small>
          </span>
          <span className="parent-club-card__bar" aria-hidden="true">
            <span style={{ width: `${String(capacityPercent(club))}%` }} />
          </span>
        </div>

        {actionMode ? (
          <div className="parent-club-card__actions club-card__actions">
            {signedUp ? (
              <Button
                onClick={() => {
                  onWithdraw?.(club);
                }}
                pending={pending}
                type="button"
                variant="danger"
              >
                <XCircle aria-hidden="true" size={16} />
                Withdraw
              </Button>
            ) : (
              <Button
                disabled={cannotSignUp}
                onClick={() => {
                  onSignUp?.(club);
                }}
                pending={pending}
                type="button"
              >
                <CheckCircle2 aria-hidden="true" size={16} />
                Sign Up
              </Button>
            )}
          </div>
        ) : null}
      </div>
    </>
  );

  if (href && !actionMode) {
    return (
      <Link
        aria-label={`View ${club.name} details`}
        className="parent-club-card parent-club-card--link linked-club-card"
        href={href}
        style={clubAccentStyle(club)}
      >
        {content}
      </Link>
    );
  }

  return (
    <article className="parent-club-card linked-club-card" style={clubAccentStyle(club)}>
      {content}
    </article>
  );
}
