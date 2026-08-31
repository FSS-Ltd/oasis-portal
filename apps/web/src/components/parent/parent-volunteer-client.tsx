'use client';

import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { friendlyErrorMessage, showErrorToast, showSuccessToast } from '@/lib/notifications';
import { api, type RouterOutputs } from '@/lib/trpc';

type ParentVolunteerSlots = RouterOutputs['rota']['parentVolunteerSlots'];
type VolunteerDay = ParentVolunteerSlots['centreVolunteer']['days'][number];

const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
  weekday: 'short',
});

function formatDate(date: string): string {
  return dateFormatter.format(new Date(`${date}T00:00:00.000Z`));
}

function availabilityLabel(slot: VolunteerDay): string {
  if (slot.selected) return 'Your day';
  if (slot.status === 'Full') return 'Full';
  return `${String(slot.spacesRemaining)} ${slot.spacesRemaining === 1 ? 'space' : 'spaces'} left`;
}

function selectedDates(days: readonly VolunteerDay[]): Set<string> {
  return new Set(days.filter((day) => day.selected).map((day) => day.date));
}

function VolunteerDayButton({
  onToggle,
  pending,
  selected,
  showDate = true,
  slot,
}: {
  onToggle: (date: string) => void;
  pending: boolean;
  selected: boolean;
  showDate?: boolean;
  slot: VolunteerDay;
}) {
  const disabled = slot.status === 'Full' && !selected;
  return (
    <button
      aria-pressed={selected}
      className={`parent-volunteer-day${selected ? ' is-selected' : ''}${disabled ? ' is-full' : ''}`}
      disabled={disabled || pending}
      onClick={() => {
        onToggle(slot.date);
      }}
      type="button"
    >
      {showDate ? <strong>{formatDate(slot.date)}</strong> : null}
      <span>{selected ? 'Selected' : availabilityLabel(slot)}</span>
    </button>
  );
}

