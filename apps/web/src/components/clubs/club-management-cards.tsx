'use client';

import { Plus, UserRound } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { accentStyle, capacityPercent, capacityText, type Club } from './club-management-model';
import { clubAccentStyle, clubVisual } from './club-visuals';

export function ClubStats({ clubs }: { clubs: readonly Club[] }) {
  const activeClubs = clubs.filter((club) => club.active);
  const totalCapacity = clubs.reduce((total, club) => total + (club.capacity ?? 0), 0);
  const totalMembers = clubs.reduce((total, club) => total + club.activeSignupCount, 0);
  const awaitingLead = activeClubs.filter((club) => club.assignedLeads.length === 0).length;
  const leadCount = new Set(clubs.flatMap((club) => club.assignedLeads.map((lead) => lead.id)))
    .size;

  return (
    <section className="admin-clubs-stats" aria-label="Clubs summary">
      <article className="admin-clubs-stat" style={accentStyle('var(--oasis-navy)')}>
        <span>Active clubs</span>
        <strong>{String(activeClubs.length)}</strong>
        <small>{String(totalCapacity)} capped places</small>
      </article>
      <article className="admin-clubs-stat" style={accentStyle('var(--oasis-blue)')}>
        <span>Students enrolled</span>
        <strong>{String(totalMembers)}</strong>
        <small>across all clubs</small>
      </article>
      <article className="admin-clubs-stat" style={accentStyle('var(--oasis-warning)')}>
        <span>Awaiting lead</span>
        <strong>{String(awaitingLead)}</strong>
        <small>{awaitingLead === 0 ? 'all active clubs led' : 'assign in Club Lead tab'}</small>
      </article>
      <article className="admin-clubs-stat" style={accentStyle('var(--oasis-crimson)')}>
        <span>Club leads</span>
        <strong>{String(leadCount)}</strong>
        <small>assigned users</small>
      </article>
    </section>
  );
}

export function ClubCard({ club, onOpen }: { club: Club; onOpen: (club: Club) => void }) {
  const visual = clubVisual(club);
  const ClubIcon = visual.Icon;
  const leadPreview = club.assignedLeads[0] ?? null;

  return (
    <article className={club.active ? 'admin-club-card' : 'admin-club-card is-inactive'}>
      <button
        className="admin-club-card__button"
        onClick={() => {
          onOpen(club);
        }}
        style={clubAccentStyle(club)}
        type="button"
      >
        <span className="admin-club-card__band">
          <span>
            <strong>{club.name}</strong>
            <small>{club.scheduleLabel ?? 'No schedule set'}</small>
          </span>
          <span className="admin-club-card__icon">
            <ClubIcon aria-hidden="true" size={28} />
          </span>
        </span>
        <span className="admin-club-card__body">
          <span className="admin-club-card__lead">
            {leadPreview ? (
              <>
                <Avatar name={leadPreview.fullName} />
                <span>
                  <strong>{leadPreview.fullName}</strong>
                  <small>
                    {club.assignedLeads.length === 1
                      ? 'Club Lead'
                      : `${String(club.assignedLeads.length)} assigned leads`}
                  </small>
                </span>
              </>
            ) : (
              <>
                <span className="admin-club-card__empty-avatar">
                  <UserRound aria-hidden="true" size={17} />
                </span>
                <span>
                  <strong>Assign a lead</strong>
                  <small>No lead assigned</small>
                </span>
              </>
            )}
          </span>
          <span className="admin-club-card__capacity">
            <span>
              <strong>{capacityText(club)}</strong>
              <small>{club.capacity === null ? 'No capacity cap' : 'Capacity'}</small>
            </span>
            <span className="admin-club-card__bar" aria-hidden="true">
              <span style={{ width: `${String(capacityPercent(club))}%` }} />
            </span>
          </span>
          {!club.active ? <Badge tone="grey">Inactive</Badge> : null}
        </span>
      </button>
    </article>
  );
}

export function CreateClubTile({ onCreate }: { onCreate: () => void }) {
  return (
    <button className="admin-club-create-tile" onClick={onCreate} type="button">
      <Plus aria-hidden="true" size={28} />
      <span>
        <strong>Create a new club</strong>
        <small>Set the weekly schedule and capacity</small>
      </span>
    </button>
  );
}
