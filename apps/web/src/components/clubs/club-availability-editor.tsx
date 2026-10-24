'use client';

import { useState } from 'react';
import { Plus, Save, Trash2 } from 'lucide-react';
import { api, type RouterOutputs } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Field, SelectInput, TextInput } from '@/components/ui/field';
import { friendlyErrorMessage, showErrorToast, showSuccessToast } from '@/lib/notifications';
import { fromTimeValue, toTimeValue } from './club-schedule-utils';

type AccessClub = RouterOutputs['club']['myClubRotaAccess'][number];
type AvailabilityRow = RouterOutputs['club']['myClubAvailability'][number];

type AvailabilityDraft = {
  id: string;
  dayOfWeek: number;
  startMinute: number;
  endMinute: number;
};

const weekdays = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
] as const;

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

export function ClubAvailabilityEditor({
  clubs,
  selectedClub,
  onClubChange,
}: {
  clubs: readonly AccessClub[];
  selectedClub: AccessClub;
  onClubChange: (id: string) => void;
}) {
  const utils = api.useUtils();
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<AvailabilityDraft[] | null>(null);
  const availabilityQuery = api.club.myClubAvailability.useQuery(
    { clubId: selectedClub.id },
    { retry: false },
  );
  const saveAvailability = api.club.setMyClubAvailability.useMutation();
  const savedAvailability = (availabilityQuery.data ?? []).map(mapAvailability);
  const availabilityDraft = draft ?? savedAvailability;
  function setAvailabilityDraft(update: (rows: AvailabilityDraft[]) => AvailabilityDraft[]) {
    setDraft((current) => update(current ?? savedAvailability));
  }

  async function save() {
    setSaving(true);
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
      setDraft(null);
    } catch (error) {
      showErrorToast(error, 'Availability could not be saved.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="club-rota-panel">
      <div className="section-title">
        <h3>Volunteer availability</h3>
        <Button
          disabled={saving || saveAvailability.isPending || availabilityQuery.isLoading}
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
            onClubChange(event.target.value);
          }}
          value={selectedClub.id}
        >
          {clubs.map((club) => (
            <option key={club.id} value={club.id}>
              {club.name}
            </option>
          ))}
        </SelectInput>
      </Field>
      {selectedClub.scheduleLabel ? <p className="muted">{selectedClub.scheduleLabel}</p> : null}
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
                  disabled={saving || saveAvailability.isPending}
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
                  disabled={saving || saveAvailability.isPending}
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
                  disabled={saving || saveAvailability.isPending}
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
                disabled={saving || saveAvailability.isPending || availabilityQuery.isLoading}
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
        disabled={saving || saveAvailability.isPending || availabilityQuery.isLoading}
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
  );
}