function VolunteerWeeks({
  days,
  onToggle,
  pending,
  selected,
}: {
  days: readonly VolunteerDay[];
  onToggle: (date: string) => void;
  pending: boolean;
  selected: ReadonlySet<string>;
}) {
  const weeks = useMemo(() => [days.slice(0, 7), days.slice(7)], [days]);

  return (
    <div className="parent-volunteer-weeks">
      {weeks.map((week, index) => (
        <section aria-label={`Volunteer week ${String(index + 1)}`} key={index}>
          <h3>Week {String(index + 1)}</h3>
          <div className="parent-volunteer-grid">
            {week.map((slot) => (
              <VolunteerDayButton
                key={slot.date}
                onToggle={onToggle}
                pending={pending}
                selected={selected.has(slot.date)}
                slot={slot}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function LunchAndClubsWeeks({
  primaryDays,
  primarySelectedDates,
  secondaryDays,
  secondarySelectedDates,
  onTogglePrimary,
  onToggleSecondary,
  pending,
}: {
  primaryDays: readonly VolunteerDay[];
  primarySelectedDates: ReadonlySet<string>;
  secondaryDays: readonly VolunteerDay[];
  secondarySelectedDates: ReadonlySet<string>;
  onTogglePrimary: (date: string) => void;
  onToggleSecondary: (date: string) => void;
  pending: boolean;
}) {
  const weeks = useMemo(
    () => [
      { primary: primaryDays.slice(0, 7), secondary: secondaryDays.slice(0, 7) },
      { primary: primaryDays.slice(7), secondary: secondaryDays.slice(7) },
    ],
    [primaryDays, secondaryDays],
  );

  return (
    <div className="parent-volunteer-weeks">
      {weeks.map((week, index) => (
        <section aria-label={`Lunch and clubs volunteer week ${String(index + 1)}`} key={index}>
          <h3>Week {String(index + 1)}</h3>
          <div className="parent-volunteer-lunch-grid">
            {week.primary.map((primarySlot, dayIndex) => {
              const secondarySlot = week.secondary[dayIndex];
              if (!secondarySlot) return null;
              const primarySelected = primarySelectedDates.has(primarySlot.date);
              const secondarySelected = secondarySelectedDates.has(secondarySlot.date);
              return (
                <article className="parent-volunteer-lunch-day" key={primarySlot.date}>
                  <strong>{formatDate(primarySlot.date)}</strong>
                  <div>
                    <span>Primary</span>
                    <VolunteerDayButton
                      onToggle={onTogglePrimary}
                      pending={pending}
                      selected={primarySelected}
                      showDate={false}
                      slot={primarySlot}
                    />
                  </div>
                  <div>
                    <span>Secondary</span>
                    <VolunteerDayButton
                      onToggle={onToggleSecondary}
                      pending={pending}
                      selected={secondarySelected}
                      showDate={false}
                      slot={secondarySlot}
                    />
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

export function ParentVolunteerClient() {
  const utils = api.useUtils();
  const slotsQuery = api.rota.parentVolunteerSlots.useQuery(undefined, { retry: false });
  const [centreDates, setCentreDates] = useState<Set<string>>(new Set());
  const [primaryLunchAndClubsDates, setPrimaryLunchAndClubsDates] = useState<Set<string>>(
    new Set(),
  );
  const [secondaryLunchAndClubsDates, setSecondaryLunchAndClubsDates] = useState<Set<string>>(
    new Set(),
  );

  useEffect(() => {
    if (!slotsQuery.data) return;
    setCentreDates(selectedDates(slotsQuery.data.centreVolunteer.days));
    setPrimaryLunchAndClubsDates(selectedDates(slotsQuery.data.lunchAndClubs.primary.days));
    setSecondaryLunchAndClubsDates(selectedDates(slotsQuery.data.lunchAndClubs.secondary.days));
  }, [slotsQuery.data]);

  const saveVolunteerDays = api.rota.setMyParentVolunteerDays.useMutation({
    onError: async (error) => {
      showErrorToast(error, 'Volunteer days could not be saved.');
      await utils.rota.parentVolunteerSlots.invalidate();
    },
    onSuccess: async () => {
      showSuccessToast('Your volunteer days have been saved.');
      await utils.rota.parentVolunteerSlots.invalidate();
    },
  });

  function toggleCentreDate(date: string): void {
    setCentreDates((current) => {
      const next = new Set(current);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  }

  function toggleLunchAndClubsDate(date: string, placement: 'primary' | 'secondary'): void {
    const updateSelection =
      placement === 'primary' ? setPrimaryLunchAndClubsDates : setSecondaryLunchAndClubsDates;
    const clearOtherSelection =
      placement === 'primary' ? setSecondaryLunchAndClubsDates : setPrimaryLunchAndClubsDates;
    updateSelection((current) => {
      const next = new Set(current);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
    clearOtherSelection((current) => {
      const next = new Set(current);
      next.delete(date);
      return next;
    });
  }

  const slots = slotsQuery.data;
  const centreSelectedDayCount = centreDates.size;
  const lunchAndClubsSelectedDayCount =
    primaryLunchAndClubsDates.size + secondaryLunchAndClubsDates.size;

  return (
    <section className="parent-volunteer-page" aria-labelledby="parent-volunteer-title">
      <div className="page-header">
        <div>
          <p>Oasis parent team</p>
          <h1 id="parent-volunteer-title">Volunteer at Oasis</h1>
          <p>Choose where you can help. Other parents&apos; choices stay private.</p>
        </div>
        <span className="badge badge--blue">
          <CalendarDays aria-hidden="true" size={14} />
          Rolling two weeks
        </span>
      </div>

      {slotsQuery.isLoading ? <div className="empty-state">Loading volunteer days...</div> : null}
      {slotsQuery.error ? (
        <p className="status--error">{friendlyErrorMessage(slotsQuery.error)}</p>
      ) : null}
      {slots ? (
        <>
          <section className="panel panel__body parent-volunteer-panel">
            <div className="section-title">
              <div>
                <p className="muted">Learning time</p>
                <h2>Centre Volunteer</h2>
                <p className="muted">
                  Support learning time. Two parent spaces are available each day.
                </p>
              </div>
              <span className="badge">{String(centreSelectedDayCount)} selected</span>
            </div>
            <p className="muted">
              {formatDate(slots.from)} - {formatDate(slots.to)} · Week three opens when this period
              reaches its second week.
            </p>
            <VolunteerWeeks
              days={slots.centreVolunteer.days}
              onToggle={toggleCentreDate}
              pending={saveVolunteerDays.isPending}
              selected={centreDates}
            />
          </section>

          <section className="panel panel__body parent-volunteer-panel">
            <div className="section-title">
              <div>
                <p className="muted">Daily cover</p>
                <h2>Lunch + Clubs</h2>
                <p className="muted">
                  Help during lunch and clubs. Choose either Primary or Secondary for each day.
                </p>
              </div>
              <span className="badge">{String(lunchAndClubsSelectedDayCount)} selected</span>
            </div>
            <div className="parent-volunteer-capacity-summary">
              <span>
                Primary · {String(slots.lunchAndClubs.primary.dailyCapacity)} spaces daily
              </span>
              <span>
                Secondary · {String(slots.lunchAndClubs.secondary.dailyCapacity)} spaces daily
              </span>
            </div>
            <LunchAndClubsWeeks
              onTogglePrimary={(date) => {
                toggleLunchAndClubsDate(date, 'primary');
              }}
              onToggleSecondary={(date) => {
                toggleLunchAndClubsDate(date, 'secondary');
              }}
              pending={saveVolunteerDays.isPending}
              primaryDays={slots.lunchAndClubs.primary.days}
              primarySelectedDates={primaryLunchAndClubsDates}
              secondaryDays={slots.lunchAndClubs.secondary.days}
              secondarySelectedDates={secondaryLunchAndClubsDates}
            />
          </section>

          {saveVolunteerDays.error ? (
            <p className="status--error">{friendlyErrorMessage(saveVolunteerDays.error)}</p>
          ) : null}
          <div className="row-actions">
            <Button
              onClick={() => {
                saveVolunteerDays.mutate({
                  centreDates: [...centreDates].sort(),
                  primaryLunchAndClubsDates: [...primaryLunchAndClubsDates].sort(),
                  secondaryLunchAndClubsDates: [...secondaryLunchAndClubsDates].sort(),
                });
              }}
              pending={saveVolunteerDays.isPending}
              type="button"
            >
              <Save aria-hidden="true" size={16} />
              Save volunteer days
            </Button>
          </div>
        </>
      ) : null}
    </section>
  );
}
