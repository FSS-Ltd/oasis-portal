'use client';

import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { friendlyErrorMessage, showErrorToast, showSuccessToast } from '@/lib/notifications';
import { api } from '@/lib/trpc';

const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
  weekday: 'short',
});

function formatDate(date: string): string {
  return dateFormatter.format(new Date(`${date}T00:00:00.000Z`));
}

function availabilityLabel(slot: {
  selected: boolean;
  spacesRemaining: number;
  status: 'Available' | 'Full' | 'Selected';
}): string {
  if (slot.selected) return 'Your day';
  if (slot.status === 'Full') return 'Full';
  return `${String(slot.spacesRemaining)} ${slot.spacesRemaining === 1 ? 'space' : 'spaces'} left`;
}

export function ParentVolunteerClient() {
  const utils = api.useUtils();
  const slotsQuery = api.rota.parentVolunteerSlots.useQuery(undefined, { retry: false });
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!slotsQuery.data) return;
    setSelectedDates(
      new Set(slotsQuery.data.days.filter((slot) => slot.selected).map((slot) => slot.date)),
    );
  }, [slotsQuery.data]);

  const selectedDayCount = selectedDates.size;
  const weeks = useMemo(() => {
    const days = slotsQuery.data?.days ?? [];
    return [days.slice(0, 7), days.slice(7)];
  }, [slotsQuery.data?.days]);
  const saveVolunteerDays = api.rota.setMyParentVolunteerDays.useMutation({
    onError: async (error) => {
      showErrorToast(error, 'Volunteer days could not be saved.');
      await utils.rota.parentVolunteerSlots.invalidate();
    },
    onSuccess: async (result) => {
      setSelectedDates(
        new Set(result.days.filter((slot) => slot.selected).map((slot) => slot.date)),
      );
      showSuccessToast('Your volunteer days have been saved.');
      await utils.rota.parentVolunteerSlots.invalidate();
    },
  });

  function toggleDate(date: string): void {
    setSelectedDates((current) => {
      const next = new Set(current);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  }

  return (
    <section className="parent-volunteer-page" aria-labelledby="parent-volunteer-title">
      <div className="page-header">
        <div>
          <p>Oasis parent team</p>
          <h1 id="parent-volunteer-title">Volunteer at Oasis</h1>
          <p>
            Choose the full days you can serve. Each day has two parent volunteer spaces, and other
            parents&apos; choices stay private.
          </p>
        </div>
        <span className="badge badge--blue">
          <CalendarDays aria-hidden="true" size={14} />
          Rolling two weeks
        </span>
      </div>

      <section className="panel panel__body parent-volunteer-panel">
        {slotsQuery.isLoading ? <div className="empty-state">Loading volunteer days...</div> : null}
        {slotsQuery.error ? (
          <p className="status--error">{friendlyErrorMessage(slotsQuery.error)}</p>
        ) : null}
        {slotsQuery.data ? (
          <>
            <div className="section-title">
              <div>
                <h2>
                  {formatDate(slotsQuery.data.from)} - {formatDate(slotsQuery.data.to)}
                </h2>
                <p className="muted">
                  Week three becomes available when this period reaches its second week.
                </p>
              </div>
              <span className="badge">{String(selectedDayCount)} selected</span>
            </div>

            <div className="parent-volunteer-weeks">
              {weeks.map((week, index) => (
                <section aria-label={`Volunteer week ${String(index + 1)}`} key={index}>
                  <h3>Week {String(index + 1)}</h3>
                  <div className="parent-volunteer-grid">
                    {week.map((slot) => {
                      const selected = selectedDates.has(slot.date);
                      const disabled = slot.status === 'Full' && !selected;
                      return (
                        <button
                          aria-pressed={selected}
                          className={`parent-volunteer-day${selected ? ' is-selected' : ''}${disabled ? ' is-full' : ''}`}
                          disabled={disabled || saveVolunteerDays.isPending}
                          key={slot.date}
                          onClick={() => {
                            toggleDate(slot.date);
                          }}
                          type="button"
                        >
                          <strong>{formatDate(slot.date)}</strong>
                          <span>{selected ? 'Selected' : availabilityLabel(slot)}</span>
                        </button>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>

            {saveVolunteerDays.error ? (
              <p className="status--error">{friendlyErrorMessage(saveVolunteerDays.error)}</p>
            ) : null}
            <div className="row-actions">
              <Button
                onClick={() => {
                  saveVolunteerDays.mutate({ dates: [...selectedDates].sort() });
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
    </section>
  );
}
