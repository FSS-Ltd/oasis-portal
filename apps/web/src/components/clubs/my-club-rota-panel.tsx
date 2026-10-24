'use client';

import { useEffect, useMemo, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { api, type RouterOutputs } from '@/lib/trpc';
import { ClubAvailabilityEditor } from './club-availability-editor';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { friendlyErrorMessage } from '@/lib/notifications';
import { addDays, dateFromKey, dateKey, formatDateLabel, formatTime } from './club-schedule-utils';

type AccessClub = RouterOutputs['club']['myClubRotaAccess'][number];
interface MyClubRotaPanelProps {
  accessClubs?: readonly AccessClub[];
}

function mondayFor(date: Date): Date {
  const day = date.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  return addDays(date, diff);
}

export function MyClubRotaPanel({ accessClubs }: MyClubRotaPanelProps = {}) {
  const [weekStart, setWeekStart] = useState(() => mondayFor(dateFromKey(dateKey(new Date()))));
  const [selectedClubId, setSelectedClubId] = useState<string | null>(null);
  const accessQuery = api.club.myClubRotaAccess.useQuery(undefined, {
    enabled: accessClubs === undefined,
    retry: false,
  });
  const clubs = accessClubs ?? accessQuery.data ?? [];
  const selectedClub: AccessClub | null =
    clubs.find((club) => club.id === selectedClubId) ?? clubs[0] ?? null;
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)),
    [weekStart],
  );
  const weekEnd = weekDays[6] ?? weekStart;
  const rotaQuery = api.club.myClubRota.useQuery(
    { from: weekStart, to: weekEnd },
    { enabled: clubs.length > 0, retry: false },
  );
  useEffect(() => {
    if (!selectedClubId && clubs[0]) {
      setSelectedClubId(clubs[0].id);
    }
  }, [clubs, selectedClubId]);

  if (accessClubs === undefined && accessQuery.isLoading) {
    return <div className="empty-state">Loading club rota...</div>;
  }
  if (accessClubs === undefined && accessQuery.error) {
    return <p className="status--error">{friendlyErrorMessage(accessQuery.error)}</p>;
  }
  if (clubs.length === 0) return null;

  return (
    <section className="panel panel__body my-club-rota-panel" aria-labelledby="my-club-rota-title">
      <div className="section-title">
        <div>
          <p className="muted">Volunteer cover</p>
          <h2 id="my-club-rota-title">My Club Rota</h2>
        </div>
        <Badge tone="blue">
          <CalendarDays aria-hidden="true" size={14} />
          {String(clubs.length)}
        </Badge>
      </div>

      <div className="club-rota-grid">
        <section className="club-rota-panel">
          <div className="section-title">
            <h3>Scheduled cover</h3>
            <div className="row-actions">
              <Button
                onClick={() => {
                  setWeekStart((current) => addDays(current, -7));
                }}
                size="sm"
                type="button"
                variant="secondary"
              >
                Previous
              </Button>
              <Button
                onClick={() => {
                  setWeekStart((current) => addDays(current, 7));
                }}
                size="sm"
                type="button"
                variant="secondary"
              >
                Next
              </Button>
            </div>
          </div>
          <p className="muted">
            {formatDateLabel(weekStart)} - {formatDateLabel(weekEnd)}
          </p>
          {rotaQuery.isLoading ? <div className="empty-state">Loading rota...</div> : null}
          {rotaQuery.error ? (
            <p className="status--error">{friendlyErrorMessage(rotaQuery.error)}</p>
          ) : null}
          <div className="linked-clubs-list">
            {(rotaQuery.data ?? []).length === 0 ? (
              <div className="empty-state">No cover scheduled for this week.</div>
            ) : (
              (rotaQuery.data ?? []).map((shift) => (
                <article className="club-notification-history__item" key={shift.id}>
                  <span>
                    <strong>{shift.clubName ?? 'Club'}</strong>
                    <small>
                      {shift.date} · {formatTime(shift.startsAt)}-{formatTime(shift.endsAt)}
                    </small>
                    {shift.notes ? <small>{shift.notes}</small> : null}
                  </span>
                </article>
              ))
            )}
          </div>
        </section>

        {selectedClub ? (
          <ClubAvailabilityEditor
            key={selectedClub.id}
            clubs={clubs}
            selectedClub={selectedClub}
            onClubChange={setSelectedClubId}
          />
        ) : null}
      </div>
    </section>
  );
}
