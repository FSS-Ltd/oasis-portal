'use client';

import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Plus, Save, Trash2 } from 'lucide-react';
import { api, type RouterOutputs } from '@/lib/trpc';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field, SelectInput, TextInput } from '@/components/ui/field';
import { friendlyErrorMessage, showErrorToast, showSuccessToast } from '@/lib/notifications';
import {
  addDays,
  dateFromKey,
  dateKey,
  formatDateLabel,
  formatTime,
  fromTimeValue,
  toTimeValue,
} from './club-schedule-utils';

type AccessClub = RouterOutputs['club']['myClubRotaAccess'][number];
type AvailabilityRow = RouterOutputs['club']['myClubAvailability'][number];

type AvailabilityDraft = {
  id: string;
  dayOfWeek: number;
  startMinute: number;
  endMinute: number;
};

interface MyClubRotaPanelProps {
  accessClubs?: readonly AccessClub[];
}

const weekdays = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
] as const;

function mondayFor(date: Date): Date {
  const day = date.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  return addDays(date, diff);
}

function emptyAvailabilityRow(): AvailabilityDraft {
  return {
    id: `draft_${String(Date.now())}_${Math.random().toString(36).slice(2)}`,
    dayOfWeek: 1,
    startMinute: 540,
    endMinute: 720,
  };
}

function mapAvailability(window: AvailabilityRow): AvailabilityDraft {
  return {
    id: window.id,
    dayOfWeek: window.dayOfWeek,
    startMinute: window.startMinute,
    endMinute: window.endMinute,
  };
}

function updateAvailabilityDraft(
  rows: readonly AvailabilityDraft[],
  id: string,
  patch: Partial<Pick<AvailabilityDraft, 'dayOfWeek' | 'endMinute' | 'startMinute'>>,
): AvailabilityDraft[] {
  return rows.map((row) => (row.id === id ? { ...row, ...patch } : row));
}

export function MyClubRotaPanel({ accessClubs }: MyClubRotaPanelProps = {}) {
  const utils = api.useUtils();
  const [weekStart, setWeekStart] = useState(() => mondayFor(dateFromKey(dateKey(new Date()))));
  const [selectedClubId, setSelectedClubId] = useState<string | null>(null);
  const [availabilityDraft, setAvailabilityDraft] = useState<AvailabilityDraft[]>([]);
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
  const availabilityQuery = api.club.myClubAvailability.useQuery(
    { clubId: selectedClub?.id ?? '' },
    { enabled: selectedClub !== null, retry: false },
  );
  const saveAvailability = api.club.setMyClubAvailability.useMutation();

  useEffect(() => {
    if (!selectedClubId && clubs[0]) {
      setSelectedClubId(clubs[0].id);
    }
  }, [clubs, selectedClubId]);

  useEffect(() => {
    if (!availabilityQuery.data) return;
    setAvailabilityDraft(availabilityQuery.data.map(mapAvailability));
  }, [availabilityQuery.data]);

  if (accessClubs === undefined && accessQuery.isLoading) {
    return <div className="empty-state">Loading club rota...</div>;
  }
  if (accessClubs === undefined && accessQuery.error) {
    return <p className="status--error">{friendlyErrorMessage(accessQuery.error)}</p>;
  }
  if (clubs.length === 0) return null;

  async function save() {
    if (!selectedClub) return;
    try {
      await saveAvailability.mutateAsync({
        clubId: selectedClub.id,
        windows: availabilityDraft.map(({ dayOfWeek, startMinute, endMinute }) => ({
          dayOfWeek,
          startMinute,
          endMinute,
        })),
      });
      showSuccessToast('Volunteer availability saved.');
      await utils.club.myClubAvailability.invalidate({ clubId: selectedClub.id });
    } catch (error) {
      showErrorToast(error, 'Availability could not be saved.');
    }
  }

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

        <section className="club-rota-panel">
          <div className="section-title">
            <h3>Volunteer availability</h3>
            <Button
              onClick={() => {
                setAvailabilityDraft((rows) => [...rows, emptyAvailabilityRow()]);
              }}
              size="sm"
              type="button"
              variant="secondary"
            >
              <Plus aria-hidden="true" size={14} />
              Add
            </Button>
          </div>
          <Field label="Club">
            <SelectInput
              onChange={(event) => {
                setSelectedClubId(event.target.value);
              }}
              value={selectedClub?.id ?? ''}
            >
              {clubs.map((club) => (
                <option key={club.id} value={club.id}>
                  {club.name}
                </option>
              ))}
            </SelectInput>
          </Field>
          {selectedClub?.scheduleLabel ? (
            <p className="muted">{selectedClub.scheduleLabel}</p>
          ) : null}
          {availabilityQuery.isLoading ? (
            <div className="empty-state">Loading availability...</div>
          ) : null}
          {availabilityQuery.error ? (
            <p className="status--error">{friendlyErrorMessage(availabilityQuery.error)}</p>
          ) : null}
          <div className="availability-editor">
            {availabilityDraft.length === 0 ? (
              <div className="empty-state">No availability set.</div>
            ) : (
              availabilityDraft.map((window) => (
                <div className="availability-editor__row" key={window.id}>
                  <Field label="Day">
                    <SelectInput
                      onChange={(event) => {
                        setAvailabilityDraft((rows) =>
                          updateAvailabilityDraft(rows, window.id, {
                            dayOfWeek: Number(event.target.value),
                          }),
                        );
                      }}
                      value={window.dayOfWeek}
                    >
                      {weekdays.map((day) => (
                        <option key={day.value} value={day.value}>
                          {day.label}
                        </option>
                      ))}
                    </SelectInput>
                  </Field>
                  <Field label="Start">
                    <TextInput
                      onChange={(event) => {
                        setAvailabilityDraft((rows) =>
                          updateAvailabilityDraft(rows, window.id, {
                            startMinute: fromTimeValue(event.target.value),
                          }),
                        );
                      }}
                      type="time"
                      value={toTimeValue(window.startMinute)}
                    />
                  </Field>
                  <Field label="End">
                    <TextInput
                      onChange={(event) => {
                        setAvailabilityDraft((rows) =>
                          updateAvailabilityDraft(rows, window.id, {
                            endMinute: fromTimeValue(event.target.value),
                          }),
                        );
                      }}
                      type="time"
                      value={toTimeValue(window.endMinute)}
                    />
                  </Field>
                  <Button
                    aria-label="Remove availability window"
                    onClick={() => {
                      setAvailabilityDraft((rows) => rows.filter((row) => row.id !== window.id));
                    }}
                    size="sm"
                    type="button"
                    variant="ghost"
                  >
                    <Trash2 aria-hidden="true" size={14} />
                  </Button>
                </div>
              ))
            )}
          </div>
          <Button
            onClick={() => {
              void save();
            }}
            pending={saveAvailability.isPending}
            type="button"
          >
            <Save aria-hidden="true" size={16} />
            Save availability
          </Button>
        </section>
      </div>
    </section>
  );
}
