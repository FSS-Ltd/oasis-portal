'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Save } from 'lucide-react';
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

function datesInWindow(from: string, to: string): string[] {
  const current = new Date(`${from}T00:00:00.000Z`);
  const end = new Date(`${to}T00:00:00.000Z`);
  const dates: string[] = [];
  while (current.getTime() <= end.getTime()) {
    dates.push(current.toISOString().slice(0, 10));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
}

export function StaffLunchAndClubsVolunteerEditor() {
  const utils = api.useUtils();
  const volunteerDaysQuery = api.rota.myStaffLunchAndClubsVolunteerDays.useQuery(undefined, {
    retry: false,
  });
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());
  const selectedDatesWindow = useRef<string | null>(null);

  useEffect(() => {
    if (!volunteerDaysQuery.data) return;
    const windowKey = `${volunteerDaysQuery.data.from}:${volunteerDaysQuery.data.to}`;
    if (selectedDatesWindow.current === windowKey) return;
    setSelectedDates(new Set(volunteerDaysQuery.data.dates));
    selectedDatesWindow.current = windowKey;
  }, [volunteerDaysQuery.data]);

  const saveVolunteerDays = api.rota.setMyStaffLunchAndClubsVolunteerDays.useMutation({
    onError(error) {
      showErrorToast(error, 'Lunch and clubs cover days could not be saved.');
    },
    async onSuccess() {
      showSuccessToast('Lunch and clubs cover days have been saved.');
      await Promise.all([
        utils.rota.myStaffLunchAndClubsVolunteerDays.invalidate(),
        utils.rota.staffLunchAndClubsVolunteerSchedule.invalidate(),
      ]);
    },
  });

  const days = useMemo(() => {
    if (!volunteerDaysQuery.data) return [];
    return datesInWindow(volunteerDaysQuery.data.from, volunteerDaysQuery.data.to);
  }, [volunteerDaysQuery.data]);

  function toggleDate(date: string): void {
    setSelectedDates((current) => {
      const next = new Set(current);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  }

  return (
    <section className="panel panel__body staff-lunch-clubs-volunteer">
      <div className="section-title staff-lunch-clubs-volunteer__header">
        <div>
          <h2>Lunch + Clubs cover</h2>
          <p className="muted">Choose the days you can cover both lunch and clubs.</p>
        </div>
        <div className="staff-lunch-clubs-volunteer__actions">
          <span className="badge">{String(selectedDates.size)} selected</span>
          <Button
            onClick={() => {
              saveVolunteerDays.mutate({ dates: [...selectedDates].sort() });
            }}
            pending={saveVolunteerDays.isPending}
            size="sm"
            type="button"
          >
            <Save aria-hidden="true" size={16} />
            Save days
          </Button>
        </div>
      </div>

      {volunteerDaysQuery.isLoading ? (
        <div className="empty-state">Loading cover days...</div>
      ) : null}
      {volunteerDaysQuery.error ? (
        <p className="status--error">{friendlyErrorMessage(volunteerDaysQuery.error)}</p>
      ) : null}
      {saveVolunteerDays.error ? (
        <p className="status--error">{friendlyErrorMessage(saveVolunteerDays.error)}</p>
      ) : null}

      {days.length > 0 ? (
        <div className="staff-lunch-clubs-volunteer__days">
          {days.map((date) => {
            const selected = selectedDates.has(date);
            return (
              <button
                aria-pressed={selected}
                className={`staff-lunch-clubs-volunteer__day${selected ? ' is-selected' : ''}`}
                disabled={saveVolunteerDays.isPending}
                key={date}
                onClick={() => {
                  toggleDate(date);
                }}
                type="button"
              >
                <strong>{formatDate(date)}</strong>
                <span>{selected ? 'Covering' : 'Available'}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
